"use client";

import { useTideCloak } from "@/lib/tc";
import { useCallback } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Calls VEIL's API through the SDK's secureFetch: the Bearer token is swapped for a DPoP-bound
 * Authorization header plus a signed proof, which the server verifies (src/lib/auth/verifyDpop.ts).
 */
export function useApi() {
  const { secureFetch, getToken } = useTideCloak();
  return useCallback(
    async <T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      await getToken(); // refreshes the token first if it is about to expire
      // Absolute URL (the DPoP proof's htu needs one) and NO Authorization header: secureFetch
      // attaches `DPoP <current token>` + a fresh proof itself, so a cached token can't go stale.
      const res = await secureFetch(new URL(path, window.location.origin).href, {
        method: init.method ?? "GET",
        headers: init.body !== undefined ? { "Content-Type": "application/json" } : {},
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || res.statusText);
      return data as T;
    },
    [secureFetch, getToken],
  );
}

/** Same DPoP-bound call, but straight to TideCloak's admin API with the admin's OWN token (AP-89). */
export function useTideAdminApi() {
  const { secureFetch, getToken, getConfig } = useTideCloak();
  return useCallback(
    async <T = unknown>(pathUnderRealm: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const cfg = getConfig() as { "auth-server-url": string; realm: string };
      const base = cfg["auth-server-url"].replace(/\/+$/, "");
      await getToken();
      const res = await secureFetch(`${base}/admin/realms/${cfg.realm}${pathUnderRealm}`, {
        method: init.method ?? "GET",
        headers: init.body !== undefined ? { "Content-Type": "application/json" } : {},
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const text = await res.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* plain text */
      }
      if (!res.ok) throw new ApiError(res.status, typeof data === "string" ? data : JSON.stringify(data));
      return data as T;
    },
    [secureFetch, getToken, getConfig],
  );
}

export function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
