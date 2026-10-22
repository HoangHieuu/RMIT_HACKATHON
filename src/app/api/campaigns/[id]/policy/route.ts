import { route, body, str, HttpError } from "@/lib/server/session";
import { db, audit, newId } from "@/lib/server/db";
import { getCampaign } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";
import { SIM } from "@/lib/sim/mode";

// Each campaign has two RelationshipAttestation:1 policies, signed by the Tide network after a
// tide-realm-admin approves them in the Tide enclave:
//   write: subject Role veil-applicant,          roles ["_tide_encryptor"]  (drop box: encrypt only)
//   read:  subject Role veil-disclosure-officer, roles ["_tide_decryptor"]  (decrypt only)
// The record id (assignmentId) and the ONLY tag on every identity blob is the campaign id.
const EXPECTED = {
  write: { subjectType: "Role", subjectId: ROLE.applicant, roles: [ROLE.encryptor] },
  read: { subjectType: "Role", subjectId: ROLE.officer, roles: [ROLE.decryptor] },
} as const;

type Purpose = keyof typeof EXPECTED;

function purposeOf(v: string | null): Purpose {
  if (v === "write" || v === "read") return v;
  throw new HttpError(400, "purpose must be write or read");
}

// GET a policy: only to callers it can apply to (AP-RA07).
//   write -> veil-applicant holders;  read -> veil-disclosure-officer holders.
// (The security lab route deliberately hands the read policy to anyone, to prove that holding the
//  policy is useless without the role: see /api/security-lab.)
export const GET = route(async (req, p, ctx) => {
  const { id } = await ctx.params;
  getCampaign(id);
  const purpose = purposeOf(new URL(req.url).searchParams.get("purpose"));
  const need = purpose === "write" ? ROLE.applicant : ROLE.officer;
  if (!p.has(need)) {
    audit({ actorId: p.sub, actorName: p.username, action: `policy.fetch.${purpose}`, targetType: "campaign", targetId: id, outcome: "denied" });
    throw new HttpError(403, `Only holders of ${need} receive this policy`);
  }
  const row = db().prepare("SELECT policy_b64 FROM relationship_policies WHERE campaign_id = ? AND purpose = ?").get(id, purpose) as
    | { policy_b64: string }
    | undefined;
  if (!row) throw new HttpError(404, `No signed ${purpose} policy yet. A Tide realm admin must sign it on the Governance page.`);
  return Response.json({ recordId: id, policy: row.policy_b64 });
});

// STORE a signed policy: Tide realm admins only, checked on the verified token (AP-RA08).
export const POST = route(
  async (req, p, ctx) => {
    const { id } = await ctx.params;
    getCampaign(id);
    const b = await body<{ purpose?: string; policy?: unknown }>(req);
    const purpose = purposeOf(b.purpose ?? null);
    const policyB64 = str(b.policy, "policy", 200000);
    if (!/^[A-Za-z0-9+/=]+$/.test(policyB64)) throw new HttpError(400, "policy must be base64");

    // Parse the signed bytes and check they name the expected subject, record and roles.
    const described = await describe(policyB64);
    const exp = EXPECTED[purpose];
    if (described) {
      const roles = safeParse(described.roles);
      const ok =
        described.isRelationshipPolicy &&
        described.signed &&
        described.subjectType.toLowerCase() === exp.subjectType.toLowerCase() &&
        described.subjectId === exp.subjectId &&
        described.recordId === id &&
        JSON.stringify(roles) === JSON.stringify(exp.roles);
      if (!ok) throw new HttpError(400, `Policy does not match the expected ${purpose} policy for ${id}: ${JSON.stringify(described)}`);
    }

    db()
      .prepare(
        `INSERT INTO relationship_policies (id, campaign_id, purpose, subject_type, subject_id, record_id, policy_b64, granted_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(campaign_id, purpose) DO UPDATE SET policy_b64 = excluded.policy_b64, granted_by = excluded.granted_by, created_at = excluded.created_at`,
      )
      .run(newId("pol"), id, purpose, exp.subjectType, exp.subjectId, id, policyB64, p.username, new Date().toISOString());
    audit({
      actorId: p.sub,
      actorName: p.username,
      action: `policy.signed.${purpose}`,
      targetType: "campaign",
      targetId: id,
      outcome: "ok",
      detail: `RelationshipAttestation:1 subject=Role:${exp.subjectId} roles=${exp.roles.join(",")} parsed=${!!described}`,
      source: "tidecloak",
    });
    return Response.json({ ok: true, verifiedOnServer: !!described });
  },
  { anyRole: [ROLE.realmAdmin] },
);

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

async function describe(b64: string) {
  try {
    if (SIM) return await describeSim(b64);
    const { Models } = await import("@tideorg/js");
    const p = Models.Policy.from(Uint8Array.from(Buffer.from(b64, "base64")));
    const params = (p as unknown as { params: { entries: Map<string, unknown> } }).params.entries;
    const param = (k: string) => String(params.get(k) ?? "");
    const sig = (p as unknown as { signature?: Uint8Array }).signature;
    return {
      contractId: (p as unknown as { contractId: string }).contractId,
      subjectType: param("subjectType"),
      subjectId: param("subjectId"),
      recordId: param("assignmentId"),
      roles: param("roles"),
      signed: !!sig && sig.length > 0,
      isRelationshipPolicy: (p as unknown as { contractId: string }).contractId === "RelationshipAttestation:1",
    };
  } catch (err) {
    console.warn("[veil] could not parse policy server-side; storing unparsed", err instanceof Error ? err.message : err);
    return null;
  }
}

// Simulated policies are JSON, signed by the sim network key; check that signature, not just the shape.
async function describeSim(b64: string) {
  const { decodePolicy, policySigned, CONTRACT_ID } = await import("@/lib/sim/server/ork");
  const p = decodePolicy(b64);
  return {
    contractId: p.contractId,
    subjectType: p.params.subjectType ?? "",
    subjectId: p.params.subjectId ?? "",
    recordId: p.params.assignmentId ?? "",
    roles: p.params.roles ?? "",
    signed: await policySigned(p),
    isRelationshipPolicy: p.contractId === CONTRACT_ID,
  };
}
