import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import {
  db,
  pool,
  profilesTable,
  predictionsTable,
  insightsTable,
  labourMonthlyTable,
  aiUsageTable,
  aiUsageOverallTable,
  marketSourcesTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import app from "../app";
import { consumeAiRequest } from "./ai-rate-limit";
import { hashInput, type AgentName, type Lang } from "./agents";
import { loadCourses, loadRoles, loadSkills, roleToApi } from "./catalog";
import { profileToApi } from "./profiles";
import { scoreRole } from "./scoring";

let server: Server;
let base: string;
const profileIds: number[] = [];
const predictionIds: number[] = [];
const originalGuestLimit = process.env.AI_REQUEST_LIMIT_GUEST;

before(async () => {
  process.env.AI_REQUEST_LIMIT_GUEST = "1";
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  if (predictionIds.length) {
    await db.delete(predictionsTable).where(eq(predictionsTable.id, predictionIds[0]!));
    for (const id of predictionIds.slice(1)) await db.delete(predictionsTable).where(eq(predictionsTable.id, id));
  }
  if (profileIds.length) {
    for (const id of profileIds) await db.delete(profilesTable).where(eq(profilesTable.id, id));
  }
  if (originalGuestLimit === undefined) delete process.env.AI_REQUEST_LIMIT_GUEST;
  else process.env.AI_REQUEST_LIMIT_GUEST = originalGuestLimit;
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await pool.end();
});

function newGuestToken() {
  return randomUUID().replaceAll("-", "");
}

async function request(path: string, guestToken: string, data: unknown) {
  const response = await fetch(`${base}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-guest-token": guestToken },
    body: JSON.stringify(data),
  });
  return {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    body: await response.json() as Record<string, any>,
  };
}

async function insertCachedPrediction(guestToken: string) {
  const input = { question: "How will demand change?", horizonYears: 3, lang: "en" as const };
  const [labour, groups, overall, sources] = await Promise.all([
    db.select().from(labourMonthlyTable).orderBy(desc(labourMonthlyTable.date)).limit(24),
    db.select().from(aiUsageTable).where(and(eq(aiUsageTable.level, 1), eq(aiUsageTable.geo, "MYS"))),
    db.select().from(aiUsageOverallTable),
    db.select().from(marketSourcesTable),
  ]);
  const ctx: Record<string, unknown> = {
    pasaranBuruhMalaysia: labour.reverse().map((l) => ({
      tarikh: l.date,
      kadarPengangguran: l.unemploymentRate,
      kadarPenyertaan: l.participationRate,
      bekerjaRibu: l.employedThousands,
    })),
    indeksPenggunaanAi: overall.map((o) => ({
      geo: o.geo,
      indeksPerKapita: o.usagePerCapitaIndex,
      tempoh: o.period,
    })),
    penggunaanAiMalaysiaIkutKumpulan: groups
      .sort((a, b) => b.pct - a.pct)
      .map((g) => ({ kumpulan: g.title, peratus: g.pct })),
  };
  const inputHash = hashInput(input.question.toLowerCase(), input.horizonYears, null, input.lang, ctx);
  const [row] = await db.insert(predictionsTable).values({
    roleId: null,
    roleTitle: null,
    question: input.question,
    horizonYears: input.horizonYears,
    lang: input.lang,
    ownerUserId: null,
    guestToken,
    inputHash,
    content: "TEST ONLY cached prediction",
    sources: [],
    model: "test-fixture",
  }).returning();
  predictionIds.push(row!.id);
  return input;
}

async function insertCachedProfilerInsight(guestToken: string) {
  const [profileRow] = await db.insert(profilesTable).values({
    name: "TEST ONLY Route Cache Profile",
    segment: "worker",
    currentRole: null,
    goals: null,
    weeklyHours: 4,
    budgetMyr: 100,
    ownerUserId: null,
    guestToken,
  }).returning();
  profileIds.push(profileRow!.id);

  const [skills, roles, courses] = await Promise.all([loadSkills(), loadRoles(), loadCourses()]);
  const profile = profileToApi(profileRow!, skills);
  const matches = roles
    .map((role) => ({ role: roleToApi(role), ...scoreRole(profileRow!, role, skills, courses) }))
    .sort((a, b) => b.score - a.score);
  const top = matches.slice(0, 5).map((m) => ({
    title: m.role.title,
    score: m.score,
    breakdown: m.breakdown,
    gaps: m.gapSkills.map((g) => g.name),
    aiExposure: m.role.aiExposure,
    aiUsagePctMy: m.role.aiUsagePctMy,
    marketDemand: m.marketDemand,
  }));
  const ctx: Record<string, unknown> = {
    profil: {
      nama: profile.name,
      segmen: profile.segment,
      peranan: profile.currentRole,
      matlamat: profile.goals,
      jamSeminggu: profile.weeklyHours,
      bajetMyr: profile.budgetMyr,
      layakHrdc: profile.hrdcEligible,
    },
    kemahiran: profile.skills.map((s) => ({ nama: s.name, status: s.status })),
    riasec: null,
    padananTeratas: top,
    nota: "aiExposure 0-1 ialah pendedahan AI yang diperhatikan; aiUsagePctMy ialah peratus penggunaan AI di Malaysia bagi pekerjaan itu.",
  };
  const agent: AgentName = "profiler";
  const lang: Lang = "en";
  const inputHash = hashInput(agent, lang, ctx);
  await db.insert(insightsTable).values({
    profileId: profileRow!.id,
    agent,
    lang,
    inputHash,
    content: "TEST ONLY cached profile insight",
    sources: [],
    model: "test-fixture",
  });
  return profileRow!.id;
}

test("prediction and profile insight cache hits are served at quota without spending another request", async () => {
  const predictionGuest = newGuestToken();
  const predictionBody = await insertCachedPrediction(predictionGuest);
  assert.equal(consumeAiRequest("guest", predictionGuest).allowed, true);

  const prediction = await request("/predictions", predictionGuest, predictionBody);
  assert.equal(prediction.status, 201);
  assert.equal(prediction.body.cached, true);
  assert.equal(prediction.body.content, "TEST ONLY cached prediction");
  assert.equal(consumeAiRequest("guest", predictionGuest).allowed, false, "cached prediction must not consume another generation request");

  const insightGuest = newGuestToken();
  const profileId = await insertCachedProfilerInsight(insightGuest);
  assert.equal(consumeAiRequest("guest", insightGuest).allowed, true);

  const insight = await request(`/profiles/${profileId}/insights`, insightGuest, { agent: "profiler" });
  assert.equal(insight.status, 200);
  assert.equal(insight.body.cached, true);
  assert.equal(insight.body.content, "TEST ONLY cached profile insight");
  assert.equal(consumeAiRequest("guest", insightGuest).allowed, false, "cached insight must not consume another generation request");
});

test("rate-limited prediction returns Retry-After and a readable explanation", async () => {
  const guestToken = newGuestToken();
  assert.equal(consumeAiRequest("guest", guestToken).allowed, true);

  const result = await request("/predictions", guestToken, {
    question: "TEST ONLY uncached question",
    horizonYears: 2,
  });
  assert.equal(result.status, 429);
  assert.ok(Number(result.retryAfter) > 0);
  assert.equal(result.body.error, "ai_rate_limited");
  assert.match(result.body.message, /request limit.*try again/i);
  assert.equal(result.body.retryAfterSeconds, Number(result.retryAfter));
});
