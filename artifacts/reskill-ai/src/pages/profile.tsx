import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Legend, ResponsiveContainer, Tooltip } from "recharts";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, FileUp, Flag, Loader2, Pencil, Plus, RotateCw, Search, Trash2, X,
} from "lucide-react";
import {
  useDeleteProfile, useGetProfile, useGetProfileMatches, useGetProfilePlan, useCreateProfilePlan, useListRiasecQuestions, useListRoles,
  useListCourses, useSubmitRiasec, useUpdateProfile, useUploadCv, useGetRole, useGetMarketOverview,
  getGetProfileQueryKey, getGetProfileMatchesQueryKey, getGetProfilePlanQueryKey, getGetRoleQueryKey, getGetMarketOverviewQueryKey, getListCoursesQueryKey,
  type Profile, type RoleMatch, type SkillStatus, type Plan,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  CostBadge, DataStamp, Empty, ErrorBox, ExplainNote, GuestBanner, HrdcBadge, Meter, Panel, Rows, SdgBadge, SegTag, SkillBadge, StatusTag, catIcon,
} from "@/components/kit";
import { AGENTS, AgentCard } from "@/components/agent-card";
import { ProfileFormDialog } from "@/components/profile-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { SECTOR_SDG, roleTitle, setActiveProfile, useFmt } from "@/lib/fmt";
import { errStatus, useErrText, useT, type DictKey } from "@/i18n";
import { cn } from "@/lib/utils";

const MODULES = ["intake", "radar", "matcher", "pathway", "agents"] as const;
type Module = (typeof MODULES)[number];
const MOD_LABEL: Record<Module, DictKey> = { intake: "nav.intake", radar: "nav.radar", matcher: "nav.matcher", pathway: "nav.pathway", agents: "nav.agents" };

const MAROON = "#7A1523";
const GOLD = "#C69214";

function useRefreshProfile(pid: number) {
  const qc = useQueryClient();
  return (p?: Profile) => {
    if (p) qc.setQueryData(getGetProfileQueryKey(pid), p);
    qc.invalidateQueries({ queryKey: getGetProfileMatchesQueryKey(pid) });
    qc.invalidateQueries({ queryKey: ["/api/profiles"] });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/cohort/summary"] });
  };
}

export default function ProfileWorkspace({ base, listHref }: { base: string; listHref: string }) {
  const params = useParams<{ id: string; module?: string }>();
  const pid = Number(params.id);
  const mod: Module = (MODULES as readonly string[]).includes(params.module ?? "") ? (params.module as Module) : "intake";
  const { t, tk } = useT();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const q = useGetProfile(pid, { query: { enabled: pid > 0, queryKey: getGetProfileQueryKey(pid), retry: false } });
  const del = useDeleteProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/profiles"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        qc.invalidateQueries({ queryKey: ["/api/cohort/summary"] });
        if (base === "/me/profiles") setActiveProfile(null);
        toast({ title: t("profile.deleted") });
        nav(listHref);
      },
    },
  });
  useEffect(() => { if (base === "/me/profiles" && q.data) setActiveProfile(q.data.id); }, [base, q.data]);
  useEffect(() => { if (q.isError && base === "/me/profiles") setActiveProfile(null); }, [q.isError, base]);

  if (q.isLoading) return <Rows n={5} h="h-20" />;
  if (q.isError || !q.data) return (
    <div className="space-y-4">
      <ErrorBox error={q.error} retry={() => q.refetch()} />
      <Link href={listHref} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary"><ArrowLeft className="h-4 w-4" />{t("common.back")}</Link>
    </div>
  );
  const p = q.data;
  const seg = p.segment === "graduate" ? "graduate" : "worker";
  return (
    <>
      <Link href={listHref} className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-primary" data-testid="link-back"><ArrowLeft className="h-4 w-4" />{t(base === "/me/profiles" ? "nav.workspace" : base.startsWith("/hr") ? "nav.members" : "nav.students")}</Link>
      <header className="rise mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 title={p.name} className="truncate whitespace-nowrap text-2xl font-bold tracking-tight md:text-3xl">{p.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <SegTag s={p.segment} />
            {p.currentRole && <span className="max-w-[16rem] truncate whitespace-nowrap" title={p.currentRole}>{p.currentRole}</span>}
            {p.riasecCode && <span className="tnum rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">RIASEC {p.riasecCode}</span>}
            {p.isGuest && <span className="rounded-full border border-accent px-2 py-0.5 text-[11px] font-semibold text-accent">{t("profile.guestTag")}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => setEdit(true)} data-testid="button-edit-profile"><Pencil className="mr-1.5 h-4 w-4" />{t("common.edit")}</Button>
          <Button variant="outline" className="min-h-11 min-w-11 px-3" onClick={() => setConfirm(true)} aria-label={t("common.delete")} data-testid="button-delete-profile"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </header>

      <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" aria-label={t("profile.modules")}>
        {MODULES.map((m, i) => (
          <Link key={m} href={`${base}/${p.id}/${m}`} data-testid={`tab-module-${m}`}
            className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
              mod === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary hover:text-primary")}>
            {m !== "agents" && <span className={cn("tnum text-xs font-bold", mod === m ? "text-accent" : "text-muted-foreground")}>{i + 1}</span>}
            {t(MOD_LABEL[m])}
          </Link>
        ))}
      </nav>

      {!user && p.isGuest && <div className="mb-4"><GuestBanner compact /></div>}
      {mod !== "agents" && <p className="mb-4 rounded-xl border-l-4 border-accent bg-card px-3 py-2 text-sm text-muted-foreground">{tk(`tip.${seg}`, mod)}</p>}

      {mod === "intake" && <Intake p={p} />}
      {mod === "radar" && <RadarModule p={p} base={base} />}
      {mod === "matcher" && <Matcher p={p} base={base} />}
      {mod === "pathway" && <Pathway p={p} base={base} />}
      {mod === "agents" && (
        <div className="grid gap-3 lg:grid-cols-2">{AGENTS.map((a) => <AgentCard key={a} profile={p} agent={a} roleId={p.targetRoleId} />)}</div>
      )}

      <ProfileFormDialog open={edit} onOpenChange={setEdit} profile={p} lockSegment={base !== "/me/profiles"} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("profile.deleteTitle", { name: p.name })}</AlertDialogTitle><AlertDialogDescription>{t("profile.deleteBody")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => del.mutate({ id: p.id })} data-testid="button-confirm-delete">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- 1. Intake ---------------- */
function Intake({ p }: { p: Profile }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <CvPanel p={p} />
        <AgentCard profile={p} agent="cv" />
      </div>
      <SkillsPanel p={p} />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <RiasecPanel p={p} />
        <AgentCard profile={p} agent="holland" />
      </div>
    </div>
  );
}

function CvPanel({ p }: { p: Profile }) {
  const { t } = useT();
  const et = useErrText();
  const f = useFmt();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const refresh = useRefreshProfile(p.id);
  const up = useUploadCv({
    mutation: {
      onSuccess: (np) => {
        refresh(np);
        toast({ title: t("cv.done"), description: `${t("cv.found", { n: np.skills.length, w: np.cvWordCount ?? 0 })}${!user ? " " + t("guest.milestone") : ""}` });
      },
      onError: (e) => toast({ title: t("cv.failed"), description: et(e), variant: "destructive" }),
    },
  });
  const handle = (file?: File | null) => {
    if (!file) return;
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) { toast({ title: t("cv.badType"), variant: "destructive" }); return; }
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); up.mutate({ id: p.id, data: { fileName: file.name, contentBase64: s.slice(s.indexOf(",") + 1) } }); };
    r.readAsDataURL(file);
  };
  return (
    <Panel title={t("cv.title")} meta={t("cv.meta")}>
      <button type="button" onClick={() => ref.current?.click()} disabled={up.isPending} data-testid="button-upload-cv"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
        className={cn("dotgrid flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-primary bg-[hsl(var(--maroon-soft))]" : "border-border hover:border-primary")}>
        {up.isPending ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : p.cvFileName ? <CheckCircle2 className="h-8 w-8 text-accent" /> : <FileUp className="h-8 w-8 text-primary" />}
        <div className="mt-2 max-w-full truncate whitespace-nowrap text-sm font-semibold">{up.isPending ? t("cv.reading") : p.cvFileName ? t("cv.replace") : t("cv.drop")}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{t("cv.formats")}</div>
      </button>
      <input ref={ref} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-cv-file" />
      {p.cvFileName && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="col-span-2 min-w-0"><dt className="text-xs text-muted-foreground">{t("cv.file")}</dt><dd title={p.cvFileName} className="truncate font-medium">{p.cvFileName}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("cv.words")}</dt><dd className="tnum font-medium">{f.num(p.cvWordCount)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("cv.uploaded")}</dt><dd className="font-medium">{f.date(p.cvUploadedAt)}</dd></div>
        </dl>
      )}
    </Panel>
  );
}

function SkillsPanel({ p }: { p: Profile }) {
  const { t, tk } = useT();
  const et = useErrText();
  const { toast } = useToast();
  const refresh = useRefreshProfile(p.id);
  const roles = useListRoles();
  const courses = useListCourses(undefined, { query: { queryKey: getListCoursesQueryKey() } });
  const [query, setQuery] = useState("");
  const upd = useUpdateProfile({ mutation: { onSuccess: (np) => { refresh(np); toast({ title: t("skills.updated") }); }, onError: (e) => toast({ title: t("err.generic"), description: et(e), variant: "destructive" }) } });
  const have = new Set(p.skills.map((s) => s.skillId));
  const catalogue = useMemo(() => {
    const m = new Map<number, { name: string; category?: string }>();
    (roles.data ?? []).forEach((r) => r.skills.forEach((s) => m.set(s.skillId, { name: s.name, category: s.category })));
    (courses.data ?? []).forEach((c) => c.skills.forEach((s) => { if (!m.has(s.id)) m.set(s.id, { name: s.name, category: s.category }); }));
    return m;
  }, [roles.data, courses.data]);
  const matches = query.trim().length < 1 ? [] : Array.from(catalogue.entries()).filter(([id, s]) => !have.has(id) && s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  const add = (id: number) => { upd.mutate({ id: p.id, data: { addSkills: [{ skillId: id, status: "self_reported" }] } }); setQuery(""); };
  const order: SkillStatus[] = ["evidenced", "self_reported", "inferred"];
  const sorted = [...p.skills].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <Panel title={t("skills.title", { n: p.skills.length })} meta={t("skills.meta")}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("skills.addPh")} className="min-h-11 pl-9" aria-label={t("skills.addPh")} data-testid="input-skill-search" />
        {matches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
            {matches.map(([id, s]) => {
              const Icon = catIcon(s.category);
              return (
                <li key={id}><button onClick={() => add(id)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted" data-testid={`button-add-skill-${id}`}>
                  <Icon className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.category && <span className="shrink-0 text-[11px] text-muted-foreground">{tk("cat", s.category)}</span>}<Plus className="h-4 w-4 shrink-0" />
                </button></li>
              );
            })}
          </ul>
        )}
      </div>
      {!p.skills.length ? <Empty title={t("skills.emptyTitle")}>{t("skills.emptyBody")}</Empty> : (
        <ul className="divide-y divide-border">
          {sorted.map((s) => {
            const cat = catalogue.get(s.skillId)?.category;
            const Icon = catIcon(cat);
            return (
              <li key={s.skillId} className="flex items-start justify-between gap-2 py-2" data-testid={`row-skill-${s.skillId}`}>
                <div className="flex min-w-0 items-start gap-2.5">
                  <Icon className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2"><span title={s.name} className="truncate whitespace-nowrap font-medium">{s.name}</span><StatusTag s={s.status} /></div>
                    {s.evidence && <div title={s.evidence} className="mt-0.5 truncate text-xs italic text-muted-foreground">&ldquo;{s.evidence}&rdquo;</div>}
                  </div>
                </div>
                <div className="flex shrink-0">
                  {s.status === "inferred" && (
                    <Button variant="ghost" className="min-h-11 px-2 text-xs" disabled={upd.isPending} onClick={() => upd.mutate({ id: p.id, data: { addSkills: [{ skillId: s.skillId, status: "self_reported" }] } })} data-testid={`button-confirm-skill-${s.skillId}`}>
                      <Check className="mr-1 h-4 w-4" />{t("skills.confirm")}
                    </Button>
                  )}
                  <Button variant="ghost" className="min-h-11 min-w-11 px-0" disabled={upd.isPending} onClick={() => upd.mutate({ id: p.id, data: { removeSkillIds: [s.skillId] } })} aria-label={t("skills.remove", { name: s.name })} data-testid={`button-remove-skill-${s.skillId}`}><X className="h-4 w-4" /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const RIASEC_KEYS = ["R", "I", "A", "S", "E", "C"] as const;

function RiasecPanel({ p }: { p: Profile }) {
  const { t, tk, lang } = useT();
  const et = useErrText();
  const { toast } = useToast();
  const { user } = useAuth();
  const refresh = useRefreshProfile(p.id);
  const qs = useListRiasecQuestions();
  const [ans, setAns] = useState<Record<number, number>>({});
  const [retake, setRetake] = useState(false);
  const sub = useSubmitRiasec({
    mutation: {
      onSuccess: (np) => { refresh(np); setRetake(false); setAns({}); toast({ title: t("riasec.done", { code: np.riasecCode ?? "-" }), description: !user ? t("guest.milestone") : undefined }); },
      onError: (e) => toast({ title: t("err.generic"), description: et(e), variant: "destructive" }),
    },
  });
  const total = qs.data?.length ?? 0;
  const done = Object.keys(ans).length;
  const scores = p.riasecScores;
  if (scores && !retake) {
    const max = Math.max(1, ...RIASEC_KEYS.map((k) => scores[k]));
    return (
      <Panel title={t("riasec.resultTitle", { code: p.riasecCode ?? "-" })} meta={t("riasec.disclaimer")}
        actions={<Button variant="outline" className="min-h-11" onClick={() => setRetake(true)} data-testid="button-retake-riasec"><RotateCw className="mr-1.5 h-4 w-4" />{t("riasec.retake")}</Button>}>
        <div className="space-y-2">
          {RIASEC_KEYS.map((k) => (
            <div key={k} className="grid grid-cols-[1.5rem_minmax(0,7rem)_1fr] items-center gap-2 text-sm">
              <span className="font-bold text-primary">{k}</span><span className="truncate whitespace-nowrap" title={tk("riasec", k)}>{tk("riasec", k)}</span>
              <Meter value={scores[k]} max={max} tone={p.riasecCode?.includes(k) ? "maroon" : "gold"} label={scores[k].toFixed(1)} />
            </div>
          ))}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title={t("riasec.title")} meta={t("riasec.meta")}>
      {qs.isLoading ? <Rows n={6} /> : qs.isError ? <ErrorBox error={qs.error} retry={() => qs.refetch()} /> : !total ? <Empty title={t("riasec.none")} /> : (
        <>
          <div className="sticky top-14 z-10 -mx-1 mb-3 rounded-xl bg-card/95 px-1 py-2 backdrop-blur lg:top-0">
            <Meter value={done} max={total} label={`${done}/${total}`} />
            <div className="mt-1 text-[11px] text-muted-foreground">{t("riasec.scale")}</div>
          </div>
          <ol className="space-y-2">
            {qs.data!.map((qq, i) => (
              <li key={qq.id} className="rounded-xl border border-border p-3">
                <div className="text-sm"><span className="tnum mr-2 text-xs font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>{lang === "ms" ? qq.textMs : lang === "zh" ? qq.textZh : qq.text}</div>
                <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} role="radio" aria-checked={ans[qq.id] === v} aria-label={`${v}`} onClick={() => setAns((a) => ({ ...a, [qq.id]: v }))} data-testid={`button-answer-${qq.id}-${v}`}
                      className={cn("tnum min-h-11 rounded-lg border text-sm font-semibold transition-all active:scale-95", ans[qq.id] === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>{v}</button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {done < 18 && <span className="text-xs text-muted-foreground">{t("riasec.min", { n: 18 - done })}</span>}
            {retake && <Button variant="ghost" className="min-h-11" onClick={() => setRetake(false)}>{t("common.cancel")}</Button>}
            <Button className="min-h-11" disabled={done < 18 || sub.isPending} data-testid="button-submit-riasec"
              onClick={() => sub.mutate({ id: p.id, data: { answers: Object.entries(ans).map(([k, v]) => ({ questionId: Number(k), value: v })) } })}>
              {sub.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("riasec.submit", { n: done, total })}
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---------------- 2. Radar ---------------- */
const CREDIT: Record<SkillStatus, number> = { evidenced: 1, self_reported: 0.8, inferred: 0.5 };

function RadarModule({ p, base }: { p: Profile; base: string }) {
  const { t, tk, lang } = useT();
  const f = useFmt();
  const m = useGetProfileMatches(p.id, { query: { queryKey: getGetProfileMatchesQueryKey(p.id) } });
  const ov = useGetMarketOverview({ query: { queryKey: getGetMarketOverviewQueryKey() } });
  const [pick, setPick] = useState<number | null>(null);
  const roleId = pick ?? p.targetRoleId ?? m.data?.[0]?.role.id ?? 0;
  const role = useGetRole(roleId, { query: { enabled: roleId > 0, queryKey: getGetRoleQueryKey(roleId) } });
  const r = role.data;
  const data = useMemo(() => {
    if (!r) return [];
    const have = new Map(p.skills.map((s) => [s.skillId, CREDIT[s.status]]));
    if (r.skills.length <= 8) {
      return [...r.skills].sort((a, b) => b.importance - a.importance).map((s) => ({ axis: s.name, required: Math.round((s.importance / 3) * 100), current: Math.round((have.get(s.skillId) ?? 0) * 100) }));
    }
    const g = new Map<string, { imp: number; cred: number; n: number }>();
    r.skills.forEach((s) => { const x = g.get(s.category) ?? { imp: 0, cred: 0, n: 0 }; x.imp += s.importance; x.cred += have.get(s.skillId) ?? 0; x.n++; g.set(s.category, x); });
    return Array.from(g.entries()).map(([c, x]) => ({ axis: tk("cat", c), required: Math.round((x.imp / x.n / 3) * 100), current: Math.round((x.cred / x.n) * 100) }));
  }, [r, p.skills, tk]);
  const gaps = r ? r.skills.filter((s) => !p.skills.some((h) => h.skillId === s.skillId)).sort((a, b) => b.importance - a.importance) : [];
  const options = (m.data ?? []).slice(0, 8);

  if (m.isLoading) return <Rows n={4} h="h-24" />;
  if (m.isError) return <ErrorBox error={m.error} retry={() => m.refetch()} />;
  if (!roleId) return <Empty title={t("radar.emptyTitle")} action={<Link href={`${base}/${p.id}/intake`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">{t("nav.intake")}</Link>}>{t("radar.emptyBody")}</Empty>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("radar.pickRole")}>
        {options.map((x) => (
          <button key={x.role.id} onClick={() => setPick(x.role.id)} title={roleTitle(x.role, lang)} data-testid={`button-radar-role-${x.role.id}`}
            className={cn("inline-flex min-h-11 max-w-[15rem] items-center gap-1.5 rounded-full border px-3 text-sm", roleId === x.role.id ? "border-primary bg-[hsl(var(--maroon-soft))] font-semibold text-primary" : "border-border bg-card")}>
            {p.targetRoleId === x.role.id && <Flag className="h-3.5 w-3.5 shrink-0" />}<span className="truncate whitespace-nowrap">{roleTitle(x.role, lang)}</span>
          </button>
        ))}
      </div>
      {role.isLoading || !r ? <Rows n={3} h="h-40" /> : (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Panel title={t("radar.chartTitle", { role: roleTitle(r, lang) })} meta={t("radar.chartMeta")}>
            {data.length < 3 ? <Empty title={t("radar.fewAxes")} /> : (
              <div className="h-[320px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={data} outerRadius="68%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                    <PolarGrid stroke="hsl(30 16% 84%)" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(350 10% 35%)", fontSize: 11 }} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v)} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name={t("radar.required")} dataKey="required" stroke={MAROON} fill={MAROON} fillOpacity={0.18} strokeWidth={2} />
                    <Radar name={t("radar.current")} dataKey="current" stroke={GOLD} fill={GOLD} fillOpacity={0.4} strokeWidth={2} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(30 16% 86%)", fontSize: 12 }} formatter={(v: number) => `${v}/100`} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            <ExplainNote>{t("radar.howScored")}</ExplainNote>
          </Panel>
          <div className="space-y-4">
            <Panel title={t("radar.exposureTitle")} meta={<DataStamp source="Anthropic Economic Index" period={ov.data?.aiUsagePeriod} />}>
              <div className="flex items-end gap-3"><div className="tnum text-4xl font-bold text-primary">{f.frac(r.aiExposure)}</div><div className="pb-1 text-xs text-muted-foreground">{t("radar.exposureUnit")}</div></div>
              <Meter className="mt-2" value={r.aiExposure} tone="maroon" />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("radar.exposureExplain")}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div><div className="flex justify-between text-xs"><span>{t("market.my")}</span><span className="tnum font-semibold">{f.pct(r.aiUsagePctMy, 2)}</span></div><Meter value={r.aiUsagePctMy} max={Math.max(r.aiUsagePctMy ?? 0, r.aiUsagePctGlobal ?? 0, 0.01)} tone="maroon" /></div>
                <div><div className="flex justify-between text-xs"><span>{t("market.global")}</span><span className="tnum font-semibold">{f.pct(r.aiUsagePctGlobal, 2)}</span></div><Meter value={r.aiUsagePctGlobal} max={Math.max(r.aiUsagePctMy ?? 0, r.aiUsagePctGlobal ?? 0, 0.01)} tone="gold" /></div>
                <p className="text-[11px] text-muted-foreground">{t("radar.usageExplain")}</p>
              </div>
            </Panel>
            <Panel title={t("radar.gapsTitle", { n: gaps.length })}>
              {!gaps.length ? <p className="text-sm text-muted-foreground">{t("radar.noGaps")}</p> : (
                <div className="flex flex-wrap gap-1.5">{gaps.map((s) => <SkillBadge key={s.skillId} name={s.name} category={s.category} tone="gap" />)}</div>
              )}
              <Link href={`${base}/${p.id}/pathway`} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">{t("radar.toPathway")}<ArrowRight className="h-4 w-4" /></Link>
            </Panel>
          </div>
        </div>
      )}
      <AgentCard profile={p} agent="profiler" roleId={roleId} />
    </div>
  );
}

/* ---------------- 3. Matcher ---------------- */
const BREAK: [keyof RoleMatch["breakdown"], number][] = [["skills", 40], ["transferable", 15], ["interest", 20], ["preferences", 10], ["feasibility", 15]];

function Matcher({ p, base }: { p: Profile; base: string }) {
  const { t, tk, lang } = useT();
  const et = useErrText();
  const f = useFmt();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = useRefreshProfile(p.id);
  const m = useGetProfileMatches(p.id, { query: { queryKey: getGetProfileMatchesQueryKey(p.id) } });
  const upd = useUpdateProfile();
  const plan = useCreateProfilePlan();
  const [busy, setBusy] = useState<number | null>(null);
  const build = async (roleId: number) => {
    setBusy(roleId);
    try {
      const np = await upd.mutateAsync({ id: p.id, data: { targetRoleId: roleId } });
      refresh(np);
      const pl = await plan.mutateAsync({ id: p.id, data: { roleId } });
      qc.setQueryData(getGetProfilePlanQueryKey(p.id), pl);
      toast({ title: t("pathway.built", { n: pl.items.length, w: pl.totalWeeks }) });
      nav(`${base}/${p.id}/pathway`);
    } catch (e) {
      toast({ title: t("err.generic"), description: et(e), variant: "destructive" });
    } finally { setBusy(null); }
  };
  if (m.isLoading) return <div className="grid gap-4 lg:grid-cols-3"><Rows n={1} h="h-96" /><Rows n={1} h="h-96" /><Rows n={1} h="h-96" /></div>;
  if (m.isError) return <ErrorBox error={m.error} retry={() => m.refetch()} />;
  if (!m.data?.length) return <Empty title={t("matcher.emptyTitle")}>{t("matcher.emptyBody")}</Empty>;
  return (
    <div className="space-y-4">
      <ExplainNote>{t("matcher.explain")}</ExplainNote>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {m.data.map((x, i) => {
          const target = p.targetRoleId === x.role.id;
          const key = [...x.role.skills].sort((a, b) => b.importance - a.importance).slice(0, 4);
          const matched = new Set(x.matchedSkills.map((s) => s.skillId));
          const RoleIcon = catIcon(key[0]?.category);
          const title = roleTitle(x.role, lang);
          return (
            <article key={x.role.id} style={{ animationDelay: `${i * 50}ms` }} data-testid={`card-match-${x.role.id}`}
              className={cn("rise flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-primary md:p-5", target ? "border-primary ring-1 ring-primary" : "border-card-border")}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--maroon-soft))] text-primary"><RoleIcon className="h-5 w-5" /></span>
                <div className="text-right"><div className="tnum text-3xl font-bold leading-none text-primary">{Math.round(x.score)}</div><div className="text-[10px] font-medium text-muted-foreground">{t("matcher.fit")}</div></div>
              </div>
              <Link href={`/roles/${x.role.id}`} title={title} className="mt-3 truncate whitespace-nowrap text-base font-bold hover:text-primary">{title}</Link>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="truncate whitespace-nowrap">{tk("sector", x.role.sector)}</span><span>·</span><span>SOC {x.role.socCode}</span>
                {x.role.myColCritical && <span className="rounded-full bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">MyCOL</span>}
                {target && <span className="inline-flex items-center gap-0.5 font-semibold text-primary"><Flag className="h-3 w-3" />{t("matcher.target")}</span>}
              </div>

              <div className="mt-3 space-y-1">
                {BREAK.map(([k, max]) => (
                  <div key={k} className="grid grid-cols-[minmax(0,6.5rem)_1fr] items-center gap-2 text-[11px]">
                    <span className="truncate whitespace-nowrap text-muted-foreground" title={tk("break", k)}>{tk("break", k)}</span>
                    <Meter value={x.breakdown[k]} max={max} label={`${x.breakdown[k].toFixed(1)}/${max}`} />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="mb-1.5 truncate whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("matcher.keySkills")}</div>
                <div className="flex flex-wrap gap-1.5">{key.map((s) => <SkillBadge key={s.skillId} name={s.name} category={s.category} tone={matched.has(s.skillId) ? "have" : "gap"} />)}</div>
                {x.gapSkills.length > 0 && <div className="mt-1.5 text-[11px] text-muted-foreground">{t("matcher.gapCount", { n: x.gapSkills.length })}</div>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                <div className="min-w-0"><div className="truncate whitespace-nowrap text-muted-foreground" title={t("matcher.marketSignal")}>{t("matcher.marketSignal")}</div><Meter value={x.marketDemand} max={100} tone="gold" label={String(Math.round(x.marketDemand))} /></div>
                <div className="min-w-0"><div className="truncate whitespace-nowrap text-muted-foreground" title={t("matcher.exposure")}>{t("matcher.exposure")}</div><Meter value={x.role.aiExposure} tone="slate" label={f.frac(x.role.aiExposure, 0)} /></div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1.5 truncate whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" title={t("matcher.sdgNote")}>{t("matcher.sdgNote")}</div>
                <div className="flex flex-wrap gap-1">{(SECTOR_SDG[x.role.sector] ?? ["4", "8"]).map((g) => <SdgBadge key={g} code={g} title={tk("sdg", g)} />)}</div>
              </div>

              <Button className="mt-4 min-h-11 w-full" disabled={busy !== null} onClick={() => build(x.role.id)} data-testid={`button-build-${x.role.id}`}>
                {busy === x.role.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
                <span className="truncate">{t("matcher.build")}</span>
              </Button>
            </article>
          );
        })}
      </div>
      <AgentCard profile={p} agent="fitter" roleId={p.targetRoleId ?? m.data[0]?.role.id} />
    </div>
  );
}

/* ---------------- 4. Pathway ---------------- */
function Pathway({ p, base }: { p: Profile; base: string }) {
  const { t } = useT();
  const et = useErrText();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const q = useGetProfilePlan(p.id, { query: { queryKey: getGetProfilePlanQueryKey(p.id), retry: false } });
  const rebuild = useCreateProfilePlan({
    mutation: {
      onSuccess: (pl) => { qc.setQueryData(getGetProfilePlanQueryKey(p.id), pl); qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] }); toast({ title: t("pathway.built", { n: pl.items.length, w: pl.totalWeeks }), description: !user ? t("guest.milestone") : undefined }); },
      onError: (e) => toast({ title: t("err.generic"), description: et(e), variant: "destructive" }),
    },
  });
  if (q.isLoading) return <Rows n={5} />;
  const none = q.isError && (errStatus(q.error) === 404);
  if (q.isError && !none) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const pl = q.data;
  if (!pl || none) {
    return (
      <Empty title={t("pathway.emptyTitle")} action={
        <div className="flex flex-wrap justify-center gap-2">
          {p.targetRoleId && <Button className="min-h-11" disabled={rebuild.isPending} onClick={() => rebuild.mutate({ id: p.id, data: { roleId: p.targetRoleId! } })} data-testid="button-build-target">{rebuild.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("pathway.buildTarget")}</Button>}
          <Link href={`${base}/${p.id}/matcher`} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold">{t("pathway.chooseRole")}</Link>
        </div>
      }>{t("pathway.emptyBody")}</Empty>
    );
  }
  return (
    <div className="space-y-4">
      <PlanView pl={pl} onRebuild={() => rebuild.mutate({ id: p.id, data: { roleId: pl.roleId } })} rebuilding={rebuild.isPending} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AgentCard profile={p} agent="planner" roleId={pl.roleId} />
        <AgentCard profile={p} agent="sdg" roleId={pl.roleId} />
      </div>
    </div>
  );
}

function PlanView({ pl, onRebuild, rebuilding }: { pl: Plan; onRebuild: () => void; rebuilding: boolean }) {
  const { t, tk } = useT();
  const f = useFmt();
  const weeks = Math.max(pl.totalWeeks, 1, ...pl.items.map((i) => i.startWeek - 1 + i.durationWeeks));
  const ticks = Array.from(new Set([1, Math.ceil(weeks / 4), Math.ceil(weeks / 2), Math.ceil((3 * weeks) / 4), weeks])).filter((w) => w >= 1);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 min-w-0 rounded-2xl bg-primary p-4 text-primary-foreground">
          <div className="text-xs text-primary-foreground/70">{t("pathway.target")}</div>
          <div title={pl.roleTitle} className="mt-1 truncate whitespace-nowrap text-lg font-bold">{pl.roleTitle}</div>
          <div className="mt-1 text-[11px] text-primary-foreground/70">{t("pathway.created", { d: f.date(pl.createdAt) })}</div>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-4"><div className="text-xs text-muted-foreground">{t("pathway.duration")}</div><div className="tnum mt-1 text-2xl font-bold">{t("common.weeks", { n: pl.totalWeeks })}</div></div>
        <div className="rounded-2xl border border-card-border bg-card p-4"><div className="text-xs text-muted-foreground">{t("pathway.cost")}</div><div className="tnum mt-1 text-2xl font-bold text-accent">{pl.totalCostMyr === 0 ? t("cost.free") : f.myr(pl.totalCostMyr)}</div></div>
      </div>
      <Panel title={t("pathway.timeline", { n: pl.items.length })} meta={t("pathway.hrdcNote")}
        actions={<Button variant="outline" className="min-h-11" disabled={rebuilding} onClick={onRebuild} data-testid="button-rebuild">{rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}<span className="ml-1.5 hidden sm:inline">{t("pathway.rebuild")}</span></Button>}>
        {!pl.items.length ? <Empty title={t("pathway.noItems")} /> : (
          <ol className="relative space-y-3">
            <div className="relative ml-0 hidden h-5 md:ml-[calc(40%+0.75rem)] md:block">
              {ticks.map((w) => <span key={w} className="tnum absolute -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${((w - 0.5) / weeks) * 100}%` }}>{t("pathway.wk", { n: w })}</span>)}
            </div>
            {pl.items.map((it, i) => (
              <li key={`${it.courseId}-${i}`} className="rise grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[40%_1fr] md:items-center md:gap-3" style={{ animationDelay: `${i * 60}ms` }} data-testid={`row-plan-${it.courseId}`}>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--maroon-soft))] text-[11px] font-bold text-primary">{i + 1}</span>
                    <a href={it.url} target="_blank" rel="noreferrer" title={it.title} className="min-w-0 truncate whitespace-nowrap text-sm font-semibold hover:text-primary">{it.title}</a>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate whitespace-nowrap">{it.provider}</span>
                    <span className="tnum font-semibold text-foreground">{it.costMyr === 0 ? t("cost.free") : f.myr(it.costMyr)}</span>
                    <CostBadge type={it.costMyr === 0 ? "free" : it.costMyr <= 200 ? "low_cost" : "paid"} />
                    <HrdcBadge status={it.hrdcStatus} />
                  </div>
                  {it.sdgTargets.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{it.sdgTargets.map((s) => <SdgBadge key={s.code} code={s.code} title={`${s.code} ${s.title}`} />)}</div>}
                </div>
                <div className="min-w-0">
                  <div className="relative h-9 rounded-lg bg-muted/70">
                    <div className="absolute inset-y-1 flex items-center overflow-hidden rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground"
                      style={{ left: `${((it.startWeek - 1) / weeks) * 100}%`, width: `${Math.max((it.durationWeeks / weeks) * 100, 6)}%` }} title={it.skills.join(", ")}>
                      <span className="truncate whitespace-nowrap">{t("pathway.wkRange", { a: it.startWeek, b: it.startWeek + it.durationWeeks - 1 })}</span>
                    </div>
                  </div>
                  <div title={it.skills.join(", ")} className="mt-1 truncate whitespace-nowrap text-[11px] text-muted-foreground">{it.skills.join(" · ")}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {pl.uncoveredSkills.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-primary/40 p-3 text-sm">
            <div className="font-semibold">{t("pathway.uncovered")}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{pl.uncoveredSkills.map((s) => <SkillBadge key={s} name={s} tone="gap" />)}</div>
            <p className="mt-2 text-xs text-muted-foreground">{t("pathway.uncoveredHint")}</p>
            <Link href="/courses" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">{t("nav.courses")}<ArrowRight className="h-4 w-4" /></Link>
          </div>
        )}
        <span className="sr-only">{tk("cost", "free")}</span>
      </Panel>
    </>
  );
}
