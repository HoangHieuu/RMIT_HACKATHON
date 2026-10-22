import { route } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { ROLE } from "@/lib/veil";

const PUBLISHED = new Set(["FINALIZED", "DISCLOSURE", "CLOSED"]);

// An applicant sees only their own submissions (ownership checked against the verified sub).
export const GET = route(
  async (_req, p) => {
    const rows = db()
      .prepare(
        `SELECT s.id, s.anonymous_candidate_id, s.title, s.submitted_at, s.status, c.title AS campaign_title, c.status AS campaign_status,
           (SELECT ROUND(AVG(e.weighted_total_score), 1) FROM evaluations e WHERE e.submission_id = s.id AND e.status = 'FINALIZED') AS score
         FROM submissions s JOIN campaigns c ON c.id = s.campaign_id
         WHERE s.applicant_user_id = ? ORDER BY s.submitted_at DESC`,
      )
      .all(p.sub) as { campaign_status: string; score: number | null }[];
    return Response.json({
      submissions: rows.map((r) => ({ ...r, score: PUBLISHED.has(r.campaign_status) ? r.score : null })),
    });
  },
  { anyRole: [ROLE.applicant] },
);
