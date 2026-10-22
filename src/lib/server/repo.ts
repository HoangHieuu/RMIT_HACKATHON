// Data access + VEIL business rules. Every rule here is an APPLICATION rule enforced by this
// server. It is NOT cryptographic: TideCloak/ORK enforcement is the separate layer described in
// the README (who can decrypt is decided by the Tide network, not by this file).
import { db as getDb } from "./db";
import { HttpError, type Principal } from "./session";
import { ROLE, STAGES, type Criterion, type Stage } from "../veil";

export interface CampaignRow {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  status: Stage;
  deadline: string | null;
  criteria: string;
  required_reviews: number;
  created_by: string;
  created_at: string;
}

export function getCampaign(id: string): CampaignRow {
  const c = getDb().prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as CampaignRow | undefined;
  if (!c) throw new HttpError(404, "Campaign not found");
  return c;
}

export function criteriaOf(c: CampaignRow): Criterion[] {
  return JSON.parse(c.criteria) as Criterion[];
}

export function reviewersOf(campaignId: string): string[] {
  return (getDb().prepare("SELECT reviewer_username FROM campaign_reviewers WHERE campaign_id = ?").all(campaignId) as { reviewer_username: string }[]).map(
    (r) => r.reviewer_username,
  );
}

export function isAssignedReviewer(campaignId: string, p: Principal) {
  return p.has(ROLE.evaluator) && reviewersOf(campaignId).includes(p.username);
}

export interface CampaignStats {
  submissions: number;
  finalizedSubmissions: number;
  evaluationsFinalized: number;
  evaluationsDraft: number;
}

export function campaignStats(campaignId: string): CampaignStats {
  const d = getDb();
  const submissions = (d.prepare("SELECT COUNT(*) n FROM submissions WHERE campaign_id = ?").get(campaignId) as { n: number }).n;
  const c = getCampaign(campaignId);
  const finalizedSubmissions = (
    d
      .prepare(
        `SELECT COUNT(*) n FROM submissions s WHERE s.campaign_id = ?
         AND (SELECT COUNT(*) FROM evaluations e WHERE e.submission_id = s.id AND e.status = 'FINALIZED') >= ?`,
      )
      .get(campaignId, c.required_reviews) as { n: number }
  ).n;
  const ev = d
    .prepare(
      `SELECT e.status, COUNT(*) n FROM evaluations e JOIN submissions s ON s.id = e.submission_id WHERE s.campaign_id = ? GROUP BY e.status`,
    )
    .all(campaignId) as { status: string; n: number }[];
  return {
    submissions,
    finalizedSubmissions,
    evaluationsFinalized: ev.find((x) => x.status === "FINALIZED")?.n ?? 0,
    evaluationsDraft: ev.find((x) => x.status === "DRAFT")?.n ?? 0,
  };
}

export function approvedDisclosure(campaignId: string) {
  return getDb()
    .prepare("SELECT * FROM disclosure_requests WHERE campaign_id = ? AND status = 'APPROVED' ORDER BY resolved_at DESC LIMIT 1")
    .get(campaignId) as { id: string; requested_by: string; approved_by: string } | undefined;
}

/** Server-side stage machine. Returns the reason a transition is refused, or null. */
export function transitionBlocker(c: CampaignRow, to: Stage): string | null {
  const from = c.status;
  if (STAGES.indexOf(to) !== STAGES.indexOf(from) + 1) return `Invalid transition ${from} → ${to}. Stages only move forward one step.`;
  const stats = campaignStats(c.id);
  switch (to) {
    case "OPEN":
      return criteriaOf(c).reduce((a, x) => a + x.weight, 0) === 100 ? null : "Criteria weights must sum to 100%.";
    case "REVIEW":
      return stats.submissions > 0 ? null : "No submissions to review yet.";
    case "FINALIZED":
      return stats.submissions > 0 && stats.finalizedSubmissions === stats.submissions
        ? null
        : `Every submission needs ${c.required_reviews} finalized review(s): ${stats.finalizedSubmissions}/${stats.submissions} done.`;
    case "DISCLOSURE":
      return approvedDisclosure(c.id) ? null : "A disclosure request must be approved by a disclosure officer first.";
    case "CLOSED":
      return null;
    default:
      return "Unknown stage";
  }
}
