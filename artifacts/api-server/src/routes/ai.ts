import { Router, type IRouter } from "express";
import { db, predictionsTable, labourMonthlyTable, aiUsageTable, aiUsageOverallTable, marketSourcesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { CreatePredictionBody } from "@workspace/api-zod";
import { aiStatus, chat, AiNotConnectedError } from "../lib/llm";
import { loadRoles } from "../lib/catalog";
import { hashInput, predictionPrompt, SOURCE_AEI, SOURCE_DOSM } from "../lib/agents";

const router: IRouter = Router();

router.get("/ai/status", (_req, res) => {
  res.json(aiStatus());
});

function predictionToApi(r: typeof predictionsTable.$inferSelect, cached: boolean) {
  return {
    id: r.id,
    roleId: r.roleId,
    roleTitle: r.roleTitle,
    question: r.question,
    horizonYears: r.horizonYears,
    content: r.content,
    sources: r.sources,
    model: r.model,
    cached,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/predictions", async (_req, res) => {
  const rows = await db.select().from(predictionsTable).orderBy(desc(predictionsTable.createdAt)).limit(50);
  res.json(rows.map((r) => predictionToApi(r, true)));
});

router.post("/predictions", async (req, res) => {
  const body = CreatePredictionBody.parse(req.body);
  const roles = await loadRoles();
  const role = body.roleId ? roles.find((r) => r.id === body.roleId) : undefined;
  if (body.roleId && !role) {
    res.status(404).json({ error: "Peranan tidak dijumpai" });
    return;
  }

  // Grounding context (retrieved from stored market snapshots; no GPU).
  const [labour, groups, overall, sources] = await Promise.all([
    db.select().from(labourMonthlyTable).orderBy(desc(labourMonthlyTable.date)).limit(24),
    db.select().from(aiUsageTable).where(and(eq(aiUsageTable.level, 1), eq(aiUsageTable.geo, "MYS"))),
    db.select().from(aiUsageOverallTable),
    db.select().from(marketSourcesTable),
  ]);
  const src = new Map(sources.map((s) => [s.id, s]));
  const ctx: Record<string, unknown> = {
    pasaranBuruhMalaysia: labour.reverse().map((l) => ({ tarikh: l.date, kadarPengangguran: l.unemploymentRate, kadarPenyertaan: l.participationRate, bekerjaRibu: l.employedThousands })),
    indeksPenggunaanAi: overall.map((o) => ({ geo: o.geo, indeksPerKapita: o.usagePerCapitaIndex, tempoh: o.period })),
    penggunaanAiMalaysiaIkutKumpulan: groups.sort((a, b) => b.pct - a.pct).map((g) => ({ kumpulan: g.title, peratus: g.pct })),
  };
  if (role) {
    ctx["peranan"] = {
      tajuk: role.title,
      sektor: role.sector,
      pendedahanAi: role.aiExposure,
      penggunaanAiMalaysiaPct: role.aiUsagePctMy,
      penggunaanAiGlobalPct: role.aiUsagePctGlobal,
      senaraiMyCOL: role.myColCritical,
      kemahiran: role.skills.map((s) => s.name),
    };
  }
  const question = body.question.trim();
  const inputHash = hashInput(question.toLowerCase(), body.horizonYears, body.roleId ?? null, ctx);
  const [cached] = await db.select().from(predictionsTable).where(eq(predictionsTable.inputHash, inputHash)).limit(1);
  if (cached) {
    res.status(201).json(predictionToApi(cached, true));
    return;
  }
  try {
    const { system, user } = predictionPrompt(ctx, question, body.horizonYears);
    const out = await chat("main", system, user);
    const refs = [
      { ...SOURCE_DOSM, dataDate: src.get("dosm_lfs_month")?.dataDate ?? null },
      { ...SOURCE_AEI, dataDate: src.get("aei_usage")?.dataDate ?? null },
    ];
    const [row] = await db
      .insert(predictionsTable)
      .values({ roleId: role?.id ?? null, roleTitle: role?.title ?? null, question, horizonYears: body.horizonYears, inputHash, content: out.content, sources: refs, model: out.model })
      .returning();
    res.status(201).json(predictionToApi(row, false));
  } catch (err) {
    if (err instanceof AiNotConnectedError) {
      res.status(503).json({ error: "Enjin AI belum disambungkan" });
      return;
    }
    req.log.error({ err }, "Prediction failed");
    res.status(502).json({ error: "Enjin AI gagal memberi respons. Cuba lagi." });
  }
});

export default router;
