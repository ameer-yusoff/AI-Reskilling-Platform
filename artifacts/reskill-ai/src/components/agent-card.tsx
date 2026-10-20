import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Languages, Lock, Play, RotateCw } from "lucide-react";
import {
  useGetProfilePlan, useListProfileInsights, useRunProfileAgent, getGetProfilePlanQueryKey, getListProfileInsightsQueryKey,
  type AgentInsight, type AgentName, type Profile,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AiWait, ErrorBox, Markdown, SourceList } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useFmt } from "@/lib/fmt";
import { LANG_NAME, errCode, useErrText, useT, type DictKey } from "@/i18n";
import { cn } from "@/lib/utils";

export const AGENTS: AgentName[] = ["cv", "holland", "profiler", "fitter", "planner", "sdg"];

export function AgentCard({ profile, agent, roleId, className }: { profile: Profile; agent: AgentName; roleId?: number | null; className?: string }) {
  const { t, tk, lang } = useT();
  const et = useErrText();
  const f = useFmt();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [since, setSince] = useState<number | null>(null);
  const [fresh, setFresh] = useState<AgentInsight | null>(null);
  const ins = useListProfileInsights(profile.id, { query: { queryKey: getListProfileInsightsQueryKey(profile.id) } });
  const plan = useGetProfilePlan(profile.id, { query: { queryKey: getGetProfilePlanQueryKey(profile.id), retry: false } });
  const run = useRunProfileAgent({
    mutation: {
      onSuccess: (r) => {
        setSince(null);
        setFresh(r);
        qc.invalidateQueries({ queryKey: getListProfileInsightsQueryKey(profile.id) });
        if (!user) toast({ title: t("agent.ready"), description: t("guest.milestone") });
      },
      onError: () => setSince(null),
    },
  });

  const prereq: DictKey | null =
    agent === "cv" && !profile.cvFileName ? "agent.needCv"
      : agent === "holland" && !profile.riasecScores ? "agent.needRiasec"
        : (agent === "planner" || agent === "sdg") && !plan.data ? "agent.needPlan"
          : null;

  const list = ins.data ?? [];
  const mine = (fresh && fresh.agent === agent && fresh.lang === lang ? fresh : null) ?? list.find((x) => x.agent === agent && x.lang === lang) ?? null;
  const other = !mine ? list.find((x) => x.agent === agent) ?? null : null;
  const go = (refresh: boolean) => {
    setSince(Date.now());
    run.mutate({ id: profile.id, data: { agent, lang, refresh, ...(roleId ? { roleId } : {}) } });
  };
  const busy = run.isPending;
  const code = errCode(run.error);

  return (
    <div className={cn("min-w-0 rounded-2xl border border-card-border bg-card p-4 shadow-xs", className)} data-testid={`card-agent-${agent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--maroon-soft))] text-primary"><Bot className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div title={tk("agent", `${agent}.name`)} className="truncate whitespace-nowrap font-semibold">{tk("agent", `${agent}.name`)}</div>
            <div className="text-xs text-muted-foreground">{tk("agent", `${agent}.desc`)}</div>
          </div>
        </div>
        {!mine && !busy && (
          <Button className="min-h-11 shrink-0" disabled={!!prereq} onClick={() => go(false)} data-testid={`button-run-${agent}`}>
            {prereq ? <Lock className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}{t("agent.run")}
          </Button>
        )}
      </div>

      {prereq && !mine && <p className="mt-3 rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">{t(prereq)}</p>}
      {busy && since && <div className="mt-3"><AiWait since={since} /></div>}
      {run.isError && !busy && (
        <div className="mt-3"><ErrorBox message={code === "ai_timeout" ? t("ai.timeout") : et(run.error)} retry={() => go(false)} /></div>
      )}

      {!mine && other && !busy && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-accent/60 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">{t("agent.otherLang", { lang: LANG_NAME[other.lang as keyof typeof LANG_NAME] ?? other.lang })}</span>
          <Button variant="outline" className="min-h-11 shrink-0" disabled={!!prereq} onClick={() => go(false)} data-testid={`button-gen-lang-${agent}`}>
            <Languages className="mr-1.5 h-4 w-4" />{t("agent.generateIn", { lang: LANG_NAME[lang] })}
          </Button>
        </div>
      )}

      {mine && !busy && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{f.dateTime(mine.createdAt)}</span><span>{t("agent.model")}: {mine.model}</span>
            {mine.cached && <span className="rounded-full bg-[hsl(var(--gold-soft))] px-2 py-0.5 font-semibold text-foreground">{t("common.cached")}</span>}
            <button onClick={() => go(true)} className="ml-auto inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline" data-testid={`button-regen-${agent}`}>
              <RotateCw className="h-3.5 w-3.5" />{t("common.regenerate")}
            </button>
          </div>
          <Markdown>{mine.content}</Markdown>
          <div className="mt-3"><div className="mb-1 text-[11px] font-semibold text-muted-foreground">{t("common.sources")}</div><SourceList sources={mine.sources} /></div>
        </div>
      )}
    </div>
  );
}
