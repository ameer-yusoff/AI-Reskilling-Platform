import {
  db,
  marketSourcesTable,
  labourMonthlyTable,
  occupationExposureTable,
  aiUsageTable,
  aiUsageOverallTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export type SourceDef = {
  id: string;
  name: string;
  url: string;
  description: string;
  refreshCadence: string;
};

const HF = "https://huggingface.co";
const HF_DATASET = "Anthropic/EconomicIndex";

export const SOURCES: SourceDef[] = [
  {
    id: "dosm_lfs_month",
    name: "DOSM Labour Force Survey (bulanan)",
    url: "https://data.gov.my/data-catalogue/lfs_month",
    description: "Kadar pengangguran, kadar penyertaan dan guna tenaga Malaysia, data rasmi Jabatan Perangkaan Malaysia melalui API data.gov.my.",
    refreshCadence: "Bulanan, disemak setiap 6 jam",
  },
  {
    id: "aei_usage",
    name: "Anthropic Economic Index: penggunaan AI mengikut pekerjaan",
    url: `${HF}/datasets/${HF_DATASET}`,
    description: "Peratus penggunaan Claude yang dipetakan kepada pekerjaan SOC, untuk Malaysia (MYS) dan global. Keluaran terkini dikesan secara automatik.",
    refreshCadence: "Ikut keluaran baharu, disemak setiap 6 jam",
  },
  {
    id: "aei_exposure",
    name: "Anthropic Economic Index: pendedahan AI yang diperhatikan",
    url: `${HF}/datasets/${HF_DATASET}/tree/main/labor_market_impacts`,
    description: "Skor pendedahan AI yang diperhatikan (0-1) bagi setiap pekerjaan SOC, berdasarkan penembusan tugas sebenar.",
    refreshCadence: "Ikut keluaran baharu, disemak setiap 6 jam",
  },
];

const normSoc = (code: string) => code.replace(/\.\d+$/, "");

async function setSource(id: string, patch: Partial<typeof marketSourcesTable.$inferInsert>) {
  await db
    .insert(marketSourcesTable)
    .values({ id, ...patch })
    .onConflictDoUpdate({ target: marketSourcesTable.id, set: patch });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "ReskillAI-Malaysia/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

// Quote-aware CSV line parser.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function* streamLines(url: string): AsyncGenerator<string> {
  const res = await fetch(url, { headers: { "User-Agent": "ReskillAI-Malaysia/1.0" } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
    }
  }
  if (buf) yield buf;
}

async function ingestLabour(): Promise<void> {
  type Row = { date: string; u_rate?: number; p_rate?: number; lf_employed?: number; lf_unemployed?: number };
  const rows = await fetchJson<Row[]>("https://api.data.gov.my/data-catalogue?id=lfs_month&sort=-date&limit=60");
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Empty response from data.gov.my");
  for (const r of rows) {
    const v = {
      unemploymentRate: r.u_rate ?? null,
      participationRate: r.p_rate ?? null,
      employedThousands: r.lf_employed ?? null,
      unemployedThousands: r.lf_unemployed ?? null,
    };
    await db.insert(labourMonthlyTable).values({ date: r.date, ...v }).onConflictDoUpdate({ target: labourMonthlyTable.date, set: v });
  }
  const latest = rows.map((r) => r.date).sort().at(-1) ?? null;
  await setSource("dosm_lfs_month", { status: "ok", lastFetchedAt: new Date(), dataDate: latest, recordCount: rows.length, error: null });
}

async function ingestExposure(): Promise<void> {
  const rows: { socCode: string; title: string; exposure: number }[] = [];
  let header = true;
  for await (const line of streamLines(`${HF}/datasets/${HF_DATASET}/resolve/main/labor_market_impacts/job_exposure.csv`)) {
    if (header) {
      header = false;
      continue;
    }
    if (!line.trim()) continue;
    const [code, title, exp] = parseCsvLine(line);
    const exposure = Number(exp);
    if (!code || Number.isNaN(exposure)) continue;
    rows.push({ socCode: normSoc(code), title, exposure });
  }
  if (rows.length === 0) throw new Error("job_exposure.csv returned no rows");
  await db.transaction(async (tx) => {
    await tx.delete(occupationExposureTable);
    for (let i = 0; i < rows.length; i += 500) await tx.insert(occupationExposureTable).values(rows.slice(i, i + 500)).onConflictDoNothing();
  });
  await setSource("aei_exposure", { status: "ok", lastFetchedAt: new Date(), dataDate: "labor_market_impacts", recordCount: rows.length, error: null });
}

async function latestUsageFile(): Promise<{ release: string; path: string }> {
  type Entry = { type: string; path: string };
  const root = await fetchJson<Entry[]>(`${HF}/api/datasets/${HF_DATASET}/tree/main`);
  const releases = root.filter((e) => e.type === "directory" && /^release_\d{4}_\d{2}_\d{2}$/.test(e.path)).map((e) => e.path).sort().reverse();
  for (const rel of releases) {
    const files = await fetchJson<Entry[]>(`${HF}/api/datasets/${HF_DATASET}/tree/main/${rel}?recursive=1`);
    const f = files.find((e) => e.type === "file" && /data\/aei_claude_ai_\d{4}-\d{2}-\d{2}\.csv$/.test(e.path));
    if (f) return { release: rel, path: f.path };
  }
  throw new Error("No compatible Anthropic Economic Index release found");
}

async function ingestUsage(force: boolean): Promise<void> {
  const { release, path } = await latestUsageFile();
  const [existing] = await db.select().from(marketSourcesTable).where(eq(marketSourcesTable.id, "aei_usage"));
  if (!force && existing?.version === path && existing.status === "ok") {
    await setSource("aei_usage", { lastFetchedAt: new Date() });
    return;
  }
  type U = { geo: string; level: number; socCode: string; title: string; pct: number; period: string };
  const byPeriod = new Map<string, U[]>();
  const overall = new Map<string, { index: number | null; pct: number | null; period: string }>();
  let header = true;
  for await (const line of streamLines(`${HF}/datasets/${HF_DATASET}/resolve/main/${path}`)) {
    if (header) {
      header = false;
      continue;
    }
    if (!(line.includes(",MYS,") || line.includes(",GLOBAL,"))) continue;
    if (!(line.includes(",soc_occupation,") || line.includes(",overall,"))) continue;
    const c = parseCsvLine(line);
    const [dateStart, , geo, , category, level, metric, value, nodeName, nodeId] = c;
    if (geo !== "MYS" && geo !== "GLOBAL") continue;
    const period = dateStart.slice(0, 7);
    if (category === "overall") {
      const key = `${geo}|${period}`;
      const o = overall.get(key) ?? { index: null, pct: null, period };
      if (metric === "usage_per_capita_index") o.index = Number(value);
      if (metric === "usage_pct") o.pct = Number(value);
      overall.set(key, o);
    } else if (metric === "pct" && (level === "0" || level === "1")) {
      const arr = byPeriod.get(period) ?? [];
      arr.push({ geo, level: Number(level), socCode: normSoc(nodeId), title: nodeName, pct: Number(value), period });
      byPeriod.set(period, arr);
    }
  }
  const latest = [...byPeriod.keys()].sort().at(-1);
  if (!latest) throw new Error(`No SOC usage rows found in ${path}`);
  const rows = byPeriod.get(latest)!;
  await db.transaction(async (tx) => {
    await tx.delete(aiUsageTable);
    for (let i = 0; i < rows.length; i += 500) await tx.insert(aiUsageTable).values(rows.slice(i, i + 500)).onConflictDoNothing();
    for (const geo of ["MYS", "GLOBAL"]) {
      const o = overall.get(`${geo}|${latest}`);
      if (!o) continue;
      const v = { usagePerCapitaIndex: o.index, usagePct: o.pct, period: latest };
      await tx.insert(aiUsageOverallTable).values({ geo, ...v }).onConflictDoUpdate({ target: aiUsageOverallTable.geo, set: v });
    }
  });
  await setSource("aei_usage", { status: "ok", lastFetchedAt: new Date(), dataDate: latest, recordCount: rows.length, error: null, version: path });
  logger.info({ release, period: latest, rows: rows.length }, "AI usage ingested");
}

let running: Promise<void> | null = null;

export function refreshAll(force = false): Promise<void> {
  if (running) return running;
  const jobs: [string, () => Promise<void>][] = [
    ["dosm_lfs_month", ingestLabour],
    ["aei_exposure", ingestExposure],
    ["aei_usage", () => ingestUsage(force)],
  ];
  running = (async () => {
    for (const [id, fn] of jobs) {
      try {
        await fn();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err, source: id }, "Market ingestion failed");
        await setSource(id, { status: "error", error: message });
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

export async function listSources() {
  const rows = await db.select().from(marketSourcesTable);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return SOURCES.map((s) => {
    const r = byId.get(s.id);
    return {
      ...s,
      status: (r?.status ?? "pending") as "ok" | "error" | "pending",
      lastFetchedAt: r?.lastFetchedAt ? r.lastFetchedAt.toISOString() : null,
      dataDate: r?.dataDate ?? null,
      recordCount: r?.recordCount ?? 0,
      error: r?.error ?? null,
    };
  });
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function startMarketScheduler(): void {
  void (async () => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(marketSourcesTable).where(eq(marketSourcesTable.status, "ok"));
    if (count < SOURCES.length) await refreshAll();
    else logger.info("Market data present; next check in 6 hours");
  })().catch((err) => logger.error({ err }, "Initial market refresh failed"));
  setInterval(() => {
    refreshAll().catch((err) => logger.error({ err }, "Scheduled market refresh failed"));
  }, SIX_HOURS).unref();
}
