import { route, body, str, HttpError } from "@/lib/server/session";
import { db, audit, newId } from "@/lib/server/db";
import { getCampaign, campaignStats } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// APPLICATION workflow (not TideCloak QEA): an org admin asks for identities to be disclosed after
// evaluation is finalized; a disclosure officer (a different person) must approve.
export const POST = route(
  async (req, p, ctx) => {
    const { id } = await ctx.params;
    const c = getCampaign(id);
    if (c.status !== "FINALIZED") throw new HttpError(409, `Disclosure can only be requested once the campaign is FINALIZED (now ${c.status}).`);
    const st = campaignStats(id);
    if (st.finalizedSubmissions !== st.submissions) throw new HttpError(409, "All reviews must be finalized first.");
    const pending = db().prepare("SELECT 1 FROM disclosure_requests WHERE campaign_id = ? AND status = 'PENDING'").get(id);
    if (pending) throw new HttpError(409, "A disclosure request is already pending.");
    const reason = str((await body<{ reason?: unknown }>(req)).reason, "reason", 1000, 5);
    const rid = newId("dsc");
    db()
      .prepare("INSERT INTO disclosure_requests (id, campaign_id, submission_id, requested_by, reason, status, created_at) VALUES (?, ?, NULL, ?, ?, 'PENDING', ?)")
      .run(rid, id, p.username, reason, new Date().toISOString());
    audit({ actorId: p.sub, actorName: p.username, action: "disclosure.requested", targetType: "campaign", targetId: id, outcome: "ok" });
    return Response.json({ id: rid }, { status: 201 });
  },
  { anyRole: [ROLE.orgAdmin] },
);
