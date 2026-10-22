import { route, body, str, HttpError } from "@/lib/server/session";
import { db, audit } from "@/lib/server/db";
import { getCampaign } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// Assigning a reviewer grants access to the WORK only. It never grants identity access:
// decryption is decided by the Tide network policy, not by this table.
export const POST = route(
  async (req, p, ctx) => {
    const { id } = await ctx.params;
    const c = getCampaign(id);
    if (c.status === "CLOSED") throw new HttpError(409, "Campaign is closed");
    const username = str((await body<{ username?: unknown }>(req)).username, "username", 64);
    if (!/^[a-z0-9._-]+$/i.test(username)) throw new HttpError(400, "Invalid username");
    db().prepare("INSERT OR IGNORE INTO campaign_reviewers (campaign_id, reviewer_username) VALUES (?, ?)").run(id, username);
    audit({ actorId: p.sub, actorName: p.username, action: "campaign.reviewer_assigned", targetType: "campaign", targetId: id, outcome: "ok", detail: `reviewer=${username}` });
    return Response.json({ ok: true });
  },
  { anyRole: [ROLE.orgAdmin] },
);
