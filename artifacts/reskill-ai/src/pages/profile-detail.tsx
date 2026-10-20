import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileUp, Loader2, Play, Plus, RotateCw, Trash2, X } from "lucide-react";
import {
  useDeleteProfile, useGetProfile, useGetProfileMatches, useGetProfilePlan, useCreateProfilePlan, useListProfileInsights, useListRiasecQuestions,
  useListRoles, useRunProfileAgent, useSubmitRiasec, useUpdateProfile, useUploadCv,
  getGetProfileQueryKey, getGetProfileMatchesQueryKey, getGetProfilePlanQueryKey, getListProfileInsightsQueryKey,
  type AgentName, type Profile, type RoleMatch, type SkillStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AiOffline, Empty, ErrorBox, HrdcBadge, Meter, PageHeader, Panel, Rows, SegTag, Sources } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { AGENT_LABEL, RIASEC_LABEL, dt, errStatus, frac, myr } from "@/lib/fmt";
import { cn } from "@/lib/utils";

export default function ProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const q = useGetProfile(pid, { query: { enabled: !!pid, queryKey: getGetProfileQueryKey(pid) } });
  const del = useDeleteProfile({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/profiles"] }); toast({ title: "Profil dipadam" }); nav("/profiles"); } } });
  const p = q.data;
  return (
    <>
      <Link href="/profiles" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary" data-testid="link-back-profiles"><ArrowLeft className="h-4 w-4" />Profil</Link>
      {q.isLoading ? <Rows n={5} h="h-16" /> : q.isError || !p ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
        <>
          <PageHeader kicker={`Ruang kerja profil #${p.id}`} title={p.name}
            sub={<span className="flex flex-wrap items-center gap-2"><SegTag s={p.segment} />{p.currentRole ?? "Tiada peranan semasa"}{p.organization && ` · ${p.organization}`}<span className="num text-xs">· {p.weeklyHours} j/mgg · {myr(p.budgetMyr)} · HRD Corp {p.hrdcEligible ? "ya" : "tidak"}</span></span>}
            actions={<Button variant="outline" onClick={() => setConfirm(true)} data-testid="button-delete-profile"><Trash2 className="mr-2 h-4 w-4" />Padam</Button>} />
          {p.goals && <p className="mb-4 max-w-3xl border-l-2 border-accent pl-3 text-sm italic text-muted-foreground">{p.goals}</p>}
          <Tabs defaultValue="cv">
            <TabsList className="mb-4 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              {[["cv", "1 · CV"], ["skills", `2 · Kemahiran (${p.skills.length})`], ["riasec", `3 · RIASEC ${p.riasecCode ?? ""}`], ["matches", "4 · Padanan"], ["plan", "5 · Pelan Gantt"], ["agents", "Agen AI"]].map(([v, l]) => (
                <TabsTrigger key={v} value={v} data-testid={`tab-${v}`} className="rounded-sm border border-border bg-card data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{l}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="cv"><CvStep p={p} /></TabsContent>
            <TabsContent value="skills"><SkillsStep p={p} /></TabsContent>
            <TabsContent value="riasec"><RiasecStep p={p} /></TabsContent>
            <TabsContent value="matches"><MatchesStep p={p} /></TabsContent>
            <TabsContent value="plan"><PlanStep p={p} /></TabsContent>
            <TabsContent value="agents"><AgentsStep p={p} /></TabsContent>
          </Tabs>
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Padam profil {p.name}?</AlertDialogTitle><AlertDialogDescription>Kemahiran, keputusan RIASEC, pelan dan wawasan akan dipadam. Tindakan ini tidak boleh dibatalkan.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate({ id: p.id })} data-testid="button-confirm-delete">Padam</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}

function useInvalidate(pid: number) {
  const qc = useQueryClient();
  return (p?: Profile) => {
    if (p) qc.setQueryData(getGetProfileQueryKey(pid), p);
    qc.invalidateQueries({ queryKey: getGetProfileQueryKey(pid) });
    qc.invalidateQueries({ queryKey: getGetProfileMatchesQueryKey(pid) });
    qc.invalidateQueries({ queryKey: ["/api/profiles"] });
  };
}

function CvStep({ p }: { p: Profile }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { toast } = useToast();
  const inv = useInvalidate(p.id);
  const up = useUploadCv({
    mutation: {
      onSuccess: (np) => { inv(np); toast({ title: "CV diproses", description: `${np.skills.length} kemahiran dikenal pasti daripada ${np.cvWordCount ?? 0} perkataan` }); },
      onError: (e) => toast({ title: "Gagal memproses CV", description: (e as Error).message, variant: "destructive" }),
    },
  });
  const handle = (f?: File | null) => {
    if (!f) return;
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) { toast({ title: "Format tidak disokong", description: "Gunakan PDF, DOCX atau TXT.", variant: "destructive" }); return; }
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); up.mutate({ id: p.id, data: { fileName: f.name, contentBase64: s.slice(s.indexOf(",") + 1) } }); };
    r.readAsDataURL(f);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel title="Muat naik CV" meta="PDF, DOCX atau TXT. Teks diekstrak, fail asal tidak disimpan.">
        <button type="button" onClick={() => ref.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }} disabled={up.isPending} data-testid="button-upload-cv"
          className={cn("songket flex w-full flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-12 transition-colors", drag ? "border-primary bg-primary/5" : "border-border")}>
          {up.isPending ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileUp className="h-8 w-8 text-primary" />}
          <div className="font-display mt-3 font-bold">{up.isPending ? "Mengekstrak kemahiran..." : "Seret fail ke sini atau klik untuk memilih"}</div>
          <div className="text-xs text-muted-foreground">Kemahiran dipadankan dengan taksonomi beserta bukti petikan</div>
        </button>
        <input ref={ref} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-cv-file" />
      </Panel>
      <Panel title="CV semasa">
        {p.cvFileName ? (
          <dl className="num space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Fail</dt><dd>{p.cvFileName}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Dimuat naik</dt><dd>{dt(p.cvUploadedAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Perkataan</dt><dd>{p.cvWordCount ?? "-"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Kemahiran bukti</dt><dd>{p.skills.filter((s) => s.status === "evidenced").length}</dd></div>
          </dl>
        ) : <Empty title="Belum ada CV">Fail asal tidak disimpan; hanya teks dan kemahiran yang diekstrak.</Empty>}
      </Panel>
    </div>
  );
}

const STATUS: Record<SkillStatus, [string, string]> = {
  evidenced: ["Berbukti", "bg-primary text-primary-foreground"],
  self_reported: ["Dilaporkan sendiri", "bg-accent/30"],
  inferred: ["Disimpulkan", "bg-muted text-muted-foreground"],
};

function SkillsStep({ p }: { p: Profile }) {
  const { toast } = useToast();
  const inv = useInvalidate(p.id);
  const roles = useListRoles();
  const [pick, setPick] = useState("");
  const upd = useUpdateProfile({ mutation: { onSuccess: (np) => { inv(np); toast({ title: "Kemahiran dikemas kini" }); }, onError: (e) => toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" }) } });
  const have = new Set(p.skills.map((s) => s.skillId));
  const options = useMemo(() => {
    const m = new Map<number, string>();
    (roles.data ?? []).forEach((r) => r.skills.forEach((s) => m.set(s.skillId, s.name)));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [roles.data]);
  return (
    <Panel title="Kemahiran diekstrak" meta="Status: berbukti (dari CV), dilaporkan sendiri, atau disimpulkan"
      actions={<div className="flex gap-2">
        <Select value={pick} onValueChange={setPick}><SelectTrigger className="w-56" data-testid="select-add-skill"><SelectValue placeholder="Tambah kemahiran..." /></SelectTrigger>
          <SelectContent>{options.filter(([id]) => !have.has(id)).map(([id, n]) => <SelectItem key={id} value={String(id)}>{n}</SelectItem>)}</SelectContent></Select>
        <Button size="icon" disabled={!pick || upd.isPending} onClick={() => { upd.mutate({ id: p.id, data: { addSkills: [{ skillId: Number(pick), status: "self_reported" }] } }); setPick(""); }} data-testid="button-add-skill"><Plus className="h-4 w-4" /></Button>
      </div>}>
      {!p.skills.length ? <Empty title="Tiada kemahiran lagi">Muat naik CV atau tambah kemahiran secara manual.</Empty> : (
        <ul className="divide-y divide-border">
          {p.skills.map((s, i) => (
            <li key={s.skillId} className="rise flex items-start justify-between gap-3 py-2.5" style={{ animationDelay: `${i * 25}ms` }} data-testid={`row-skill-${s.skillId}`}>
              <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-medium">{s.name}</span><span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] uppercase", STATUS[s.status][1])}>{STATUS[s.status][0]}</span></div>
                {s.evidence && <div className="mt-0.5 truncate text-xs italic text-muted-foreground">"{s.evidence}"</div>}</div>
              <Button size="icon" variant="ghost" disabled={upd.isPending} onClick={() => upd.mutate({ id: p.id, data: { removeSkillIds: [s.skillId] } })} data-testid={`button-remove-skill-${s.skillId}`}><X className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RiasecStep({ p }: { p: Profile }) {
  const { toast } = useToast();
  const inv = useInvalidate(p.id);
  const qs = useListRiasecQuestions();
  const [ans, setAns] = useState<Record<number, number>>({});
  const [en, setEn] = useState(false);
  const [retake, setRetake] = useState(false);
  const sub = useSubmitRiasec({ mutation: { onSuccess: (np) => { inv(np); setRetake(false); setAns({}); toast({ title: `Kod Holland anda: ${np.riasecCode ?? "-"}` }); }, onError: (e) => toast({ title: "Gagal menghantar", description: (e as Error).message, variant: "destructive" }) } });
  const total = qs.data?.length ?? 0;
  const done = Object.keys(ans).length;
  const scores = p.riasecScores;
  if (scores && !retake) {
    const max = Math.max(1, ...Object.values(scores));
    return (
      <Panel title={`Kod Holland: ${p.riasecCode ?? "-"}`} meta="Alat saringan minat, bukan instrumen rasmi O*NET." actions={<Button variant="outline" onClick={() => setRetake(true)} data-testid="button-retake-riasec"><RotateCw className="mr-2 h-4 w-4" />Ambil semula</Button>}>
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(RIASEC_LABEL) as (keyof typeof scores)[]).map((k) => (
            <div key={k} className="grid grid-cols-[2rem_7rem_1fr_3rem] items-center gap-2 text-sm">
              <span className="num font-display text-lg font-bold text-primary">{k}</span><span>{RIASEC_LABEL[k]}</span>
              <div className="h-2.5 rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${(scores[k] / max) * 100}%` }} /></div><span className="num text-right text-xs">{scores[k].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Ujian minat RIASEC" meta="30 soalan, skala 1 (sangat tidak suka) hingga 5 (sangat suka). Alat saringan, bukan O*NET."
      actions={<Button variant="ghost" size="sm" onClick={() => setEn(!en)} data-testid="button-toggle-lang">{en ? "BM" : "EN"}</Button>}>
      {qs.isLoading ? <Rows n={6} /> : qs.isError ? <ErrorBox error={qs.error} retry={() => qs.refetch()} /> : !total ? <Empty title="Soalan belum tersedia" /> : (
        <>
          <div className="sticky top-14 z-10 mb-3 bg-card py-2 lg:top-0"><Meter value={done} max={total} label={`${done}/${total}`} /></div>
          <ol className="space-y-2">
            {qs.data!.map((qq, i) => (
              <li key={qq.id} className="grid gap-2 rounded-sm border border-border p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="text-sm"><span className="num mr-2 text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{en ? qq.text : qq.textMs}{!en && <div className="ml-7 text-[11px] text-muted-foreground">{qq.text}</div>}</div>
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setAns((a) => ({ ...a, [qq.id]: v }))} data-testid={`button-answer-${qq.id}-${v}`}
                    className={cn("num h-8 w-8 rounded-sm border text-xs transition-all active:scale-90", ans[qq.id] === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>{v}</button>
                ))}</div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex justify-end gap-2">
            {retake && <Button variant="ghost" onClick={() => setRetake(false)}>Batal</Button>}
            <Button disabled={done < total || sub.isPending} onClick={() => sub.mutate({ id: p.id, data: { answers: Object.entries(ans).map(([k, v]) => ({ questionId: Number(k), value: v })) } })} data-testid="button-submit-riasec">
              {sub.isPending ? "Mengira..." : `Hantar (${done}/${total})`}
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

const BREAK: [keyof RoleMatch["breakdown"], string][] = [["skills", "Kemahiran"], ["transferable", "Boleh pindah"], ["interest", "Minat"], ["preferences", "Pilihan"], ["feasibility", "Kebolehlaksanaan"]];

function MatchesStep({ p }: { p: Profile }) {
  const { toast } = useToast();
  const inv = useInvalidate(p.id);
  const qc = useQueryClient();
  const m = useGetProfileMatches(p.id, { query: { queryKey: getGetProfileMatchesQueryKey(p.id) } });
  const upd = useUpdateProfile({ mutation: { onSuccess: (np) => { inv(np); toast({ title: "Peranan sasaran ditetapkan" }); } } });
  const plan = useCreateProfilePlan({ mutation: { onSuccess: (pl) => { qc.setQueryData(getGetProfilePlanQueryKey(p.id), pl); qc.invalidateQueries({ queryKey: getGetProfilePlanQueryKey(p.id) }); toast({ title: "Pelan dijana", description: `${pl.items.length} kursus · ${pl.totalWeeks} minggu · ${myr(pl.totalCostMyr)}. Lihat tab Pelan Gantt.` }); }, onError: (e) => toast({ title: "Gagal menjana pelan", description: (e as Error).message, variant: "destructive" }) } });
  const max = (k: string) => (k === "skills" ? 40 : k === "transferable" ? 15 : k === "interest" ? 20 : k === "preferences" ? 10 : 15);
  return (
    <>
      {m.isLoading ? <Rows n={4} h="h-32" /> : m.isError ? <ErrorBox error={m.error} retry={() => m.refetch()} /> : !m.data?.length ? <Empty title="Belum ada padanan">Tambah kemahiran atau lengkapkan RIASEC untuk menjana padanan.</Empty> : (
        <div className="space-y-3">
          {m.data.map((x, i) => {
            const target = p.targetRoleId === x.role.id;
            return (
              <div key={x.role.id} className={cn("rise rounded-md border bg-card p-4", target ? "border-primary ring-1 ring-primary" : "border-card-border")} style={{ animationDelay: `${i * 50}ms` }} data-testid={`card-match-${x.role.id}`}>
                <div className="grid gap-4 lg:grid-cols-[5rem_1fr_1.2fr_auto]">
                  <div><div className="num font-display text-4xl font-bold text-primary">{Math.round(x.score)}</div><div className="text-[10px] uppercase text-muted-foreground">skor padanan</div></div>
                  <div>
                    <Link href={`/roles/${x.role.id}`} className="font-display text-lg font-bold hover:text-primary">{x.role.titleMs}</Link>
                    <div className="num text-[11px] text-muted-foreground">SOC {x.role.socCode} · {x.role.sector} · RIASEC {x.role.riasecCode}{x.role.myColCritical && " · MyCOL"}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs"><div>Pendedahan AI<Meter value={x.role.aiExposure} tone="accent" label={frac(x.role.aiExposure)} /></div><div>Permintaan pasaran<Meter value={x.marketDemand} max={100} label={String(Math.round(x.marketDemand))} /></div></div>
                  </div>
                  <div className="space-y-1">{BREAK.map(([k, l]) => <div key={k} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-xs"><span className="text-muted-foreground">{l}</span><Meter value={x.breakdown[k]} max={Math.max(max(k), x.breakdown[k])} label={x.breakdown[k].toFixed(1)} /></div>)}</div>
                  <div className="flex flex-row gap-2 lg:flex-col">
                    <Button size="sm" variant={target ? "secondary" : "outline"} disabled={upd.isPending} onClick={() => upd.mutate({ id: p.id, data: { targetRoleId: x.role.id } })} data-testid={`button-target-${x.role.id}`}>{target ? <><Check className="mr-1 h-3 w-3" />Sasaran</> : "Jadikan sasaran"}</Button>
                    <Button size="sm" disabled={plan.isPending} onClick={() => plan.mutate({ id: p.id, data: { roleId: x.role.id } })} data-testid={`button-plan-${x.role.id}`}>{plan.isPending && plan.variables?.data.roleId === x.role.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Jana pelan"}</Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3 text-[11px]">
                  {x.matchedSkills.map((s) => <span key={s.skillId} className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary">{s.name}</span>)}
                  {x.gapSkills.map((s) => <span key={s.skillId} className="rounded-sm border border-dashed border-destructive/50 px-1.5 py-0.5 text-destructive">jurang: {s.name}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PlanStep({ p }: { p: Profile }) {
  const q = useGetProfilePlan(p.id, { query: { queryKey: getGetProfilePlanQueryKey(p.id), retry: false } });
  const pl = q.data;
  if (q.isLoading) return <Rows n={5} />;
  if (q.isError && errStatus(q.error) !== 404) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!pl) return <Empty title="Belum ada pelan">Pilih peranan di tab Padanan dan tekan "Jana pelan".</Empty>;
  const weeks = Math.max(pl.totalWeeks, 1);
  return (
    <Panel title={`Pelan ke ${pl.roleTitle}`} meta={`Dijana ${dt(pl.createdAt)}`}
      actions={<div className="num text-right text-sm"><div className="font-semibold">{pl.totalWeeks} minggu</div><div className="text-xs text-muted-foreground">{myr(pl.totalCostMyr)}</div></div>}>
      {!pl.items.length ? <Empty title="Tiada kursus dalam pelan" /> : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="num grid grid-cols-[18rem_1fr] border-b border-border pb-1 text-[10px] text-muted-foreground"><span>Kursus</span>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks},1fr)` }}>{Array.from({ length: weeks }).map((_, w) => <span key={w} className="text-center">{w + 1}</span>)}</div></div>
            {pl.items.map((it, i) => (
              <div key={`${it.courseId}-${i}`} className="grid grid-cols-[18rem_1fr] items-center gap-0 border-b border-border py-2" data-testid={`row-plan-${it.courseId}`}>
                <div className="pr-3">
                  <a href={it.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-primary">{it.title}</a>
                  <div className="text-[11px] text-muted-foreground">{it.provider} · <span className="num">{it.costMyr === 0 ? "Percuma" : myr(it.costMyr)}</span></div>
                  <div className="mt-1 flex flex-wrap gap-1"><HrdcBadge status={it.hrdcStatus} />{it.sdgTargets.map((s) => <span key={s.code} title={s.title} className="num rounded-sm bg-sidebar px-1 py-0.5 text-[9px] text-sidebar-primary">SDG {s.code}</span>)}</div>
                </div>
                <div className="relative grid h-8" style={{ gridTemplateColumns: `repeat(${weeks},1fr)` }}>
                  {Array.from({ length: weeks }).map((_, w) => <span key={w} className="border-l border-border/50" />)}
                  <div className="absolute inset-y-1 origin-left rounded-sm bg-primary px-2 text-[10px] leading-6 text-primary-foreground" style={{ left: `${((it.startWeek - 1) / weeks) * 100}%`, width: `${(it.durationWeeks / weeks) * 100}%`, animation: `rise .5s ${i * 80}ms both` }} title={it.skills.join(", ")}>
                    <span className="truncate">{it.skills.join(", ")}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {pl.uncoveredSkills.length > 0 && (
        <div className="mt-4 rounded-sm border border-dashed border-destructive/50 p-3 text-sm"><b>Kemahiran belum diliputi:</b> <span className="text-muted-foreground">{pl.uncoveredSkills.join(", ")}</span><div className="text-xs text-muted-foreground">Tiada kursus dalam katalog yang sesuai dengan bajet/masa anda untuk kemahiran ini.</div></div>
      )}
    </Panel>
  );
}

function AgentsStep({ p }: { p: Profile }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [offline, setOffline] = useState(false);
  const ins = useListProfileInsights(p.id, { query: { queryKey: getListProfileInsightsQueryKey(p.id) } });
  const run = useRunProfileAgent({
    mutation: {
      onSuccess: () => { setOffline(false); qc.invalidateQueries({ queryKey: getListProfileInsightsQueryKey(p.id) }); toast({ title: "Wawasan agen sedia" }); },
      onError: (e) => { if (errStatus(e) === 503) setOffline(true); else toast({ title: "Agen gagal", description: (e as Error).message, variant: "destructive" }); },
    },
  });
  const go = (agent: AgentName, refresh = false) => run.mutate({ id: p.id, data: { agent, refresh, ...(p.targetRoleId ? { roleId: p.targetRoleId } : {}) } });
  return (
    <div className="space-y-4">
      {offline && <AiOffline />}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(AGENT_LABEL) as AgentName[]).map((a) => {
          const busy = run.isPending && run.variables?.data.agent === a;
          return (
            <div key={a} className="flex items-center justify-between rounded-md border border-card-border bg-card p-3">
              <div><div className="font-semibold">{AGENT_LABEL[a].name}</div><div className="text-xs text-muted-foreground">{AGENT_LABEL[a].desc}</div></div>
              <div className="flex gap-1">
                <Button size="icon" disabled={run.isPending} onClick={() => go(a)} data-testid={`button-run-${a}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}</Button>
                <Button size="icon" variant="outline" disabled={run.isPending} onClick={() => go(a, true)} title="Abaikan cache" data-testid={`button-refresh-${a}`}><RotateCw className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>
      <Panel title="Wawasan tersimpan" meta="Dicache untuk menjimatkan GPU">
        {ins.isLoading ? <Rows n={3} h="h-24" /> : ins.isError ? <ErrorBox error={ins.error} retry={() => ins.refetch()} /> : !ins.data?.length ? <Empty title="Belum ada wawasan">Jalankan agen di atas. Agen memerlukan enjin AI yang disambungkan.</Empty> : (
          <ul className="space-y-3">{ins.data.map((x) => (
            <li key={x.id} className="rise rounded-sm border border-border bg-background p-4" data-testid={`card-insight-${x.id}`}>
              <div className="num mb-1 flex flex-wrap gap-2 text-[10px] uppercase text-muted-foreground"><span className="text-primary">{AGENT_LABEL[x.agent]?.name ?? x.agent}</span><span>{x.model}</span>{x.cached && <span className="rounded-sm bg-accent/30 px-1">cache</span>}<span>{dt(x.createdAt)}</span></div>
              <p className="whitespace-pre-line text-sm">{x.content}</p>
              <div className="mt-2"><Sources sources={x.sources} /></div>
            </li>))}</ul>
        )}
      </Panel>
    </div>
  );
}
