import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Briefcase, Building2, Database, FileText, GraduationCap, HardHat, Loader2, Map, School, ShieldCheck, UserRound } from "lucide-react";
import { useGetMarketOverview, useListDemoAccounts, useLogin, useRegister, getGetMarketOverviewQueryKey, type UserRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicHeader } from "@/components/shell";
import { BrandMark, ErrorBox } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";
import { useAuth, portalHome } from "@/lib/auth";
import { errCode, useT, type DictKey } from "@/i18n";
import { cn } from "@/lib/utils";

function HonestyLine() {
  const { t } = useT();
  const ov = useGetMarketOverview({ query: { queryKey: getGetMarketOverviewQueryKey() } });
  const o = ov.data;
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground" data-testid="text-honesty">
      <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
      <span>{t("landing.honesty", { dosm: o?.unemploymentDate ?? t("common.notYet"), aei: o?.aiUsagePeriod ?? t("common.notYet") })}</span>
    </div>
  );
}

function RadarMotif() {
  const pts = (r: number[]) => r.map((v, i) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; return `${100 + Math.cos(a) * v},${100 + Math.sin(a) * v}`; }).join(" ");
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      {[25, 50, 75].map((r) => <polygon key={r} points={pts([r, r, r, r, r, r])} fill="none" stroke="hsl(352 71% 28% / .14)" />)}
      {[0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; return <line key={i} x1="100" y1="100" x2={100 + Math.cos(a) * 75} y2={100 + Math.sin(a) * 75} stroke="hsl(352 71% 28% / .12)" />; })}
      <motion.polygon initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }} style={{ transformOrigin: "100px 100px" }}
        points={pts([70, 62, 72, 55, 66, 60])} fill="hsl(352 71% 28% / .16)" stroke="#7A1523" strokeWidth="2" />
      <motion.polygon initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.5 }} style={{ transformOrigin: "100px 100px" }}
        points={pts([48, 58, 30, 50, 38, 44])} fill="hsl(41 82% 43% / .28)" stroke="#C69214" strokeWidth="2" />
    </svg>
  );
}

export function Landing() {
  const { t } = useT();
  const { user } = useAuth();
  const steps: [DictKey, DictKey, typeof FileText][] = [
    ["nav.intake", "landing.step1", FileText], ["nav.radar", "landing.step2", Activity], ["nav.matcher", "landing.step3", Briefcase], ["nav.pathway", "landing.step4", Map],
  ];
  return (
    <div className="paper min-h-[100dvh] bg-background">
      <PublicHeader />
      <main className="relative z-[1] mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <section className="grid items-center gap-8 py-10 md:grid-cols-[1.25fr_1fr] md:py-16">
          <div className="rise min-w-0">
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-accent/50 bg-card px-3 py-1 text-xs font-semibold text-accent">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" /><span className="truncate whitespace-nowrap">{t("landing.badge")}</span>
            </div>
            <h1 className="text-[2rem] font-extrabold leading-[1.08] tracking-tight md:text-5xl">{t("landing.title")}</h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">{t("landing.sub")}</p>
            {user && (
              <Link href={portalHome(user.role)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-continue">
                {t("landing.continue", { name: user.name })}<ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <div className="mt-6"><HonestyLine /></div>
          </div>
          <div className="mx-auto hidden aspect-square w-full max-w-sm md:block"><RadarMotif /></div>
        </section>

        <section className="grid gap-3 md:grid-cols-2" aria-label={t("landing.chooseTitle")}>
          <h2 className="truncate whitespace-nowrap text-lg font-bold md:col-span-2">{t("landing.chooseTitle")}</h2>
          {([["worker", HardHat, "landing.worker", "landing.workerSub"], ["graduate", GraduationCap, "landing.grad", "landing.gradSub"]] as const).map(([seg, Icon, title, sub], i) => (
            <Link key={seg} href={`/me?new=${seg}`} data-testid={`link-start-${seg}`} style={{ animationDelay: `${i * 80}ms` }}
              className="rise group flex min-h-24 items-center gap-4 rounded-2xl border border-card-border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate whitespace-nowrap font-bold">{t(title)}</span><span className="mt-0.5 block text-sm text-muted-foreground">{t(sub)}</span></span>
              <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
          {([["hr", Building2, "portal.hr", "landing.hrSub"], ["tvet", School, "portal.tvet", "landing.tvetSub"]] as const).map(([role, Icon, title, sub], i) => (
            <Link key={role} href={`/login?role=${role}`} data-testid={`link-portal-${role}`} style={{ animationDelay: `${160 + i * 80}ms` }}
              className="rise group flex min-h-20 items-center gap-4 rounded-2xl border border-dashed border-border bg-background p-4 transition-colors hover:border-accent">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--gold-soft))] text-accent"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate whitespace-nowrap font-semibold">{t(title)}</span><span className="block text-xs text-muted-foreground">{t(sub)}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </section>

        <section className="mt-14">
          <h2 className="truncate whitespace-nowrap text-lg font-bold">{t("landing.howTitle")}</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, body, Icon], i) => (
              <li key={title} className="rise relative rounded-2xl border border-card-border bg-card p-5" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-primary" /><span className="tnum text-xs font-bold text-accent">0{i + 1}</span></div>
                <div className="mt-3 truncate whitespace-nowrap font-semibold" title={t(title)}>{t(title)}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t(body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 grid gap-6 rounded-3xl bg-primary p-6 text-primary-foreground md:grid-cols-[1fr_1.3fr] md:p-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("landing.trustTitle")}</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">{t("landing.trustBody")}</p>
          </div>
          <ul className="grid gap-3 text-sm">
            {(["landing.trust1", "landing.trust2", "landing.trust3"] as const).map((k) => (
              <li key={k} className="flex gap-3 rounded-xl bg-white/5 p-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /><span>{t(k)}</span></li>
            ))}
          </ul>
        </section>

        <footer className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2"><BrandMark className="h-6 w-6 text-[9px]" /><span>{t("landing.footer")}</span></div>
          <div className="flex gap-4"><Link href="/market" className="min-h-11 py-3 hover:text-primary">{t("nav.market")}</Link><Link href="/sources" className="min-h-11 py-3 hover:text-primary">{t("nav.sources")}</Link></div>
        </footer>
      </main>
    </div>
  );
}

function AuthFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="paper min-h-[100dvh] bg-background">
      <PublicHeader />
      <main className="relative z-[1] mx-auto max-w-md px-4 py-8 md:py-14">
        <div className="rise rounded-3xl border border-card-border bg-card p-5 shadow-md md:p-8">
          <h1 title={title} className="truncate whitespace-nowrap text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6"><HonestyLine /></div>
      </main>
    </div>
  );
}

const ROLES: { r: UserRole; icon: typeof UserRound; label: DictKey }[] = [
  { r: "individual", icon: UserRound, label: "role.individual" },
  { r: "hr", icon: Building2, label: "role.hr" },
  { r: "tvet", icon: School, label: "role.tvet" },
];

export function Login() {
  const { t } = useT();
  const search = useSearch();
  const [, nav] = useLocation();
  const { signIn } = useAuth();
  const initialRole = new URLSearchParams(search).get("role");
  const [role, setRole] = useState<UserRole>(initialRole === "hr" || initialRole === "tvet" ? initialRole : "individual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const demos = useListDemoAccounts();
  const login = useLogin();
  useEffect(() => setErr(null), [role]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    login.mutate({ data: { email: email.trim(), password, role } }, {
      onSuccess: async (s) => { await signIn(s); nav(portalHome(s.user.role)); },
      onError: (e) => {
        const c = errCode(e);
        if (c === "wrong_role") {
          const actual = (e as { data?: { role?: string } }).data?.role;
          setErr(actual ? t("auth.wrongRoleKnown", { portal: t(`role.${actual}` as DictKey) }) : t("auth.wrongRole"));
        } else if (c === "invalid_credentials") setErr(t("auth.invalid"));
        else setErr(t("err.generic"));
      },
    });
  };
  const roleDemos = (demos.data ?? []).filter((d) => d.role === role);

  return (
    <AuthFrame title={t("auth.loginTitle")} sub={t("auth.loginSub")}>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
        {ROLES.map(({ r, icon: Icon, label }) => (
          <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setRole(r)} data-testid={`button-role-${r}`}
            className={cn("flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors", role === r ? "bg-card text-primary shadow-xs" : "text-muted-foreground")}>
            <Icon className="h-4 w-4" /><span className="w-full truncate whitespace-nowrap text-center">{t(label)}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11" placeholder={t("auth.emailPh")} data-testid="input-email" /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">{t("auth.password")}</Label>
          <Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-11" data-testid="input-password" /></div>
        {err && <ErrorBox message={err} />}
        <Button type="submit" className="min-h-11 w-full text-sm font-semibold" disabled={login.isPending} data-testid="button-login">
          {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("auth.login")}
        </Button>
      </form>

      {role !== "individual" && (
        <div className="mt-6 rounded-2xl border border-accent/40 bg-[hsl(var(--gold-soft))]/50 p-4">
          <div className="text-sm font-semibold">{t("auth.demoTitle")}</div>
          <p className="text-xs text-muted-foreground">{t("auth.demoSub")}</p>
          <div className="mt-3 space-y-2">
            {demos.isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {!demos.isLoading && !roleDemos.length && <div className="text-xs text-muted-foreground">{t("auth.demoNone")}</div>}
            {roleDemos.map((d) => (
              <div key={d.email} className="flex items-center justify-between gap-2 rounded-xl bg-card p-2.5">
                <div className="min-w-0"><div title={d.organization} className="truncate whitespace-nowrap text-sm font-medium">{d.organization}</div><div className="truncate text-[11px] text-muted-foreground">{d.email}</div></div>
                <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => { setEmail(d.email); setPassword(d.password); }} data-testid={`button-demo-${d.email}`}>{t("auth.useDemo")}</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {role === "individual" && (
        <div className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
          <Link href="/me" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border font-medium hover:border-primary hover:text-primary" data-testid="link-continue-guest">{t("auth.continueGuest")}<ArrowRight className="h-4 w-4" /></Link>
          <p className="text-center text-muted-foreground">{t("auth.noAccount")} <Link href="/register" className="font-semibold text-primary underline-offset-2 hover:underline">{t("auth.register")}</Link></p>
        </div>
      )}
    </AuthFrame>
  );
}

export function Register() {
  const { t } = useT();
  const [, nav] = useLocation();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const reg = useRegister();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) { setErr(t("auth.pwShort")); return; }
    reg.mutate({ data: { name: name.trim(), email: email.trim(), password } }, {
      onSuccess: async (s) => {
        await signIn(s);
        toast({ title: t("auth.welcome", { name: s.user.name }), description: s.claimedProfiles > 0 ? t("auth.claimed", { n: s.claimedProfiles }) : undefined });
        nav("/me");
      },
      onError: (e) => setErr(errCode(e) === "email_taken" ? t("auth.emailTaken") : errCode(e) === "invalid_input" ? t("err.invalid_input") : t("err.generic")),
    });
  };
  return (
    <AuthFrame title={t("auth.registerTitle")} sub={t("auth.registerSub")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="name">{t("auth.name")}</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="min-h-11" autoComplete="name" data-testid="input-name" /></div>
        <div className="space-y-1.5"><Label htmlFor="email">{t("auth.email")}</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11" autoComplete="email" placeholder={t("auth.emailPh")} data-testid="input-email" /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">{t("auth.password")}</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-11" autoComplete="new-password" data-testid="input-password" />
          <p className="text-[11px] text-muted-foreground">{t("auth.pwHint")}</p></div>
        {err && <ErrorBox message={err} />}
        <Button type="submit" className="min-h-11 w-full font-semibold" disabled={reg.isPending} data-testid="button-register">{reg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("auth.register")}</Button>
        <p className="text-xs text-muted-foreground">{t("auth.claimNote")}</p>
        <p className="text-center text-sm text-muted-foreground">{t("auth.haveAccount")} <Link href="/login" className="font-semibold text-primary hover:underline">{t("auth.login")}</Link></p>
      </form>
    </AuthFrame>
  );
}

export function NotFound() {
  const { t } = useT();
  return (
    <div className="dotgrid flex min-h-[60vh] flex-col items-center justify-center rounded-3xl px-4 text-center">
      <div className="tnum text-sm font-bold text-accent">404</div>
      <h1 className="mt-2 text-3xl font-bold">{t("nf.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("nf.body")}</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" data-testid="link-404-home">{t("nf.home")}</Link>
    </div>
  );
}
