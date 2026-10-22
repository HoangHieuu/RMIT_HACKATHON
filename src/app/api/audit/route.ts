import { route, body, str, HttpError } from "@/lib/server/session";
import { db, audit } from "@/lib/server/db";
import { ROLE } from "@/lib/veil";

// Application event log. Contains no identity fields, plaintext, ciphertext or tokens.
// TideCloak governance events (change requests + approvals) are read live from TideCloak on the
// Governance page; they are never mixed into this table.
export const GET = route(
  async () => {
    const events = db().prepare("SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 200").all();
    return Response.json({ events });
  },
  { anyRole: [ROLE.orgAdmin, ROLE.officer, ROLE.realmAdmin] },
);

// The browser reports the OUTCOME of a Tide network operation (e.g. "decrypt refused by ORKs").
// Stored as client-reported; never trusted for authorisation.
const ALLOWED = new Set(["tide.decrypt.refused", "tide.decrypt.succeeded", "tide.encrypt.succeeded", "tide.encrypt.failed", "tide.policy.sign_failed"]);
export const POST = route(async (req, p) => {
  const b = await body<{ action?: unknown; target?: unknown; detail?: unknown }>(req);
  const action = str(b.action, "action", 64);
  if (!ALLOWED.has(action)) throw new HttpError(400, "Unknown client event");
  const target = typeof b.target === "string" ? b.target.slice(0, 64) : undefined;
  const detail = typeof b.detail === "string" ? b.detail.replace(/[\r\n]+/g, " ").slice(0, 300) : undefined;
  audit({
    actorId: p.sub,
    actorName: p.username,
    action,
    targetType: "submission",
    targetId: target,
    outcome: action.endsWith("refused") || action.endsWith("failed") ? "denied" : "ok",
    detail: `client-reported Tide network result${detail ? `: ${detail}` : ""}`,
    source: "tidecloak",
  });
  return Response.json({ ok: true });
});
