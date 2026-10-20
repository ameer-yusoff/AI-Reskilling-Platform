import { useState } from "react";
import { Link } from "wouter";
import { ExternalLink, Cpu, Server } from "lucide-react";
import {
  useGetAiStatus, useGetCohortSummary, useListCourses, useListOrganizations, useListSdgTargets,
  getGetCohortSummaryQueryKey, getListCoursesQueryKey, type CostType,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBox, HrdcBadge, Meter, PageHeader, Panel, Rows, SegTag, Stat } from "@/components/bits";
import { RIASEC_LABEL, SEGMENT_LABEL, day, frac, myr } from "@/lib/fmt";
import { cn } from "@/lib/utils";

const COST: Record<string, string> = { free: "Percuma", low_cost: "Kos rendah", paid: "Berbayar" };

export function Courses() {
  const [cost, setCost] = useState("all");
  const [hrdc, setHrdc] = useState(false);
  const params = { ...(cost !== "all" ? { costType: cost as CostType } : {}), ...(hrdc ? { hrdcOnly: true } : {}) };
  const q = useListCourses(params, { query: { queryKey: getListCoursesQueryKey(params) } });
  return (
    <>
      <PageHeader kicker="Katalog kursus" title="Latihan percuma, kos rendah & HRD Corp"
        sub="Status HRD Corp dipaparkan dengan jujur: hanya 'disahkan' jika telah disemak. Tarikh semakan terakhir ditunjukkan pada setiap kursus." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={cost} onValueChange={setCost}><SelectTrigger className="w-48" data-testid="select-cost"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua kos</SelectItem>{Object.entries(COST).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={hrdc} onCheckedChange={setHrdc} data-testid="switch-hrdc-only" />HRD Corp sahaja</label>
        <span className="num text-xs text-muted-foreground">{q.data?.length ?? 0} kursus</span>
      </div>
      {q.isLoading ? <Rows n={6} h="h-20" /> : q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <Empty title="Tiada kursus sepadan">Cuba longgarkan penapis.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((c, i) => (
            <article key={c.id} className="rise rounded-md border border-card-border bg-card p-4" style={{ animationDelay: `${i * 25}ms` }} data-testid={`card-course-${c.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-display font-bold leading-tight">{c.title}</div><div className="text-xs text-muted-foreground">{c.provider} · {c.level} · {c.language}{c.certificate ? " · sijil" : ""}</div></div>
                <div className="text-right"><div className="num font-semibold">{c.costMyr === 0 ? "Percuma" : myr(c.costMyr)}</div><div className="text-[10px] uppercase text-muted-foreground">{COST[c.costType]}</div></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{c.skills.map((s) => <span key={s.id} className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px]">{s.name}</span>)}</div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <HrdcBadge status={c.hrdcStatus} />
                <div className="num flex items-center gap-3 text-[10px] text-muted-foreground"><span>{c.durationHours} jam</span><span>disemak {day(c.lastVerified)}</span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary" data-testid={`link-course-${c.id}`}>Buka<ExternalLink className="h-3 w-3" /></a></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Bars({ items, testid }: { items: { label: string; count: number }[]; testid: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return <div className="text-sm text-muted-foreground">Tiada data.</div>;
  return (
    <ul className="space-y-1.5" data-testid={testid}>
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[1fr_2fr_2rem] items-center gap-2 text-sm"><span className="truncate">{it.label}</span>
          <div className="h-2 rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary transition-transform" style={{ width: `${(it.count / max) * 100}%` }} /></div><span className="num text-right text-xs">{it.count}</span></li>
      ))}
    </ul>
  );
}

export function Cohort() {
  const orgs = useListOrganizations();
  const [org, setOrg] = useState("all");
  const params = org !== "all" ? { organization: org } : undefined;
  const q = useGetCohortSummary(params, { query: { queryKey: getGetCohortSummaryQueryKey(params) } });
  const c = q.data;
  return (
    <>
      <PageHeader kicker="Pandangan HR / pusat kerjaya" title={c?.organization ?? "Semua organisasi"} sub="Ringkasan kohort: segmen, jurang kemahiran teratas, taburan RIASEC dan liputan pelan."
        actions={<Select value={org} onValueChange={setOrg}><SelectTrigger className="w-64" data-testid="select-cohort-org"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua organisasi</SelectItem>{orgs.data?.map((o) => <SelectItem key={o.organization} value={o.organization}>{o.organization} ({o.count})</SelectItem>)}</SelectContent></Select>} />
      {q.isLoading ? <Rows n={5} h="h-20" /> : q.isError || !c ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !c.profileCount ? <Empty title="Kohort kosong">Tiada profil untuk organisasi ini. Tetapkan medan organisasi semasa mencipta profil.</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Profil" value={c.profileCount} testid="text-cohort-count" />
            <Stat label="Purata pendedahan AI peranan semasa" value={frac(c.avgExposure)} />
            <Stat label="Liputan pelan" value={frac(c.planCoverage ?? 0)} foot="profil dengan pelan latihan" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title="Segmen"><Bars testid="list-segments" items={c.segmentCounts.map((s) => ({ ...s, label: SEGMENT_LABEL[s.label] ?? s.label }))} /></Panel>
            <Panel title="Jurang kemahiran teratas"><Bars testid="list-gaps" items={c.topGaps} /></Panel>
            <Panel title="Taburan RIASEC" meta="Huruf dominan"><Bars testid="list-riasec" items={c.riasecDistribution.map((s) => ({ ...s, label: `${s.label} ${RIASEC_LABEL[s.label] ?? ""}` }))} /></Panel>
          </div>
          <Panel className="mt-4" title="Ahli kohort">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="num text-left text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-2">Nama</th><th>Segmen</th><th>RIASEC</th><th>Padanan teratas</th><th className="w-36">Pendedahan semasa</th><th>Pelan</th></tr></thead>
              <tbody className="divide-y divide-border">{c.members.map((m) => (
                <tr key={m.id}><td className="py-2"><Link href={`/profiles/${m.id}`} className="font-medium hover:text-primary" data-testid={`link-member-${m.id}`}>{m.name}</Link><div className="text-xs text-muted-foreground">{m.currentRole ?? "-"}</div></td>
                  <td><SegTag s={m.segment} /></td><td className="num text-xs">{m.riasecCode ?? "-"}</td>
                  <td className="text-xs">{m.topMatchTitle ?? "-"} {m.topMatchScore != null && <span className="num text-primary">{Math.round(m.topMatchScore)}</span>}</td>
                  <td className="pr-3"><Meter value={m.currentRoleExposure} tone="accent" label={frac(m.currentRoleExposure)} /></td>
                  <td>{m.hasPlan ? <span className="num rounded-sm bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">ADA</span> : <span className="text-xs text-muted-foreground">-</span>}</td></tr>
              ))}</tbody></table></div>
          </Panel>
        </>
      )}
    </>
  );
}

export function Sdg() {
  const q = useListSdgTargets();
  return (
    <>
      <PageHeader kicker="UN Sustainable Development Goals" title="Sasaran SDG untuk pemetaan pelan" sub="Setiap item pelan latihan dipetakan ke sasaran berikut, terutamanya SDG 4 (pendidikan berkualiti) dan SDG 8 (pekerjaan wajar)." />
      {q.isLoading ? <Rows n={5} h="h-20" /> : q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <Empty title="Tiada sasaran SDG" /> : (
        <div className="grid gap-3 md:grid-cols-2">{q.data.map((s, i) => (
          <div key={s.code} className="rise flex gap-4 rounded-md border border-card-border bg-card p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="num flex h-14 w-16 shrink-0 items-center justify-center rounded-sm bg-sidebar text-lg font-semibold text-sidebar-primary">{s.code}</div>
            <div><div className="font-display font-bold">{s.title}</div><p className="text-sm text-muted-foreground">{s.description}</p></div>
          </div>))}</div>
      )}
    </>
  );
}

export function AiSettings() {
  const q = useGetAiStatus();
  const a = q.data;
  const Row = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="num flex items-center gap-2">{ok !== undefined && <span className={cn("h-2 w-2 rounded-full", ok ? "bg-primary" : "bg-accent")} />}{v}</span></div>
  );
  return (
    <>
      <PageHeader kicker="Tetapan · Enjin AI" title="Status enjin GPU" actions={<Button variant="outline" onClick={() => q.refetch()} data-testid="button-refresh-ai">Semak semula</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="RunPod" meta="Pembekal inferens">
          {q.isLoading ? <Rows /> : q.isError || !a ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
            <>
              <Row k="Sambungan" v={a.connected ? "Disambungkan" : "Enjin AI belum disambungkan"} ok={a.connected} />
              <Row k="Pembekal" v={a.provider} />
              <Row k="Model utama" v={a.mainModel ?? "-"} ok={a.mainConfigured} />
              <Row k="Model ringan" v={a.lightModel ?? "-"} ok={a.lightConfigured} />
              {a.message && <p className="mt-3 rounded-sm bg-muted p-3 text-xs">{a.message}</p>}
            </>
          )}
        </Panel>
        <Panel title="Apa yang memerlukan GPU?">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="mb-2 flex items-center gap-2 font-semibold"><Cpu className="h-4 w-4 text-accent" />Perlu GPU</div>
              <ul className="space-y-1 text-sm text-muted-foreground"><li>Naratif agen (CV, Holland, Profiler, Fitter, Planner, SDG)</li><li>Ramalan masa depan (Analyst)</li></ul>
              <p className="mt-2 text-xs">Dijalankan hanya atas permintaan dan dicache.</p></div>
            <div><div className="mb-2 flex items-center gap-2 font-semibold"><Server className="h-4 w-4 text-primary" />Tanpa GPU</div>
              <ul className="space-y-1 text-sm text-muted-foreground"><li>Pengekstrakan kemahiran CV</li><li>Pemarkahan RIASEC</li><li>Padanan & skor peranan</li><li>Pelan latihan Gantt</li><li>Carta pasaran</li></ul></div>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function NotFound() {
  return (
    <div className="songket flex min-h-[60vh] flex-col items-center justify-center rounded-md text-center">
      <div className="num text-sm text-primary">404</div>
      <h1 className="font-display mt-2 text-4xl font-bold">Halaman tidak ditemui</h1>
      <p className="mt-2 text-muted-foreground">Laluan ini tiada dalam instrumen.</p>
      <Link href="/" className="mt-6 rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground" data-testid="link-404-home">Kembali ke papan pemuka</Link>
    </div>
  );
}
