import { route, HttpError } from "@/lib/server/session";
import { db, audit } from "@/lib/server/db";
import { getCampaign, approvedDisclosure } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// Controlled disclosure. This route hands the CIPHERTEXT (+ the read policy) to the browser of a
// disclosure officer when VEIL's APPLICATION conditions hold. It cannot decrypt anything itself.
// The decryption is then performed by the Tide network, which independently checks the caller's
// roles against the signed policy. Two separate layers:
//   1. VEIL (this file):  stage + finalized reviews + approved disclosure request + officer role
//   2. Tide ORKs:         RelationshipAttestation:1 — subject role + _tide_decryptor + tag
export const GET = route(async (_req, p, ctx) => {
  const { id } = await ctx.params;
  const s = db()
    .prepare("SELECT id, campaign_id, anonymous_candidate_id, encrypted_identity_payload, identity_encryption_tags FROM submissions WHERE id = ?")
    .get(id) as { id: string; campaign_id: string; anonymous_candidate_id: string; encrypted_identity_payload: string; identity_encryption_tags: string } | undefined;
  if (!s) throw new HttpError(404, "Submission not found");
  const c = getCampaign(s.campaign_id);

  const deny = (reason: string) => {
    audit({ actorId: p.sub, actorName: p.username, action: "identity.disclosure_requested", targetType: "submission", targetId: s.anonymous_candidate_id, outcome: "denied", detail: reason });
    throw new HttpError(403, reason);
  };
  if (!p.has(ROLE.officer)) deny(`VEIL: your TideCloak token does not carry ${ROLE.officer}.`);
  if (c.status !== "DISCLOSURE") deny(`VEIL: campaign is in ${c.status}; identities are only disclosed in the DISCLOSURE stage.`);
  const finalized = (db().prepare("SELECT COUNT(*) n FROM evaluations WHERE submission_id = ? AND status = 'FINALIZED'").get(id) as { n: number }).n;
  if (finalized < c.required_reviews) deny("VEIL: this submission's reviews are not finalized.");
  if (!approvedDisclosure(c.id)) deny("VEIL: no approved disclosure request for this campaign.");
  const pol = db().prepare("SELECT policy_b64 FROM relationship_policies WHERE campaign_id = ? AND purpose = 'read'").get(c.id) as { policy_b64: string } | undefined;
  if (!pol) throw new HttpError(409, "No signed read policy for this campaign yet.");

  audit({ actorId: p.sub, actorName: p.username, action: "identity.ciphertext_released", targetType: "submission", targetId: s.anonymous_candidate_id, outcome: "ok", detail: "app conditions met; decryption now subject to Tide network" });
  return Response.json({
    candidateId: s.anonymous_candidate_id,
    encrypted: s.encrypted_identity_payload,
    tags: JSON.parse(s.identity_encryption_tags),
    policy: pol.policy_b64,
  });
});
