import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getGetMeQueryKey, logout as apiLogout, useGetMe, type AuthSession, type AuthUser } from "@workspace/api-client-react";
import { setActiveProfile } from "@/lib/fmt";

const TOKEN = "skilytics.token";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signIn: (s: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export const portalHome = (role?: string | null) => (role === "hr" ? "/hr" : role === "tvet" ? "/tvet" : "/me");

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 5 * 60_000 } });
  const meKey = getGetMeQueryKey();

  const rescope = useCallback(async (user: AuthUser | null) => {
    qc.removeQueries({ type: "inactive" });
    qc.setQueryData(meKey, user);
    await qc.resetQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const signIn = useCallback(async (s: AuthSession) => {
    localStorage.setItem(TOKEN, s.token);
    setActiveProfile(null);
    await rescope(s.user);
  }, [rescope]);

  const signOut = useCallback(async () => {
    try { await apiLogout(); } catch { /* token may already be invalid */ }
    localStorage.removeItem(TOKEN);
    setActiveProfile(null);
    qc.clear();
    qc.setQueryData(meKey, null);
    nav("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, nav]);

  const value = useMemo<AuthCtx>(() => ({ user: me.data ?? null, loading: me.isLoading, signIn, signOut }), [me.data, me.isLoading, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
