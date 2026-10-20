import { Router, type IRouter } from "express";
import { db, labourMonthlyTable, occupationExposureTable, aiUsageTable, aiUsageOverallTable, marketSourcesTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { GetAiUsageByRoleQueryParams, GetRoleExposureQueryParams } from "@workspace/api-zod";
import { listSources, refreshAll } from "../lib/market";

const router: IRouter = Router();

async function sourceRow(id: string) {
  const [r] = await db.select().from(marketSourcesTable).where(eq(marketSourcesTable.id, id));
  return r;
}


router.get("/market/overview", async (_req, res) => {
  const [labour, usage, exposure, overall, sources] = await Promise.all([
    db.select().from(labourMonthlyTable).orderBy(desc(labourMonthlyTable.date)).limit(1),
    db.select().from(aiUsageTable).where(eq(aiUsageTable.geo, "MYS")).orderBy(desc(aiUsageTable.pct)),
    db.select().from(occupationExposureTable).orderBy(desc(occupationExposureTable.exposure)).limit(1),
    db.select().from(aiUsageOverallTable).where(eq(aiUsageOverallTable.geo, "MYS")),
    listSources(),
  ]);
  const topRole = usage.find((u) => u.level === 0);
  const fetched = sources.map((s) => s.lastFetchedAt).filter((x): x is string => !!x).sort();
  res.json({
    unemploymentRate: labour[0]?.unemploymentRate ?? null,
    unemploymentDate: labour[0]?.date ?? null,
    participationRate: labour[0]?.participationRate ?? null,
    aiUsagePeriod: overall[0]?.period ?? topRole?.period ?? null,
    malaysiaUsageIndex: overall[0]?.usagePerCapitaIndex ?? null,
    topAiRoleMy: topRole?.title ?? null,
    topExposedRole: exposure[0]?.title ?? null,
    sourcesOk: sources.filter((s) => s.status === "ok").length,
    sourcesTotal: sources.length,
    lastRefresh: fetched.at(-1) ?? null,
  });
});

router.get("/market/sources", async (_req, res) => {
  res.json(await listSources());
});

router.post("/market/refresh", async (_req, res) => {
  await refreshAll(true);
  res.json(await listSources());
});

router.get("/market/ai-usage/roles", async (req, res) => {
  const q = GetAiUsageByRoleQueryParams.parse(req.query);
  const geo = q.geo ?? "MYS";
  const limit = Math.min(Math.max(q.limit ?? 20, 1), 200);
  const [rows, exposure, src] = await Promise.all([
    db.select().from(aiUsageTable).where(eq(aiUsageTable.level, 0)),
    db.select().from(occupationExposureTable),
    sourceRow("aei_usage"),
  ]);
  const groups = new Map(rows.length ? (await db.select().from(aiUsageTable).where(eq(aiUsageTable.level, 1))).map((g) => [`${g.geo}|${g.socCode}`, g.title]) : []);
  const exp = new Map(exposure.map((e) => [e.socCode, e.exposure]));
  const global = new Map(rows.filter((r) => r.geo === "GLOBAL").map((r) => [r.socCode, r.pct]));
  const items = rows
    .filter((r) => r.geo === geo)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
    .map((r) => ({
      socCode: r.socCode,
      title: r.title,
      majorGroup: groups.get(`GLOBAL|${r.socCode.slice(0, 2)}`) ?? groups.get(`${geo}|${r.socCode.slice(0, 2)}`) ?? r.socCode.slice(0, 2),
      usagePct: r.pct,
      usagePctGlobal: global.get(r.socCode) ?? null,
      exposure: exp.get(r.socCode) ?? null,
    }));
  res.json({ geo, period: rows[0]?.period ?? null, fetchedAt: src?.lastFetchedAt?.toISOString() ?? null, items });
});

router.get("/market/ai-usage/groups", async (_req, res) => {
  const [rows, src] = await Promise.all([db.select().from(aiUsageTable).where(eq(aiUsageTable.level, 1)), sourceRow("aei_usage")]);
  const byCode = new Map<string, { majorGroup: string; usagePctMy: number | null; usagePctGlobal: number | null }>();
  for (const r of rows) {
    const g = byCode.get(r.socCode) ?? { majorGroup: r.title, usagePctMy: null, usagePctGlobal: null };
    if (r.geo === "MYS") g.usagePctMy = r.pct;
    else g.usagePctGlobal = r.pct;
    byCode.set(r.socCode, g);
  }
  const items = [...byCode.values()].sort((a, b) => (b.usagePctMy ?? 0) - (a.usagePctMy ?? 0));
  res.json({ period: rows[0]?.period ?? null, fetchedAt: src?.lastFetchedAt?.toISOString() ?? null, items });
});

router.get("/market/exposure", async (req, res) => {
  const q = GetRoleExposureQueryParams.parse(req.query);
  const limit = Math.min(Math.max(q.limit ?? 20, 1), 800);
  const rows = await db.select().from(occupationExposureTable).orderBy(desc(occupationExposureTable.exposure)).limit(limit);
  res.json(rows);
});

router.get("/market/labour", async (_req, res) => {
  const rows = await db.select().from(labourMonthlyTable).orderBy(asc(labourMonthlyTable.date));
  res.json(rows);
});

export default router;
