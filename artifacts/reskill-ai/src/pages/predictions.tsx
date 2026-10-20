import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useCreatePrediction, useListPredictions, useListRoles, getListPredictionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiOffline, Empty, ErrorBox, PageHeader, Panel, Rows, Sources } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { dt, errStatus } from "@/lib/fmt";

export default function Predictions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState("none");
  const [h, setH] = useState(5);
  const [offline, setOffline] = useState(false);
  const roles = useListRoles();
  const list = useListPredictions();
  const create = useCreatePrediction({
    mutation: {
      onSuccess: (p) => { setOffline(false); setQ(""); qc.invalidateQueries({ queryKey: getListPredictionsQueryKey() }); toast({ title: p.cached ? "Jawapan dari cache" : "Ramalan siap", description: p.model }); },
      onError: (e) => { if (errStatus(e) === 503) setOffline(true); else toast({ title: "Ramalan gagal", description: (e as Error).message, variant: "destructive" }); },
    },
  });
  const submit = () => create.mutate({ data: { question: q.trim(), horizonYears: h, ...(roleId !== "none" ? { roleId: Number(roleId) } : {}) } });

  return (
    <>
      <PageHeader kicker="Agen Analyst · atas permintaan" title="Tanya tentang masa depan sesuatu kerja"
        sub="Ramalan hanya dijalankan apabila anda bertanya, dan jawapan disimpan dalam cache untuk menjimatkan GPU. Soalan yang sama akan dijawab daripada cache." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Panel title="Soalan baharu" className="h-fit">
          <div className="space-y-4">
            <Textarea value={q} onChange={(e) => setQ(e.target.value)} rows={4} placeholder="Cth: Adakah kerani akaun di Malaysia masih diperlukan dalam 5 tahun?" data-testid="input-question" />
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Peranan (pilihan)</div>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Tiada peranan khusus</SelectItem>{roles.data?.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.titleMs}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Ufuk masa</span><span className="num font-semibold">{h} tahun</span></div>
              <Slider min={1} max={10} step={1} value={[h]} onValueChange={(v) => setH(v[0])} data-testid="slider-horizon" />
            </div>
            <Button className="w-full" disabled={q.trim().length < 3 || create.isPending} onClick={submit} data-testid="button-ask">
              {create.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Agen sedang menganalisis...</> : <><Send className="mr-2 h-4 w-4" />Jalankan ramalan</>}
            </Button>
            {offline && <AiOffline />}
          </div>
        </Panel>
        <Panel title="Ramalan lepas" meta={`${list.data?.length ?? 0} rekod`}>
          {list.isLoading ? <Rows n={3} h="h-28" /> : list.isError ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : !list.data?.length ? <Empty title="Belum ada ramalan">Tanya soalan pertama anda. Jawapan akan disertakan sumber.</Empty> : (
            <ul className="space-y-3">
              {list.data.map((p, i) => (
                <li key={p.id} className="rise rounded-sm border border-border bg-background p-4" style={{ animationDelay: `${i * 40}ms` }} data-testid={`card-prediction-${p.id}`}>
                  <div className="num mb-1 flex flex-wrap gap-2 text-[10px] uppercase text-muted-foreground">
                    <span className="text-primary">+{p.horizonYears} thn</span>{p.roleTitle && <span>{p.roleTitle}</span>}<span>{p.model}</span>{p.cached && <span className="rounded-sm bg-accent/30 px-1">cache</span>}<span>{dt(p.createdAt)}</span>
                  </div>
                  <div className="font-display font-bold">{p.question}</div>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/85">{p.content}</p>
                  <div className="mt-3"><Sources sources={p.sources} /></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
