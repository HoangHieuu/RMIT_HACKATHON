import { jwtVerify, createLocalJWKSet } from "jose";
import type { JWTPayload } from "jose";
import { statSync } from "fs";
import { join } from "path";
import { loadTideConfig } from "./tidecloakConfig";
import { SIM } from "@/lib/sim/mode";

// Lazy initialization — do NOT load config at module level.
// Next.js 16 evaluates module-level code during `next build` for static
// page generation. If tidecloak.json doesn't exist yet (placeholder or
// pre-bootstrap), eager loading throws at build time.
let _jwks: ReturnType<typeof createLocalJWKSet> | null = null;
let _config: ReturnType<typeof loadTideConfig> | null = null;
let _configStamp = "";

// Re-read the adapter when data/tidecloak.json changes (e.g. the realm was re-bootstrapped and now
// signs with a new key); otherwise every token would fail verification until a server restart.
function adapterStamp(): string {
  if (process.env.CLIENT_ADAPTER) return "env";
  try {
    const st = statSync(join(process.cwd(), "data", "tidecloak.json"));
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return "missing";
  }
}

async function getConfig() {
  if (SIM) {
    // Simulated realm: trust the sim IdP's public key. Imported lazily so live builds never load it.
    const { simKeys } = await import("@/lib/sim/server/keys");
    _jwks ??= createLocalJWKSet({ keys: [(await simKeys()).realm.pub] });
    return { config: loadTideConfig(), JWKS: _jwks };
  }
  const stamp = adapterStamp();
  if (!_config || stamp !== _configStamp) {
    _configStamp = stamp;
    _config = loadTideConfig();
    if (!_config.jwk) {
      throw new Error(
        "Adapter JSON missing jwk field. Re-export with IGA enabled."
      );
    }
    _jwks = createLocalJWKSet(_config.jwk);
  }
  return { config: _config, JWKS: _jwks! };
}

export async function verifyTideJWT(token: string): Promise<JWTPayload> {
  const { config, JWKS } = await getConfig();
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${config["auth-server-url"].replace(/\/+$/, "")}/realms/${config.realm}`,
  });

  if (payload.azp !== config.resource) {
    throw new Error("Token azp does not match client");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }
  if (payload.iat && payload.iat > now + 60) {
    throw new Error("Token issued in future");
  }

  return payload;
}

export function hasRole(payload: JWTPayload, role: string): boolean {
  const realmRoles = (payload.realm_access as any)?.roles || [];
  if (realmRoles.includes(role)) return true;

  const resourceAccess = payload.resource_access as any;
  if (resourceAccess) {
    for (const client of Object.values(resourceAccess)) {
      if ((client as any)?.roles?.includes(role)) return true;
    }
  }
  return false;
}

export function extractToken(authHeader: string | null): string {
  if (!authHeader) throw new Error("Missing Authorization header");
  if (authHeader.startsWith("Bearer ")) return authHeader.substring(7);
  if (authHeader.startsWith("DPoP ")) return authHeader.substring(5);
  throw new Error("Invalid Authorization header format");
}
