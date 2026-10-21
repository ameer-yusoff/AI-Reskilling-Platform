import { Router, type IRouter } from "express";
import { db, profilesTable, plansTable, insightsTable, rolesTable, type StoredProfileSkill } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  ListProfilesQueryParams,
  CreateProfileBody,
  GetProfileParams,
  UpdateProfileBody,
  UploadCvBody,
  SubmitRiasecBody,
  CreateProfilePlanBody,
  RunProfileAgentBody,
} from "@workspace/api-zod";
import { loadCourses, loadRoles, loadSkills, roleToApi } from "../lib/catalog";
import { extractCvText, extractSkills, CvError } from "../lib/cv";
import { RIASEC_QUESTIONS, type RiasecType } from "../data/riasec";
import { scoreRole } from "../lib/scoring";
import { buildPlan } from "../lib/planner";
import { canAccessProfile, getLatestPlan, getProfileRow, planToApi, profileScope, profileToApi, type ProfileRow } from "../lib/profiles";
import { agentPrompt, agentTier, hashInput, SOURCE_AEI, type AgentName, type Lang } from "../lib/agents";
import { chat, AiNotConnectedError, AiTimeoutError } from "../lib/llm";
import { consumeAiRequest } from "../lib/ai-rate-limit";
import { SDG_TARGETS } from "../data/courses";

const router: IRouter = Router();

router.get("/profiles", async (req, res) => {
  const q = ListProfilesQueryParams.parse(req.query);
  const conds = [profileScope(req)];
  if (q.segment) conds.push(eq(profilesTable.segment, q.segment));
  if (q.organization) conds.push(eq(profilesTable.organization, q.organization));
  const [rows, skills] = await Promise.all([
    db.select().from(profilesTable).where(and(...conds)).orderBy(desc(profilesTable.createdAt)),
    loadSkills(),
  ]);
  res.json(rows.map((r) => profileToApi(r, skills)));
});

router.post("/profiles", async (req, res) => {
  const body = CreateProfileBody.parse(req.body);
  const u = req.user;
  const isOrg = u && (u.role === "hr" || u.role === "tvet");
  if (!u && !req.guestToken) {
    res.status(400).json({ error: "guest_token_required" });
    return;
  }
  const [row] = await db
    .insert(profilesTable)
    .values({
      name: body.name,
      segment: body.segment,
      currentRole: body.currentRole ?? null,
      organization: isOrg ? u.organization : body.organization?.trim() || null,
      ownerUserId: u ? u.id : null,
      guestToken: u ? null : req.guestToken!,
      goals: body.goals ?? null,
      weeklyHours: body.weeklyHours,
      budgetMyr: body.budgetMyr,
      hrdcEligible: body.hrdcEligible ?? false,
    })
    .returning();
  res.status(201).json(profileToApi(row, await loadSkills()));
});

async function requireProfile(id: number, req: import("express").Request, res: import("express").Response): Promise<ProfileRow | null> {
  const p = await getProfileRow(id);
  if (!p || !canAccessProfile(req, p)) {
    res.status(404).json({ error: "profile_not_found" });
    return null;
  }
  return p;
}

router.get("/profiles/:id", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  res.json(profileToApi(p, await loadSkills()));
});

router.patch("/profiles/:id", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = UpdateProfileBody.parse(req.body);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  let skills: StoredProfileSkill[] = p.skills;
  if (body.removeSkillIds?.length) skills = skills.filter((s) => !body.removeSkillIds!.includes(s.skillId));
  for (const add of body.addSkills ?? []) {
    const existing = skills.find((s) => s.skillId === add.skillId);
    if (existing) existing.status = add.status;
    else skills.push({ skillId: add.skillId, status: add.status, evidence: null });
  }
  const { addSkills: _a, removeSkillIds: _r, organization: orgIn, ...rest } = body;
  const isOrg = req.user && (req.user.role === "hr" || req.user.role === "tvet");
  const organization = isOrg ? undefined : orgIn;
  const [row] = await db
    .update(profilesTable)
    .set({ ...rest, ...(organization !== undefined ? { organization: organization.trim() || null } : {}), skills })
    .where(eq(profilesTable.id, id))
    .returning();
  res.json(profileToApi(row, await loadSkills()));
});

router.delete("/profiles/:id", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.status(204).end();
});

router.post("/profiles/:id/cv", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = UploadCvBody.parse(req.body);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  let text: string;
  try {
    text = await extractCvText(body.fileName, body.contentBase64);
  } catch (err) {
    if (err instanceof CvError) {
      res.status(400).json({ error: "cv_unreadable", detail: err.message });
      return;
    }
    req.log.error({ err }, "CV parse failed");
    res.status(400).json({ error: "cv_unreadable" });
    return;
  }
  const allSkills = await loadSkills();
  const extracted = extractSkills(text, allSkills);
  // Keep manual (self_reported) skills; replace previous CV-derived ones.
  const manual = p.skills.filter((s) => s.status === "self_reported" && !extracted.some((e) => e.skillId === s.skillId));
  const [row] = await db
    .update(profilesTable)
    .set({ cvText: text, cvFileName: body.fileName, cvUploadedAt: new Date(), skills: [...extracted, ...manual] })
    .where(eq(profilesTable.id, id))
    .returning();
  req.log.info({ profileId: id, skills: extracted.length }, "CV processed (file discarded)");
  res.json(profileToApi(row, allSkills));
});

router.get("/riasec/questions", (_req, res) => {
  res.json(RIASEC_QUESTIONS);
});

router.post("/profiles/:id/riasec", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = SubmitRiasecBody.parse(req.body);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  const sums: Record<RiasecType, number[]> = { R: [], I: [], A: [], S: [], E: [], C: [] };
  for (const a of body.answers) {
    const q = RIASEC_QUESTIONS.find((x) => x.id === a.questionId);
    if (q) sums[q.type].push(a.value);
  }
  const answered = Object.values(sums).reduce((a, v) => a + v.length, 0);
  if (answered < 18) {
    res.status(400).json({ error: "riasec_incomplete" });
    return;
  }
  const scores = Object.fromEntries(
    (Object.keys(sums) as RiasecType[]).map((k) => [k, sums[k].length ? Math.round((sums[k].reduce((a, b) => a + b, 0) / sums[k].length) * 100) / 100 : 1]),
  ) as Record<RiasecType, number>;
  const order: RiasecType[] = ["R", "I", "A", "S", "E", "C"];
  const code = [...order].sort((a, b) => scores[b] - scores[a] || order.indexOf(a) - order.indexOf(b)).slice(0, 3).join("");
  const [row] = await db.update(profilesTable).set({ riasecScores: scores, riasecCode: code }).where(eq(profilesTable.id, id)).returning();
  res.json(profileToApi(row, await loadSkills()));
});

async function computeMatches(p: ProfileRow) {
  const [roles, skills, courses] = await Promise.all([loadRoles(), loadSkills(), loadCourses()]);
  return roles
    .map((role) => ({ role: roleToApi(role), ...scoreRole(p, role, skills, courses) }))
    .sort((a, b) => b.score - a.score);
}

router.get("/profiles/:id/matches", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  res.json(await computeMatches(p));
});

router.get("/profiles/:id/plan", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  const plan = await getLatestPlan(id);
  res.json(plan ? planToApi(plan) : null);
});

router.post("/profiles/:id/plan", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const { roleId } = CreateProfilePlanBody.parse(req.body);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  const [roles, skills, courses] = await Promise.all([loadRoles(), loadSkills(), loadCourses()]);
  const role = roles.find((r) => r.id === roleId);
  if (!role) {
    res.status(404).json({ error: "role_not_found" });
    return;
  }
  const { gapSkills } = scoreRole(p, role, skills, courses);
  const plan = buildPlan({ gaps: gapSkills, courses, budgetMyr: p.budgetMyr, weeklyHours: p.weeklyHours, hrdcEligible: p.hrdcEligible });
  const [row] = await db
    .insert(plansTable)
    .values({ profileId: id, roleId, roleTitle: role.title, ...plan })
    .returning();
  await db.update(profilesTable).set({ targetRoleId: roleId }).where(eq(profilesTable.id, id));
  res.status(201).json(planToApi(row));
});

router.get("/profiles/:id/insights", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  const rows = await db.select().from(insightsTable).where(eq(insightsTable.profileId, id)).orderBy(desc(insightsTable.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(`${r.agent}|${r.lang}`)) latest.set(`${r.agent}|${r.lang}`, r);
  res.json([...latest.values()].map((r) => ({ ...insightToApi(r), cached: true })));
});

function insightToApi(r: typeof insightsTable.$inferSelect) {
  return {
    id: r.id,
    agent: r.agent as AgentName,
    lang: r.lang as Lang,
    content: r.content,
    sources: r.sources,
    model: r.model,
    cached: false,
    createdAt: r.createdAt.toISOString(),
  };
}

router.post("/profiles/:id/insights", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = RunProfileAgentBody.parse(req.body);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  const agent = body.agent as AgentName;
  const lang: Lang = body.lang ?? "en";
  const skills = await loadSkills();
  const profile = profileToApi(p, skills);
  const matches = await computeMatches(p);
  const top = matches.slice(0, 5).map((m) => ({
    title: m.role.title,
    score: m.score,
    breakdown: m.breakdown,
    gaps: m.gapSkills.map((g) => g.name),
    aiExposure: m.role.aiExposure,
    aiUsagePctMy: m.role.aiUsagePctMy,
    marketDemand: m.marketDemand,
  }));
  const targetId = body.roleId ?? p.targetRoleId;
  const [targetRole] = targetId ? await db.select().from(rolesTable).where(eq(rolesTable.id, targetId)) : [];
  const plan = await getLatestPlan(id);
  const planView = plan ? planToApi(plan) : null;

  const base = {
    profil: { nama: profile.name, segmen: profile.segment, peranan: profile.currentRole, matlamat: profile.goals, jamSeminggu: profile.weeklyHours, bajetMyr: profile.budgetMyr, layakHrdc: profile.hrdcEligible },
    kemahiran: profile.skills.map((s) => ({ nama: s.name, status: s.status })),
  };
  const ctx: Record<string, unknown> = { ...base };
  const sources = [{ ...SOURCE_AEI }];
  if (agent === "cv") {
    if (!p.cvText) {
      res.status(400).json({ error: "cv_required" });
      return;
    }
    ctx["teksCv"] = p.cvText.slice(0, 12000);
    ctx["kemahiranDikesan"] = profile.skills.map((s) => ({ nama: s.name, bukti: s.evidence }));
  }
  if (agent === "holland") {
    if (!p.riasecScores) {
      res.status(400).json({ error: "riasec_required" });
      return;
    }
    ctx["riasec"] = { skor: p.riasecScores, kod: p.riasecCode };
    ctx["padananTeratas"] = top;
  }
  if (agent === "profiler" || agent === "fitter") {
    ctx["riasec"] = p.riasecScores ? { skor: p.riasecScores, kod: p.riasecCode } : null;
    ctx["padananTeratas"] = top;
    ctx["nota"] = "aiExposure 0-1 ialah pendedahan AI yang diperhatikan; aiUsagePctMy ialah peratus penggunaan AI di Malaysia bagi pekerjaan itu.";
  }
  if (agent === "planner" || agent === "sdg") {
    if (!planView) {
      res.status(400).json({ error: "plan_required" });
      return;
    }
    ctx["pelan"] = planView;
    if (agent === "sdg") ctx["sasaranSdg"] = SDG_TARGETS;
  }
  if (targetRole) ctx["peranSasaran"] = targetRole.title;

  const inputHash = hashInput(agent, lang, ctx);
  if (!body.refresh) {
    const [cached] = await db
      .select()
      .from(insightsTable)
      .where(and(eq(insightsTable.profileId, id), eq(insightsTable.agent, agent), eq(insightsTable.lang, lang), eq(insightsTable.inputHash, inputHash)))
      .orderBy(desc(insightsTable.createdAt))
      .limit(1);
    if (cached) {
      res.json({ ...insightToApi(cached), cached: true });
      return;
    }
  }
  const rateLimit = consumeAiRequest(req.user ? "user" : "guest", req.user ? String(req.user.id) : req.guestToken!);
  res.setHeader("X-RateLimit-Limit", String(rateLimit.limit));
  res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({
      error: "ai_rate_limited",
      message: "You've reached the AI request limit. Please try again after the retry period.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }
  try {
    const { system, user } = agentPrompt(agent, ctx, lang);
    const out = await chat(agentTier(agent), system, user);
    const [row] = await db
      .insert(insightsTable)
      .values({ profileId: id, agent, lang, inputHash, content: out.content, sources, model: out.model })
      .returning();
    res.json(insightToApi(row));
  } catch (err) {
    if (err instanceof AiNotConnectedError) {
      res.status(503).json({ error: "ai_not_connected" });
      return;
    }
    req.log.error({ err, agent }, "Agent run failed");
    res.status(502).json({ error: err instanceof AiTimeoutError ? "ai_timeout" : "ai_failed" });
  }
});

export default router;
