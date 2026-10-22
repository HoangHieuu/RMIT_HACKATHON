import { route } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { getCampaign, campaignStats, reviewersOf, criteriaOf, transitionBlocker } from "@/lib/server/repo";
import { ROLE, nextStage } from "@/lib/veil";

export const GET = route(async (_req, p, ctx) => {
  const { id } = await ctx.params;
  const c = getCampaign(id);
  const staff = p.has(ROLE.orgAdmin) || p.has(ROLE.officer) || p.has(ROLE.realmAdmin);
  const next = nextStage(c.status);
  const policies = db()
    .prepare("SELECT purpose, subject_type, subject_id, record_id, granted_by, created_at FROM relationship_policies WHERE campaign_id = ?")
    .all(id);
  return Response.json({
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    deadline: c.deadline,
    criteria: criteriaOf(c),
    requiredReviews: c.required_reviews,
    policies,
    ...(staff
      ? {
          stats: campaignStats(id),
          reviewers: reviewersOf(id),
          nextStage: next,
          nextStageBlocker: next ? transitionBlocker(c, next) : null,
          disclosureRequests: db()
            .prepare("SELECT id, submission_id, requested_by, reason, status, approved_by, created_at, resolved_at FROM disclosure_requests WHERE campaign_id = ? ORDER BY created_at DESC")
            .all(id),
        }
      : {}),
  });
});
