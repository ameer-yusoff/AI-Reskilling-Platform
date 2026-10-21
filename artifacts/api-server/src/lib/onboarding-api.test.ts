import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { db, pool, profilesTable, usersTable, insightsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { hashPassword, issueToken } from "./auth";
import { RIASEC_QUESTIONS } from "../data/riasec";

// Integration fixtures are explicitly test data, not a substitute for a RunPod response.
let server: Server, base: string;
const userIds: number[] = [], profileIds: number[] = [];
const guest = randomUUID().replaceAll("-", "");
const stranger = randomUUID().replaceAll("-", "");
const answers = RIASEC_QUESTIONS.map((q) => ({ questionId: q.id, value: q.type === "S" ? 5 : 3 }));
async function request(path: string, method = "GET", data?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { "content-type": "application/json", "x-guest-token": guest, ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  // Heterogeneous test endpoints: assertions below validate each expected envelope.
  const body: any = response.status === 204 ? null : await response.json();
  return { status: response.status, body };
}
before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  if (profileIds.length) await db.delete(profilesTable).where(inArray(profilesTable.id, profileIds));
  if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await pool.end();
});
async function draft(segment: "worker" | "graduate") {
  const result = await request("/profiles", "POST", { name: "TEST ONLY Draft", segment, weeklyHours: 1, budgetMyr: 0 });
  assert.equal(result.status, 201);
  profileIds.push(result.body.id);
  return result.body.id as number;
}
async function extractedFixture(id: number) {
  await db.update(profilesTable).set({
    cvExtractionKey: `TEST-ONLY-${id}`, cvText: "TEST ONLY CV: Diploma. Programming and communication.",
    cvFileName: "test-only.txt", onboardingStep: "review",
    cvEvidence: [{ field: "name", value: "TEST ONLY Person", quote: "TEST ONLY Person", source: "user_cv" }],
  }).where(eq(profilesTable.id, id));
}

test("both individual paths validate prerequisites, preserve state and reject cross-guest access", async () => {
  for (const segment of ["worker", "graduate"] as const) {
    const id = await draft(segment);
    assert.equal((await request(`/profiles/${id}`, "GET", undefined, { "x-guest-token": stranger })).status, 404);
    assert.equal((await request(`/profiles/${id}`, "PATCH", { onboardingStep: "results" })).status, 400);
    assert.equal((await request(`/profiles/${id}/cv`, "POST", { fileName: "cv.txt", contentBase64: "", consent: false })).body.error, "cv_consent_required");
    assert.equal((await request(`/profiles/${id}/cv`, "POST", { fileName: "cv.txt", contentBase64: "", consent: true })).body.error, "cv_empty");
    assert.equal((await request(`/profiles/${id}/cv`, "POST", { fileName: "cv.docx", contentBase64: Buffer.from("broken").toString("base64"), consent: true })).body.error, "cv_unreadable");
    await extractedFixture(id);
    const verified = await request(`/profiles/${id}`, "PATCH", {
      name: "TEST ONLY Person", education: "Diploma", experience: "", goals: "Learn programming",
      weeklyHours: 4, budgetMyr: 120, hrdcEligibilityStatus: "unknown", verified: true, onboardingStep: "holland",
    });
    assert.equal(verified.status, 200); assert.equal(verified.body.hrdcEligibilityStatus, "unknown");
    assert.equal(verified.body.hrdcEligible, false);
    assert.equal((await request(`/profiles/${id}/riasec`, "POST", { answers: [...answers, answers[0]] })).status, 400);
    const scored = await request(`/profiles/${id}/riasec`, "POST", { answers });
    assert.equal(scored.body.riasecCode, "SRI"); assert.equal(scored.body.riasecScores.S, 5);
    assert.deepEqual((await request(`/profiles/${id}`)).body.riasecAnswers, answers);
    assert.equal((await request(`/profiles/${id}`, "PATCH", { onboardingStep: "results" })).status, 200);
    assert.equal((await request(`/profiles/${id}`, "PATCH", { onboardingStep: "complete" })).status, 401);
    const changed = await request(`/profiles/${id}`, "PATCH", { riasecAnswers: answers.map((a, i) => i ? a : { ...a, value: 1 }) });
    assert.equal(changed.body.riasecScores, null);
    assert.equal(changed.body.riasecCode, null);
    assert.equal(changed.body.onboardingStep, "holland");
    await request(`/profiles/${id}/riasec`, "POST", { answers });
    const same = await request(`/profiles/${id}`, "PATCH", { riasecAnswers: [...answers].reverse() });
    assert.equal(same.body.riasecCode, "SRI");
  }
});

test("register then existing login claims guest profiles and dependent evidence/answers once", async () => {
  const id = await draft("graduate"); await extractedFixture(id);
  await db.insert(insightsTable).values({ profileId: id, agent: "cv", lang: "en", inputHash: "test-only", content: "TEST ONLY insight", sources: [], model: "test-fixture" });
  const email = `walkthrough-${randomUUID()}@example.invalid`, password = "Test-only-password123";
  const registered = await request("/auth/register", "POST", { name: "TEST ONLY Account", email, password });
  assert.equal(registered.status, 201); userIds.push(registered.body.user.id);
  const owner = registered.body.user.id;
  assert.equal((await request(`/profiles/${id}`)).status, 404);
  const auth = { authorization: `Bearer ${registered.body.token}` };
  assert.equal((await request(`/profiles/${id}`, "GET", undefined, auth)).body.isGuest, false);
  assert.equal((await request(`/profiles/${id}/insights`, "GET", undefined, auth)).body[0].content, "TEST ONLY insight");
  const more = await draft("worker"); await extractedFixture(more);
  const logged = await request("/auth/login", "POST", { email, password, role: "individual" });
  assert.equal(logged.body.claimedProfiles, 1);
  assert.equal((await request("/auth/login", "POST", { email, password, role: "individual" })).body.claimedProfiles, 0);
  const [row] = await db.select().from(profilesTable).where(eq(profilesTable.id, more));
  assert.equal(row.ownerUserId, owner); assert.equal(row.guestToken, null); assert.ok(row.cvEvidence.length);
});

test("Employee and Educators cannot see each other or individual CV organisation names", async () => {
  const organization = `TEST-ORG-${randomUUID()}`, tokens: Record<string, string> = {}, ids: Record<string, number> = {};
  for (const role of ["hr", "tvet", "individual"] as const) {
    const [u] = await db.insert(usersTable).values({ name: "TEST ONLY", email: `${role}-${randomUUID()}@example.invalid`, role, organization: role === "individual" ? null : organization, passwordHash: await hashPassword("Test-only-password123") }).returning();
    userIds.push(u.id); tokens[role] = issueToken(u.id);
    const [p] = await db.insert(profilesTable).values({ name: `TEST ONLY ${role}`, segment: "worker", ownerUserId: u.id, organization, weeklyHours: 1, budgetMyr: 0 }).returning();
    profileIds.push(p.id); ids[role] = p.id;
  }
  for (const role of ["hr", "tvet"]) {
    const headers = { authorization: `Bearer ${tokens[role]}` };
    const own = await request("/profiles", "GET", undefined, headers);
    assert.deepEqual(own.body.map((p: { id: number }) => p.id), [ids[role]]);
    const other = role === "hr" ? "tvet" : "hr";
    assert.equal((await request(`/profiles/${ids[other]}`, "GET", undefined, headers)).status, 404);
    assert.equal((await request(`/profiles/${ids.individual}`, "GET", undefined, headers)).status, 404);
    assert.equal((await request("/cohort/summary", "GET", undefined, headers)).body.profileCount, 1);
  }
});
