import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Redirect, useLocation, useParams, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Check, FileUp, GraduationCap, HardHat, HelpCircle, Loader2, Quote, RotateCw, Sparkles, X,
} from "lucide-react";
import {
  useCreateProfile, useGetProfile, useListRiasecQuestions, useRunProfileAgent, useSubmitRiasec, useUpdateProfile, useUploadCv,
  getGetProfileQueryKey,
  type AgentInsight, type CvEvidence, type Profile, type ProfileUpdate, type Segment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AiWait, Brand, ErrorBox, LangToggle, Markdown, Meter, Rows, StatusTag } from "@/components/kit";
import { useAuth, portalHome } from "@/lib/auth";
import {
  CV_MAX_BYTES, CV_OK, OB_STEPS, clearDraft, getObProfile, obScope, readDraft, setObProfile, writeDraft, type ObStep,
} from "@/lib/onboarding";
import { LANG_NAME, errCode, errStatus, useErrText, useT, type DictKey, type Lang } from "@/i18n";
import { en } from "@/i18n/en";
import { ms } from "@/i18n/ms";
import { zh } from "@/i18n/zh";
import { cn } from "@/lib/utils";

const RIASEC = ["R", "I", "A", "S", "E", "C"] as const;
/** Temporary server-side name marker until the CV/review supplies the real name. */
const DRAFT_NAMES = new Set([en["ob.draftName"], ms["ob.draftName"], zh["ob.draftName"]]);
const idx = (s: string | null | undefined) => {
  if (s === "complete") return OB_STEPS.length - 1;
  const i = OB_STEPS.indexOf((s ?? "") as ObStep);
  return i < 0 ? 0 : i;
};
/** Furthest step the profile's actual data supports. */
function capStep(p: Profile): ObStep {
  if (!p.cvExtractionKey) return "cv";
  if (!p.verified) return "review";
  if (!p.riasecScores) return "holland";
  return "save";
}
/** Stored step bounded by what the data actually proves. */
function serverStep(p: Profile): ObStep {
  const cap = idx(capStep(p));
  const stored = p.onboardingStep ? idx(p.onboardingStep) : cap;
  return OB_STEPS[Math.min(cap, stored)];
}
const isAiDown = (e: unknown) => {
  const c = errCode(e);
  return c === "ai_not_connected" || c === "ai_timeout" || c === "ai_unavailable" || c === "ai_failed" || (errStatus(e) ?? 0) >= 502;
};

export default function Onboarding() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const params = useParams<{ step?: string }>();
  const search = useSearch();
  const [, nav] = useLocation();
  const { t } = useT();
  const scope = obScope(user?.id);
  const [pid, setPid] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!loading) { setPid(getObProfile(scope)); setReady(true); } }, [loading, scope]);

  const q = useGetProfile(pid ?? 0, { query: { enabled: !!pid, queryKey: getGetProfileQueryKey(pid ?? 0), retry: false } });
  // Mutations update the cache synchronously, but React Query notifies this
  // observer on a later tick. A route change can render before that notice:
  // guarding against q.data alone would redirect a successful advance back
  // to the old step. Use the authoritative cache snapshot for this render.
  const p = pid ? qc.getQueryData<Profile>(getGetProfileQueryKey(pid)) ?? q.data : q.data;
  const requested = (OB_STEPS as readonly string[]).includes(params.step ?? "") ? (params.step as ObStep) : null;

  useEffect(() => {
    if (q.isError && pid && (errStatus(q.error) === 404 || errStatus(q.error) === 403)) { setObProfile(scope, null); setPid(null); }
  }, [q.isError, q.error, pid, scope]);

  if (loading || !ready) return <Frame><Rows n={4} h="h-16" /></Frame>;
  if (user && user.role !== "individual") return <Redirect to={portalHome(user.role)} />;

  if (!pid) {
    if (requested && requested !== "status") return <Redirect to={`/onboarding/status${search ? `?${search}` : ""}`} replace />;
    return <Frame step="status" maxIdx={0}><StatusStep scope={scope} onCreated={(id) => { setPid(id); nav("/onboarding/cv"); }} /></Frame>;
  }
  if (q.isLoading) return <Frame><Rows n={4} h="h-16" /></Frame>;
  if (q.isError || !p) return <Frame><ErrorBox message={t("ob.loadErr")} retry={() => q.refetch()} /></Frame>;

  const allowed = serverStep(p);
  const step = requested ?? allowed;
  if (!requested) return <Redirect to={`/onboarding/${allowed}`} replace />;
  if (idx(step) > idx(allowed)) return <Redirect to={`/onboarding/${allowed}`} replace />;

  return (
    <Frame step={step} maxIdx={idx(allowed)}>
      {step === "status" && <StatusStep scope={scope} profile={p} onCreated={() => nav("/onboarding/cv")} />}
      {step === "cv" && <CvStep p={p} scope={scope} />}
      {step === "review" && <ReviewStep p={p} scope={scope} />}
      {step === "holland" && <HollandStep p={p} scope={scope} />}
      {step === "results" && <ResultsStep p={p} />}
      {step === "save" && <SaveStep p={p} scope={scope} />}
    </Frame>
  );
}

/* ---------- frame ---------- */
function Frame({ step, maxIdx = 0, children }: { step?: ObStep; maxIdx?: number; children: ReactNode }) {
  const { t } = useT();
  const { user } = useAuth();
  const [help, setHelp] = useState(false);
  const cur = step ? idx(step) : 0;
  return (
    <div className="paper min-h-[100dvh] bg-background">
      <header className="relative z-[2] mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => setHelp(true)} data-testid="button-help"><HelpCircle className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">{t("ob.help.btn")}</span></Button>
          <LangToggle />
          <Link href={user ? "/me" : "/"} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary" aria-label={t("ob.exit")} data-testid="link-exit"><X className="h-4 w-4" /></Link>
        </div>
      </header>
      <main className="relative z-[1] mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-[15rem_1fr] md:px-8">
        <aside aria-label={t("ob.title")}>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{t("ob.title")}</div>
          {step && <div className="tnum mt-1 text-sm text-muted-foreground" data-testid="text-step-count">{t("ob.stepOf", { n: cur + 1, total: OB_STEPS.length })}</div>}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted md:hidden"><div className="h-full rounded-full bg-primary transition-transform duration-500 origin-left" style={{ transform: `scaleX(${(cur + 1) / OB_STEPS.length})` }} /></div>
          <ol className="mt-5 hidden space-y-1 md:block">
            {OB_STEPS.map((s, i) => {
              const done = i < cur || i < maxIdx;
              const reachable = step && i <= maxIdx;
              const body = (
                <span className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors", i === cur && step ? "bg-primary font-semibold text-primary-foreground" : reachable ? "hover:bg-card" : "text-muted-foreground/60")}>
                  <span className={cn("tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    i === cur && step ? "border-accent bg-accent text-accent-foreground" : done ? "border-primary bg-[hsl(var(--maroon-soft))] text-primary" : "border-border")}>
                    {done && i !== cur ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  {t(`ob.step.${s}` as DictKey)}
                </span>
              );
              return <li key={s}>{reachable && i !== cur ? <Link href={`/onboarding/${s}`} data-testid={`link-step-${s}`}>{body}</Link> : body}</li>;
            })}
          </ol>
        </aside>
        <section className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={step ?? "x"} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}
              className="rounded-3xl border border-card-border bg-card p-5 shadow-md md:p-8">
              {children}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
      {help && <Walkthrough start={cur} onClose={() => setHelp(false)} />}
    </div>
  );
}

function Walkthrough({ start, onClose }: { start: number; onClose: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(start);
  const s = OB_STEPS[i];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 md:items-center" role="dialog" aria-modal="true" aria-label={t("ob.help.title")} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl border border-card-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{t("ob.help.title")}</h2>
          <Button variant="ghost" className="min-h-11 min-w-11 px-0" onClick={onClose} aria-label={t("ob.help.close")} data-testid="button-help-close"><X className="h-4 w-4" /></Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("ob.help.intro")}</p>
        <div className="mt-4 flex gap-1">{OB_STEPS.map((x, j) => <span key={x} className={cn("h-1 flex-1 rounded-full", j <= i ? "bg-primary" : "bg-muted")} />)}</div>
        <div className="mt-4 rounded-2xl bg-[hsl(var(--gold-soft))]/60 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">{i + 1}. {t(`ob.step.${s}` as DictKey)}</div>
          <p className="mt-1 text-sm" data-testid="text-help-tip">{t(`ob.help.${s}` as DictKey)}</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" className="min-h-11" onClick={() => setI(0)} data-testid="button-help-replay"><RotateCw className="mr-1.5 h-4 w-4" />{t("ob.help.replay")}</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" disabled={i === 0} onClick={() => setI(i - 1)}>{t("ob.help.prev")}</Button>
            {i < OB_STEPS.length - 1 ? <Button className="min-h-11" onClick={() => setI(i + 1)} data-testid="button-help-next">{t("ob.help.nextTip")}</Button>
              : <Button className="min-h-11" onClick={onClose}>{t("ob.help.close")}</Button>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StepHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
      {sub && <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{sub}</p>}
    </div>
  );
}

function NavBar({ back, children }: { back?: ObStep; children?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="mt-8 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      {back ? <Link href={`/onboarding/${back}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary" data-testid="link-back"><ArrowLeft className="h-4 w-4" />{t("ob.back")}</Link> : <span />}
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </div>
  );
}

/** Patch the profile; moves onboardingStep forward unless forced (e.g. CV re-upload). */
function useAdvance(p: Profile) {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const upd = useUpdateProfile();
  const go = async (next: ObStep | "complete", data: ProfileUpdate = {}, to?: string, force = false) => {
    const body: ProfileUpdate = { ...data };
    if (force || next === "complete" || idx(next) > idx(p.onboardingStep ?? serverStep(p))) body.onboardingStep = next;
    const np = Object.keys(body).length ? await upd.mutateAsync({ id: p.id, data: body }) : p;
    qc.setQueryData(getGetProfileQueryKey(p.id), np);
    qc.invalidateQueries({ queryKey: ["/api/profiles"] });
    nav(to ?? `/onboarding/${next === "complete" ? "save" : next}`);
    return np;
  };
  return { go, upd };
}

/* ---------- 1. status ---------- */
function StatusStep({ scope, profile, onCreated }: { scope: string; profile?: Profile; onCreated: (id: number) => void }) {
  const { t } = useT();
  const et = useErrText();
  const search = useSearch();
  const qc = useQueryClient();
  const pre = new URLSearchParams(search).get("seg");
  const [seg, setSeg] = useState<Segment>(profile?.segment === "graduate" || (!profile && pre === "graduate") ? "graduate" : "worker");
  const create = useCreateProfile();
  const upd = useUpdateProfile();
  const [, nav] = useLocation();
  const busy = create.isPending || upd.isPending;
  const err = create.error ?? upd.error;
  const submit = async () => {
    try {
      if (profile) {
        const np = await upd.mutateAsync({ id: profile.id, data: { segment: seg } });
        qc.setQueryData(getGetProfileQueryKey(profile.id), np);
        onCreated(np.id);
        return;
      }
      // Draft label is a server marker only; real name comes from CV extraction or review.
      // Hours/budget are placeholders the review step requires the user to set explicitly.
      const np = await create.mutateAsync({ data: { name: t("ob.draftName"), segment: seg, weeklyHours: 1, budgetMyr: 0 } });
      setObProfile(scope, np.id);
      const np2 = await upd.mutateAsync({ id: np.id, data: { onboardingStep: "cv" } });
      qc.setQueryData(getGetProfileQueryKey(np.id), np2);
      qc.invalidateQueries({ queryKey: ["/api/profiles"] });
      onCreated(np.id);
    } catch { /* surfaced below */ }
  };
  const opts: [Segment, typeof HardHat, DictKey, DictKey][] = [["worker", HardHat, "landing.worker", "ob.status.workerSub"], ["graduate", GraduationCap, "landing.grad", "ob.status.gradSub"]];
  return (
    <>
      <StepHead title={t("ob.status.title")} sub={t("ob.status.sub")} />
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {opts.map(([s, Icon, title, sub]) => (
          <button key={s} type="button" role="radio" aria-checked={seg === s} onClick={() => setSeg(s)} data-testid={`button-seg-${s}`}
            className={cn("flex min-h-28 items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all", seg === s ? "border-primary bg-[hsl(var(--maroon-soft))]" : "border-border hover:border-primary/50")}>
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", seg === s ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block font-bold">{t(title)}</span><span className="mt-1 block text-sm text-muted-foreground">{t(sub)}</span></span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("ob.status.noName")}</p>
      {err && <div className="mt-4"><ErrorBox message={et(err)} /></div>}
      <NavBar>
        {profile && <Button variant="ghost" className="min-h-11" onClick={() => { setObProfile(scope, null); clearDraft(scope, profile.id); nav("/onboarding/status", { replace: true }); window.location.reload(); }} data-testid="button-start-over">{t("ob.startOver")}</Button>}
        <Button className="min-h-11" disabled={busy} onClick={submit} data-testid="button-status-next">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{profile ? t("ob.next") : t("ob.status.create")}<ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </NavBar>
    </>
  );
}

/* ---------- 2. cv ---------- */
function CvStep({ p, scope }: { p: Profile; scope: string }) {
  const { t, lang } = useT();
  const et = useErrText();
  const qc = useQueryClient();
  const { go, upd } = useAdvance(p);
  const ref = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const lastFile = useRef<File | null>(null);
  const up = useUploadCv({
    mutation: {
      onSuccess: async (np) => {
        setSince(null);
        lastFile.current = null;
        qc.setQueryData(getGetProfileQueryKey(p.id), np);
        // a new extraction invalidates any earlier review draft and verification
        writeDraft(scope, p.id, { form: undefined });
        try { await go("review", { verified: false }, undefined, true); } catch { /* step stays; user can continue */ }
      },
      onError: () => setSince(null),
    },
  });
  const send = (file: File) => {
    setLocal(null);
    if (!CV_OK.test(file.name)) { setLocal(t("ob.cv.badType")); return; }
    if (file.size > CV_MAX_BYTES) { setLocal(t("ob.cv.tooBig")); return; }
    if (!consent) { setLocal(t("ob.cv.consentNeeded")); return; }
    lastFile.current = file;
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      setSince(Date.now());
      // base64 lives only in this request body; never persisted
      up.mutate({ id: p.id, data: { fileName: file.name, contentBase64: s.slice(s.indexOf(",") + 1), consent: true, lang } });
    };
    r.readAsDataURL(file);
  };
  const code = errCode(up.error);
  const upErr = up.error ? (isAiDown(up.error) ? t("ob.cv.aiDown") : errStatus(up.error) === 413 && !code ? t("ob.err.tooLarge") : et(up.error)) : null;
  return (
    <>
      <StepHead title={t("ob.cv.title")} sub={t("ob.cv.sub")} />
      {p.cvFileName && <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm" data-testid="text-cv-existing"><BadgeCheck className="h-4 w-4 text-accent" /><span className="truncate">{t("ob.cv.already", { name: p.cvFileName })}</span></div>}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed">
        <Checkbox checked={consent} onCheckedChange={(v) => { setConsent(v === true); setLocal(null); }} className="mt-0.5 h-5 w-5" data-testid="checkbox-consent" />
        <span>{t("ob.cv.consent")}</span>
      </label>
      <button type="button" disabled={up.isPending} onClick={() => (consent ? ref.current?.click() : setLocal(t("ob.cv.consentNeeded")))} data-testid="button-pick-cv"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) send(f); }}
        className={cn("dotgrid mt-4 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors", drag ? "border-primary bg-[hsl(var(--maroon-soft))]" : consent ? "border-primary/40 hover:border-primary" : "border-border opacity-70")}>
        {up.isPending ? <Loader2 className="h-9 w-9 animate-spin text-primary" /> : <FileUp className="h-9 w-9 text-primary" />}
        <div className="mt-3 text-sm font-semibold">{up.isPending ? t("ob.cv.reading") : p.cvFileName ? t("ob.cv.replace") : t("ob.cv.pick")}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t("ob.cv.formats")}</div>
      </button>
      <input ref={ref} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} data-testid="input-cv-file" />
      <p className="mt-3 text-xs text-muted-foreground">{t("ob.cv.privacy")}</p>
      {up.isPending && since && <div className="mt-4"><AiWait since={since} /></div>}
      {local && <div className="mt-4"><ErrorBox message={local} /></div>}
      {upErr && (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-4" role="alert" data-testid="status-cv-error">
          <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{t("ob.cv.failTitle")}</div>
          <p className="mt-1 text-sm">{upErr}</p>
          {lastFile.current && <Button variant="outline" className="mt-3 min-h-11" onClick={() => lastFile.current && send(lastFile.current)} data-testid="button-cv-retry"><RotateCw className="mr-1.5 h-4 w-4" />{t("ob.cv.retry")}</Button>}
        </div>
      )}
      <NavBar back="status">
        {p.cvExtractionKey && <Button variant="outline" className="min-h-11" disabled={up.isPending || upd.isPending} onClick={() => go("review").catch(() => undefined)} data-testid="button-cv-next">{t("ob.next")}</Button>}
      </NavBar>
    </>
  );
}

/* ---------- 3. review ---------- */
const TEXT_FIELDS = [["name", "ob.review.name"], ["currentRole", "ob.review.role"], ["organization", "ob.review.org"], ["education", "ob.review.edu"], ["experience", "ob.review.exp"], ["goals", "ob.review.goals"]] as const;
type TextKey = (typeof TEXT_FIELDS)[number][0];
const OPTIONAL_WITH_NONE: TextKey[] = ["currentRole", "organization", "education", "experience"];
type Hrdc = "" | "yes" | "no" | "unknown";
type ReviewForm = Record<TextKey, string> & { hours: string; budget: string; hrdc: Hrdc } & Record<`none_${TextKey}`, string>;
const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
type EvState = "supported" | "corrected" | "none";
/** Evidence counts only if the CV actually quoted it AND the current form value still matches. */
function evState(ev: CvEvidence[], field: string, current: string): EvState {
  const real = ev.filter((e) => e.field === field && e.source !== "no_evidence" && !!e.quote);
  if (!real.length) return "none";
  return real.some((e) => norm(e.value) === norm(current) && norm(current) !== "") ? "supported" : "corrected";
}

function initForm(p: Profile, scope: string): ReviewForm {
  const d = (readDraft(scope, p.id).form ?? {}) as Partial<ReviewForm>;
  const prev = !!p.verified;
  const base: ReviewForm = {
    name: DRAFT_NAMES.has(p.name) ? "" : p.name, currentRole: p.currentRole ?? "", organization: p.organization ?? "",
    education: p.education ?? "", experience: p.experience ?? "", goals: p.goals ?? "",
    hours: prev ? String(p.weeklyHours) : "", budget: prev ? String(p.budgetMyr) : "", hrdc: prev ? (p.hrdcEligibilityStatus ?? (p.hrdcEligible ? "yes" : "no")) : "",
    none_name: "", none_goals: "",
    none_currentRole: prev && !p.currentRole ? "1" : "", none_organization: prev && !p.organization ? "1" : "",
    none_education: prev && !p.education ? "1" : "", none_experience: prev && !p.experience ? "1" : "",
  };
  return { ...base, ...d };
}

function ReviewStep({ p, scope }: { p: Profile; scope: string }) {
  const { t } = useT();
  const et = useErrText();
  const qc = useQueryClient();
  const { go, upd } = useAdvance(p);
  const skillUpd = useUpdateProfile({ mutation: { onSuccess: (np) => qc.setQueryData(getGetProfileQueryKey(p.id), np) } });
  const [form, setForm] = useState<ReviewForm>(() => initForm(p, scope));
  useEffect(() => { writeDraft(scope, p.id, { form: form as unknown as Record<string, string> }); }, [form, scope, p.id]);
  const set = (k: keyof ReviewForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ev = p.cvEvidence ?? [];
  const [touched, setTouched] = useState(false);

  const hoursN = Number(form.hours);
  const budgetN = Number(form.budget);
  const errs: Partial<Record<string, string>> = {};
  if (!form.name.trim()) errs.name = t("ob.review.required");
  if (!form.goals.trim()) errs.goals = t("ob.review.required");
  OPTIONAL_WITH_NONE.forEach((k) => { if (!form[k].trim() && !form[`none_${k}`]) errs[k] = t("ob.review.pickOne"); });
  if (form.hours.trim() === "" || !Number.isInteger(hoursN) || hoursN < 1 || hoursN > 60) errs.hours = t("ob.review.hoursErr");
  if (form.budget.trim() === "" || !Number.isFinite(budgetN) || budgetN < 0) errs.budget = t("ob.review.budgetErr");
  if (!form.hrdc) errs.hrdc = t("ob.review.required");
  const ok = Object.keys(errs).length === 0;

  const submit = () => {
    setTouched(true);
    if (!ok || !p.cvExtractionKey) return;
    const val = (k: TextKey) => (form[`none_${k}`] ? "" : form[k].trim());
    go("holland", {
      name: form.name.trim(), currentRole: val("currentRole"), organization: val("organization"), education: val("education"),
      experience: val("experience"), goals: form.goals.trim(), weeklyHours: hoursN, budgetMyr: budgetN,
      hrdcEligible: form.hrdc === "yes", hrdcEligibilityStatus: form.hrdc as "yes" | "no" | "unknown", verified: true,
    }).catch(() => undefined);
  };
  const E = ({ k }: { k: string }) => (touched && errs[k] ? <p className="text-xs text-destructive" data-testid={`error-review-${k}`}>{errs[k]}</p> : null);

  return (
    <>
      <StepHead title={t("ob.review.title")} sub={t("ob.review.sub")} />
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          {TEXT_FIELDS.map(([k, label]) => {
            const long = k === "experience" || k === "education" || k === "goals";
            const none = !!form[`none_${k}`];
            const st = k === "goals" ? null : evState(ev, k, none ? "" : form[k]);
            return (
              <div key={k} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={`f-${k}`}>{t(label)}{(k === "name" || k === "goals") && <span className="text-destructive"> *</span>}</Label>
                  {st && <EvChip s={st} filled={!none && !!form[k].trim()} />}
                </div>
                {long ? <Textarea id={`f-${k}`} rows={3} value={none ? "" : form[k]} disabled={none} onChange={(e) => set(k, e.target.value)} data-testid={`input-review-${k}`} />
                  : <Input id={`f-${k}`} value={none ? "" : form[k]} disabled={none} onChange={(e) => set(k, e.target.value)} className="min-h-11" data-testid={`input-review-${k}`} />}
                {OPTIONAL_WITH_NONE.includes(k) && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={none} onCheckedChange={(v) => set(`none_${k}`, v === true ? "1" : "")} data-testid={`checkbox-none-${k}`} />
                    {t(k === "experience" ? "ob.review.noExp" : "ob.review.noInfo")}
                  </label>
                )}
                <E k={k} />
              </div>
            );
          })}

          <fieldset className="rounded-2xl border border-border p-4">
            <legend className="px-1 text-sm font-bold">{t("ob.review.prefs")}</legend>
            <p className="mb-3 text-xs text-muted-foreground">{t("ob.review.prefsSub")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-hours">{t("ob.review.hours")} <span className="text-destructive">*</span></Label>
                <Input id="f-hours" type="number" inputMode="numeric" min={1} max={60} value={form.hours} onChange={(e) => set("hours", e.target.value)} className="min-h-11" data-testid="input-review-hours" />
                <E k="hours" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-budget">{t("ob.review.budget")} <span className="text-destructive">*</span></Label>
                <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">RM</span>
                  <Input id="f-budget" type="number" inputMode="decimal" min={0} value={form.budget} onChange={(e) => set("budget", e.target.value)} className="min-h-11 pl-11" data-testid="input-review-budget" /></div>
                <E k="budget" />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="text-sm font-medium">{t("ob.review.hrdc")} <span className="text-destructive">*</span></div>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t("ob.review.hrdc")}>
                {(["yes", "no", "unknown"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={form.hrdc === v} onClick={() => set("hrdc", v)} data-testid={`button-hrdc-${v}`}
                    className={cn("min-h-11 rounded-lg border px-2 text-sm font-medium", form.hrdc === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}>
                    {t(v === "yes" ? "ob.review.hrdcYes" : v === "no" ? "ob.review.hrdcNo" : "ob.review.hrdcUnknown")}
                  </button>
                ))}
              </div>
              {form.hrdc === "unknown" && <p className="rounded-lg bg-[hsl(var(--gold-soft))]/60 p-2 text-xs" data-testid="text-hrdc-unknown">{t("ob.review.hrdcUnknownNote")}</p>}
              <E k="hrdc" />
            </div>
          </fieldset>
          <p className="text-[11px] text-muted-foreground">{t("ob.review.draft")}</p>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-accent">{t("ob.review.evidence")}</h2>
            {!ev.length ? <p className="mt-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("ob.review.noEvidence")}</p>
              : <EvidenceList ev={ev} current={(f) => (TEXT_FIELDS.some(([k]) => k === f) ? (form[`none_${f as TextKey}`] ? "" : form[f as TextKey]) : null)} />}
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-accent">{t("ob.review.skills", { n: p.skills.length })}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("ob.review.skillsSub")}</p>
            {!p.skills.length ? <p className="mt-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("ob.review.skillsEmpty")}</p> : (
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {p.skills.map((s) => (
                  <li key={s.skillId} className="flex items-center justify-between gap-2 px-3 py-1.5" data-testid={`row-ob-skill-${s.skillId}`}>
                    <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm"><span className="truncate font-medium">{s.name}</span><StatusTag s={s.status} /></span>
                    <span className="flex shrink-0">
                      {s.status === "inferred" && <Button variant="ghost" className="min-h-11 px-2 text-xs" disabled={skillUpd.isPending} onClick={() => skillUpd.mutate({ id: p.id, data: { addSkills: [{ skillId: s.skillId, status: "self_reported" }] } })} data-testid={`button-ob-confirm-skill-${s.skillId}`}><Check className="mr-1 h-4 w-4" />{t("skills.confirm")}</Button>}
                      <Button variant="ghost" className="min-h-11 min-w-11 px-0" disabled={skillUpd.isPending} onClick={() => skillUpd.mutate({ id: p.id, data: { removeSkillIds: [s.skillId] } })} aria-label={t("skills.remove", { name: s.name })} data-testid={`button-ob-remove-skill-${s.skillId}`}><X className="h-4 w-4" /></Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {skillUpd.error && <div className="mt-2"><ErrorBox message={et(skillUpd.error)} /></div>}
          </div>
        </div>
      </div>
      {!p.cvExtractionKey && <div className="mt-4"><ErrorBox message={t("ob.cv.required")} /></div>}
      {touched && !ok && <div className="mt-4"><ErrorBox message={t("ob.review.fixErrors")} /></div>}
      {upd.error && <div className="mt-4"><ErrorBox message={et(upd.error)} /></div>}
      <NavBar back="cv">
        <Button className="min-h-11" disabled={upd.isPending || !p.cvExtractionKey} onClick={submit} data-testid="button-review-confirm">
          {upd.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}{t("ob.review.confirm")}
        </Button>
      </NavBar>
    </>
  );
}

function EvChip({ s, filled }: { s: EvState; filled: boolean }) {
  const { t } = useT();
  if (s === "supported") return <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--gold-soft))] px-2 py-0.5 text-[11px] font-semibold text-accent"><BadgeCheck className="h-3 w-3" />{t("ob.ev.supported")}</span>;
  if (s === "corrected" || filled) return <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t("ob.ev.self")}</span>;
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t("ob.ev.none")}</span>;
}

function EvidenceList({ ev, current }: { ev: CvEvidence[]; current?: (field: string) => string | null }) {
  const { t } = useT();
  const label = (f: string) => { const x = TEXT_FIELDS.find(([k]) => k === f); return x ? t(x[1]) : f; };
  return (
    <ul className="mt-3 space-y-2">
      {ev.map((e, i) => {
        const noEv = e.source === "no_evidence" || !e.quote;
        const cur = current?.(e.field);
        const matches = !noEv && (cur == null || norm(cur) === norm(e.value));
        return (
          <li key={i} className="rounded-xl border border-border bg-background p-3 text-sm" data-testid={`row-evidence-${i}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label(e.field)}</span>
              <EvChip s={noEv ? "none" : matches ? "supported" : "corrected"} filled={!noEv} />
            </div>
            <div className={cn("mt-0.5 font-medium", !matches && !noEv && "text-muted-foreground line-through")}>{e.value || "-"}</div>
            {!noEv && <div className="mt-1.5 flex gap-1.5 border-l-2 border-accent pl-2 text-xs italic text-muted-foreground"><Quote className="mt-0.5 h-3 w-3 shrink-0" /><span title={t("ob.review.quote")}>{e.quote}</span></div>}
            {!noEv && <div className="mt-1 text-[11px] text-muted-foreground">{t("ob.review.source")}: {e.source === "user_cv" ? t("cv.title") : t("status.self_reported")}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- 4. holland ---------- */
function HollandStep({ p, scope }: { p: Profile; scope: string }) {
  const { t, lang } = useT();
  const et = useErrText();
  const qc = useQueryClient();
  const { go } = useAdvance(p);
  const upd = useUpdateProfile();
  const qs = useListRiasecQuestions();
  const [ans, setAns] = useState<Record<number, number>>(() => {
    const d = readDraft(scope, p.id).answers;
    if (d && Object.keys(d).length) return d;
    return Object.fromEntries((p.riasecAnswers ?? []).map((a) => [a.questionId, a.value]));
  });
  const saveRef = useRef(upd.mutate);
  saveRef.current = upd.mutate;
  const timer = useRef<number | undefined>(undefined);
  const first = useRef(true);
  useEffect(() => {
    writeDraft(scope, p.id, { answers: ans });
    if (first.current) { first.current = false; return; }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveRef.current({ id: p.id, data: { riasecAnswers: Object.entries(ans).map(([k, v]) => ({ questionId: Number(k), value: v })) } });
    }, 1200);
    return () => window.clearTimeout(timer.current);
  }, [ans, scope, p.id]);
  const sub = useSubmitRiasec({
    mutation: {
      onSuccess: async (np) => {
        qc.setQueryData(getGetProfileQueryKey(p.id), np);
        try { await go("results"); } catch { /* shown */ }
      },
    },
  });
  const total = qs.data?.length ?? 0;
  const done = (qs.data ?? []).filter((x) => ans[x.id]).length;
  const valid = new Set((qs.data ?? []).map((x) => x.id));
  const submit = () => sub.mutate({ id: p.id, data: { answers: Object.entries(ans).filter(([k]) => valid.has(Number(k))).map(([k, v]) => ({ questionId: Number(k), value: v })) } });
  return (
    <>
      <StepHead title={t("ob.holland.title")} sub={t("ob.holland.sub")} />
      {qs.isLoading ? <Rows n={6} /> : qs.isError ? <ErrorBox error={qs.error} retry={() => qs.refetch()} /> : !total ? <ErrorBox message={t("riasec.none")} /> : (
        <>
          <div className="sticky top-0 z-10 -mx-2 mb-3 rounded-xl bg-card/95 px-2 py-2 backdrop-blur">
            <Meter value={done} max={total} label={`${done}/${total}`} />
            <div className="mt-1 text-[11px] text-muted-foreground">{t("riasec.scale")}</div>
          </div>
          <ol className="space-y-2">
            {qs.data!.map((qq, i) => (
              <li key={qq.id} className={cn("rounded-xl border p-3 transition-colors", ans[qq.id] ? "border-primary/30 bg-[hsl(var(--maroon-soft))]/30" : "border-border")}>
                <div className="text-sm"><span className="tnum mr-2 text-xs font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>{lang === "ms" ? qq.textMs : lang === "zh" ? qq.textZh : qq.text}</div>
                <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={ans[qq.id] === v} aria-label={`${v}`} onClick={() => setAns((a) => ({ ...a, [qq.id]: v }))} data-testid={`button-answer-${qq.id}-${v}`}
                      className={cn("tnum min-h-11 rounded-lg border text-sm font-semibold transition-all active:scale-95", ans[qq.id] === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}>{v}</button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {sub.error && <div className="mt-4"><ErrorBox message={et(sub.error)} retry={submit} /></div>}
      <NavBar back="review">
        {done < total && <span className="self-center text-xs text-muted-foreground">{t("ob.holland.all", { n: total })}</span>}
        <Button className="min-h-11" disabled={!total || done < total || sub.isPending} onClick={submit} data-testid="button-holland-submit">
          {sub.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("ob.holland.submit")}<ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </NavBar>
    </>
  );
}

/* ---------- 5. results ---------- */
function ResultsStep({ p }: { p: Profile }) {
  const { t, tk, lang } = useT();
  const { go, upd } = useAdvance(p);
  const scores = p.riasecScores;
  const code = p.riasecCode ?? "-";
  const max = scores ? Math.max(1, ...RIASEC.map((k) => scores[k])) : 1;
  // Only show an explanation produced for the CURRENT scores in this session, by explicit request.
  // The server caches by inputs, so pressing again after a refresh reuses the cached reply.
  const [fresh, setFresh] = useState<{ key: string; ins: AgentInsight } | null>(null);
  const [since, setSince] = useState<number | null>(null);
  const scoreKey = scores ? `${code}:${RIASEC.map((k) => scores[k].toFixed(2)).join(",")}` : "";
  const run = useRunProfileAgent({
    mutation: {
      onSuccess: (r) => { setSince(null); setFresh({ key: scoreKey, ins: r }); },
      onError: () => setSince(null),
    },
  });
  const insight = fresh && fresh.key === scoreKey && fresh.ins.lang === lang ? fresh.ins : null;
  const explain = () => { setSince(Date.now()); run.mutate({ id: p.id, data: { agent: "holland", lang } }); };
  const verified = p.verified ? (p.cvEvidence ?? []).filter((e) => e.source !== "no_evidence" && !!e.quote) : [];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="tnum flex gap-1" aria-hidden>
          {code.split("").slice(0, 3).map((c, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12 }}
              className={cn("flex h-16 w-14 items-center justify-center rounded-2xl text-3xl font-extrabold", i === 0 ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--gold-soft))] text-primary")}>{c}</motion.span>
          ))}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl" data-testid="text-riasec-code">{t("ob.results.title", { code })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("ob.results.sub")}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-accent">{t("ob.results.scores")}</h2>
          {scores ? (
            <div className="mt-3 space-y-2.5">
              {RIASEC.map((k) => (
                <div key={k} className="grid grid-cols-[1.5rem_minmax(0,7rem)_1fr] items-center gap-2 text-sm" data-testid={`meter-riasec-${k}`}>
                  <span className="font-bold text-primary">{k}</span><span className="truncate">{tk("riasec", k)}</span>
                  <Meter value={scores[k]} max={max} tone={code.includes(k) ? "maroon" : "gold"} label={scores[k].toFixed(1)} />
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">-</p>}
          <p className="mt-3 text-[11px] text-muted-foreground">{t("riasec.disclaimer")}</p>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-accent">{t("ob.results.verified")}</h2>
          {!verified.length ? <p className="mt-3 text-sm text-muted-foreground">{t("ob.results.none")}</p> : <EvidenceList ev={verified} current={(f) => (f in p ? String((p as unknown as Record<string, unknown>)[f] ?? "") : null)} />}
        </div>
        <div className="rounded-2xl border border-accent/40 bg-[hsl(var(--gold-soft))]/40 p-4 md:p-5">
          <h2 className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-accent" />{t("ob.results.explainTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("ob.results.explainNote")}</p>
          <div className="mt-4">
            {insight ? (
              <div data-testid="text-holland-insight">
                <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full border border-border bg-card px-2 py-0.5" data-testid="text-insight-lang">{t("ob.results.lang", { lang: LANG_NAME[insight.lang as Lang] ?? insight.lang })}</span>
                  {insight.cached && <span className="rounded-full bg-card px-2 py-0.5 font-semibold">{t("common.cached")}</span>}
                </div>
                <Markdown>{insight.content}</Markdown>
              </div>
            ) : run.isPending && since ? <AiWait since={since} /> : (
              <Button className="min-h-11" onClick={explain} disabled={!scores} data-testid="button-explain">{t("ob.results.explainBtn")}</Button>
            )}
            {run.isError && !insight && !run.isPending && (
              <div className="mt-3 rounded-xl border border-destructive/40 bg-card p-3 text-sm" role="alert" data-testid="status-explain-error">
                <p>{t("ob.results.explainFail")}</p>
                <Button variant="outline" className="mt-2 min-h-11" onClick={explain} data-testid="button-explain-retry"><RotateCw className="mr-1.5 h-4 w-4" />{t("ob.results.explainRetry")}</Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <NavBar back="holland">
        <Button className="min-h-11" disabled={upd.isPending} onClick={() => go("save").catch(() => undefined)} data-testid="button-results-next">{t("ob.next")}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
      </NavBar>
    </>
  );
}

/* ---------- 6. save ---------- */
function SaveStep({ p, scope }: { p: Profile; scope: string }) {
  const { t } = useT();
  const et = useErrText();
  const { user } = useAuth();
  const { go, upd } = useAdvance(p);
  const seg = p.segment === "graduate" ? "student" : "worker";
  const finish = async () => {
    try {
      await go("complete", {}, `/me/profiles/${p.id}/intake`);
      clearDraft(scope, p.id);
      setObProfile(scope, null);
    } catch { /* shown */ }
  };
  const next = encodeURIComponent("/onboarding/save");
  return (
    <>
      <StepHead title={t("ob.save.title")} sub={user ? t("ob.save.subUser", { name: user.name }) : t("ob.save.subGuest")} />
      {user ? (
        <Button className="min-h-12 px-6 text-base" disabled={upd.isPending} onClick={finish} data-testid="button-finish">
          {upd.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("ob.save.finish")}<ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/register?next=${next}&seg=${seg}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90" data-testid="link-save-register">{t("ob.save.register")}<ArrowRight className="h-4 w-4" /></Link>
          <Link href={`/login?role=individual&next=${next}`} className="flex min-h-14 items-center justify-center rounded-2xl border border-border bg-background px-5 font-semibold hover:border-primary" data-testid="link-save-login">{t("ob.save.login")}</Link>
          <Link href={`/me/profiles/${p.id}/intake`} className="flex min-h-11 items-center justify-center text-sm text-muted-foreground hover:text-primary sm:col-span-2" data-testid="link-save-guest">{t("ob.save.guestKeep")}</Link>
          <p className="text-center text-xs text-muted-foreground sm:col-span-2">{t("ob.save.guestNote")}</p>
        </div>
      )}
      {upd.error && <div className="mt-4"><ErrorBox message={et(upd.error)} /></div>}
      <NavBar back="results" />
    </>
  );
}
