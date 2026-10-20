import { createHash } from "node:crypto";
import type { SourceRefStored } from "@workspace/db";

export type AgentName = "cv" | "holland" | "profiler" | "fitter" | "planner" | "sdg";

export type Lang = "en" | "ms" | "zh";

const ROLE_DESC: Record<AgentName, { tier: "main" | "light"; task: string }> = {
  cv: { tier: "light", task: "the CV Agent. Summarise the experience and skills evidenced in the CV, identify skills the automatic extraction may have missed, and suggest 3 specific CV improvements." },
  holland: { tier: "light", task: "the Holland (RIASEC) Agent. Explain the user's interest code, what it means for work environments, and link it to roles in the match list. Stress that this is a screening tool, not a diagnosis." },
  profiler: { tier: "main", task: "the Profiler Agent. Build a concise career profile (strengths, AI exposure of the current role, time and budget constraints) in 4-6 short paragraphs." },
  fitter: { tier: "main", task: "the Fitter Agent. Explain why the top 3 roles fit or do not fit, based on the score breakdown, skill gaps and market signals. Give one most realistic transition recommendation." },
  planner: { tier: "main", task: "the Planner Agent. Explain the learning plan (Gantt) week by week: why this order, personal cost, HRD Corp steps to confirm with the employer, and skills not yet covered." },
  sdg: { tier: "light", task: "the SDG Agent. Explain concretely, without exaggeration, how the plan and target role contribute to the listed UN SDG targets." },
};

export function agentTier(agent: AgentName) {
  return ROLE_DESC[agent].tier;
}

const LANG_RULE: Record<Lang, string> = {
  en: "Write the whole answer in clear, plain English.",
  ms: "Tulis keseluruhan jawapan dalam Bahasa Melayu yang jelas dan mudah difahami (bukan bahasa Indonesia).",
  zh: "全文请使用简体中文，语言清晰易懂。专有名词（如课程名称、HRD Corp、SOC 代码）可保留英文原文。",
};

const RULES =
  "Use ONLY facts in the CONTEXT (context keys may be in Malay). Do not invent statistics, course names or dates. If information is missing from the context, say so clearly. Use short subheadings and brief bullet lists in Markdown. Do not use emojis. AI exposure means the share of tasks where AI is observed assisting, not the probability of losing the job.";

export function agentPrompt(agent: AgentName, context: Record<string, unknown>, lang: Lang) {
  const system = `You are ${ROLE_DESC[agent].task} ${RULES} ${LANG_RULE[lang]}`;
  const user = `CONTEXT (JSON):\n${JSON.stringify(context, null, 1)}\n\nProduce your analysis now. ${LANG_RULE[lang]}`;
  return { system, user };
}

export function predictionPrompt(context: Record<string, unknown>, question: string, horizonYears: number, lang: Lang) {
  const system = `You are the Analyst Agent for the Malaysian labour market. ${RULES} For future outlooks: state assumptions, give scenarios (base, optimistic, pessimistic) for a ${horizonYears}-year horizon, state your confidence level, and name the signals to monitor. Do not give precise numbers that the context cannot support. ${LANG_RULE[lang]}`;
  const user = `DATA CONTEXT (JSON):\n${JSON.stringify(context, null, 1)}\n\nQUESTION: ${question}\n\n${LANG_RULE[lang]}`;
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
