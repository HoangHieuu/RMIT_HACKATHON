// SIMULATED Tide ORK network: signs and checks RelationshipAttestation:1 policies, encrypts and
// decrypts. Server-only, and reached ONLY through /api/sim/ork/* with a DPoP-bound token, never from
// VEIL's own routes. That keeps the property the demo shows: VEIL's server hands out ciphertext and
// the policy, and a separate "network" decides whether to open it.
//
// Rules follow src/lib/tide/relationship.ts (measured against the real contract). The refusal texts
// are those src/lib/veil.ts `explainTideRefusal` already recognises. NOT real threshold crypto: one
// process holds the whole key (data/sim-keys.json). Ciphertext is AES-256-GCM, tag-bound.
import { CompactSign, compactVerify, importJWK } from "jose";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import type { JWTPayload } from "jose";
import { simKeys } from "./keys";
import { REALM_ADMIN_ROLE, REALM_MGMT } from "../mode";

export const CONTRACT_ID = "RelationshipAttestation:1";
export const ADMIN_CONTRACT_ID = "TideRealmAdmin:1";
const ENCRYPT_ROLE = "_tide_encryptor";
const DECRYPT_ROLE = "_tide_decryptor";
const MAGIC = Buffer.from("SIM1");

export interface SimPolicy {
  contractId: string;
  version: string;
  modelId: string[];
  keyId: string;
  params: Record<string, string>;
  expiry?: number;
  signature?: string;
  simulated: true;
}

/** The network's refusal: HTTP 403 with the same code/message the SDK surfaces. */
export class Refusal extends Error {
  constructor(public reason: string) {
    super("Could not reach enough VVK ORKs");
  }
}

// Deterministic JSON (keys sorted at every depth, signature excluded): what the signature covers.
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, stable(x)]));
  return v;
}
const canonical = (p: SimPolicy) => JSON.stringify(stable({ ...p, signature: undefined }));
export const encodePolicy = (p: SimPolicy) => Buffer.from(JSON.stringify(p)).toString("base64");

export function decodePolicy(b64: string): SimPolicy {
  try {
    const p = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as SimPolicy;
    if (!p || typeof p.contractId !== "string" || typeof p.params !== "object") throw new Error();
    return p;
  } catch {
    throw new Refusal("Policy bytes could not be parsed");
  }
}

export async function signPolicy(p: Omit<SimPolicy, "signature">): Promise<SimPolicy> {
  const k = await simKeys();
  const jws = await new CompactSign(new TextEncoder().encode(canonical(p as SimPolicy))).setProtectedHeader({ alg: "ES256", kid: k.fabric.priv.kid }).sign(await importJWK(k.fabric.priv, "ES256"));
  return { ...p, signature: jws };
}

export async function policySigned(p: SimPolicy): Promise<boolean> {
  if (!p.signature) return false;
  try {
    const k = await simKeys();
    const { payload } = await compactVerify(p.signature, await importJWK(k.fabric.pub, "ES256"));
    return new TextDecoder().decode(payload) === canonical(p);
  } catch {
    return false;
  }
}

/** The signed admin policy that authorises policy signing (what GET /iga/role-policies/... returns). */
export async function adminPolicyB64(): Promise<string> {
  const p = await signPolicy({ contractId: ADMIN_CONTRACT_ID, version: "sim-1", modelId: [], keyId: "sim-vendor", params: { role: REALM_ADMIN_ROLE }, simulated: true });
  return encodePolicy(p);
}

const roleOf = (c: JWTPayload) => ((c.realm_access as { roles?: string[] })?.roles ?? []).map(String);
export const isRealmAdmin = (c: JWTPayload) => ((c.resource_access as Record<string, { roles?: string[] }>)?.[REALM_MGMT]?.roles ?? []).includes(REALM_ADMIN_ROLE);

/** Sign a relationship policy. Caller must be a realm admin and present the signed admin policy. */
export async function signRelationship(claims: JWTPayload, unsigned: SimPolicy, adminPolicy: string): Promise<string> {
  if (!isRealmAdmin(claims)) throw new Refusal(`Role '${REALM_ADMIN_ROLE}' not found in doken`);
  const admin = decodePolicy(adminPolicy);
  if (admin.contractId !== ADMIN_CONTRACT_ID || !(await policySigned(admin))) throw new Refusal("Admin policy is not signed by the network");
  if (unsigned.contractId !== CONTRACT_ID) throw new Refusal(`Contract '${unsigned.contractId}' is not available on this network`);
  const { subjectType, subjectId, assignmentId, roles } = unsigned.params;
  if (!["User", "Group", "Role"].includes(subjectType) || !subjectId || !assignmentId) throw new Refusal("Policy parameters are incomplete");
  let parsed: unknown;
  try {
    parsed = JSON.parse(roles);
  } catch {
    throw new Refusal("Param 'roles' must be a JSON array written as a string");
  }
  if (!Array.isArray(parsed) || !parsed.length || parsed.some((r) => r !== ENCRYPT_ROLE && r !== DECRYPT_ROLE)) throw new Refusal("Param 'roles' may only contain _tide_encryptor and _tide_decryptor");
  const signed = await signPolicy({ ...unsigned, simulated: true, signature: undefined } as Omit<SimPolicy, "signature">);
  return encodePolicy(signed);
}

async function check(claims: JWTPayload, policyB64: string, tags: string[], op: "encrypt" | "decrypt"): Promise<SimPolicy> {
  const p = decodePolicy(policyB64);
  if (p.contractId !== CONTRACT_ID) throw new Refusal(`Contract '${p.contractId}' is not available on this network`);
  if (!(await policySigned(p))) throw new Refusal("Policy signature is invalid");
  if (p.expiry && p.expiry < Math.floor(Date.now() / 1000)) throw new Refusal("Policy has expired");
  const needed = op === "encrypt" ? ENCRYPT_ROLE : DECRYPT_ROLE;
  let granted: string[] = [];
  try {
    granted = JSON.parse(p.params.roles);
  } catch {
    /* refused below */
  }
  if (!granted.includes(needed)) throw new Refusal(`Policy does not grant ${needed}`);
  const realm = roleOf(claims);
  if (!realm.includes(needed)) throw new Refusal(`Role '${needed}' not found in doken`);
  const { subjectType, subjectId, clientId } = p.params;
  if (subjectType === "Role") {
    const have = clientId ? ((claims.resource_access as Record<string, { roles?: string[] }>)?.[clientId]?.roles ?? []) : realm;
    if (!have.includes(subjectId)) throw new Refusal(`Role '${subjectId}' not found in list of roles`);
  } else if (subjectType === "User") {
    if (claims.tideuserkey !== subjectId) throw new Refusal("subjectId does not match the caller's tideuserkey");
  } else if (subjectType === "Group") {
    if (!((claims.groups as string[]) ?? []).includes(subjectId)) throw new Refusal(`Group '${subjectId}' not found in groups claim`);
  } else throw new Refusal(`Unknown subject type '${subjectType}'`);
  if (tags.length !== 1 || tags[0] !== p.params.assignmentId) throw new Refusal("Tags do not contain assignmentId (the record id must be the one and only tag)");
  return p;
}

async function dataKey(p: SimPolicy, tag: string): Promise<Buffer> {
  const k = await simKeys();
  return Buffer.from(hkdfSync("sha256", Buffer.from(k.ork, "base64"), Buffer.alloc(0), `veil-sim|${p.keyId}|${tag}`, 32));
}

export async function encrypt(claims: JWTPayload, policyB64: string, items: { data: string; tags: string[] }[]): Promise<string[]> {
  const out: string[] = [];
  for (const it of items) {
    const p = await check(claims, policyB64, it.tags ?? [], "encrypt");
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", await dataKey(p, it.tags[0]), iv);
    c.setAAD(Buffer.from(it.tags.join("\u0000")));
    const ct = Buffer.concat([c.update(Buffer.from(it.data, "utf8")), c.final()]);
    out.push(Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]).toString("base64"));
  }
  return out;
}

export async function decrypt(claims: JWTPayload, policyB64: string, items: { encrypted: string; tags: string[] }[]): Promise<string[]> {
  const out: string[] = [];
  for (const it of items) {
    const p = await check(claims, policyB64, it.tags ?? [], "decrypt");
    const raw = Buffer.from(it.encrypted, "base64");
    if (raw.length < MAGIC.length + 28 || !raw.subarray(0, MAGIC.length).equals(MAGIC)) throw new Refusal("Ciphertext was not produced by this network");
    const iv = raw.subarray(4, 16);
    const tag = raw.subarray(16, 32);
    try {
      const d = createDecipheriv("aes-256-gcm", await dataKey(p, it.tags[0]), iv);
      d.setAAD(Buffer.from(it.tags.join("\u0000")));
      d.setAuthTag(tag);
      out.push(Buffer.concat([d.update(raw.subarray(32)), d.final()]).toString("utf8"));
    } catch {
      throw new Refusal("Ciphertext integrity check failed for these tags");
    }
  }
  return out;
}
