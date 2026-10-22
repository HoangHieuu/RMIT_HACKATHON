import { route, HttpError } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { getCampaign } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// Ranked results by anonymous candidate id. Identity is never in this response: an authorised
// officer decrypts per candidate in their own browser via /api/submissions/:id/identity.
export const GET = route(
  async (_req, _p, ctx) => {
    const { id } = await ctx.params;
    const c = getCampaign(id);
    if (!["FINALIZED", "DISCLOSURE", "CLOSED", "REVIEW"].includes(c.status)) throw new HttpError(409, "No results before review starts");
    const rows = db()
      .prepare(
        `SELECT s.id, s.anonymous_candidate_id, s.title,
           ROUND(AVG(CASE WHEN e.status = 'FINALIZED' THEN e.weighted_total_score END), 1) AS score,
           SUM(CASE WHEN e.status = 'FINALIZED' THEN 1 ELSE 0 END) AS finalized_reviews
         FROM submissions s LEFT JOIN evaluations e ON e.submission_id = s.id
         WHERE s.campaign_id = ? GROUP BY s.id ORDER BY score DESC NULLS LAST, s.submitted_at ASC`,
      )
      .all(id);
    return Response.json({ campaign: { id: c.id, title: c.title, status: c.status }, results: rows });
  },
  { anyRole: [ROLE.orgAdmin, ROLE.officer, ROLE.realmAdmin] },
);
