import { route } from "@/lib/server/session";
import { db, DEMO_CAMPAIGN_ID } from "@/lib/server/db";
import { campaignStats, getCampaign } from "@/lib/server/repo";
import { STAGES } from "@/lib/veil";

// Demo runbook: where the recorded demo currently stands, computed from real state.
// "Seen" role facts come from each persona's last verified sign-in (informational only).
type Step = { id: string; persona: string; title: string; where: string; done: boolean; detail?: string };

export const GET = route(async () => {
  const d = db();
  const c = getCampaign(DEMO_CAMPAIGN_ID);
  const stats = campaignStats(DEMO_CAMPAIGN_ID);
  const at = STAGES.indexOf(c.status);
  const policies = d.prepare("SELECT purpose FROM relationship_policies WHERE campaign_id = ?").all(DEMO_CAMPAIGN_ID) as { purpose: string }[];
  const users = d.prepare("SELECT username, application_role FROM users").all() as { username: string; application_role: string | null }[];
  const seen = (role: string) => users.filter((u) => (u.application_role ?? "").split(" ").includes(role)).map((u) => u.username);
  const committee = seen("tide-realm-admin");
  const officers = seen("veil-disclosure-officer");
  const audit = (action: string, notActor?: string[]) =>
    (d.prepare("SELECT actor_name FROM audit_events WHERE action = ?").all(action) as { actor_name: string | null }[]).filter(
      (e) => !notActor || !notActor.includes(e.actor_name ?? ""),
    ).length;
  const requested = (d.prepare("SELECT COUNT(*) n FROM disclosure_requests WHERE campaign_id = ?").get(DEMO_CAMPAIGN_ID) as { n: number }).n;
  const approved = (d.prepare("SELECT COUNT(*) n FROM disclosure_requests WHERE campaign_id = ? AND status = 'APPROVED'").get(DEMO_CAMPAIGN_ID) as { n: number }).n;

  const steps: Step[] = [
    {
      id: "policies",
      persona: "hr-lead",
      title: "Sign the campaign's two identity policies in the Tide enclave",
      where: "/app/governance",
      done: policies.some((p) => p.purpose === "write") && policies.some((p) => p.purpose === "read"),
    },
    {
      id: "committee",
      persona: "hr-lead",
      title: "Security committee has 3 Tide realm admins (quorum = 2)",
      where: "/app/governance",
      done: committee.length >= 3,
      detail: committee.length ? `seen at sign-in: ${committee.join(", ")}` : "each committee member signs in once to be counted",
    },
    { id: "submit", persona: "applicant", title: "Submit the synthetic candidates (identity encrypted by Tide)", where: "/app/apply", done: stats.submissions >= 3, detail: `${stats.submissions} submitted` },
    { id: "review-open", persona: "hr-lead", title: "Move the campaign to Review", where: `/app/campaigns/${DEMO_CAMPAIGN_ID}`, done: at >= STAGES.indexOf("REVIEW") },
    {
      id: "score",
      persona: "reviewer",
      title: "Score and finalize every candidate blind",
      where: "/app/review",
      done: stats.submissions > 0 && stats.finalizedSubmissions === stats.submissions,
      detail: `${stats.finalizedSubmissions}/${stats.submissions} finalized`,
    },
    { id: "bypass", persona: "reviewer", title: "Try to reveal a candidate: refused by the Tide network", where: "/app/review", done: audit("tide.decrypt.refused") > 0 },
    { id: "request", persona: "hr-lead", title: "Move to Finalized and request disclosure", where: "/app/disclosure", done: requested > 0 },
    {
      id: "quorum",
      persona: "hr-lead + reviewer",
      title: "Appoint the disclosure officer: 2 of 3 committee approvals",
      where: "/app/governance",
      done: officers.length > 0,
      detail: officers.length ? `officer role seen for: ${officers.join(", ")}` : "officer signs out and in after the grant commits",
    },
    {
      id: "reveal",
      persona: "officer",
      title: "Approve the disclosure request and reveal the shortlist",
      where: "/app/disclosure",
      done: approved > 0 && audit("tide.decrypt.succeeded") > 0,
    },
  ];
  return Response.json({ campaign: { id: c.id, title: c.title, status: c.status }, steps });
});
