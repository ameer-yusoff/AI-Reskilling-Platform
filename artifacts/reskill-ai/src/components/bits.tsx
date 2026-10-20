import type { ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, CircleDashed, Cpu, Database, ExternalLink, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { HrdcStatus, SourceRef } from "@workspace/api-client-react";
import { SEGMENT_LABEL, day, errMsg } from "@/lib/fmt";
import { cn } from "@/lib/utils";

export function PageHeader({ kicker, title, sub, actions }: { kicker: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="num mb-2 text-[11px] uppercase tracking-[0.18em] text-primary">{kicker}</div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
        {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, meta, children, className, actions }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rise rounded-md border border-card-border bg-card p-4 md:p-5", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
            {meta && <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stamp({ source, period, fetchedAt }: { source: string; period?: string | null; fetchedAt?: string | null }) {
  return (
    <div className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-testid="text-data-stamp">
      <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" />{source}</span>
      <span>Data terkini: <b className="text-foreground">{period ?? "tiada"}</b></span>
      <span>dikemas kini {day(fetchedAt)}</span>
    </div>
  );
}

export function Empty({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="songket flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-card text-primary">{icon ?? <CircleDashed className="h-5 w-5" />}</div>
      <div className="font-display text-base font-bold">{title}</div>
      {children && <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Gagal memuatkan data: {errMsg(error)}</div>
      {retry && <Button size="sm" variant="outline" onClick={retry} data-testid="button-retry"><RotateCw className="mr-1 h-3 w-3" />Cuba lagi</Button>}
    </div>
  );
}

export function AiOffline({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-accent/50 bg-accent/10 p-4 text-sm" data-testid="status-ai-offline">
      <Cpu className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">Enjin AI belum disambungkan</div>
        {!compact && <p className="text-muted-foreground">Naratif dan ramalan memerlukan GPU (RunPod). Pemarkahan, padanan, pelan dan carta pasaran tetap berfungsi. <Link href="/settings/ai" className="underline">Semak status enjin</Link>.</p>}
      </div>
    </div>
  );
}

export function Rows({ n = 4, h = "h-10" }: { n?: number; h?: string }) {
  return <div className="space-y-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={cn("w-full", h)} style={{ opacity: 1 - i * 0.15 }} />)}</div>;
}

const HRDC: Record<string, [string, string]> = {
  claimable_verified: ["HRD Corp: boleh tuntut (disahkan)", "bg-primary text-primary-foreground"],
  check_with_employer: ["HRD Corp: semak dengan majikan", "bg-accent/25 text-foreground border border-accent"],
  not_claimable: ["HRD Corp: tidak boleh tuntut", "bg-muted text-muted-foreground"],
};
export function HrdcBadge({ status }: { status: HrdcStatus }) {
  const [l, c] = HRDC[status] ?? [status, "bg-muted"];
  return <span className={cn("inline-flex whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", c)}>{l}</span>;
}

export function SegTag({ s }: { s: string }) {
  return <span className="num rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{SEGMENT_LABEL[s] ?? s}</span>;
}

export function Meter({ value, max = 1, tone = "primary", label }: { value: number | null | undefined; max?: number; tone?: "primary" | "accent" | "destructive"; label?: string }) {
  const w = value == null ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  const col = tone === "accent" ? "bg-accent" : tone === "destructive" ? "bg-destructive" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full origin-left rounded-full transition-transform duration-700", col)} style={{ width: `${w}%` }} /></div>
      {label && <span className="num w-12 text-right text-xs">{label}</span>}
    </div>
  );
}

export function Sources({ sources }: { sources: SourceRef[] }) {
  if (!sources?.length) return <div className="text-xs text-muted-foreground">Tiada sumber dilampirkan.</div>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sources.map((s, i) => (
        <li key={i} className="num inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px]">
          {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">{s.label}<ExternalLink className="h-2.5 w-2.5" /></a> : s.label}
          {s.dataDate && <span className="text-muted-foreground">· {s.dataDate}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, foot, testid }: { label: string; value: ReactNode; foot?: ReactNode; testid?: string }) {
  return (
    <div className="rise rounded-md border border-card-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num mt-1 text-2xl font-semibold" data-testid={testid}>{value}</div>
      {foot && <div className="mt-1 text-[11px] text-muted-foreground">{foot}</div>}
    </div>
  );
}
