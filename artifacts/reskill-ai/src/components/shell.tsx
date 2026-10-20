import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, BookOpen, Briefcase, Cpu, Globe2, LayoutGrid, Menu, Sparkles, Users, UsersRound, X } from "lucide-react";
import { useGetAiStatus, useHealthCheck } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Papan pemuka", icon: LayoutGrid },
  { href: "/market", label: "Risikan pasaran", icon: BarChart3 },
  { href: "/predictions", label: "Ramalan", icon: Sparkles },
  { href: "/profiles", label: "Profil", icon: Users },
  { href: "/roles", label: "Katalog peranan", icon: Briefcase },
  { href: "/courses", label: "Kursus", icon: BookOpen },
  { href: "/cohort", label: "Kohort HR", icon: UsersRound },
  { href: "/sdg", label: "Sasaran SDG", icon: Globe2 },
  { href: "/settings/ai", label: "Enjin AI", icon: Cpu },
];

function Nav({ onNav }: { onNav?: () => void }) {
  const [loc] = useLocation();
  const health = useHealthCheck({ query: { refetchInterval: 60000, queryKey: ["/api/healthz"] } });
  const ai = useGetAiStatus();
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="block px-5 pb-6 pt-6" onClick={onNav} data-testid="link-home">
        <div className="font-display text-xl font-extrabold text-sidebar-accent-foreground">Reskill<span className="text-sidebar-primary">AI</span></div>
        <div className="num text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/60">Malaysia · instrumen tenaga kerja</div>
      </Link>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => {
          const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={onNav} data-testid={`link-nav-${n.href.replace(/\W/g, "") || "home"}`}
              className={cn("relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground")}>
              {active && <motion.span layoutId="navbar" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-sidebar-primary" />}
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="num m-3 space-y-1.5 rounded-sm border border-sidebar-border p-3 text-[10px] text-sidebar-foreground/70">
        <div className="flex items-center justify-between"><span>API</span><Dot ok={health.data?.status === "ok"} pending={health.isLoading} /></div>
        <div className="flex items-center justify-between"><span>Enjin AI (GPU)</span><Dot ok={!!ai.data?.connected} pending={ai.isLoading} /></div>
      </div>
    </div>
  );
}

function Dot({ ok, pending }: { ok: boolean; pending: boolean }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", pending ? "animate-pulse bg-sidebar-foreground/40" : ok ? "bg-emerald-400" : "bg-sidebar-primary")} />{pending ? "..." : ok ? "sedia" : "luar talian"}</span>;
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-sidebar lg:block"><Nav /></aside>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <span className="font-display font-extrabold text-sidebar-accent-foreground">Reskill<span className="text-sidebar-primary">AI</span></span>
        <button onClick={() => setOpen(true)} className="text-sidebar-foreground" data-testid="button-menu"><Menu className="h-5 w-5" /></button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-sidebar lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-sidebar-foreground" data-testid="button-close-menu"><X className="h-5 w-5" /></button>
            <Nav onNav={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <main className="lg:pl-60">
        <motion.div key={loc} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }} className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </motion.div>
      </main>
    </div>
  );
}
