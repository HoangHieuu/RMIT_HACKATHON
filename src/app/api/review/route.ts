import { route } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { ROLE } from "@/lib/veil";

// Evaluator dashboard. Returns ONLY the anonymised work: no applicant user id, no ciphertext,
// no identity of any kind. Scoped to campaigns this reviewer is assigned to (cross-campaign
// access is impossible through this query).
export const GET = route(
  async (_req, p) => {
    const rows = db()
      .prepare(
        `SELECT s.id, s.anonymous_candidate_id, s.title, s.submitted_at, c.id AS campaign_id, c.title AS campaign_title, c.status AS campaign_status,
           e.status AS my_status, e.weighted_total_score AS my_score
         FROM submissions s
         JOIN campaigns c ON c.id = s.campaign_id
         JOIN campaign_reviewers r ON r.campaign_id = c.id AND r.reviewer_username = ?
         LEFT JOIN evaluations e ON e.submission_id = s.id AND e.evaluator_id = ?
         WHERE c.status IN ('REVIEW','FINALIZED','DISCLOSURE','CLOSED')
         ORDER BY c.created_at DESC, s.submitted_at ASC`,
      )
      .all(p.username, p.sub);
    const assigned = db()
      .prepare(
        `SELECT c.id, c.title, c.status FROM campaigns c JOIN campaign_reviewers r ON r.campaign_id = c.id WHERE r.reviewer_username = ?`,
      )
      .all(p.username);
    return Response.json({ submissions: rows, assignedCampaigns: assigned });
  },
  { anyRole: [ROLE.evaluator] },
);
