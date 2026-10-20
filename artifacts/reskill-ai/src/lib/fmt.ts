import { format, formatDistanceToNow } from "date-fns";

export const SEGMENT_LABEL: Record<string, string> = {
  worker: "Pekerja berisiko",
  graduate: "Graduan / penukar kerjaya",
  employer: "Majikan / HR",
  career_centre: "Pusat kerjaya TVET / IPT",
};

export const AGENT_LABEL: Record<string, { name: string; desc: string }> = {
  cv: { name: "Agen CV", desc: "Ringkasan kemahiran daripada CV" },
  holland: { name: "Agen Holland", desc: "Tafsiran profil minat RIASEC" },
  profiler: { name: "Agen Profiler", desc: "Gambaran keseluruhan profil" },
  fitter: { name: "Agen Fitter", desc: "Penjelasan padanan peranan" },
  planner: { name: "Agen Planner", desc: "Naratif pelan latihan" },
  sdg: { name: "Agen SDG", desc: "Pemetaan sasaran SDG" },
};

export const RIASEC_LABEL: Record<string, string> = {
  R: "Realistik", I: "Penyiasat", A: "Artistik", S: "Sosial", E: "Keusahawanan", C: "Konvensional",
};

export const myr = (n: number | null | undefined) =>
  n == null ? "-" : `RM ${n.toLocaleString("ms-MY", { maximumFractionDigits: 2 })}`;

export const pct = (n: number | null | undefined, d = 1) => (n == null ? "-" : `${n.toFixed(d)}%`);
export const frac = (n: number | null | undefined) => (n == null ? "-" : `${(n * 100).toFixed(1)}%`);

export function dt(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : format(d, "d MMM yyyy, HH:mm");
}
export function day(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : format(d, "d MMM yyyy");
}
export function ago(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : formatDistanceToNow(d, { addSuffix: true });
}

export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}
export function errMsg(e: unknown): string {
  return (e as Error | null)?.message ?? "Ralat tidak diketahui";
}
