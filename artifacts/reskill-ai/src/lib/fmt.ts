import { LOCALE, useT } from "@/i18n";

export function useFmt() {
  const { lang } = useT();
  const loc = LOCALE[lang];
  const date = (s?: string | null, withTime = false) => {
    if (!s) return "-";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    try {
      return d.toLocaleString(loc, withTime ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return d.toISOString().slice(0, withTime ? 16 : 10).replace("T", " ");
    }
  };
  const num = (n: number | null | undefined, d = 0) => (n == null ? "-" : n.toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: 0 }));
  return {
    date,
    dateTime: (s?: string | null) => date(s, true),
    num,
    myr: (n: number | null | undefined) => (n == null ? "-" : `RM ${num(n, 2)}`),
    pct: (n: number | null | undefined, d = 1) => (n == null ? "-" : `${n.toFixed(d)}%`),
    frac: (n: number | null | undefined, d = 1) => (n == null ? "-" : `${(n * 100).toFixed(d)}%`),
  };
}

export const ACTIVE_PROFILE_KEY = "skilytics.activeProfile";
export const getActiveProfile = () => {
  const v = Number(localStorage.getItem(ACTIVE_PROFILE_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
};
export const setActiveProfile = (id: number | null) => {
  if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, String(id));
  else localStorage.removeItem(ACTIVE_PROFILE_KEY);
};

export const roleTitle = (r: { title: string; titleMs?: string | null; titleZh?: string | null }, lang: string) =>
  (lang === "ms" ? r.titleMs : lang === "zh" ? r.titleZh : r.title) || r.title;

export const SECTOR_SDG: Record<string, string[]> = {
  "Digital & ICT": ["4", "8", "9"], "Business Services": ["4", "8"], Creative: ["4", "8"], Finance: ["4", "8", "10"],
  "Education & Training": ["4"], Logistics: ["4", "8", "9"], "Engineering & Manufacturing": ["4", "9", "12"],
  "Green Economy": ["4", "7", "13"], Healthcare: ["4", "8", "10"],
};
