import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, ClipboardList, FileText, Loader2, Plus, Send, Sparkles, UserRound } from "lucide-react";
import {
  useCreatePrediction, useGetDashboardSummary, useListPredictions, useListProfiles, useListRoles,
  getListPredictionsQueryKey, getGetDashboardSummaryQueryKey, getListProfilesQueryKey, type Segment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiWait, Empty, ErrorBox, GuestBanner, Markdown, PageHeader, Panel, Rows, SegTag, SourceList, Stat } from "@/components/kit";
import { ProfileFormDialog } from "@/components/profile-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { roleTitle, useFmt } from "@/lib/fmt";
import { LANG_SHORT, errCode, useErrText, useT, type Lang } from "@/i18n";

export function Workspace() {
  const { t, tk } = useT();
  const f = useFmt();
  const { user } = useAuth();
  const search = useSearch();
  const [, nav] = useLocation();
  const preset = new URLSearchParams(search).get("new");
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<Segment>("worker");
  useEffect(() => {
    if (preset === "worker" || preset === "graduate") { setSegment(preset); setOpen(true); }
  }, [preset]);
  const profiles = useListProfiles(undefined, { query: { queryKey: getListProfilesQueryKey() } });
  const sum = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const s = sum.data;
  return (
    <>
      <PageHeader eyebrow={t(user ? "portal.individual" : "portal.guest")} title={user ? t("me.hello", { name: user.name }) : t("me.title")} sub={t("me.sub")}
        actions={<Button className="min-h-11" onClick={() => { setSegment("worker"); setOpen(true); }} data-testid="button-new-profile"><Plus className="mr-1.5 h-4 w-4" />{t("me.newProfile")}</Button>} />
      {!user && <div className="mb-5"><GuestBanner /></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("me.statProfiles")} value={s ? f.num(s.profileCount) : "-"} tone="maroon" testid="text-stat-profiles" />
        <Stat label={t("me.statPlans")} value={s ? f.num(s.planCount) : "-"} />
        <Stat label={t("me.statInsights")} value={s ? f.num(s.insightCount) : "-"} />
        <Stat label={t("me.statPredictions")} value={s ? f.num(s.predictionCount) : "-"} tone="gold" />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title={t("me.profiles")}>
          {profiles.isLoading ? <Rows n={3} h="h-20" /> : profiles.isError ? <ErrorBox error={profiles.error} retry={() => profiles.refetch()} /> : !profiles.data?.length ? (
            <Empty title={t("me.emptyTitle")} icon={<UserRound className="h-5 w-5" />} action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="min-h-11" onClick={() => { setSegment("worker"); setOpen(true); }} data-testid="button-start-worker">{t("landing.worker")}</Button>
                <Button variant="outline" className="min-h-11" onClick={() => { setSegment("graduate"); setOpen(true); }} data-testid="button-start-graduate">{t("landing.grad")}</Button>
              </div>}>{t("me.emptyBody")}</Empty>
          ) : (
            <ul className="space-y-2">
              {profiles.data.map((p, i) => (
                <li key={p.id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <Link href={`/me/profiles/${p.id}/intake`} className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary" data-testid={`link-profile-${p.id}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--maroon-soft))] text-sm font-bold text-primary">{p.name.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate whitespace-nowrap font-semibold" title={p.name}>{p.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <SegTag s={p.segment} /><span>{t("me.skillsN", { n: p.skills.length })}</span>
                        {p.riasecCode && <span>RIASEC {p.riasecCode}</span>}
                        {p.cvFileName && <span className="inline-flex items-center gap-0.5"><FileText className="h-3 w-3" />CV</span>}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("me.activity")}>
          {sum.isLoading ? <Rows n={4} h="h-10" /> : sum.isError ? <ErrorBox error={sum.error} retry={() => sum.refetch()} /> : !s?.recentActivity.length ? <p className="text-sm text-muted-foreground">{t("me.noActivity")}</p> : (
            <ul className="space-y-2.5">
              {s.recentActivity.slice(0, 10).map((a, i) => {
                const Icon = a.kind === "plan" ? ClipboardList : a.kind === "prediction" ? Sparkles : a.kind === "insight" ? Bot : UserRound;
                const body = (
                  <span className="flex min-w-0 items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="block truncate whitespace-nowrap text-sm" title={a.label}><b className="font-semibold">{tk("activity", a.kind)}:</b> {a.label}</span>
                      <span className="text-[11px] text-muted-foreground">{f.dateTime(a.createdAt)}</span>
                    </span>
                  </span>
                );
                return <li key={i}>{a.profileId ? <Link href={`/me/profiles/${a.profileId}`} className="block rounded-lg hover:bg-muted/50">{body}</Link> : a.kind === "prediction" ? <Link href="/me/outlook" className="block rounded-lg hover:bg-muted/50">{body}</Link> : body}</li>;
              })}
            </ul>
          )}
        </Panel>
      </div>
      <ProfileFormDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && preset) nav("/me", { replace: true }); }} segment={segment} onDone={(p) => nav(`/me/profiles/${p.id}/intake`)} />
    </>
  );
}

export function Outlook() {
  const { t, lang } = useT();
  const et = useErrText();
  const f = useFmt();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const roles = useListRoles();
  const list = useListPredictions({ query: { queryKey: getListPredictionsQueryKey() } });
  const [question, setQuestion] = useState("");
  const [horizon, setHorizon] = useState(3);
  const [roleId, setRoleId] = useState("none");
  const [since, setSince] = useState<number | null>(null);
  const create = useCreatePrediction({
    mutation: {
      onSuccess: () => { setSince(null); setQuestion(""); qc.invalidateQueries({ queryKey: getListPredictionsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); toast({ title: t("outlook.ready"), description: !user ? t("guest.milestone") : undefined }); },
      onError: () => setSince(null),
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 3) return;
    setSince(Date.now());
    create.mutate({ data: { question: question.trim(), horizonYears: horizon, lang, ...(roleId !== "none" ? { roleId: Number(roleId) } : {}) } });
  };
  return (
    <>
      <PageHeader eyebrow={t("nav.outlook")} title={t("outlook.title")} sub={t("outlook.sub")} />
      {!user && <div className="mb-5"><GuestBanner compact /></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title={t("outlook.ask")} className="h-fit lg:sticky lg:top-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="q">{t("outlook.question")}</Label>
              <Textarea id="q" rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("outlook.questionPh")} data-testid="input-question" /></div>
            <div className="space-y-2"><Label>{t("outlook.horizon", { n: horizon })}</Label>
              <Slider min={1} max={10} step={1} value={[horizon]} onValueChange={(v) => setHorizon(v[0] ?? 3)} className="py-3" aria-label={t("outlook.horizon", { n: horizon })} data-testid="slider-horizon" /></div>
            <div className="space-y-1.5"><Label>{t("outlook.role")}</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="min-h-11" data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">{t("outlook.anyRole")}</SelectItem>{(roles.data ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{roleTitle(r, lang)}</SelectItem>)}</SelectContent>
              </Select></div>
            <Button type="submit" className="min-h-11 w-full" disabled={create.isPending || question.trim().length < 3} data-testid="button-ask">
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{t("outlook.submit")}</Button>
            {create.isPending && since && <AiWait since={since} />}
            {create.isError && <ErrorBox message={errCode(create.error) === "ai_timeout" ? t("ai.timeout") : et(create.error)} />}
            <p className="text-[11px] text-muted-foreground">{t("outlook.note")}</p>
          </form>
        </Panel>
        <div className="space-y-3">
          {list.isLoading ? <Rows n={3} h="h-40" /> : list.isError ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : !list.data?.length ? <Empty title={t("outlook.emptyTitle")} icon={<Sparkles className="h-5 w-5" />}>{t("outlook.emptyBody")}</Empty> : (
            list.data.map((p) => (
              <article key={p.id} className="rise min-w-0 rounded-2xl border border-card-border bg-card p-4 shadow-xs md:p-5" data-testid={`card-prediction-${p.id}`}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">{t("outlook.years", { n: p.horizonYears })}</span>
                  {p.roleTitle && <span className="max-w-[14rem] truncate whitespace-nowrap rounded-full bg-muted px-2 py-0.5" title={p.roleTitle}>{p.roleTitle}</span>}
                  <span className="rounded-full border border-border px-2 py-0.5">{LANG_SHORT[p.lang as Lang] ?? p.lang}</span>
                  {p.cached && <span className="rounded-full bg-[hsl(var(--gold-soft))] px-2 py-0.5 font-semibold text-foreground">{t("common.cached")}</span>}
                  <span>{f.dateTime(p.createdAt)}</span>
                </div>
                <h3 className="mt-2 font-semibold">{p.question}</h3>
                <div className="mt-2"><Markdown>{p.content}</Markdown></div>
                <div className="mt-3 border-t border-border pt-3"><div className="mb-1 text-[11px] font-semibold text-muted-foreground">{t("common.sources")} · {t("agent.model")}: {p.model}</div><SourceList sources={p.sources} /></div>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}
