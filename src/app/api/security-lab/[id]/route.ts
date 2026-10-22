import { route, HttpError } from "@/lib/server/session";
import { db, audit } from "@/lib/server/db";
import { isAssignedReviewer } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// SECURITY LAB — a deliberate, labelled simulation of an insider/server compromise.
//
// It gives the caller EVERYTHING VEIL stores about a candidate's identity: the ciphertext and the
// signed read policy. In a conventional app, whoever controls the server controls identity. Here,
// the browser then asks the Tide network to decrypt, and the network refuses unless the caller's
// own credential satisfies the policy. The point being proved: VEIL's server is NOT the gatekeeper.
//
// Restricted to staff who could plausibly be insiders (assigned reviewers, org admins, realm admins).
export const GET = route(async (_req, p, ctx) => {
  const { id } = await ctx.params;
  const s = db()
    .prepare("SELECT campaign_id, anonymous_candidate_id, encrypted_identity_payload, identity_encryption_tags FROM submissions WHERE id = ?")
    .get(id) as { campaign_id: string; anonymous_candidate_id: string; encrypted_identity_payload: string; identity_encryption_tags: string } | undefined;
  if (!s) throw new HttpError(404, "Submission not found");
  const insider = isAssignedReviewer(s.campaign_id, p) || p.has(ROLE.orgAdmin) || p.has(ROLE.realmAdmin);
  if (!insider) throw new HttpError(403, "Security lab is limited to campaign staff");
  const pol = db().prepare("SELECT policy_b64 FROM relationship_policies WHERE campaign_id = ? AND purpose = 'read'").get(s.campaign_id) as
    | { policy_b64: string }
    | undefined;
  if (!pol) throw new HttpError(409, "No signed read policy for this campaign yet.");
  audit({
    actorId: p.sub,
    actorName: p.username,
    action: "security_lab.bypass_kit_issued",
    targetType: "submission",
    targetId: s.anonymous_candidate_id,
    outcome: "ok",
    detail: "SIMULATION: ciphertext + read policy handed out, bypassing VEIL's disclosure rules",
  });
  return Response.json({
    simulation: true,
    candidateId: s.anonymous_candidate_id,
    encrypted: s.encrypted_identity_payload,
    tags: JSON.parse(s.identity_encryption_tags),
    policy: pol.policy_b64,
  });
});
