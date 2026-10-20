import { createHash } from "node:crypto";
import type { SourceRefStored } from "@workspace/db";

export type AgentName = "cv" | "holland" | "profiler" | "fitter" | "planner" | "sdg";

const ROLE_DESC: Record<AgentName, { tier: "main" | "light"; task: string }> = {
  cv: { tier: "light", task: "Ejen CV: ringkaskan pengalaman dan kemahiran yang dibuktikan dalam CV, kenal pasti kemahiran yang mungkin tertinggal daripada pengekstrakan automatik, dan cadangkan 3 penambahbaikan CV yang spesifik." },
  holland: { tier: "light", task: "Ejen Holland (RIASEC): terangkan kod minat pengguna, maksudnya untuk persekitaran kerja, dan kaitkan dengan peranan dalam senarai padanan. Tegaskan ini alat saringan, bukan diagnosis." },
  profiler: { tier: "main", task: "Ejen Profiler: bina profil kerjaya yang padu (kekuatan, risiko pendedahan AI pada peranan semasa, kekangan masa dan bajet) dalam 4-6 perenggan pendek." },
  fitter: { tier: "main", task: "Ejen Fitter: terangkan mengapa 3 peranan teratas sesuai atau tidak, berdasarkan pecahan skor, jurang kemahiran dan isyarat pasaran. Beri satu cadangan peralihan yang paling realistik." },
  planner: { tier: "main", task: "Ejen Planner: terangkan pelan pembelajaran (Gantt) minggu demi minggu, kenapa susunan ini, kos peribadi, langkah HRD Corp yang perlu disemak dengan majikan, dan kemahiran yang belum diliputi." },
  sdg: { tier: "light", task: "Ejen SDG: terangkan bagaimana pelan dan peranan sasaran menyumbang kepada sasaran SDG PBB yang disenaraikan, secara konkrit dan tanpa membesar-besarkan." },
};

export function agentTier(agent: AgentName) {
  return ROLE_DESC[agent].tier;
}

const RULES =
  "Jawab dalam Bahasa Melayu yang jelas. Gunakan HANYA fakta dalam KONTEKS. Jangan reka statistik, nama kursus atau tarikh. Jika maklumat tiada dalam konteks, nyatakan dengan jelas. Gunakan tajuk kecil dan senarai ringkas. Pendedahan AI bermaksud bahagian tugas yang dibantu AI, bukan kebarangkalian kehilangan kerja.";

export function agentPrompt(agent: AgentName, context: Record<string, unknown>) {
  const system = `Anda ialah ${ROLE_DESC[agent].task} ${RULES}`;
  const user = `KONTEKS (JSON):\n${JSON.stringify(context, null, 1)}\n\nHasilkan analisis anda sekarang.`;
  return { system, user };
}

export function predictionPrompt(context: Record<string, unknown>, question: string, horizonYears: number) {
  const system = `Anda ialah Ejen Analyst pasaran buruh Malaysia. ${RULES} Untuk unjuran masa depan: nyatakan andaian, beri senario (asas, optimistik, pesimistik) bagi tempoh ${horizonYears} tahun, nyatakan tahap keyakinan, dan sebut isyarat yang perlu dipantau. Jangan beri angka tepat yang tidak boleh disokong oleh konteks.`;
  const user = `KONTEKS DATA (JSON):\n${JSON.stringify(context, null, 1)}\n\nSOALAN: ${question}`;
  return { system, user };
}

export function hashInput(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export const SOURCE_AEI: SourceRefStored = {
  label: "Anthropic Economic Index",
  url: "https://huggingface.co/datasets/Anthropic/EconomicIndex",
  dataDate: null,
};
export const SOURCE_DOSM: SourceRefStored = {
  label: "DOSM Labour Force Survey (data.gov.my)",
  url: "https://data.gov.my/data-catalogue/lfs_month",
  dataDate: null,
};
