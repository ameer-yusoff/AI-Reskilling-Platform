import { RIASEC_QUESTIONS, type RiasecType } from "../data/riasec";
import type { StoredRiasec } from "@workspace/db";

export function scoreRiasec(answers: { questionId: number; value: number }[]) {
  const sums: Record<RiasecType, number[]> = { R: [], I: [], A: [], S: [], E: [], C: [] };
  const ids = new Set<number>();
  for (const a of answers) {
    const q = RIASEC_QUESTIONS.find((x) => x.id === a.questionId);
    if (!q || ids.has(a.questionId) || !Number.isInteger(a.value) || a.value < 1 || a.value > 5) throw new Error("invalid_input");
    ids.add(a.questionId);
    sums[q.type].push(a.value);
  }
  if (answers.length < 18 || Object.values(sums).some((s) => s.length < 3)) throw new Error("riasec_incomplete");
  const order: RiasecType[] = ["R", "I", "A", "S", "E", "C"];
  const scores = Object.fromEntries(order.map((k) => [k, Math.round(sums[k].reduce((a, b) => a + b, 0) / sums[k].length * 100) / 100])) as StoredRiasec;
  const code = [...order].sort((a, b) => scores[b] - scores[a] || order.indexOf(a) - order.indexOf(b)).slice(0, 3).join("");
  return { scores, code };
}
