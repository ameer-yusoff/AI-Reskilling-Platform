import { Router, type IRouter } from "express";
import { db, profilesTable, plansTable, insightsTable, predictionsTable } from "@workspace/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { profileScope } from "../lib/profiles";
import { loadCourses, loadRoles, loadSkills } from "../lib/catalog";
import { scoreRole } from "../lib/scoring";

const router: IRouter = Router();

// HR and TVET users only ever see their own organisation.
router.get("/cohort/organizations", requireRole("hr", "tvet"), async (req, res) => {
  const org = req.user!.organization!;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.organization, org));
  res.json([{ organization: org, count }]);
});

router.get("/cohort/summary", requireRole("hr", "tvet"), async (req, res) => {
  const org = req.user!.organization!;
  const [profiles, roles, skills, courses, plans] = await Promise.all([
    db.select().from(profilesTable).where(eq(profilesTable.organization, org)),
    loadRoles(),
    loadSkills(),
    loadCourses(),
    db.select({ profileId: plansTable.profileId }).from(plansTable),
  ]);
  const withPlan = new Set(plans.map((p) => p.profileId));
  const segCount = new Map<string, number>();
  const gapCount = new Map<string, number>();
  const riasecCount = new Map<string, number>();
  const fitCount = new Map<string, number>();
  const exposures: number[] = [];

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const members = profiles.map((p) => {
    segCount.set(p.segment, (segCount.get(p.segment) ?? 0) + 1);
    if (p.riasecCode) riasecCount.set(p.riasecCode[0], (riasecCount.get(p.riasecCode[0]) ?? 0) + 1);
    const scored = roles.map((r) => ({ r, s: scoreRole(p, r, skills, courses) })).sort((a, b) => b.s.score - a.s.score);
    if (scored[0]) fitCount.set(scored[0].r.title, (fitCount.get(scored[0].r.title) ?? 0) + 1);
    const target = (p.targetRoleId && scored.find((x) => x.r.id === p.targetRoleId)) || scored[0];
    for (const g of target?.s.gapSkills ?? []) gapCount.set(g.name, (gapCount.get(g.name) ?? 0) + 1);
    const current = p.currentRole ? roles.find((r) => norm(r.title) === norm(p.currentRole!) || norm(p.currentRole!).includes(norm(r.title))) : undefined;
    const exp = current?.aiExposure ?? null;
    if (exp !== null) exposures.push(exp);
    return {
      id: p.id,
      name: p.name,
      segment: p.segment,
      currentRole: p.currentRole,
      riasecCode: p.riasecCode,
      topMatchTitle: scored[0]?.r.title ?? null,
      topMatchScore: scored[0]?.s.score ?? null,
      currentRoleExposure: exp,
      hasPlan: withPlan.has(p.id),
      skillCount: p.skills.length,
      hrdcEligible: p.hrdcEligible,
    };
  });
  const toItems = (m: Map<string, number>) => [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const topGaps = toItems(gapCount).slice(0, 10);
  const gapCourses = topGaps.slice(0, 6).map((g) => ({
    skill: g.label,
    count: g.count,
    courses: courses
      .filter((c) => c.skills.some((s) => s.name === g.label))
      .slice(0, 4)
      .map((c) => ({ id: c.id, title: c.title, provider: c.provider, url: c.url, costMyr: c.costMyr, costType: c.costType, hrdcStatus: c.hrdcStatus, durationHours: c.durationHours })),
  }));
  res.json({
    organization: org,
    profileCount: profiles.length,
    avgExposure: exposures.length ? Math.round((exposures.reduce((a, b) => a + b, 0) / exposures.length) * 1000) / 1000 : null,
    planCoverage: profiles.length ? Math.round((members.filter((m) => m.hasPlan).length / profiles.length) * 100) : 0,
    segmentCounts: toItems(segCount),
    topGaps,
    roleFitDistribution: toItems(fitCount).slice(0, 8),
    gapCourses,
    riasecDistribution: ["R", "I", "A", "S", "E", "C"].map((t) => ({ label: t, count: riasecCount.get(t) ?? 0 })),
    members,
  });
});

router.get("/dashboard/summary", async (req, res) => {
  const scope = profileScope(req);
  const owned = await db.select({ id: profilesTable.id }).from(profilesTable).where(scope);
  const ids = owned.map((o) => o.id);
  const predScope = req.user
    ? eq(predictionsTable.ownerUserId, req.user.id)
    : req.guestToken
      ? and(isNull(predictionsTable.ownerUserId), eq(predictionsTable.guestToken, req.guestToken))
      : sql`false`;
  const none = sql`false`;
  const planScope = ids.length ? inArray(plansTable.profileId, ids) : none;
  const insightScope = ids.length ? inArray(insightsTable.profileId, ids) : none;
  const [roles, courses, [pl], [ins], [pr], recentProfiles, recentPlans, recentPreds, recentInsights] = await Promise.all([
    loadRoles(),
    loadCourses(),
    db.select({ c: sql<number>`count(*)::int` }).from(plansTable).where(planScope),
    db.select({ c: sql<number>`count(*)::int` }).from(insightsTable).where(insightScope),
    db.select({ c: sql<number>`count(*)::int` }).from(predictionsTable).where(predScope),
    db.select().from(profilesTable).where(scope).orderBy(desc(profilesTable.createdAt)).limit(5),
    db.select().from(plansTable).where(planScope).orderBy(desc(plansTable.createdAt)).limit(5),
    db.select().from(predictionsTable).where(predScope).orderBy(desc(predictionsTable.createdAt)).limit(5),
    db.select().from(insightsTable).where(insightScope).orderBy(desc(insightsTable.createdAt)).limit(5),
  ]);
  // Labels are plain data; the frontend renders them with translated prefixes by kind.
  const activity = [
    ...recentProfiles.map((p) => ({ kind: "profile", label: p.name, profileId: p.id, createdAt: p.createdAt })),
    ...recentPlans.map((p) => ({ kind: "plan", label: p.roleTitle, profileId: p.profileId, createdAt: p.createdAt })),
    ...recentPreds.map((p) => ({ kind: "prediction", label: p.question.slice(0, 80), profileId: null, createdAt: p.createdAt })),
    ...recentInsights.map((i) => ({ kind: "insight", label: i.agent, profileId: i.profileId, createdAt: i.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
  res.json({
    profileCount: ids.length,
    planCount: pl.c,
    predictionCount: pr.c,
    insightCount: ins.c,
    roleCount: roles.length,
    courseCount: courses.length,
    recentActivity: activity,
  });
});

export default router;
