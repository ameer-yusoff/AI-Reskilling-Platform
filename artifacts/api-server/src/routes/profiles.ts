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
import { getLatestPlan, getProfileRow, planToApi, profileToApi, type ProfileRow } from "../lib/profiles";
import { agentPrompt, agentTier, hashInput, SOURCE_AEI, type AgentName } from "../lib/agents";
import { chat, AiNotConnectedError } from "../lib/llm";
import { SDG_TARGETS } from "../data/courses";

const router: IRouter = Router();

router.get("/profiles", async (req, res) => {
  const q = ListProfilesQueryParams.parse(req.query);
  const conds = [];
  if (q.segment) conds.push(eq(profilesTable.segment, q.segment));
  if (q.organization) conds.push(eq(profilesTable.organization, q.organization));
  const [rows, skills] = await Promise.all([
    db.select().from(profilesTable).where(conds.length ? and(...conds) : undefined).orderBy(desc(profilesTable.createdAt)),
    loadSkills(),
  ]);
  res.json(rows.map((r) => profileToApi(r, skills)));
});

router.post("/profiles", async (req, res) => {
  const body = CreateProfileBody.parse(req.body);
  const [row] = await db
    .insert(profilesTable)
    .values({
      name: body.name,
      segment: body.segment,
      currentRole: body.currentRole ?? null,
      organization: body.organization?.trim() || null,
      goals: body.goals ?? null,
      weeklyHours: body.weeklyHours,
      budgetMyr: body.budgetMyr,
      hrdcEligible: body.hrdcEligible ?? false,
    })
    .returning();
  res.status(201).json(profileToApi(row, await loadSkills()));
});

async function requireProfile(id: number, res: import("express").Response): Promise<ProfileRow | null> {
  const p = await getProfileRow(id);
  if (!p) {
    res.status(404).json({ error: "Profil tidak dijumpai" });
    return null;
  }
  return p;
}

router.get("/profiles/:id", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, res);
  if (!p) return;
  res.json(profileToApi(p, await loadSkills()));
});

router.patch("/profiles/:id", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = UpdateProfileBody.parse(req.body);
  const p = await requireProfile(id, res);
  if (!p) return;
  let skills: StoredProfileSkill[] = p.skills;
  if (body.removeSkillIds?.length) skills = skills.filter((s) => !body.removeSkillIds!.includes(s.skillId));
  for (const add of body.addSkills ?? []) {
    const existing = skills.find((s) => s.skillId === add.skillId);
    if (existing) existing.status = add.status;
    else skills.push({ skillId: add.skillId, status: add.status, evidence: null });
  }
  const { addSkills: _a, removeSkillIds: _r, organization, ...rest } = body;
  const [row] = await db
    .update(profilesTable)
    .set({ ...rest, ...(organization !== undefined ? { organization: organization.trim() || null } : {}), skills })
    .where(eq(profilesTable.id, id))
    .returning();
  res.json(profileToApi(row, await loadSkills()));
});

router.delete("/profiles/:id", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.status(204).end();
});

router.post("/profiles/:id/cv", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = UploadCvBody.parse(req.body);
  const p = await requireProfile(id, res);
  if (!p) return;
  let text: string;
  try {
    text = await extractCvText(body.fileName, body.contentBase64);
  } catch (err) {
    if (err instanceof CvError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "CV parse failed");
    res.status(400).json({ error: "Fail tidak dapat dibaca" });
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
  const p = await requireProfile(id, res);
  if (!p) return;
  const sums: Record<RiasecType, number[]> = { R: [], I: [], A: [], S: [], E: [], C: [] };
  for (const a of body.answers) {
    const q = RIASEC_QUESTIONS.find((x) => x.id === a.questionId);
    if (q) sums[q.type].push(a.value);
  }
  const answered = Object.values(sums).reduce((a, v) => a + v.length, 0);
  if (answered < 18) {
    res.status(400).json({ error: "Jawab sekurang-kurangnya 18 soalan" });
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
  const p = await requireProfile(id, res);
  if (!p) return;
  res.json(await computeMatches(p));
});

router.get("/profiles/:id/plan", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const p = await requireProfile(id, res);
  if (!p) return;
  const plan = await getLatestPlan(id);
  res.json(plan ? planToApi(plan) : null);
});

router.post("/profiles/:id/plan", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const { roleId } = CreateProfilePlanBody.parse(req.body);
  const p = await requireProfile(id, res);
  if (!p) return;
  const [roles, skills, courses] = await Promise.all([loadRoles(), loadSkills(), loadCourses()]);
  const role = roles.find((r) => r.id === roleId);
  if (!role) {
    res.status(404).json({ error: "Peranan tidak dijumpai" });
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
  const rows = await db.select().from(insightsTable).where(eq(insightsTable.profileId, id)).orderBy(desc(insightsTable.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.agent)) latest.set(r.agent, r);
  res.json([...latest.values()].map((r) => ({ ...insightToApi(r), cached: true })));
});

function insightToApi(r: typeof insightsTable.$inferSelect) {
  return {
    id: r.id,
    agent: r.agent as AgentName,
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
  const p = await requireProfile(id, res);
  if (!p) return;
  const agent = body.agent as AgentName;
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
      res.status(400).json({ error: "Muat naik CV dahulu" });
      return;
    }
    ctx["teksCv"] = p.cvText.slice(0, 12000);
    ctx["kemahiranDikesan"] = profile.skills.map((s) => ({ nama: s.name, bukti: s.evidence }));
  }
  if (agent === "holland") {
    if (!p.riasecScores) {
      res.status(400).json({ error: "Lengkapkan ujian RIASEC dahulu" });
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
      res.status(400).json({ error: "Jana pelan dahulu" });
      return;
    }
    ctx["pelan"] = planView;
    if (agent === "sdg") ctx["sasaranSdg"] = SDG_TARGETS;
  }
  if (targetRole) ctx["peranSasaran"] = targetRole.title;

  const inputHash = hashInput(agent, ctx);
  if (!body.refresh) {
    const [cached] = await db
      .select()
      .from(insightsTable)
      .where(and(eq(insightsTable.profileId, id), eq(insightsTable.agent, agent), eq(insightsTable.inputHash, inputHash)))
      .orderBy(desc(insightsTable.createdAt))
      .limit(1);
    if (cached) {
      res.json({ ...insightToApi(cached), cached: true });
      return;
    }
  }
  try {
    const { system, user } = agentPrompt(agent, ctx);
    const out = await chat(agentTier(agent), system, user);
    const [row] = await db
      .insert(insightsTable)
      .values({ profileId: id, agent, inputHash, content: out.content, sources, model: out.model })
      .returning();
    res.json(insightToApi(row));
  } catch (err) {
    if (err instanceof AiNotConnectedError) {
      res.status(503).json({ error: "Enjin AI belum disambungkan" });
      return;
    }
    req.log.error({ err, agent }, "Agent run failed");
    res.status(502).json({ error: "Enjin AI gagal memberi respons. Cuba lagi." });
  }
});

export default router;
