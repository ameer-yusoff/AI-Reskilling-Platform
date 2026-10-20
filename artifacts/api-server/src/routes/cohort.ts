import { Router, type IRouter } from "express";
import { db, profilesTable, plansTable, insightsTable, predictionsTable } from "@workspace/db";
import { desc, eq, sql, isNotNull } from "drizzle-orm";
import { GetCohortSummaryQueryParams } from "@workspace/api-zod";
import { loadCourses, loadRoles, loadSkills } from "../lib/catalog";
import { scoreRole } from "../lib/scoring";

const router: IRouter = Router();

router.get("/cohort/organizations", async (_req, res) => {
  const rows = await db
    .select({ organization: profilesTable.organization, count: sql<number>`count(*)::int` })
    .from(profilesTable)
    .where(isNotNull(profilesTable.organization))
    .groupBy(profilesTable.organization)
    .orderBy(desc(sql`count(*)`));
  res.json(rows.filter((r) => r.organization).map((r) => ({ organization: r.organization!, count: r.count })));
});

router.get("/cohort/summary", async (req, res) => {
  const q = GetCohortSummaryQueryParams.parse(req.query);
  const [profiles, roles, skills, courses, plans] = await Promise.all([
    db.select().from(profilesTable).where(q.organization ? eq(profilesTable.organization, q.organization) : undefined),
    loadRoles(),
    loadSkills(),
    loadCourses(),
    db.select({ profileId: plansTable.profileId }).from(plansTable),
  ]);
  const withPlan = new Set(plans.map((p) => p.profileId));
  const segCount = new Map<string, number>();
  const gapCount = new Map<string, number>();
  const riasecCount = new Map<string, number>();
  const exposures: number[] = [];

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const members = profiles.map((p) => {
    segCount.set(p.segment, (segCount.get(p.segment) ?? 0) + 1);
    if (p.riasecCode) riasecCount.set(p.riasecCode[0], (riasecCount.get(p.riasecCode[0]) ?? 0) + 1);
    const scored = roles.map((r) => ({ r, s: scoreRole(p, r, skills, courses) })).sort((a, b) => b.s.score - a.s.score);
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
    };
  });
  const toItems = (m: Map<string, number>) => [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  res.json({
    organization: q.organization ?? null,
    profileCount: profiles.length,
    avgExposure: exposures.length ? Math.round((exposures.reduce((a, b) => a + b, 0) / exposures.length) * 1000) / 1000 : null,
    planCoverage: profiles.length ? Math.round((members.filter((m) => m.hasPlan).length / profiles.length) * 100) : 0,
    segmentCounts: toItems(segCount),
    topGaps: toItems(gapCount).slice(0, 10),
    riasecDistribution: ["R", "I", "A", "S", "E", "C"].map((t) => ({ label: t, count: riasecCount.get(t) ?? 0 })),
    members,
  });
});

router.get("/dashboard/summary", async (_req, res) => {
  const count = async (t: typeof profilesTable | typeof plansTable | typeof insightsTable | typeof predictionsTable) =>
    (await db.select({ c: sql<number>`count(*)::int` }).from(t))[0].c;
  const [profileCount, planCount, insightCount, predictionCount, roles, courses] = await Promise.all([
    count(profilesTable),
    count(plansTable),
    count(insightsTable),
    count(predictionsTable),
    loadRoles(),
    loadCourses(),
  ]);
  const [recentProfiles, recentPlans, recentPreds, recentInsights] = await Promise.all([
    db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt)).limit(5),
    db.select().from(plansTable).orderBy(desc(plansTable.createdAt)).limit(5),
    db.select().from(predictionsTable).orderBy(desc(predictionsTable.createdAt)).limit(5),
    db.select().from(insightsTable).orderBy(desc(insightsTable.createdAt)).limit(5),
  ]);
  const activity = [
    ...recentProfiles.map((p) => ({ kind: "profile", label: `Profil baharu: ${p.name}`, profileId: p.id, createdAt: p.createdAt })),
    ...recentPlans.map((p) => ({ kind: "plan", label: `Pelan dijana ke ${p.roleTitle}`, profileId: p.profileId, createdAt: p.createdAt })),
    ...recentPreds.map((p) => ({ kind: "prediction", label: `Unjuran: ${p.question.slice(0, 80)}`, profileId: null, createdAt: p.createdAt })),
    ...recentInsights.map((i) => ({ kind: "insight", label: `Ejen ${i.agent} dijalankan`, profileId: i.profileId, createdAt: i.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
  res.json({ profileCount, planCount, predictionCount, insightCount, roleCount: roles.length, courseCount: courses.length, recentActivity: activity });
});

export default router;
