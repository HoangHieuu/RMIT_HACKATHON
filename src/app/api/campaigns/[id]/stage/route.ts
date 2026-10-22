import { route, body, HttpError } from "@/lib/server/session";
import { db, audit } from "@/lib/server/db";
import { getCampaign, transitionBlocker } from "@/lib/server/repo";
import { ROLE, STAGES, type Stage } from "@/lib/veil";

// Stage transitions are enforced HERE (server), not by disabled buttons.
export const POST = route(
  async (req, p, ctx) => {
    const { id } = await ctx.params;
    const { to } = await body<{ to?: string }>(req);
    if (!STAGES.includes(to as Stage)) throw new HttpError(400, "Unknown stage");
    const c = getCampaign(id);
    const blocker = transitionBlocker(c, to as Stage);
    if (blocker) {
      audit({ actorId: p.sub, actorName: p.username, action: `campaign.stage ${c.status}→${to}`, targetType: "campaign", targetId: id, outcome: "denied", detail: blocker });
      throw new HttpError(409, blocker);
    }
    db().prepare("UPDATE campaigns SET status = ? WHERE id = ? AND status = ?").run(to as string, id, c.status);
    audit({ actorId: p.sub, actorName: p.username, action: `campaign.stage ${c.status}→${to}`, targetType: "campaign", targetId: id, outcome: "ok" });
    return Response.json({ status: to });
  },
  { anyRole: [ROLE.orgAdmin] },
);
