import { route, body, HttpError } from "@/lib/server/session";
import { db, audit, newId } from "@/lib/server/db";
import { getCampaign, criteriaOf, isAssignedReviewer } from "@/lib/server/repo";
import { ROLE, weightedTotal } from "@/lib/veil";

interface SubRow {
  id: string;
  campaign_id: string;
  anonymous_candidate_id: string;
  title: string;
  anonymized_work_content: string;
  skills: string;
  submitted_at: string;
}

function load(id: string, p: Parameters<typeof isAssignedReviewer>[1]) {
  const s = db()
    .prepare("SELECT id, campaign_id, anonymous_candidate_id, title, anonymized_work_content, skills, submitted_at FROM submissions WHERE id = ?")
    .get(id) as SubRow | undefined;
  if (!s) throw new HttpError(404, "Submission not found");
  if (!isAssignedReviewer(s.campaign_id, p)) throw new HttpError(403, "You are not assigned to this campaign");
  const c = getCampaign(s.campaign_id);
  if (c.status === "DRAFT" || c.status === "OPEN") throw new HttpError(409, "Review has not started for this campaign");
  return { s, c };
}

// Anonymous submission detail. Deliberately NO identity, NO ciphertext, NO applicant id.
export const GET = route(
  async (_req, p, ctx) => {
    const { id } = await ctx.params;
    const { s, c } = load(id, p);
    const mine = db()
      .prepare("SELECT criterion_scores, weighted_total_score, feedback, status, finalized_at FROM evaluations WHERE submission_id = ? AND evaluator_id = ?")
      .get(id, p.sub) as { criterion_scores: string } | undefined;
    return Response.json({
      submission: {
        id: s.id,
        candidateId: s.anonymous_candidate_id,
        title: s.title,
        work: s.anonymized_work_content,
        skills: s.skills,
        submittedAt: s.submitted_at,
      },
      campaign: { id: c.id, title: c.title, status: c.status, criteria: criteriaOf(c) },
      evaluation: mine ? { ...mine, criterion_scores: JSON.parse(mine.criterion_scores) } : null,
    });
  },
  { anyRole: [ROLE.evaluator] },
);

// Save a draft or finalize. Weighted total is computed on the server. Finalized = locked.
export const POST = route(
  async (req, p, ctx) => {
    const { id } = await ctx.params;
    const { s, c } = load(id, p);
    if (c.status !== "REVIEW") throw new HttpError(409, `Campaign is ${c.status}; scoring is only open during REVIEW`);
    const b = await body<{ scores?: Record<string, unknown>; feedback?: unknown; finalize?: unknown }>(req);
    const criteria = criteriaOf(c);
    const scores: Record<string, number> = {};
    for (const cr of criteria) {
      const v = Number(b.scores?.[cr.key]);
      if (!Number.isFinite(v) || v < 0 || v > 10) throw new HttpError(400, `Score for "${cr.label}" must be 0-10`);
      scores[cr.key] = Math.round(v * 2) / 2;
    }
    const feedback = typeof b.feedback === "string" ? b.feedback.slice(0, 4000) : "";
    const finalize = b.finalize === true;
    const d = db();
    const existing = d.prepare("SELECT id, status FROM evaluations WHERE submission_id = ? AND evaluator_id = ?").get(id, p.sub) as
      | { id: string; status: string }
      | undefined;
    if (existing?.status === "FINALIZED") throw new HttpError(409, "This evaluation is finalized and locked");
    const total = weightedTotal(criteria, scores);
    const now = new Date().toISOString();
    const status = finalize ? "FINALIZED" : "DRAFT";
    if (existing) {
      d.prepare("UPDATE evaluations SET criterion_scores = ?, weighted_total_score = ?, feedback = ?, status = ?, finalized_at = ?, updated_at = ? WHERE id = ?").run(
        JSON.stringify(scores),
        total,
        feedback,
        status,
        finalize ? now : null,
        now,
        existing.id,
      );
    } else {
      d.prepare(
        `INSERT INTO evaluations (id, submission_id, evaluator_id, evaluator_username, criterion_scores, weighted_total_score, feedback, status, finalized_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId("evl"), id, p.sub, p.username, JSON.stringify(scores), total, feedback, status, finalize ? now : null, now);
    }
    audit({
      actorId: p.sub,
      actorName: p.username,
      action: finalize ? "evaluation.finalized" : "evaluation.draft_saved",
      targetType: "submission",
      targetId: s.anonymous_candidate_id,
      outcome: "ok",
      detail: `weighted_total=${total}`,
    });
    return Response.json({ status, weightedTotal: total });
  },
  { anyRole: [ROLE.evaluator] },
);
