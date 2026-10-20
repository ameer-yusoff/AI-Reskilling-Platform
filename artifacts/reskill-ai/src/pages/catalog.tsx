import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Award, ExternalLink } from "lucide-react";
import {
  useGetMarketOverview, useGetRole, useListCourses, useListRoles,
  getGetMarketOverviewQueryKey, getGetRoleQueryKey, getListCoursesQueryKey, type CostType,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CostBadge, DataStamp, Empty, ErrorBox, ExplainNote, HrdcBadge, Meter, PageHeader, Panel, Rows, SdgBadge, SkillBadge, catIcon } from "@/components/kit";
import { SECTOR_SDG, roleTitle, useFmt } from "@/lib/fmt";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function Roles() {
  const { t, tk, lang } = useT();
  const f = useFmt();
  const q = useListRoles();
  const [sector, setSector] = useState("all");
  const sectors = useMemo(() => Array.from(new Set((q.data ?? []).map((r) => r.sector))).sort(), [q.data]);
  const list = (q.data ?? []).filter((r) => sector === "all" || r.sector === sector);
  return (
    <>
      <PageHeader eyebrow={t("nav.roles")} title={t("roles.title")} sub={t("roles.sub")}
        actions={<Select value={sector} onValueChange={setSector}><SelectTrigger className="min-h-11 w-56" data-testid="select-sector"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("roles.allSectors")}</SelectItem>{sectors.map((s) => <SelectItem key={s} value={s}>{tk("sector", s)}</SelectItem>)}</SelectContent></Select>} />
      {q.isLoading ? <Rows n={6} h="h-28" /> : q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !list.length ? <Empty title={t("roles.empty")} /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((r, i) => {
            const Icon = catIcon([...r.skills].sort((a, b) => b.importance - a.importance)[0]?.category);
            const title = roleTitle(r, lang);
            return (
              <Link key={r.id} href={`/roles/${r.id}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }} data-testid={`card-role-${r.id}`}
                className="rise flex min-w-0 flex-col rounded-2xl border border-card-border bg-card p-4 shadow-xs transition-colors hover:border-primary">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--maroon-soft))] text-primary"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0"><div title={title} className="truncate whitespace-nowrap font-semibold">{title}</div>
                    <div className="truncate whitespace-nowrap text-[11px] text-muted-foreground">{tk("sector", r.sector)} · SOC {r.socCode}</div></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                  <div><div className="text-muted-foreground">{t("matcher.exposure")}</div><Meter value={r.aiExposure} tone="slate" label={f.frac(r.aiExposure, 0)} /></div>
                  <div><div className="text-muted-foreground">{t("roles.usageMy")}</div><div className="tnum font-semibold">{f.pct(r.aiUsagePctMy, 2)}</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.myColCritical && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">MyCOL</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">RIASEC {r.riasecCode}</span>
                  <span className="text-[10px] text-muted-foreground">{t("roles.skillsN", { n: r.skills.length })}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export function RoleDetail() {
  const { id } = useParams<{ id: string }>();
  const rid = Number(id);
  const { t, tk, lang } = useT();
  const f = useFmt();
  const q = useGetRole(rid, { query: { enabled: rid > 0, queryKey: getGetRoleQueryKey(rid) } });
  const ov = useGetMarketOverview({ query: { queryKey: getGetMarketOverviewQueryKey() } });
  const r = q.data;
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof r>["skills"]>();
    (r?.skills ?? []).forEach((s) => m.set(s.category, [...(m.get(s.category) ?? []), s]));
    return Array.from(m.entries());
  }, [r]);
  return (
    <>
      <Link href="/roles" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />{t("nav.roles")}</Link>
      {q.isLoading ? <Rows n={4} h="h-24" /> : q.isError || !r ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
        <>
          <PageHeader eyebrow={`${tk("sector", r.sector)} · SOC ${r.socCode}`} title={roleTitle(r, lang)} sub={lang !== "en" ? r.title : undefined} />
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              {r.description && <Panel title={t("roles.about")}><p className="text-sm leading-relaxed text-muted-foreground">{r.description}</p></Panel>}
              <Panel title={t("roles.requiredSkills")} meta={t("roles.importanceNote")}>
                <div className="space-y-4">
                  {groups.map(([cat, skills]) => (
                    <div key={cat}>
                      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{tk("cat", cat)}</div>
                      <div className="flex flex-wrap gap-1.5">{[...skills].sort((a, b) => b.importance - a.importance).map((s) => (
                        <span key={s.skillId} className="inline-flex items-center gap-1"><SkillBadge name={s.name} category={s.category} tone={s.importance >= 3 ? "gap" : "neutral"} /><span className="tnum text-[10px] text-muted-foreground">{s.importance}/3</span></span>
                      ))}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel title={t("radar.exposureTitle")} meta={<DataStamp source="Anthropic Economic Index" period={ov.data?.aiUsagePeriod} />}>
                <div className="tnum text-3xl font-bold text-primary">{f.frac(r.aiExposure)}</div>
                <Meter className="mt-2" value={r.aiExposure} />
                <p className="mt-2 text-xs text-muted-foreground">{t("radar.exposureExplain")}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">{t("market.my")}</div><div className="tnum font-semibold">{f.pct(r.aiUsagePctMy, 2)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("market.global")}</div><div className="tnum font-semibold">{f.pct(r.aiUsagePctGlobal, 2)}</div></div>
                </div>
              </Panel>
              <Panel title={t("roles.signals")}>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">RIASEC</dt><dd className="font-semibold">{r.riasecCode}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("roles.mycol")}</dt><dd className="font-semibold">{r.myColCritical ? t("common.yes") : t("common.no")}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-1">{(SECTOR_SDG[r.sector] ?? ["4", "8"]).map((g) => <SdgBadge key={g} code={g} title={tk("sdg", g)} />)}</div>
                <ExplainNote>{t("roles.mycolExplain")}</ExplainNote>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function Courses({ hr }: { hr?: boolean }) {
  const { t, tk } = useT();
  const f = useFmt();
  const [cost, setCost] = useState("all");
  const [hrdc, setHrdc] = useState(!!hr);
  const params = { ...(cost !== "all" ? { costType: cost as CostType } : {}), ...(hrdc ? { hrdcOnly: true } : {}) };
  const q = useListCourses(params, { query: { queryKey: getListCoursesQueryKey(params) } });
  const costs: CostType[] = ["free", "low_cost", "paid"];
  return (
    <>
      <PageHeader eyebrow={t("nav.courses")} title={hr ? t("courses.hrTitle") : t("courses.title")} sub={t("courses.sub")} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={cost} onValueChange={setCost}>
          <SelectTrigger className="min-h-11 w-48" data-testid="select-cost"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("courses.allCosts")}</SelectItem>{costs.map((c) => <SelectItem key={c} value={c}>{tk("cost", c)}</SelectItem>)}</SelectContent>
        </Select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm"><Switch checked={hrdc} onCheckedChange={setHrdc} data-testid="switch-hrdc-only" />{t("courses.hrdcOnly")}</label>
        <span className="tnum text-xs text-muted-foreground">{t("courses.count", { n: q.data?.length ?? 0 })}</span>
      </div>
      {q.isLoading ? <Rows n={6} h="h-24" /> : q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <Empty title={t("courses.empty")}>{t("courses.emptyBody")}</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((c, i) => (
            <article key={c.id} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} data-testid={`card-course-${c.id}`}
              className={cn("rise min-w-0 rounded-2xl border bg-card p-4 shadow-xs", hr && c.hrdcStatus !== "not_claimable" ? "border-accent/60" : "border-card-border")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div title={c.title} className="truncate whitespace-nowrap font-semibold">{c.title}</div>
                  <div className="truncate whitespace-nowrap text-xs text-muted-foreground">{c.provider} · {c.level} · {c.language}</div></div>
                <div className="shrink-0 text-right"><div className="tnum font-bold">{c.costMyr === 0 ? t("cost.free") : f.myr(c.costMyr)}</div><div className="text-[11px] text-muted-foreground">{t("common.hours", { n: c.durationHours })}</div></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{c.skills.map((s) => <SkillBadge key={s.id} name={s.name} category={s.category} />)}</div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5"><HrdcBadge status={c.hrdcStatus} /><CostBadge type={c.costType} />{c.certificate && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold"><Award className="h-3 w-3" />{t("courses.cert")}</span>}</div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span>{t("courses.verified", { d: f.date(c.lastVerified) })}</span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary" data-testid={`link-course-${c.id}`}>{t("common.open")}<ExternalLink className="h-3.5 w-3.5" /></a></div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{t("courses.hrdcHonest")}</p>
    </>
  );
}
