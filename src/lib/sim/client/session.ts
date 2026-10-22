"use client";

// Browser side of the SIMULATED TideCloak: holds the session and signs real RFC 9449 DPoP proofs
// (WebCrypto ES256) so VEIL's server-side verifyDpop runs unchanged. The session lives in
// sessionStorage, so it is per tab and gone when the tab closes.
import { SIM_API_BASE } from "../mode";

export interface SimSession {
  username: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  dpopPriv: JsonWebKey;
  dpopPub: JsonWebKey;
}

const KEY = "veil.sim.session";
const listeners = new Set<() => void>();

/** Raw stored string: a stable snapshot for useSyncExternalStore. */
export function snapshot(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function store(s: SimSession | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session just will not survive a reload */
  }
  listeners.forEach((f) => f());
}

export function current(): SimSession | null {
  const raw = snapshot();
  return raw ? (JSON.parse(raw) as SimSession) : null;
}

export function decode(jwt: string): Record<string, unknown> {
  try {
    const b = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch {
    return {};
  }
}

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const text = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

async function tokenCall(body: Record<string, unknown>) {
  const res = await fetch(`${SIM_API_BASE}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Simulated sign-in failed (${res.status})`);
  return data as { access_token: string; id_token: string; refresh_token: string };
}

/** Sign in as a persona: a fresh DPoP key pair is bound to the tokens (cnf.jkt). */
export async function simLogin(username: string) {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const dpopPriv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const { crv, kty, x, y } = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const dpopPub = { crv, kty, x, y } as JsonWebKey;
  const t = await tokenCall({ username, jwk: dpopPub });
  store({ username, accessToken: t.access_token, idToken: t.id_token, refreshToken: t.refresh_token, dpopPriv, dpopPub });
}

export function simLogout() {
  store(null);
}

/** Roles are fixed at token time, as on the real realm: refreshing is how a committed grant lands. */
export async function refresh(): Promise<boolean> {
  const s = current();
  if (!s) return false;
  try {
    const t = await tokenCall({ refreshToken: s.refreshToken, jwk: s.dpopPub });
    store({ ...s, accessToken: t.access_token, idToken: t.id_token, refreshToken: t.refresh_token });
    return true;
  } catch {
    store(null);
    return false;
  }
}

export async function getToken(): Promise<string> {
  let s = current();
  if (!s) throw new Error("Not signed in");
  const exp = Number(decode(s.accessToken).exp ?? 0);
  if (exp - Date.now() / 1000 < 30) {
    await refresh();
    s = current();
    if (!s) throw new Error("Session expired");
  }
  return s.accessToken;
}

async function proof(s: SimSession, method: string, url: string, token: string) {
  const u = new URL(url, window.location.origin);
  const header = { alg: "ES256", typ: "dpop+jwt", jwk: s.dpopPub };
  const payload = {
    jti: crypto.randomUUID(),
    htm: method.toUpperCase(),
    htu: `${u.origin}${u.pathname}`,
    iat: Math.floor(Date.now() / 1000),
    ath: b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
  };
  const input = `${b64u(text(header))}.${b64u(text(payload))}`;
  const key = await crypto.subtle.importKey("jwk", s.dpopPriv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `${input}.${b64u(sig)}`;
}

/** Stand-in for the SDK's secureFetch: `DPoP <token>` plus a fresh proof for this request. */
export async function secureFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const s = current()!;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `DPoP ${token}`);
  headers.set("DPoP", await proof(s, init.method ?? "GET", url, token));
  return fetch(url, { ...init, headers });
}
