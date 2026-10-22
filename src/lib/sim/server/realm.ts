// SIMULATED TideCloak realm: users, role mappings, token issuing and IGA change requests.
// Server-only. State lives in VEIL's SQLite file (tables sim_*), so deleting data/veil.db resets it.
//
// Modelled on the documented TideCloak behaviour (docs.tide.org: QEA / IGA):
//  - governed writes become PENDING change requests (HTTP 202) instead of taking effect
//  - threshold = max(1, floor(0.7 * number of tide-realm-admin holders))
//  - each admin counts once; a repeat approval answers 200 {committed:false}
//  - the approval that reaches the threshold commits in the same call
//  - commit below threshold: 412; approve/commit on a non-PENDING request: 409
// Field names inside change-request rows are NOT documented upstream; they are chosen so that
// VEIL's Governance page renders them.
import { SignJWT, calculateJwkThumbprint, importJWK, jwtVerify, type JWK } from "jose";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/lib/server/db";
import { simKeys } from "./keys";
import { SIM_PERSONAS } from "../personas";
import { REALM_ADMIN_ROLE, REALM_MGMT, SIM_CLIENT_ID, SIM_ISSUER_BASE, SIM_REALM } from "../mode";

type DB = ReturnType<typeof db>;

// Realm roles and their composites. veil-applicant is a DEFAULT role: every user holds it, and it
// carries _tide_encryptor (applying is open; the campaign's write policy is encrypt-only).
export const REALM_ROLES: Record<string, string[]> = {
  "veil-applicant": ["_tide_encryptor"],
  "veil-evaluator": [],
  "veil-org-admin": [],
  "veil-disclosure-officer": ["_tide_decryptor"],
  _tide_encryptor: [],
  _tide_decryptor: [],
};
const DEFAULT_ROLES = ["veil-applicant", "default-roles-" + SIM_REALM];
const ACCESS_TTL_S = 300;
const REFRESH_TTL_S = 8 * 3600;

const g = globalThis as unknown as { __simRealmReady?: boolean };

function ensure(): DB {
  const d = db();
  if (g.__simRealmReady) return d;
  d.exec(`
  CREATE TABLE IF NOT EXISTS sim_users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, tide_user_key TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sim_role_mappings (
    user_id TEXT NOT NULL REFERENCES sim_users(id), kind TEXT NOT NULL CHECK (kind IN ('realm','client')),
    role TEXT NOT NULL, PRIMARY KEY (user_id, kind, role)
  );
  CREATE TABLE IF NOT EXISTS sim_change_requests (
    id TEXT PRIMARY KEY, status TEXT NOT NULL, action TEXT NOT NULL, user_id TEXT NOT NULL,
    kind TEXT NOT NULL, role TEXT NOT NULL, requested_by TEXT NOT NULL, created_at TEXT NOT NULL, committed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sim_cr_approvals (
    cr_id TEXT NOT NULL REFERENCES sim_change_requests(id), username TEXT NOT NULL, timestamp INTEGER NOT NULL,
    PRIMARY KEY (cr_id, username)
  );`);
  const count = (d.prepare("SELECT COUNT(*) n FROM sim_users").get() as { n: number }).n;
  if (!count) {
    for (const p of SIM_PERSONAS) {
      const id = randomUUID();
      d.prepare("INSERT INTO sim_users (id, username, tide_user_key) VALUES (?, ?, ?)").run(id, p.username, randomBytes(32).toString("base64"));
      for (const r of p.realmRoles) d.prepare("INSERT INTO sim_role_mappings (user_id, kind, role) VALUES (?, 'realm', ?)").run(id, r);
      if (p.realmAdmin) d.prepare("INSERT INTO sim_role_mappings (user_id, kind, role) VALUES (?, 'client', ?)").run(id, REALM_ADMIN_ROLE);
    }
  }
  g.__simRealmReady = true;
  return d;
}

export interface SimUser {
  id: string;
  username: string;
  tideUserKey: string;
}

export function listUsers(): SimUser[] {
  return (ensure().prepare("SELECT id, username, tide_user_key AS tideUserKey FROM sim_users ORDER BY username").all() as unknown as SimUser[]);
}

export function userByName(username: string): SimUser | undefined {
  return ensure().prepare("SELECT id, username, tide_user_key AS tideUserKey FROM sim_users WHERE username = ?").get(username) as SimUser | undefined;
}

export function userById(id: string): SimUser | undefined {
  return ensure().prepare("SELECT id, username, tide_user_key AS tideUserKey FROM sim_users WHERE id = ?").get(id) as SimUser | undefined;
}

export function effectiveRoles(userId: string): { realm: string[]; admin: boolean } {
  const rows = ensure().prepare("SELECT kind, role FROM sim_role_mappings WHERE user_id = ?").all(userId) as { kind: string; role: string }[];
  const realm = new Set<string>(DEFAULT_ROLES);
  for (const r of [...DEFAULT_ROLES, ...rows.filter((x) => x.kind === "realm").map((x) => x.role)]) {
    realm.add(r);
    for (const c of REALM_ROLES[r] ?? []) realm.add(c);
  }
  return { realm: [...realm].sort(), admin: rows.some((x) => x.kind === "client" && x.role === REALM_ADMIN_ROLE) };
}

export function realmAdmins(): SimUser[] {
  return ensure()
    .prepare(`SELECT u.id, u.username, u.tide_user_key AS tideUserKey FROM sim_users u
              JOIN sim_role_mappings m ON m.user_id = u.id AND m.kind = 'client' AND m.role = ? ORDER BY u.username`)
    .all(REALM_ADMIN_ROLE) as unknown as SimUser[];
}

export const threshold = () => Math.max(1, Math.floor(realmAdmins().length * 0.7));

// --- tokens ----------------------------------------------------------------------------------

export async function dpopThumbprint(jwk: JWK): Promise<string> {
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y || "d" in jwk) throw new Error("dpop jwk must be a public EC P-256 key");
  return calculateJwkThumbprint({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, "sha256");
}

export async function issueTokens(user: SimUser, jkt: string) {
  const k = await simKeys();
  const key = await importJWK(k.realm.priv, "ES256");
  const { realm, admin } = effectiveRoles(user.id);
  const base = { iss: `${SIM_ISSUER_BASE}/realms/${SIM_REALM}`, sub: user.id, azp: SIM_CLIENT_ID, preferred_username: user.username };
  const sign = (claims: Record<string, unknown>, ttl: number) =>
    new SignJWT({ ...base, ...claims })
      .setProtectedHeader({ alg: "ES256", kid: k.realm.priv.kid, typ: "JWT" })
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${ttl}s`)
      .sign(key);
  const access_token = await sign(
    {
      typ: "Bearer",
      aud: SIM_CLIENT_ID,
      realm_access: { roles: realm },
      ...(admin ? { resource_access: { [REALM_MGMT]: { roles: [REALM_ADMIN_ROLE] } } } : {}),
      tideuserkey: user.tideUserKey,
      vuid: user.id,
      groups: [] as string[],
      cnf: { jkt },
    },
    ACCESS_TTL_S,
  );
  const id_token = await sign({ typ: "ID", aud: SIM_CLIENT_ID }, ACCESS_TTL_S);
  const refresh_token = await sign({ typ: "Refresh", aud: SIM_CLIENT_ID, cnf: { jkt } }, REFRESH_TTL_S);
  return { access_token, id_token, refresh_token, expires_in: ACCESS_TTL_S, token_type: "DPoP" };
}

export async function readRefresh(token: string): Promise<{ userId: string; jkt: string }> {
  const k = await simKeys();
  const { payload } = await jwtVerify(token, await importJWK(k.realm.pub, "ES256"), { issuer: `${SIM_ISSUER_BASE}/realms/${SIM_REALM}` });
  if (payload.typ !== "Refresh") throw new Error("not a refresh token");
  return { userId: String(payload.sub), jkt: String((payload.cnf as { jkt?: string })?.jkt ?? "") };
}

// --- IGA change requests ---------------------------------------------------------------------

export interface ChangeRequest {
  id: string;
  entityType: string;
  actionType: string;
  status: "PENDING" | "APPROVED";
  threshold: number;
  authorizationCount: number;
  authCount: number;
  authorizers: { username: string; timestamp: number }[];
  readyToCommit: boolean;
  rows: Record<string, unknown>[];
  createdBy: string;
  createdAt: string;
}

interface CrRow {
  id: string;
  status: "PENDING" | "APPROVED";
  action: "GRANT" | "REVOKE";
  user_id: string;
  kind: "realm" | "client";
  role: string;
  requested_by: string;
  created_at: string;
}

function shape(d: DB, r: CrRow): ChangeRequest {
  const authorizers = d.prepare("SELECT username, timestamp FROM sim_cr_approvals WHERE cr_id = ? ORDER BY timestamp").all(r.id) as { username: string; timestamp: number }[];
  const need = threshold();
  return {
    id: r.id,
    entityType: "USER_ROLE_MAPPING",
    actionType: r.action === "GRANT" ? "GRANT_ROLE" : "REVOKE_ROLE",
    status: r.status,
    threshold: need,
    authorizationCount: authorizers.length,
    authCount: authorizers.length,
    authorizers,
    readyToCommit: r.status === "PENDING" && authorizers.length >= need,
    rows: [{ USERNAME: userById(r.user_id)?.username ?? r.user_id, ROLE_NAME: r.role }],
    createdBy: r.requested_by,
    createdAt: r.created_at,
  };
}

export function listChangeRequests(status: string | null): ChangeRequest[] {
  const d = ensure();
  const rows = (status
    ? d.prepare("SELECT * FROM sim_change_requests WHERE status = ? ORDER BY created_at, id").all(status.toUpperCase())
    : d.prepare("SELECT * FROM sim_change_requests ORDER BY created_at, id").all()) as unknown as CrRow[];
  return rows.map((r) => shape(d, r));
}

/** A governed write: captured as a PENDING change request, not applied. */
export function captureRoleChange(opts: { actor: string; userId: string; kind: "realm" | "client"; role: string; action: "GRANT" | "REVOKE" }): string {
  const d = ensure();
  const id = randomUUID();
  d.prepare("INSERT INTO sim_change_requests (id, status, action, user_id, kind, role, requested_by, created_at) VALUES (?, 'PENDING', ?, ?, ?, ?, ?, ?)").run(
    id,
    opts.action,
    opts.userId,
    opts.kind,
    opts.role,
    opts.actor,
    new Date().toISOString(),
  );
  return id;
}

export interface SimHttp {
  status: number;
  body: Record<string, unknown>;
}

function apply(d: DB, r: CrRow) {
  if (r.action === "GRANT") d.prepare("INSERT OR IGNORE INTO sim_role_mappings (user_id, kind, role) VALUES (?, ?, ?)").run(r.user_id, r.kind, r.role);
  else d.prepare("DELETE FROM sim_role_mappings WHERE user_id = ? AND kind = ? AND role = ?").run(r.user_id, r.kind, r.role);
  d.prepare("UPDATE sim_change_requests SET status = 'APPROVED', committed_at = ? WHERE id = ?").run(new Date().toISOString(), r.id);
}

function load(d: DB, id: string): CrRow | undefined {
  return d.prepare("SELECT * FROM sim_change_requests WHERE id = ?").get(id) as CrRow | undefined;
}

export function approveChangeRequest(id: string, approver: string): SimHttp {
  const d = ensure();
  const r = load(d, id);
  if (!r) return { status: 404, body: { error: "Change request not found" } };
  if (r.status !== "PENDING") return { status: 409, body: { error: `Change request is ${r.status}, not PENDING` } };
  const admin = realmAdmins().some((u) => u.username === approver);
  if (!admin) return { status: 403, body: { error: "FORBIDDEN_APPROVER_ROLE", message: `${approver} is not a ${REALM_ADMIN_ROLE}` } };
  const seen = d.prepare("SELECT 1 FROM sim_cr_approvals WHERE cr_id = ? AND username = ?").get(id, approver);
  if (!seen) d.prepare("INSERT INTO sim_cr_approvals (cr_id, username, timestamp) VALUES (?, ?, ?)").run(id, approver, Date.now());
  const need = threshold();
  const count = (d.prepare("SELECT COUNT(*) n FROM sim_cr_approvals WHERE cr_id = ?").get(id) as { n: number }).n;
  // A repeat approval by the same admin is not an error and does not count twice.
  if (!seen && count >= need) {
    apply(d, r);
    return { status: 200, body: { committed: true, status: "APPROVED", authCount: count, threshold: need } };
  }
  return { status: 200, body: { committed: false, authCount: count, threshold: need } };
}

export function commitChangeRequest(id: string, approver: string): SimHttp {
  const d = ensure();
  const r = load(d, id);
  if (!r) return { status: 404, body: { error: "Change request not found" } };
  if (!realmAdmins().some((u) => u.username === approver)) return { status: 403, body: { error: "Forbidden" } };
  if (r.status !== "PENDING") return { status: 409, body: { error: `Change request is ${r.status}, not PENDING` } };
  const need = threshold();
  const count = (d.prepare("SELECT COUNT(*) n FROM sim_cr_approvals WHERE cr_id = ?").get(id) as { n: number }).n;
  if (count < need) return { status: 412, body: { error: "QUORUM_NOT_MET", message: `Need ${need - count} more signature(s)` } };
  apply(d, r);
  return { status: 200, body: { committed: true, status: "APPROVED", authCount: count, threshold: need } };
}
