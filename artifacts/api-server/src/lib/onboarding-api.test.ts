import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { db, pool, profilesTable, usersTable, insightsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { hashPassword, issueToken } from "./auth";
import { RIASEC_QUESTIONS } from "../data/riasec";
import { imageOnlyCvPdf, syntheticCvJpeg, syntheticCvText } from "./test-cv-fixtures";

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

test("image and scanned-PDF CV uploads use one vision call, save sourced text, and discard image bytes", async () => {
  const envKeys = ["RUNPOD_API_KEY", "RUNPOD_LLM_ENDPOINT_ID", "RUNPOD_LIGHT_ENDPOINT_ID", "RUNPOD_LLM_MODEL", "RUNPOD_LIGHT_MODEL"] as const;
  const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const savedFetch = globalThis.fetch;
  process.env["RUNPOD_API_KEY"] = "test-only-key";
  process.env["RUNPOD_LLM_ENDPOINT_ID"] = "test-only-vision-endpoint";
  delete process.env["RUNPOD_LIGHT_ENDPOINT_ID"];
  delete process.env["RUNPOD_LLM_MODEL"];
  delete process.env["RUNPOD_LIGHT_MODEL"];

  let chatCalls = 0;
  const syntheticResponse = {
    imagePages: [{ pageNumber: 1, text: syntheticCvText }],
    profile: {
      name: { value: "Kiran Example", quote: "Name: Kiran Example" },
      currentRole: { value: "Data Analyst", quote: "Current role: Data Analyst" },
      organization: { value: "Sample Research Lab", quote: "Organization: Sample Research Lab" },
      education: { value: "Diploma in Data Analytics", quote: "Education: Diploma in Data Analytics" },
      experience: { value: "Prepared monthly reports for operations teams.", quote: "Experience: Prepared monthly reports for operations teams." },
    },
  };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "qwen/qwen3.5-27b" }] }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/chat/completions")) {
      chatCalls++;
      const payload = JSON.parse(String(init?.body)) as { messages: { role: string; content: unknown }[] };
      const content = payload.messages[1]?.content;
      assert.ok(Array.isArray(content));
      assert.equal(content.filter((part: { type?: string }) => part.type === "image_url").length, 1);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(syntheticResponse) } }] }), { headers: { "Content-Type": "application/json" } });
    }
    return savedFetch(input, init);
  };

  try {
    const imageBase64 = syntheticCvJpeg().toString("base64");
    const uploads = [
      { fileName: "sample.jpg", contentBase64: imageBase64, lang: "en" },
      { fileName: "sample.jpg", contentBase64: imageBase64, lang: "ms" },
      { fileName: "sample.jpg", contentBase64: imageBase64, lang: "zh" },
      { fileName: "scanned.pdf", contentBase64: imageOnlyCvPdf().toString("base64"), lang: "zh" },
    ];
    for (const upload of uploads) {
      const token = randomUUID().replaceAll("-", "");
      const created = await request("/profiles", "POST", { name: "TEST ONLY Draft", segment: "worker", weeklyHours: 1, budgetMyr: 0 }, { "x-guest-token": token });
      assert.equal(created.status, 201);
      const id = created.body.id as number;
      profileIds.push(id);
      const result = await request(`/profiles/${id}/cv`, "POST", { ...upload, consent: true }, { "x-guest-token": token });
      assert.equal(result.status, 200);
      assert.equal(result.body.name, "Kiran Example");
      assert.equal(result.body.currentRole, "Data Analyst");
      assert.ok(result.body.cvEvidence.some((entry: { field: string; quote: string | null; source: string }) =>
        entry.field === "education" && entry.quote === "Education: Diploma in Data Analytics" && entry.source === "user_cv"));
      assert.equal(JSON.stringify(result.body).includes(imageBase64), false);
      const [stored] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
      assert.ok(stored.cvText?.includes("Experience: Prepared monthly reports for operations teams."));
      assert.equal(JSON.stringify(stored).includes(imageBase64), false);
    }
    assert.equal(chatCalls, uploads.length);
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of envKeys) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
