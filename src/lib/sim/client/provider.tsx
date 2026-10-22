"use client";

// SIMULATED stand-in for @tidecloak/nextjs: the same provider/hook surface VEIL's screens use,
// backed by the in-process sim IdP instead of a TideCloak server and the Tide enclave.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { REALM_MGMT, SIM_API_BASE, SIM_CLIENT_ID, SIM_REALM, SIM_VENDOR_ID } from "../mode";
import { decode, getToken, refresh, secureFetch, simLogout, snapshot, subscribe, type SimSession } from "./session";

interface SimTideCloak {
  authenticated: boolean;
  isInitializing: boolean;
  initError: Error | null;
  token: string;
  tokenExp: number;
  login: (returnUrl?: string) => void;
  logout: () => void;
  getToken: () => Promise<string>;
  refreshToken: () => Promise<boolean>;
  forceRefreshToken: () => Promise<boolean>;
  getValueFromToken: (key: string) => unknown;
  getValueFromIdToken: (key: string) => unknown;
  hasRealmRole: (role: string) => boolean;
  hasClientRole: (role: string, client?: string) => boolean;
  secureFetch: typeof secureFetch;
  getConfig: () => Record<string, unknown>;
  approveTideRequests: () => Promise<never>;
}

const Ctx = createContext<SimTideCloak | null>(null);

export function SimTideCloakProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const session = useMemo(() => (raw ? (JSON.parse(raw) as SimSession) : null), [raw]);
  const claims = useMemo(() => decode(session?.accessToken ?? ""), [session]);
  const idClaims = useMemo(() => decode(session?.idToken ?? ""), [session]);

  const login = useCallback((returnUrl?: string) => {
    const back = returnUrl ?? window.location.pathname + window.location.search;
    window.location.assign(`/sim/login?returnUrl=${encodeURIComponent(back)}`);
  }, []);
  const logout = useCallback(() => {
    simLogout();
    window.location.assign("/");
  }, []);

  const value = useMemo<SimTideCloak>(() => {
    const realmRoles = ((claims.realm_access as { roles?: string[] })?.roles ?? []) as string[];
    const clientRoles = (claims.resource_access as Record<string, { roles?: string[] }>) ?? {};
    return {
      authenticated: !!session,
      isInitializing: !mounted,
      initError: null,
      token: session?.accessToken ?? "",
      tokenExp: Number(claims.exp ?? 0),
      login,
      logout,
      getToken,
      refreshToken: refresh,
      forceRefreshToken: refresh,
      getValueFromToken: (k) => claims[k],
      getValueFromIdToken: (k) => idClaims[k],
      hasRealmRole: (r) => realmRoles.includes(r),
      hasClientRole: (r, client = SIM_CLIENT_ID) => (clientRoles[client]?.roles ?? []).includes(r),
      secureFetch,
      getConfig: () => ({
        realm: SIM_REALM,
        resource: SIM_CLIENT_ID,
        vendorId: SIM_VENDOR_ID,
        "auth-server-url": `${window.location.origin}${SIM_API_BASE}`,
        managementClient: REALM_MGMT,
      }),
      approveTideRequests: async () => {
        throw new Error("Simulated realm: approvals happen through the simulated enclave dialog");
      },
    };
  }, [session, claims, idClaims, mounted, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimTideCloak(): SimTideCloak {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTideCloak must be used inside the provider");
  return v;
}

/** The sim login page returns straight to the app, so there is no OIDC callback to process. */
export function useSimAuthCallback(opts: { onSuccess?: (returnUrl?: string) => void }) {
  useEffect(() => {
    opts.onSuccess?.("/app");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { isProcessing: false, isSuccess: true, error: null as Error | null };
}
