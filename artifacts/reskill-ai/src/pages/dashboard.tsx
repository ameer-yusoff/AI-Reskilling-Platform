import { Link } from "wouter";
import { ArrowUpRight, Building2, GraduationCap, HardHat, School } from "lucide-react";
import { useGetAiStatus, useGetDashboardSummary, useGetMarketOverview } from "@workspace/api-client-react";
import { Empty, ErrorBox, PageHeader, Panel, Rows, Stat, Stamp } from "@/components/bits";
import { ago, day, pct } from "@/lib/fmt";

const SEGS = [
  { seg: "worker", icon: HardHat, title: "Pekerja berisiko", body: "Lihat pendedahan AI peranan semasa dan cari laluan peralihan yang realistik." },
  { seg: "graduate", icon: GraduationCap, title: "Graduan & penukar kerjaya", body: "Muat naik CV, ambil ujian RIASEC, dapatkan peranan sasaran dengan skor dijelaskan." },
  { seg: "employer", icon: Building2, title: "Majikan / HR", body: "Ringkasan kohort: jurang kemahiran utama dan liputan pelan latihan HRD Corp." },
  { seg: "career_centre", icon: School, title: "Pusat kerjaya TVET / IPT", body: "Pantau taburan minat dan padanan pelajar mengikut organisasi." },
];

export default function Dashboard() {
  const sum = useGetDashboardSummary();
  const mkt = useGetMarketOverview({ query: { refetchInterval: 60000, queryKey: ["/api/market/overview"] } });
  const ai = useGetAiStatus();
  const s = sum.data;
  const m = mkt.data;
  return (
    <>
      <PageHeader kicker="Papan pemuka · ReskillAI Malaysia" title="Di mana AI sebenarnya mengubah kerja."
        sub="Instrumen risikan kerjaya untuk peralihan tenaga kerja Malaysia. Setiap angka disertakan sumber dan tarikh datanya." />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rise relative overflow-hidden rounded-md bg-sidebar p-5 text-sidebar-foreground md:col-span-2 md:row-span-2">
          <div className="songket absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="num text-[11px] uppercase tracking-[0.2em] text-sidebar-primary">Tajuk pasaran</div>
            {mkt.isLoading ? <Rows n={3} /> : mkt.isError ? <ErrorBox error={mkt.error} retry={() => mkt.refetch()} /> : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-5">
                  <div><div className="text-xs opacity-70">Kadar pengangguran</div><div className="num font-display text-5xl font-bold text-sidebar-accent-foreground" data-testid="text-unemployment">{pct(m?.unemploymentRate)}</div><div className="num text-[10px] opacity-60">{m?.unemploymentDate ?? "tiada data"}</div></div>
                  <div><div className="text-xs opacity-70">Kadar penyertaan</div><div className="num font-display text-5xl font-bold text-sidebar-accent-foreground">{pct(m?.participationRate)}</div><div className="num text-[10px] opacity-60">DOSM</div></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-sidebar-border pt-4 text-sm">
                  <div><div className="text-[11px] opacity-60">Indeks penggunaan AI Malaysia</div><div className="num text-lg text-sidebar-primary">{m?.malaysiaUsageIndex?.toFixed(2) ?? "-"}<span className="text-xs opacity-60"> x dunia</span></div></div>
                  <div><div className="text-[11px] opacity-60">Peranan guna AI tertinggi (MY)</div><div className="text-sm text-sidebar-accent-foreground">{m?.topAiRoleMy ?? "-"}</div></div>
                  <div><div className="text-[11px] opacity-60">Pendedahan AI tertinggi</div><div className="text-sm text-sidebar-accent-foreground">{m?.topExposedRole ?? "-"}</div></div>
                  <div><div className="text-[11px] opacity-60">Sumber OK</div><div className="num text-sm">{m?.sourcesOk ?? 0}/{m?.sourcesTotal ?? 0} · {day(m?.lastRefresh)}</div></div>
                </div>
                <div className="num mt-3 text-[10px] opacity-60">Tempoh penggunaan AI: {m?.aiUsagePeriod ?? "-"}</div>
                <Link href="/market" className="mt-4 inline-flex items-center gap-1 text-sm text-sidebar-primary hover:underline" data-testid="link-market">Buka risikan pasaran<ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </>
            )}
          </div>
        </div>
        {sum.isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />) : sum.isError ? <div className="md:col-span-2"><ErrorBox error={sum.error} retry={() => sum.refetch()} /></div> : (
          <>
            <Stat label="Profil" value={s?.profileCount ?? 0} foot={`${s?.planCount ?? 0} pelan dijana`} testid="text-profile-count" />
            <Stat label="Wawasan agen" value={s?.insightCount ?? 0} foot={`${s?.predictionCount ?? 0} ramalan`} />
            <Stat label="Peranan dalam katalog" value={s?.roleCount ?? 0} foot="dipetakan ke kod SOC" />
            <Stat label="Kursus" value={s?.courseCount ?? 0} foot="percuma, kos rendah, HRD Corp" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {SEGS.map((g, i) => (
            <Link key={g.seg} href={g.seg === "employer" || g.seg === "career_centre" ? "/cohort" : `/profiles?segment=${g.seg}`} data-testid={`link-segment-${g.seg}`}
              className="rise group rounded-md border border-card-border bg-card p-4 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between"><g.icon className="h-5 w-5 text-primary" /><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
              <div className="font-display mt-3 font-bold">{g.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{g.body}</p>
            </Link>
          ))}
        </div>
        <Panel title="Enjin AI" meta="RunPod GPU">
          {ai.isLoading ? <Rows n={2} /> : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${ai.data?.connected ? "bg-primary" : "bg-accent"}`} /><b>{ai.data?.connected ? "Disambungkan" : "Enjin AI belum disambungkan"}</b></div>
              <div className="num text-xs text-muted-foreground">{ai.data?.provider ?? "-"} · utama: {ai.data?.mainModel ?? "-"} · ringan: {ai.data?.lightModel ?? "-"}</div>
              {ai.data?.message && <p className="text-xs text-muted-foreground">{ai.data.message}</p>}
              <Link href="/settings/ai" className="text-xs text-primary underline" data-testid="link-ai-settings">Butiran enjin</Link>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Aktiviti terkini" meta="Profil, pelan, wawasan dan ramalan terbaharu">
        {sum.isLoading ? <Rows /> : !s?.recentActivity?.length ? <Empty title="Belum ada aktiviti">Cipta profil pertama untuk memulakan.</Empty> : (
          <ul className="divide-y divide-border">
            {s.recentActivity.map((a, i) => (
              <li key={i} className="rise flex items-center justify-between gap-3 py-2 text-sm" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center gap-3"><span className="num w-20 shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-center text-[10px] uppercase">{a.kind}</span>
                  {a.profileId ? <Link href={`/profiles/${a.profileId}`} className="hover:text-primary" data-testid={`link-activity-${i}`}>{a.label}</Link> : <span>{a.label}</span>}</div>
                <span className="num shrink-0 text-xs text-muted-foreground">{ago(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="mt-4"><Stamp source="DOSM · Anthropic Economic Index" period={m?.unemploymentDate} fetchedAt={m?.lastRefresh} /></div>
    </>
  );
}
