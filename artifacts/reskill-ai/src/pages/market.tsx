import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import {
  useGetAiUsageByGroup, useGetAiUsageByRole, useGetLabourTrend, useGetMarketOverview, useGetRoleExposure, useListMarketSources, useRefreshMarketData,
  getGetAiUsageByGroupQueryKey, getGetAiUsageByRoleQueryKey, getGetLabourTrendQueryKey, getGetMarketOverviewQueryKey, getGetRoleExposureQueryKey, getListMarketSourcesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBox, PageHeader, Panel, Rows, Stamp, Stat } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { day, dt, pct } from "@/lib/fmt";
import { cn } from "@/lib/utils";

const POLL = 60000;
const C1 = "hsl(188 72% 26%)", C2 = "hsl(38 92% 50%)", C3 = "hsl(4 66% 52%)";
const tip = { contentStyle: { background: "hsl(42 40% 98%)", border: "1px solid hsl(40 18% 82%)", borderRadius: 4, fontSize: 12, fontFamily: "JetBrains Mono" } };
const axis = { fontSize: 10, fontFamily: "JetBrains Mono", fill: "hsl(192 14% 38%)" };

export default function Market() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [geo, setGeo] = useState<"MYS" | "GLOBAL">("MYS");
  const rolesParams = { limit: 15, geo };
  const ov = useGetMarketOverview({ query: { refetchInterval: POLL, queryKey: getGetMarketOverviewQueryKey() } });
  const roles = useGetAiUsageByRole(rolesParams, { query: { refetchInterval: POLL, queryKey: getGetAiUsageByRoleQueryKey(rolesParams) } });
  const groups = useGetAiUsageByGroup({ query: { refetchInterval: POLL, queryKey: getGetAiUsageByGroupQueryKey() } });
  const exp = useGetRoleExposure({ limit: 15 }, { query: { refetchInterval: POLL, queryKey: getGetRoleExposureQueryKey({ limit: 15 }) } });
  const lab = useGetLabourTrend({ query: { refetchInterval: POLL, queryKey: getGetLabourTrendQueryKey() } });
  const src = useListMarketSources({ query: { refetchInterval: POLL, queryKey: getListMarketSourcesQueryKey() } });
  const refresh = useRefreshMarketData({
    mutation: {
      onSuccess: (s) => {
        [getGetMarketOverviewQueryKey(), getGetAiUsageByGroupQueryKey(), getGetLabourTrendQueryKey(), getListMarketSourcesQueryKey(), ["/api/market/ai-usage/roles"], ["/api/market/exposure"]].forEach((k) => qc.invalidateQueries({ queryKey: k }));
        qc.invalidateQueries();
        toast({ title: "Sumber dimuat semula", description: `${s.filter((x) => x.status === "ok").length}/${s.length} sumber OK` });
      },
      onError: (e) => toast({ title: "Gagal memuat semula", description: (e as Error).message, variant: "destructive" }),
    },
  });
  const o = ov.data;
  const labour = lab.data ?? [];
  const lastLab = labour[labour.length - 1];

  return (
    <>
      <PageHeader kicker="Risikan pasaran · dikemas kini setiap 60 saat" title="Penggunaan & pendedahan AI mengikut pekerjaan"
        sub="Data dikumpul secara berkala daripada sumber awam, bukan masa nyata. Setiap carta memaparkan tempoh data dan sumbernya."
        actions={<Button onClick={() => refresh.mutate()} disabled={refresh.isPending} data-testid="button-refresh-market"><RefreshCw className={cn("mr-2 h-4 w-4", refresh.isPending && "animate-spin")} />{refresh.isPending ? "Memuat semula..." : "Muat semula sumber"}</Button>} />

      {ov.isError && <ErrorBox error={ov.error} retry={() => ov.refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pengangguran" value={pct(o?.unemploymentRate)} foot={`DOSM · ${o?.unemploymentDate ?? "-"}`} />
        <Stat label="Penyertaan tenaga buruh" value={pct(o?.participationRate)} foot="DOSM" />
        <Stat label="Indeks guna AI MY" value={o?.malaysiaUsageIndex != null ? `${o.malaysiaUsageIndex.toFixed(2)}x` : "-"} foot={`1.0 = setara dunia · ${o?.aiUsagePeriod ?? "-"}`} />
        <Stat label="Sumber OK" value={`${o?.sourcesOk ?? 0}/${o?.sourcesTotal ?? 0}`} foot={`Muat semula: ${dt(o?.lastRefresh)}`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Penggunaan AI mengikut pekerjaan" meta={<Stamp source="Anthropic Economic Index" period={roles.data?.period} fetchedAt={roles.data?.fetchedAt} />}
          actions={<div className="flex rounded-sm border border-border p-0.5 text-xs">{(["MYS", "GLOBAL"] as const).map((g) => <button key={g} onClick={() => setGeo(g)} data-testid={`button-geo-${g}`} className={cn("rounded-sm px-2 py-1", geo === g && "bg-primary text-primary-foreground")}>{g === "MYS" ? "Malaysia" : "Global"}</button>)}</div>}>
          {roles.isLoading ? <Rows n={6} /> : roles.isError ? <ErrorBox error={roles.error} retry={() => roles.refetch()} /> : !roles.data?.items.length ? <Empty title="Belum ada data penggunaan">Tekan "Muat semula sumber" untuk mengambil data.</Empty> : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={roles.data.items} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid horizontal={false} stroke="hsl(40 18% 86%)" />
                <XAxis type="number" tick={axis} unit="%" />
                <YAxis type="category" dataKey="title" width={170} tick={axis} />
                <Tooltip {...tip} formatter={(v: number) => `${v?.toFixed?.(2)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="usagePct" name={geo === "MYS" ? "Malaysia" : "Global"} fill={C1} radius={[0, 2, 2, 0]} />
                {geo === "MYS" && <Bar dataKey="usagePctGlobal" name="Global" fill={C2} radius={[0, 2, 2, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Penggunaan AI mengikut kumpulan utama" meta={<Stamp source="Anthropic Economic Index" period={groups.data?.period} fetchedAt={groups.data?.fetchedAt} />}>
          {groups.isLoading ? <Rows n={6} /> : groups.isError ? <ErrorBox error={groups.error} retry={() => groups.refetch()} /> : !groups.data?.items.length ? <Empty title="Belum ada data kumpulan" /> : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={groups.data.items} margin={{ bottom: 70 }}>
                <CartesianGrid vertical={false} stroke="hsl(40 18% 86%)" />
                <XAxis dataKey="majorGroup" tick={{ ...axis, fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={axis} unit="%" />
                <Tooltip {...tip} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="usagePctMy" name="Malaysia" fill={C1} />
                <Bar dataKey="usagePctGlobal" name="Global" fill={C2} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Pendedahan AI yang diperhatikan" meta={<Stamp source="Observed AI exposure (0-1)" period={o?.aiUsagePeriod} fetchedAt={o?.lastRefresh} />}>
          {exp.isLoading ? <Rows n={6} /> : exp.isError ? <ErrorBox error={exp.error} retry={() => exp.refetch()} /> : !exp.data?.length ? <Empty title="Belum ada data pendedahan" /> : (
            <ul className="space-y-1.5">
              {exp.data.map((e, i) => (
                <li key={e.socCode} className="rise grid grid-cols-[3.5rem_1fr_9rem] items-center gap-3 text-sm" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="num text-[10px] text-muted-foreground">{e.socCode}</span>
                  <span className="truncate">{e.title}</span>
                  <div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-sm bg-muted"><div className="h-full rounded-sm" style={{ width: `${e.exposure * 100}%`, background: e.exposure > 0.6 ? C3 : e.exposure > 0.3 ? C2 : C1 }} /></div><span className="num w-12 text-right text-xs">{(e.exposure * 100).toFixed(1)}%</span></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Trend tenaga buruh bulanan Malaysia" meta={<Stamp source="DOSM / OpenDOSM" period={lastLab?.date} fetchedAt={o?.lastRefresh} />}>
          {lab.isLoading ? <Rows n={6} /> : lab.isError ? <ErrorBox error={lab.error} retry={() => lab.refetch()} /> : !labour.length ? <Empty title="Belum ada siri tenaga buruh" /> : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={labour}>
                <CartesianGrid stroke="hsl(40 18% 86%)" vertical={false} />
                <XAxis dataKey="date" tick={axis} minTickGap={30} />
                <YAxis yAxisId="u" tick={axis} unit="%" domain={["auto", "auto"]} />
                <YAxis yAxisId="p" orientation="right" tick={axis} unit="%" domain={["auto", "auto"]} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="u" dataKey="unemploymentRate" name="Pengangguran %" stroke={C3} dot={false} strokeWidth={2} />
                <Line yAxisId="p" dataKey="participationRate" name="Penyertaan %" stroke={C1} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Sumber data & kesegaran" meta="Status setiap sumber, tarikh data dan bilangan rekod">
        {src.isLoading ? <Rows /> : src.isError ? <ErrorBox error={src.error} retry={() => src.refetch()} /> : !src.data?.length ? <Empty title="Tiada sumber berdaftar" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="num text-left text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-2">Sumber</th><th>Status</th><th>Tarikh data</th><th>Diambil</th><th>Kekerapan</th><th className="text-right">Rekod</th></tr></thead>
              <tbody className="divide-y divide-border">
                {src.data.map((s) => (
                  <tr key={s.id} data-testid={`row-source-${s.id}`}>
                    <td className="py-2 pr-3"><a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">{s.name}</a><div className="text-xs text-muted-foreground">{s.description}</div>{s.error && <div className="text-xs text-destructive">{s.error}</div>}</td>
                    <td><span className={cn("num rounded-sm px-1.5 py-0.5 text-[10px] uppercase", s.status === "ok" ? "bg-primary text-primary-foreground" : s.status === "error" ? "bg-destructive text-destructive-foreground" : "bg-accent/30")}>{s.status}</span></td>
                    <td className="num text-xs">{s.dataDate ?? "-"}</td>
                    <td className="num text-xs">{day(s.lastFetchedAt)}</td>
                    <td className="text-xs">{s.refreshCadence}</td>
                    <td className="num text-right text-xs">{s.recordCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
