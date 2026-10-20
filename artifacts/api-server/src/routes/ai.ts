import { Router, type IRouter } from "express";
import { db, predictionsTable, labourMonthlyTable, aiUsageTable, aiUsageOverallTable, marketSourcesTable } from "@workspace/db";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { CreatePredictionBody } from "@workspace/api-zod";
import { aiStatus, chat, AiNotConnectedError, AiTimeoutError } from "../lib/llm";
import { loadRoles } from "../lib/catalog";
import { hashInput, predictionPrompt, SOURCE_AEI, SOURCE_DOSM, type Lang } from "../lib/agents";

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
    lang: r.lang as Lang,
    content: r.content,
    sources: r.sources,
    model: r.model,
    cached,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Predictions are private to their author (user account or guest browser). */
function predictionScope(req: Request): SQL {
  if (req.user) return eq(predictionsTable.ownerUserId, req.user.id);
  if (req.guestToken) return and(isNull(predictionsTable.ownerUserId), eq(predictionsTable.guestToken, req.guestToken))!;
  return sql`false`;
}

router.get("/predictions", async (req, res) => {
  const rows = await db.select().from(predictionsTable).where(predictionScope(req)).orderBy(desc(predictionsTable.createdAt)).limit(50);
  res.json(rows.map((r) => predictionToApi(r, true)));
});

router.post("/predictions", async (req, res) => {
  const body = CreatePredictionBody.parse(req.body);
  const lang: Lang = body.lang ?? "en";
  if (!req.user && !req.guestToken) {
    res.status(400).json({ error: "guest_token_required" });
    return;
  }
  const roles = await loadRoles();
  const role = body.roleId ? roles.find((r) => r.id === body.roleId) : undefined;
  if (body.roleId && !role) {
    res.status(404).json({ error: "role_not_found" });
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
  const inputHash = hashInput(question.toLowerCase(), body.horizonYears, body.roleId ?? null, lang, ctx);
  const owner = { ownerUserId: req.user?.id ?? null, guestToken: req.user ? null : req.guestToken! };
  const [cached] = await db.select().from(predictionsTable).where(eq(predictionsTable.inputHash, inputHash)).orderBy(desc(predictionsTable.createdAt)).limit(1);
  if (cached) {
    // Reuse the generated text (no GPU); give this caller their own copy if needed.
    const mine = (owner.ownerUserId !== null && cached.ownerUserId === owner.ownerUserId) || (owner.ownerUserId === null && cached.guestToken === owner.guestToken);
    if (mine) {
      res.status(201).json(predictionToApi(cached, true));
      return;
    }
    const { id: _id, createdAt: _c, ...copy } = cached;
    const [row] = await db.insert(predictionsTable).values({ ...copy, ...owner }).returning();
    res.status(201).json(predictionToApi(row, true));
    return;
  }
  try {
    const { system, user } = predictionPrompt(ctx, question, body.horizonYears, lang);
    const out = await chat("main", system, user);
    const refs = [
      { ...SOURCE_DOSM, dataDate: src.get("dosm_lfs_month")?.dataDate ?? null },
      { ...SOURCE_AEI, dataDate: src.get("aei_usage")?.dataDate ?? null },
    ];
    const [row] = await db
      .insert(predictionsTable)
      .values({ roleId: role?.id ?? null, roleTitle: role?.title ?? null, question, horizonYears: body.horizonYears, lang, ...owner, inputHash, content: out.content, sources: refs, model: out.model })
      .returning();
    res.status(201).json(predictionToApi(row, false));
  } catch (err) {
    if (err instanceof AiNotConnectedError) {
      res.status(503).json({ error: "ai_not_connected" });
      return;
    }
    req.log.error({ err }, "Prediction failed");
    res.status(502).json({ error: err instanceof AiTimeoutError ? "ai_timeout" : "ai_failed" });
  }
});

export default router;
