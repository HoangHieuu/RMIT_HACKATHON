// Every VEIL API route goes through `route()`: it verifies the TideCloak JWT (signature, issuer,
// azp, expiry) AND the DPoP proof, then builds a Principal from the VERIFIED claims.
// Roles are read only from the verified token, never from the database or the request body.
import type { NextRequest } from "next/server";
import { verifyTideJWT, hasRole, extractToken } from "@/lib/auth/tideJWT";
import { verifyDpop } from "@/lib/auth/verifyDpop";
import type { JWTPayload } from "jose";
import { db, audit } from "./db";

export interface Principal {
  sub: string;
  username: string;
  tideUserKey: string;
  roles: string[];
  has(role: string): boolean;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, p: Principal, ctx: Ctx) => Promise<Response>;

export function route(handler: Handler, opts: { anyRole?: string[] } = {}) {
  return async (req: NextRequest, ctx: Ctx) => {
    let p: Principal;
    try {
      const token = extractToken(req.headers.get("authorization"));
      const jwt = await verifyTideJWT(token);
      await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } });
      p = principal(jwt);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status: 401 });
    }
    if (opts.anyRole && !opts.anyRole.some((r) => p.has(r))) {
      audit({ actorId: p.sub, actorName: p.username, action: `api.${req.method} ${new URL(req.url).pathname}`, outcome: "denied", detail: `requires one of: ${opts.anyRole.join(", ")}` });
      return Response.json({ error: `Forbidden: requires role ${opts.anyRole.join(" or ")}` }, { status: 403 });
    }
    try {
      touchUser(p);
      return await handler(req, p, ctx);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      console.error("[veil] route error", err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

function principal(jwt: JWTPayload): Principal {
  const realmRoles: string[] = ((jwt.realm_access as { roles?: string[] })?.roles ?? []).map(String);
  const clientRoles: string[] = Object.values((jwt.resource_access as Record<string, { roles?: string[] }>) ?? {}).flatMap((c) => c?.roles ?? []);
  return {
    sub: String(jwt.sub),
    username: String(jwt.preferred_username ?? jwt.sub),
    tideUserKey: String(jwt.tideuserkey ?? ""),
    roles: Array.from(new Set([...realmRoles, ...clientRoles])),
    has: (role: string) => hasRole(jwt, role),
  };
}

// application_role records the VEIL/Tide roles seen in the user's last verified token. It is
// informational only (the demo runbook reads it); authorization always uses the live token.
function touchUser(p: Principal) {
  const seen = p.roles.filter((r) => r.startsWith("veil-") || r.startsWith("_tide_") || r === "tide-realm-admin").sort().join(" ");
  db()
    .prepare(
      `INSERT INTO users (tidecloak_user_id, username, tide_user_key, application_role, last_seen) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tidecloak_user_id) DO UPDATE SET username = excluded.username, tide_user_key = excluded.tide_user_key,
         application_role = excluded.application_role, last_seen = excluded.last_seen`,
    )
    .run(p.sub, p.username, p.tideUserKey, seen, new Date().toISOString());
}

export async function body<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function str(v: unknown, field: string, max = 20000, min = 1): string {
  if (typeof v !== "string") throw new HttpError(400, `${field} must be a string`);
  const s = v.trim();
  if (s.length < min) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
  return s;
}
