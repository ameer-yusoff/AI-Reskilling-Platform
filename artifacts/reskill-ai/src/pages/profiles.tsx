import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus, UserRound } from "lucide-react";
import { useCreateProfile, useListOrganizations, useListProfiles, getListProfilesQueryKey, type Segment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBox, PageHeader, Rows, SegTag } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { SEGMENT_LABEL, ago, myr } from "@/lib/fmt";

const SEGS = Object.keys(SEGMENT_LABEL) as Segment[];

export default function Profiles() {
  const search = new URLSearchParams(useSearch());
  const [seg, setSeg] = useState<string>(search.get("segment") ?? "all");
  const [org, setOrg] = useState("all");
  const [open, setOpen] = useState(false);
  const params = { ...(seg !== "all" ? { segment: seg as Segment } : {}), ...(org !== "all" ? { organization: org } : {}) };
  const list = useListProfiles(params, { query: { queryKey: getListProfilesQueryKey(params) } });
  const orgs = useListOrganizations();

  return (
    <>
      <PageHeader kicker="Profil" title="Orang di sebalik data" sub="Setiap profil menggabungkan CV, ujian minat RIASEC dan pilihan latihan untuk padanan peranan yang dijelaskan."
        actions={<Button onClick={() => setOpen(true)} data-testid="button-new-profile"><Plus className="mr-2 h-4 w-4" />Profil baharu</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={seg} onValueChange={setSeg}><SelectTrigger className="w-56" data-testid="select-segment"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua segmen</SelectItem>{SEGS.map((s) => <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>)}</SelectContent></Select>
        <Select value={org} onValueChange={setOrg}><SelectTrigger className="w-56" data-testid="select-organization"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua organisasi</SelectItem>{orgs.data?.map((o) => <SelectItem key={o.organization} value={o.organization}>{o.organization} ({o.count})</SelectItem>)}</SelectContent></Select>
      </div>
      {list.isLoading ? <Rows n={6} h="h-16" /> : list.isError ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : !list.data?.length ? (
        <Empty title="Tiada profil di sini" icon={<UserRound className="h-5 w-5" />} action={<Button onClick={() => setOpen(true)} data-testid="button-empty-new">Cipta profil</Button>}>Cipta profil untuk mula memadankan kemahiran dengan peranan.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((p, i) => (
            <Link key={p.id} href={`/profiles/${p.id}`} data-testid={`card-profile-${p.id}`} className="rise group rounded-md border border-card-border bg-card p-4 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${i * 35}ms` }}>
              <div className="flex items-start justify-between"><SegTag s={p.segment} /><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></div>
              <div className="font-display mt-2 text-lg font-bold">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.currentRole ?? "Tiada peranan semasa"}{p.organization ? ` · ${p.organization}` : ""}</div>
              <div className="num mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span>{p.skills.length} kemahiran</span><span>RIASEC {p.riasecCode ?? "-"}</span><span>{p.weeklyHours} j/mgg</span><span>{myr(p.budgetMyr)}</span><span>{ago(p.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <CreateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [f, setF] = useState({ name: "", segment: "worker" as Segment, currentRole: "", organization: "", goals: "", weeklyHours: "6", budgetMyr: "300", hrdcEligible: false });
  const create = useCreateProfile({
    mutation: {
      onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["/api/profiles"] }); toast({ title: "Profil dicipta", description: p.name }); onOpenChange(false); nav(`/profiles/${p.id}`); },
      onError: (e) => toast({ title: "Gagal mencipta profil", description: (e as Error).message, variant: "destructive" }),
    },
  });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name.trim() && Number(f.weeklyHours) >= 1 && Number(f.weeklyHours) <= 60 && Number(f.budgetMyr) >= 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Profil baharu</DialogTitle><DialogDescription>Maklumat asas. CV dan RIASEC boleh ditambah selepas ini.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Nama penuh" value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="input-name" />
          <Select value={f.segment} onValueChange={(v) => set("segment", v)}><SelectTrigger data-testid="select-new-segment"><SelectValue /></SelectTrigger>
            <SelectContent>{SEGS.map((s) => <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Peranan semasa" value={f.currentRole} onChange={(e) => set("currentRole", e.target.value)} data-testid="input-current-role" />
            <Input placeholder="Organisasi" value={f.organization} onChange={(e) => set("organization", e.target.value)} data-testid="input-organization" />
          </div>
          <Textarea placeholder="Matlamat kerjaya" value={f.goals} onChange={(e) => set("goals", e.target.value)} data-testid="input-goals" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Jam seminggu (1-60)<Input type="number" value={f.weeklyHours} onChange={(e) => set("weeklyHours", e.target.value)} data-testid="input-weekly-hours" /></label>
            <label className="text-xs text-muted-foreground">Bajet (MYR)<Input type="number" value={f.budgetMyr} onChange={(e) => set("budgetMyr", e.target.value)} data-testid="input-budget" /></label>
          </div>
          <label className="flex items-center justify-between rounded-sm border border-border p-3 text-sm">Majikan mencarum HRD Corp<Switch checked={f.hrdcEligible} onCheckedChange={(v) => set("hrdcEligible", v)} data-testid="switch-hrdc" /></label>
          <Button disabled={!valid || create.isPending} data-testid="button-create-profile"
            onClick={() => create.mutate({ data: { name: f.name.trim(), segment: f.segment, currentRole: f.currentRole || undefined, organization: f.organization || undefined, goals: f.goals || undefined, weeklyHours: Number(f.weeklyHours), budgetMyr: Number(f.budgetMyr), hrdcEligible: f.hrdcEligible } })}>
            {create.isPending ? "Mencipta..." : "Cipta profil"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
