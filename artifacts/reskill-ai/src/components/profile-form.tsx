import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCreateProfile, useUpdateProfile, getGetProfileQueryKey, type Profile, type Segment } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ErrorBox } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile?: Profile;
  segment?: Segment;
  lockSegment?: boolean;
  onDone?: (p: Profile) => void;
}

export function ProfileFormDialog({ open, onOpenChange, profile, segment = "worker", lockSegment, onDone }: Props) {
  const { t, tk } = useT();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", segment: segment as Segment, currentRole: "", goals: "", weeklyHours: "6", budgetMyr: "300", hrdcEligible: false });
  useEffect(() => {
    if (!open) return;
    setF(profile ? {
      name: profile.name, segment: profile.segment, currentRole: profile.currentRole ?? "", goals: profile.goals ?? "",
      weeklyHours: String(profile.weeklyHours), budgetMyr: String(profile.budgetMyr), hrdcEligible: !!profile.hrdcEligible,
    } : { name: "", segment, currentRole: "", goals: "", weeklyHours: segment === "graduate" ? "10" : "6", budgetMyr: segment === "graduate" ? "100" : "300", hrdcEligible: segment === "worker" });
  }, [open, profile, segment]);
  const done = (p: Profile) => {
    qc.setQueryData(getGetProfileQueryKey(p.id), p);
    qc.invalidateQueries({ queryKey: ["/api/profiles"] });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/cohort/summary"] });
    qc.invalidateQueries({ queryKey: [`/api/profiles/${p.id}/matches`] });
    toast({ title: profile ? t("profile.saved") : t("profile.created", { name: p.name }) });
    onOpenChange(false);
    onDone?.(p);
  };
  const create = useCreateProfile({ mutation: { onSuccess: done } });
  const update = useUpdateProfile({ mutation: { onSuccess: done } });
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const hours = Number(f.weeklyHours);
  const budget = Number(f.budgetMyr);
  const valid = f.name.trim().length > 0 && hours >= 1 && hours <= 60 && budget >= 0 && Number.isFinite(budget);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const data = {
      name: f.name.trim(), segment: f.segment, weeklyHours: Math.round(hours), budgetMyr: budget, hrdcEligible: f.hrdcEligible,
      ...(f.currentRole.trim() ? { currentRole: f.currentRole.trim() } : {}),
      ...(f.goals.trim() ? { goals: f.goals.trim() } : {}),
    };
    if (profile) update.mutate({ id: profile.id, data });
    else create.mutate({ data });
  };
  const segs: Segment[] = ["worker", "graduate"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? t("profile.editTitle") : t("profile.newTitle")}</DialogTitle>
          <DialogDescription>{t("profile.formSub")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="pf-name">{t("profile.name")}</Label>
            <Input id="pf-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="min-h-11" placeholder={t("profile.namePh")} data-testid="input-profile-name" /></div>
          {!lockSegment && (
            <div className="space-y-1.5"><Label>{t("profile.segment")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {segs.map((s) => (
                  <button type="button" key={s} onClick={() => setF({ ...f, segment: s })} data-testid={`button-seg-${s}`}
                    className={cn("min-h-11 rounded-xl border px-3 text-sm font-medium", f.segment === s ? "border-primary bg-[hsl(var(--maroon-soft))] text-primary" : "border-border")}>
                    <span className="block truncate whitespace-nowrap">{tk("seg", s)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="pf-role">{f.segment === "graduate" ? t("profile.studyField") : t("profile.currentRole")}</Label>
            <Input id="pf-role" value={f.currentRole} onChange={(e) => setF({ ...f, currentRole: e.target.value })} className="min-h-11" placeholder={f.segment === "graduate" ? t("profile.studyPh") : t("profile.rolePh")} data-testid="input-profile-role" /></div>
          <div className="space-y-1.5"><Label htmlFor="pf-goals">{t("profile.goals")}</Label>
            <Textarea id="pf-goals" value={f.goals} onChange={(e) => setF({ ...f, goals: e.target.value })} rows={3} placeholder={t("profile.goalsPh")} data-testid="input-profile-goals" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="pf-h">{t("profile.hours")}</Label>
              <Input id="pf-h" type="number" inputMode="numeric" min={1} max={60} value={f.weeklyHours} onChange={(e) => setF({ ...f, weeklyHours: e.target.value })} className="min-h-11" data-testid="input-profile-hours" /></div>
            <div className="space-y-1.5"><Label htmlFor="pf-b">{t("profile.budget")}</Label>
              <Input id="pf-b" type="number" inputMode="decimal" min={0} value={f.budgetMyr} onChange={(e) => setF({ ...f, budgetMyr: e.target.value })} className="min-h-11" data-testid="input-profile-budget" /></div>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <span className="min-w-0"><span className="block text-sm font-medium">{t("profile.hrdc")}</span><span className="block text-[11px] text-muted-foreground">{t("profile.hrdcHint")}</span></span>
            <Switch checked={f.hrdcEligible} onCheckedChange={(v) => setF({ ...f, hrdcEligible: v })} data-testid="switch-hrdc" />
          </label>
          {error && <ErrorBox error={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" className="min-h-11" disabled={!valid || pending} data-testid="button-save-profile">{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{profile ? t("common.save") : t("profile.create")}</Button>
          </div>
          {!valid && f.name && <p className="text-xs text-destructive">{t("profile.invalid")}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
