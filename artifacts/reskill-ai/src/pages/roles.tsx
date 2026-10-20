import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useGetRole, useListRoles, getGetRoleQueryKey, getListRolesQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBox, Meter, PageHeader, Panel, Rows, Stat } from "@/components/bits";
import { frac, pct } from "@/lib/fmt";

export function Roles() {
  const [sector, setSector] = useState("all");
  const all = useListRoles();
  const params = sector !== "all" ? { sector } : undefined;
  const list = useListRoles(params, { query: { queryKey: getListRolesQueryKey(params) } });
  const sectors = useMemo(() => Array.from(new Set((all.data ?? []).map((r) => r.sector))).sort(), [all.data]);
  return (
    <>
      <PageHeader kicker="Katalog peranan" title="Peranan sasaran yang realistik" sub="Setiap peranan dipetakan ke kod SOC, kod RIASEC, kemahiran teras dan pendedahan AI yang diperhatikan."
        actions={<Select value={sector} onValueChange={setSector}><SelectTrigger className="w-56" data-testid="select-sector"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua sektor</SelectItem>{sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>} />
      {list.isLoading ? <Rows n={8} /> : list.isError ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : !list.data?.length ? <Empty title="Tiada peranan">Katalog peranan belum dimuatkan.</Empty> : (
        <div className="overflow-x-auto rounded-md border border-card-border bg-card">
          <table className="w-full text-sm">
            <thead className="num border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">SOC</th><th>Peranan</th><th>Sektor</th><th>RIASEC</th><th className="w-40">Pendedahan AI</th><th>Guna AI MY / Global</th><th></th></tr></thead>
            <tbody className="divide-y divide-border">
              {list.data.map((r, i) => (
                <tr key={r.id} className="rise hover:bg-muted/40" style={{ animationDelay: `${i * 20}ms` }}>
                  <td className="num p-3 text-xs text-muted-foreground">{r.socCode}</td>
                  <td><Link href={`/roles/${r.id}`} className="font-medium hover:text-primary" data-testid={`link-role-${r.id}`}>{r.titleMs}</Link><div className="text-xs text-muted-foreground">{r.title}</div></td>
                  <td className="text-xs">{r.sector}</td>
                  <td className="num text-xs">{r.riasecCode}</td>
                  <td className="pr-3"><Meter value={r.aiExposure} tone={(r.aiExposure ?? 0) > 0.6 ? "destructive" : "accent"} label={frac(r.aiExposure)} /></td>
                  <td className="num text-xs">{pct(r.aiUsagePctMy, 2)} / {pct(r.aiUsagePctGlobal, 2)}</td>
                  <td className="pr-3">{r.myColCritical && <span className="num rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold">MyCOL</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function RoleDetail() {
  const { id } = useParams<{ id: string }>();
  const rid = Number(id);
  const q = useGetRole(rid, { query: { enabled: !!rid, queryKey: getGetRoleQueryKey(rid) } });
  const r = q.data;
  return (
    <>
      <Link href="/roles" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary" data-testid="link-back-roles"><ArrowLeft className="h-4 w-4" />Katalog peranan</Link>
      {q.isLoading ? <Rows n={5} h="h-16" /> : q.isError || !r ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
        <>
          <PageHeader kicker={`SOC ${r.socCode} · ${r.sector} · RIASEC ${r.riasecCode}`} title={r.titleMs} sub={r.title} />
          {r.myColCritical && <div className="rise mb-4 flex items-center gap-2 rounded-md border border-accent bg-accent/15 p-3 text-sm"><ShieldAlert className="h-4 w-4" />Tersenarai dalam Senarai Pekerjaan Kritikal Malaysia (MyCOL).</div>}
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="Pendedahan AI diperhatikan" value={frac(r.aiExposure)} foot="Skala 0-1, bahagian tugas yang dilihat dibantu AI" />
            <Stat label="Penggunaan AI Malaysia" value={pct(r.aiUsagePctMy, 2)} foot="% perbualan AI berkaitan pekerjaan ini" />
            <Stat label="Penggunaan AI global" value={pct(r.aiUsagePctGlobal, 2)} foot="Anthropic Economic Index" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <Panel title="Keterangan">{r.description ? <p className="text-sm leading-relaxed">{r.description}</p> : <p className="text-sm text-muted-foreground">Tiada keterangan.</p>}</Panel>
            <Panel title="Kemahiran diperlukan" meta="3 = teras, 1 = tambahan">
              {!r.skills.length ? <Empty title="Tiada kemahiran dipetakan" /> : (
                <ul className="space-y-2">
                  {[...r.skills].sort((a, b) => b.importance - a.importance).map((s) => (
                    <li key={s.skillId} className="flex items-center justify-between text-sm"><span>{s.name}</span>
                      <span className="flex gap-0.5">{[1, 2, 3].map((n) => <span key={n} className={`h-2 w-5 rounded-sm ${n <= s.importance ? "bg-primary" : "bg-muted"}`} />)}</span></li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
