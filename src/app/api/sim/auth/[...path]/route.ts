// SIMULATED TideCloak: token endpoint + the slice of the Admin REST API that VEIL's Governance page
// uses. Everything under /api/sim is 404 unless NEXT_PUBLIC_TIDE_MODE=simulated.
import type { NextRequest } from "next/server";
import type { JWTPayload } from "jose";
import { authed, simOff } from "@/lib/sim/server/guard";
import { adminPolicyB64, isRealmAdmin } from "@/lib/sim/server/ork";
import {
  REALM_ROLES,
  approveChangeRequest,
  captureRoleChange,
  commitChangeRequest,
  dpopThumbprint,
  issueTokens,
  listChangeRequests,
  listUsers,
  readRefresh,
  realmAdmins,
  userById,
  userByName,
} from "@/lib/sim/server/realm";
import { REALM_ADMIN_ROLE, REALM_MGMT, SIM_REALM } from "@/lib/sim/mode";

type Ctx = { params: Promise<{ path: string[] }> };
const json = (body: unknown, status = 200) => Response.json(body, { status });

async function handle(req: NextRequest, ctx: Ctx): Promise<Response> {
  const off = simOff();
  if (off) return off;
  const path = (await ctx.params).path;
  const m = req.method;

  if (path.length === 1 && path[0] === "token" && m === "POST") return token(req);
  if (path.join("/") === `realms/${SIM_REALM}/tide-console`) {
    return new Response("<!doctype html><title>Simulated TideCloak console</title><p>Simulated TideCloak. Change requests are managed on VEIL's Governance page.</p>", { headers: { "content-type": "text/html" } });
  }
  if (path[0] !== "admin" || path[1] !== "realms" || path[2] !== SIM_REALM) return json({ error: "Not found" }, 404);

  let claims: JWTPayload;
  try {
    claims = await authed(req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unauthorized" }, 401);
  }
  if (!isRealmAdmin(claims)) return json({ error: "Forbidden", message: `requires ${REALM_ADMIN_ROLE}` }, 403);
  const actor = String(claims.preferred_username);
  const rest = path.slice(3);
  const url = new URL(req.url);

  if (m === "GET" && rest[0] === "users" && rest.length === 1) return json(listUsers().map((u) => ({ id: u.id, username: u.username })));
  if (m === "GET" && rest[0] === "clients" && rest.length === 1) return json([{ id: REALM_MGMT, clientId: REALM_MGMT }]);
  if (m === "GET" && rest[0] === "clients" && rest[2] === "roles" && rest[3] === REALM_ADMIN_ROLE) {
    if (rest.length === 5 && rest[4] === "users") return json(realmAdmins().map((u) => ({ id: u.id, username: u.username })));
    return json({ id: `role-${REALM_ADMIN_ROLE}`, name: REALM_ADMIN_ROLE, clientRole: true, containerId: rest[1] });
  }
  if (m === "GET" && rest[0] === "roles" && rest.length === 2) {
    const name = decodeURIComponent(rest[1]);
    return name in REALM_ROLES ? json({ id: `role-${name}`, name }) : json({ error: "Role not found" }, 404);
  }

  // Governed writes: captured as change requests, answered 202 like an IGA realm does.
  if ((m === "POST" || m === "DELETE") && rest[0] === "users" && rest[2] === "role-mappings") {
    const kind = rest[3] === "realm" ? "realm" : rest[3] === "clients" ? "client" : null;
    const user = userById(rest[1]);
    if (!kind || !user) return json({ error: "User or mapping type not found" }, 404);
    const roles = (await req.json().catch(() => null)) as { name?: string }[] | null;
    if (!Array.isArray(roles) || !roles.length) return json({ error: "Body must be an array of roles" }, 400);
    const ids: string[] = [];
    for (const r of roles) {
      const name = String(r.name ?? "");
      if (kind === "client" ? name !== REALM_ADMIN_ROLE : !(name in REALM_ROLES)) return json({ error: `Unknown role '${name}'` }, 404);
      ids.push(captureRoleChange({ actor, userId: user.id, kind, role: name, action: m === "POST" ? "GRANT" : "REVOKE" }));
    }
    return json({ status: "PENDING", id: ids[0], changeRequestIds: ids }, 202);
  }

  if (m === "GET" && rest.join("/") === "iga/change-requests") return json(listChangeRequests(url.searchParams.get("status")));
  if (m === "POST" && rest[0] === "iga" && rest[1] === "change-requests" && rest.length === 4) {
    const r = rest[3] === "approve" ? approveChangeRequest(rest[2], actor) : rest[3] === "commit" ? commitChangeRequest(rest[2], actor) : null;
    if (r) return json(r.body, r.status);
  }
  if (m === "GET" && rest.join("/") === `iga/role-policies/name/${REALM_ADMIN_ROLE}`) return json({ policy: await adminPolicyB64() });

  return json({ error: "Not found in the simulated Admin API" }, 404);
}

async function token(req: NextRequest): Promise<Response> {
  const b = (await req.json().catch(() => null)) as { username?: string; refreshToken?: string; jwk?: JsonWebKey } | null;
  if (!b?.jwk) return json({ error: "jwk (the DPoP public key) is required" }, 400);
  try {
    const jkt = await dpopThumbprint(b.jwk as never);
    if (b.refreshToken) {
      const r = await readRefresh(b.refreshToken);
      const user = userById(r.userId);
      if (!user || r.jkt !== jkt) return json({ error: "invalid_grant" }, 400);
      return json(await issueTokens(user, jkt));
    }
    const user = b.username ? userByName(b.username) : undefined;
    if (!user) return json({ error: "Unknown simulated user" }, 400);
    return json(await issueTokens(user, jkt));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "invalid_request" }, 400);
  }
}

export { handle as GET, handle as POST, handle as DELETE };
