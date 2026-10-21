import { Router, type IRouter } from "express";
import { performance } from "node:perf_hooks";
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
import { extractCvDocument, extractSkills, CvError, isCvImageFile, validateCvImage, type CvDocumentPage } from "../lib/cv";
import { RIASEC_QUESTIONS } from "../data/riasec";
import { scoreRiasec } from "../lib/riasec-scoring";
import { scoreRole } from "../lib/scoring";
import { buildPlan } from "../lib/planner";
import { canAccessProfile, getLatestPlan, getProfileRow, planToApi, profileScope, profileToApi, type ProfileRow } from "../lib/profiles";
import { agentPrompt, agentTier, hashInput, SOURCE_AEI, type AgentName, type Lang } from "../lib/agents";
import { chat, AiNotConnectedError, AiTimeoutError, AiVisionUnsupportedError } from "../lib/llm";
import { consumeAiRequest } from "../lib/ai-rate-limit";
import { SDG_TARGETS } from "../data/courses";
import { CvAiOutputError, cvExtractionKey, extractCvMultimodalProfile, extractCvProfile, retrieveCv, retrieveReferences } from "../lib/cv-retrieval";

const router: IRouter = Router();
const cvRequests = new Map<number, Promise<unknown>>();

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
  if (!p || !await canAccessProfile(req, p)) {
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
  const step = body.onboardingStep;
  if (body.verified && (!(body.name ?? p.name).trim() || !(body.goals ?? p.goals)?.trim())) {
    res.status(400).json({ error: "invalid_input" }); return;
  }
  if ((body.verified || ["holland", "results", "save", "complete"].includes(step ?? "")) && !p.cvExtractionKey) {
    res.status(400).json({ error: "cv_required" }); return;
  }
  if (["results", "save", "complete"].includes(step ?? "") && (!p.verified || !p.riasecScores)) {
    res.status(400).json({ error: "riasec_required" }); return;
  }
  if (step === "complete" && (!req.user || req.user.role !== "individual" || p.ownerUserId !== req.user.id)) {
    res.status(401).json({ error: "login_required" }); return;
  }
  if (body.riasecAnswers && (new Set(body.riasecAnswers.map((a) => a.questionId)).size !== body.riasecAnswers.length || body.riasecAnswers.some((a) => !RIASEC_QUESTIONS.some((q) => q.id === a.questionId)))) {
    res.status(400).json({ error: "invalid_input" }); return;
  }
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
  const canonicalAnswers = (answers: { questionId: number; value: number }[]) =>
    JSON.stringify([...answers].sort((a, b) => a.questionId - b.questionId).map((a) => [a.questionId, a.value]));
  const changedAnswers = body.riasecAnswers && canonicalAnswers(body.riasecAnswers) !== canonicalAnswers(p.riasecAnswers);
  // Edited answers must not retain an old score; identical late autosaves are safe.
  const invalidatedScores = changedAnswers
    ? { riasecScores: null, riasecCode: null, ...(p.cvExtractionKey ? { onboardingStep: "holland" } : {}) }
    : {};
  // Editing source facts invalidates confirmation; explicit confirmation is applied last.
  const factsChanged = ["name", "currentRole", "organization", "education", "experience"].some((k) => k in body && body[k as keyof typeof body] !== p[k as keyof ProfileRow]);
  const [row] = await db
    .update(profilesTable)
    .set({ ...rest, ...invalidatedScores, ...(body.hrdcEligibilityStatus ? { hrdcEligible: body.hrdcEligibilityStatus === "yes" } : {}), ...(factsChanged ? { verified: body.verified === true } : {}), ...(organization !== undefined ? { organization: organization.trim() || null } : {}), skills })
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
  if (!body.consent) { res.status(400).json({ error: "cv_consent_required" }); return; }
  let text: string | null = null;
  let pages: CvDocumentPage[] | undefined;
  const documentProcessingStartedAt = performance.now();
  try {
    if (isCvImageFile(body.fileName)) {
      pages = [{ pageNumber: 1, text: "", image: validateCvImage(body.fileName, body.contentBase64) }];
    } else {
      const document = await extractCvDocument(body.fileName, body.contentBase64);
      if ("pages" in document) pages = document.pages;
      else text = document.text;
    }
  } catch (err) {
    req.log.info(
      { profileId: id, documentProcessingMs: Math.round(performance.now() - documentProcessingStartedAt) },
      "CV document processing timing",
    );
    if (err instanceof CvError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.warn({ profileId: id }, "CV parse failed");
    res.status(400).json({ error: "cv_unreadable" });
    return;
  }
  const documentProcessingMs = Math.round(performance.now() - documentProcessingStartedAt);
  const lang = body.lang ?? "en";
  const images = pages?.flatMap((page) => page.image ? [page.image] : []) ?? [];
  // Include every PDF page's extracted text so mixed text/scanned PDFs cannot
  // reuse a cached extraction from a different document with the same images.
  const keyText = text ?? pages?.map((page) => `Page ${page.pageNumber}\n${page.text}`).join("\n\n") ?? "";
  const key = cvExtractionKey(keyText, lang, images);
  if (p.cvExtractionKey === key) { res.json(profileToApi(p, await loadSkills())); return; }
  if (cvRequests.has(id)) { res.status(409).json({ error: "cv_processing" }); return; }
  const rate = consumeAiRequest(req.user ? "user" : "guest", req.user ? String(req.user.id) : req.guestToken!, images.length ? 2 : 1);
  if (!rate.allowed) { res.setHeader("Retry-After", String(rate.retryAfterSeconds)); res.status(429).json({ error: "ai_rate_limited", retryAfterSeconds: rate.retryAfterSeconds }); return; }
  const work = (async () => {
    const multimodal = images.length > 0;
    const cvModelStageStartedAt = performance.now();
    const result = multimodal
      ? await extractCvMultimodalProfile(pages!, lang)
      : await extractCvProfile(text!, lang);
    const cvModelStageMs = Math.round(performance.now() - cvModelStageStartedAt);
    req.log.info({
      profileId: id,
      documentProcessingMs,
      cvModelStageMs,
      pageCount: pages?.length ?? 0,
      scannedPageCount: images.length,
      endpointTier: result.timing.endpointTier,
      modelResolutionMs: result.timing.modelResolutionMs,
      endpointRequestMs: result.timing.endpointRequestMs,
      endpointWarmBeforeRequest: result.timing.endpointWarmBeforeRequest,
      endpointStartupMs: result.timing.endpointStartupMs,
      readyToResponseMs: result.timing.readyToResponseMs,
    }, "CV upload timing");
    const cvText = multimodal ? (result as Awaited<ReturnType<typeof extractCvMultimodalProfile>>).text : text!;
    const allSkills = await loadSkills();
    const extracted = extractSkills(cvText, allSkills);
    const manual = p.skills.filter((s) => s.status === "self_reported" && !extracted.some((e) => e.skillId === s.skillId));
    const isOrg = req.user?.role === "hr" || req.user?.role === "tvet";
    const [row] = await db.update(profilesTable).set({
      name: result.fields.name ?? "", currentRole: result.fields.currentRole,
      ...(isOrg ? {} : { organization: result.fields.organization }),
      education: result.fields.education, experience: result.fields.experience,
      cvText, cvFileName: body.fileName, cvUploadedAt: new Date(),
      cvEvidence: result.evidence, cvExtractionKey: key, verified: false, onboardingStep: "review",
      skills: [...extracted, ...manual],
    }).where(eq(profilesTable.id, id)).returning();
    return profileToApi(row, allSkills);
  })();
  cvRequests.set(id, work);
  try { res.json(await work); }
  catch (err) {
    req.log.warn({ profileId: id, kind: err instanceof AiNotConnectedError ? "not_configured" : "extraction_failed" }, "CV extraction failed");
    const error = err instanceof AiNotConnectedError ? "ai_not_connected"
      : err instanceof AiTimeoutError ? "ai_timeout"
        : err instanceof AiVisionUnsupportedError ? "ai_vision_unsupported"
          : err instanceof CvError ? err.message
          : err instanceof CvAiOutputError ? "cv_ai_invalid" : "ai_failed";
    const status = err instanceof CvError ? 400 : err instanceof AiNotConnectedError ? 503 : 502;
    res.status(status).json({ error });
  } finally { cvRequests.delete(id); }
});

router.get("/riasec/questions", (_req, res) => {
  res.json(RIASEC_QUESTIONS);
});

router.post("/profiles/:id/riasec", async (req, res) => {
  const { id } = GetProfileParams.parse(req.params);
  const body = SubmitRiasecBody.parse(req.body);
  const p = await requireProfile(id, req, res);
  if (!p) return;
  if (p.onboardingStep && !p.verified) { res.status(400).json({ error: "cv_review_required" }); return; }
  let scores, code;
  try { ({ scores, code } = scoreRiasec(body.answers)); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "invalid_input" }); return; }
  const [row] = await db.update(profilesTable).set({ riasecScores: scores, riasecCode: code, riasecAnswers: body.answers }).where(eq(profilesTable.id, id)).returning();
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
  if (!courses.length) { res.status(503).json({ error: "course_catalogue_unavailable" }); return; }
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
    ctx["teksCv"] = retrieveCv(p.cvText);
    ctx["rujukanKemahiran"] = retrieveReferences(p.cvText);
    ctx["buktiProfil"] = p.cvEvidence;
    ctx["kemahiranDikesan"] = profile.skills.map((s) => ({ nama: s.name, bukti: s.evidence }));
  }
  if (agent === "holland") {
    if (!p.riasecScores) {
      res.status(400).json({ error: "riasec_required" });
      return;
    }
    ctx["riasec"] = { skor: p.riasecScores, kod: p.riasecCode };
    ctx["jawapanSebenar"] = p.riasecAnswers;
    ctx["profilDisahkan"] = p.verified;
    ctx["buktiCv"] = p.cvEvidence;
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
