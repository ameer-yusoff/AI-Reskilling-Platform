import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, Bot, BookOpen, Briefcase, Building2, Database, FileText, GraduationCap, LayoutGrid, LogIn, LogOut,
  Map, Menu, School, Sparkles, Target, Users, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Brand, LangToggle } from "@/components/kit";
import { useAuth } from "@/lib/auth";
import { getActiveProfile } from "@/lib/fmt";
import { useT, type DictKey } from "@/i18n";
import { cn } from "@/lib/utils";

interface Item { href: string; label: DictKey; icon: LucideIcon; match?: (loc: string) => boolean }
interface NavSet { primary: Item[]; groups: { label: DictKey; items: Item[] }[]; more: Item[] }

function useNav(): NavSet {
  const { user } = useAuth();
  const [loc] = useLocation();
  if (user?.role === "hr") {
    const primary: Item[] = [
      { href: "/hr", label: "nav.hrDashboard", icon: LayoutGrid, match: (l) => l === "/hr" },
      { href: "/hr/members", label: "nav.members", icon: Users },
      { href: "/hr/courses", label: "nav.courses", icon: BookOpen },
      { href: "/market", label: "nav.market", icon: BarChart3 },
    ];
    const more: Item[] = [{ href: "/sources", label: "nav.sources", icon: Database }];
    return { primary, more, groups: [{ label: "nav.group.portal", items: primary }, { label: "nav.group.data", items: more }] };
  }
  if (user?.role === "tvet") {
    const primary: Item[] = [
      { href: "/tvet", label: "nav.tvetDashboard", icon: LayoutGrid, match: (l) => l === "/tvet" },
      { href: "/tvet/students", label: "nav.students", icon: GraduationCap },
      { href: "/tvet/programmes", label: "nav.programmes", icon: School },
      { href: "/tvet/market", label: "nav.gradMarket", icon: BarChart3 },
    ];
    const more: Item[] = [{ href: "/sources", label: "nav.sources", icon: Database }];
    return { primary, more, groups: [{ label: "nav.group.portal", items: primary }, { label: "nav.group.data", items: more }] };
  }
  const m = loc.match(/^\/me\/profiles\/(\d+)/);
  const pid = m ? Number(m[1]) : getActiveProfile();
  const mod = (k: string): string => (pid ? `/me/profiles/${pid}/${k}` : "/me");
  const modMatch = (k: string) => (l: string) => !!pid && (l === `/me/profiles/${pid}/${k}` || (k === "intake" && l === `/me/profiles/${pid}`));
  const primary: Item[] = [
    { href: mod("intake"), label: "nav.intake", icon: FileText, match: modMatch("intake") },
    { href: mod("radar"), label: "nav.radar", icon: Activity, match: modMatch("radar") },
    { href: mod("matcher"), label: "nav.matcher", icon: Briefcase, match: modMatch("matcher") },
    { href: mod("pathway"), label: "nav.pathway", icon: Map, match: modMatch("pathway") },
  ];
  const ws: Item[] = [
    { href: "/me", label: "nav.workspace", icon: LayoutGrid, match: (l) => l === "/me" },
    { href: mod("agents"), label: "nav.agents", icon: Bot, match: modMatch("agents") },
    { href: "/me/outlook", label: "nav.outlook", icon: Sparkles },
  ];
  const explore: Item[] = [
    { href: "/roles", label: "nav.roles", icon: Target },
    { href: "/courses", label: "nav.courses", icon: BookOpen },
    { href: "/market", label: "nav.market", icon: BarChart3 },
    { href: "/sources", label: "nav.sources", icon: Database },
  ];
  return {
    primary,
    more: [...ws, ...explore],
    groups: [{ label: "nav.group.modules", items: primary }, { label: "nav.group.workspace", items: ws }, { label: "nav.group.explore", items: explore }],
  };
}

const isActive = (it: Item, loc: string) => (it.match ? it.match(loc) : loc === it.href || loc.startsWith(it.href + "/"));

function UserCard({ onNav }: { onNav?: () => void }) {
  const { user, signOut } = useAuth();
  const { t } = useT();
  if (!user) {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-background p-3">
        <div className="text-xs font-semibold">{t("portal.guest")}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{t("guest.short")}</div>
        <div className="flex gap-2">
          <Link href="/register" onClick={onNav} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground">{t("auth.register")}</Link>
          <Link href="/login" onClick={onNav} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-xs font-medium"><LogIn className="h-3.5 w-3.5" />{t("auth.login")}</Link>
        </div>
      </div>
    );
  }
  const Icon = user.role === "hr" ? Building2 : user.role === "tvet" ? School : Users;
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--maroon-soft))] text-primary"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div title={user.name} className="truncate whitespace-nowrap text-sm font-semibold">{user.name}</div>
          <div title={user.organization ?? ""} className="truncate whitespace-nowrap text-[11px] text-muted-foreground">{user.organization ?? t(`portal.${user.role}` as DictKey)}</div>
        </div>
      </div>
      <button onClick={() => { onNav?.(); void signOut(); }} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:border-primary hover:text-primary" data-testid="button-logout">
        <LogOut className="h-3.5 w-3.5" />{t("common.logout")}
      </button>
    </div>
  );
}

function NavLink({ it, loc, onNav }: { it: Item; loc: string; onNav?: () => void }) {
  const { t } = useT();
  const active = isActive(it, loc);
  const label = t(it.label);
  return (
    <Link href={it.href} onClick={onNav} title={label} data-testid={`link-nav-${it.label}`}
      className={cn("relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors", active ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary")}>
      <it.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate whitespace-nowrap">{label}</span>
    </Link>
  );
}

function SideNav({ onNav }: { onNav?: () => void }) {
  const nav = useNav();
  const [loc] = useLocation();
  const { t } = useT();
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
        <Brand href={user ? (user.role === "hr" ? "/hr" : user.role === "tvet" ? "/tvet" : "/me") : "/"} />
        <LangToggle />
      </div>
      <div className="px-5 pb-2 text-[11px] font-medium text-muted-foreground">{t(user ? (`portal.${user.role}` as DictKey) : "portal.individual")}</div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {nav.groups.map((g) => (
          <div key={g.label}>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">{t(g.label)}</div>
            <div className="space-y-0.5">{g.items.map((it) => <NavLink key={it.label} it={it} loc={loc} onNav={onNav} />)}</div>
          </div>
        ))}
      </nav>
      <div className="p-3"><UserCard onNav={onNav} /></div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const nav = useNav();
  const { t } = useT();
  return (
    <div className="paper min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block"><SideNav /></aside>

      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur lg:hidden">
        <Brand small />
        <div className="flex shrink-0 items-center gap-1.5">
          <LangToggle />
          <button onClick={() => setOpen(true)} aria-label={t("common.more")} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card" data-testid="button-more">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[86vw] max-w-sm overflow-y-auto bg-card p-0">
          <SheetHeader className="px-5 pt-5 text-left"><SheetTitle>{t("common.more")}</SheetTitle></SheetHeader>
          <div className="space-y-0.5 px-3 py-3">{nav.more.map((it) => <NavLink key={it.label} it={it} loc={loc} onNav={() => setOpen(false)} />)}</div>
          <div className="p-3"><UserCard onNav={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <main className="relative z-[1] pb-28 lg:pb-10 lg:pl-64">
        <motion.div key={loc} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
          {children}
        </motion.div>
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/97 px-1 pt-1 shadow-[0_-6px_20px_-12px_hsl(350_30%_20%/0.25)] backdrop-blur lg:hidden" aria-label={t("nav.primary")}>
        {nav.primary.map((it) => {
          const active = isActive(it, loc);
          const label = t(it.label);
          return (
            <Link key={it.label} href={it.href} title={label} data-testid={`tab-${it.label}`}
              className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1", active ? "text-primary" : "text-muted-foreground")}>
              <span className={cn("flex h-7 w-11 items-center justify-center rounded-full transition-colors", active && "bg-[hsl(var(--maroon-soft))]")}><it.icon className="h-5 w-5" /></span>
              <span className={cn("w-full truncate whitespace-nowrap text-center text-[10.5px]", active ? "font-bold" : "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PublicHeader() {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 md:px-8">
        <Brand />
        <div className="flex shrink-0 items-center gap-2">
          <LangToggle />
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" data-testid="link-header-login">{t("auth.login")}</Link>
        </div>
      </div>
    </header>
  );
}
