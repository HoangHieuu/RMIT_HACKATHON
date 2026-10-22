import { route, body, HttpError } from "@/lib/server/session";
import { db, audit } from "@/lib/server/db";
import { getCampaign } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// A disclosure officer approves or denies an org admin's request (application-level two-person rule).
// Approval moves the campaign to DISCLOSURE. It does NOT grant any decryption capability: that
// comes only from the officer's own TideCloak roles, which only a 2-of-3 admin quorum can grant.
export const POST = route(
  async (req, p, ctx) => {
    const { id } = await ctx.params;
    const r = db().prepare("SELECT * FROM disclosure_requests WHERE id = ?").get(id) as
      | { id: string; campaign_id: string; requested_by: string; status: string }
      | undefined;
    if (!r) throw new HttpError(404, "Request not found");
    if (r.status !== "PENDING") throw new HttpError(409, `Request is already ${r.status}`);
    if (r.requested_by === p.username) throw new HttpError(403, "The requester cannot approve their own disclosure request");
    const { decision } = await body<{ decision?: string }>(req);
    if (decision !== "APPROVED" && decision !== "DENIED") throw new HttpError(400, "decision must be APPROVED or DENIED");
    const c = getCampaign(r.campaign_id);
    if (decision === "APPROVED" && c.status !== "FINALIZED") throw new HttpError(409, `Campaign is ${c.status}, expected FINALIZED`);
    const now = new Date().toISOString();
    const d = db();
    d.prepare("UPDATE disclosure_requests SET status = ?, approved_by = ?, resolved_at = ? WHERE id = ?").run(decision, p.username, now, id);
    if (decision === "APPROVED") d.prepare("UPDATE campaigns SET status = 'DISCLOSURE' WHERE id = ? AND status = 'FINALIZED'").run(c.id);
    audit({ actorId: p.sub, actorName: p.username, action: `disclosure.${decision.toLowerCase()}`, targetType: "campaign", targetId: c.id, outcome: "ok" });
    return Response.json({ status: decision });
  },
  { anyRole: [ROLE.officer] },
);
