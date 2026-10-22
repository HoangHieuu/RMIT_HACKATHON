import { route } from "@/lib/server/session";
import { db, audit, DEMO_CAMPAIGN_ID } from "@/lib/server/db";
import { ROLE } from "@/lib/veil";

// Reset the recorded demo for a retake: submissions, scores, disclosure requests and the app log are
// cleared and the campaign returns to OPEN. Signed Tide policies and TideCloak roles are untouched
// (revoking the officer role is itself a quorum change request, done on the Governance page).
export const POST = route(
  async (_req, p) => {
    const d = db();
    d.exec("BEGIN");
    try {
      d.prepare("DELETE FROM evaluations WHERE submission_id IN (SELECT id FROM submissions WHERE campaign_id = ?)").run(DEMO_CAMPAIGN_ID);
      d.prepare("DELETE FROM submissions WHERE campaign_id = ?").run(DEMO_CAMPAIGN_ID);
      d.prepare("DELETE FROM disclosure_requests WHERE campaign_id = ?").run(DEMO_CAMPAIGN_ID);
      d.prepare("DELETE FROM audit_events").run();
      d.prepare("UPDATE campaigns SET status = 'OPEN' WHERE id = ?").run(DEMO_CAMPAIGN_ID);
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
    audit({ actorId: p.sub, actorName: p.username, action: "demo.reset", targetType: "campaign", targetId: DEMO_CAMPAIGN_ID, outcome: "ok", detail: "policies and TideCloak roles kept" });
    return Response.json({ ok: true });
  },
  { anyRole: [ROLE.orgAdmin] },
);
