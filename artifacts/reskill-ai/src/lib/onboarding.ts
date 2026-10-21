// Resumable onboarding state. Never stores the CV file or its base64 content.
export const OB_STEPS = ["status", "cv", "review", "holland", "results", "save"] as const;
export type ObStep = (typeof OB_STEPS)[number];

const PREFIX = "skilytics.onboarding.";
export const obScope = (userId?: number | null) => (userId ? `u${userId}` : "guest");

export function getObProfile(scope: string): number | null {
  const v = Number(localStorage.getItem(PREFIX + scope));
  return Number.isFinite(v) && v > 0 ? v : null;
}
export function setObProfile(scope: string, id: number | null) {
  if (id) localStorage.setItem(PREFIX + scope, String(id));
  else localStorage.removeItem(PREFIX + scope);
}
/** Called after login/register: guest work is claimed server-side, so move the pointer. */
export function moveGuestObToUser(userId: number) {
  const g = getObProfile("guest");
  if (g) { setObProfile(obScope(userId), g); setObProfile("guest", null); }
}
export function clearAllOb() {
  Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => sessionStorage.removeItem(k));
}

export interface ObDraft {
  form?: Record<string, string>;
  answers?: Record<number, number>;
}
const draftKey = (scope: string, pid: number) => `${PREFIX}draft.${scope}.${pid}`;
export function readDraft(scope: string, pid: number): ObDraft {
  try { return JSON.parse(sessionStorage.getItem(draftKey(scope, pid)) ?? "{}") as ObDraft; } catch { return {}; }
}
export function writeDraft(scope: string, pid: number, patch: ObDraft) {
  const cur = readDraft(scope, pid);
  sessionStorage.setItem(draftKey(scope, pid), JSON.stringify({ ...cur, ...patch }));
}
export function clearDraft(scope: string, pid: number) { sessionStorage.removeItem(draftKey(scope, pid)); }

/** Only allow internal app paths as post-auth redirects. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /^\/[a-z]+:/i.test(raw)) return null;
  return raw;
}

export const CV_MAX_BYTES = 8 * 1024 * 1024;
export const CV_OK = /\.(pdf|docx|txt)$/i;
