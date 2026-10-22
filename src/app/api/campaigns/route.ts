import { route, body, str, HttpError } from "@/lib/server/session";
import { db, audit, newId, DEMO_ORG_ID } from "@/lib/server/db";
import { campaignStats, reviewersOf, type CampaignRow } from "@/lib/server/repo";
import { DEFAULT_CRITERIA, ROLE, type Criterion } from "@/lib/veil";

export const GET = route(async (_req, p) => {
  const rows = db().prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all() as unknown as CampaignRow[];
  const staff = p.has(ROLE.orgAdmin) || p.has(ROLE.officer) || p.has(ROLE.realmAdmin) || p.has(ROLE.evaluator);
  const policies = db().prepare("SELECT campaign_id, purpose FROM relationship_policies").all() as { campaign_id: string; purpose: string }[];
  const campaigns = rows
    .filter((c) => staff || c.status === "OPEN")
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      deadline: c.deadline,
      criteria: JSON.parse(c.criteria),
      requiredReviews: c.required_reviews,
      ...(staff ? { stats: campaignStats(c.id), reviewers: reviewersOf(c.id) } : {}),
      policies: {
        write: policies.some((x) => x.campaign_id === c.id && x.purpose === "write"),
        read: policies.some((x) => x.campaign_id === c.id && x.purpose === "read"),
      },
    }));
  return Response.json({ campaigns });
});

export const POST = route(
  async (req, p) => {
    const b = await body<{ title?: unknown; description?: unknown; deadline?: unknown; criteria?: Criterion[] }>(req);
    const title = str(b.title, "title", 120);
    const description = str(b.description, "description", 4000);
    const deadline = typeof b.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.deadline) ? b.deadline : null;
    const criteria = Array.isArray(b.criteria) && b.criteria.length ? b.criteria : DEFAULT_CRITERIA;
    for (const c of criteria) {
      if (typeof c.key !== "string" || !/^[a-z0-9_-]{1,32}$/.test(c.key) || typeof c.label !== "string" || !Number.isFinite(c.weight))
        throw new HttpError(400, "Invalid criterion");
    }
    if (criteria.reduce((a, c) => a + c.weight, 0) !== 100) throw new HttpError(400, "Criteria weights must sum to 100");
    const id = newId("cmp").replace("_", "-").toLowerCase();
    db()
      .prepare(
        `INSERT INTO campaigns (id, organization_id, title, description, status, deadline, criteria, required_reviews, created_by, created_at)
         VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, 1, ?, ?)`,
      )
      .run(id, DEMO_ORG_ID, title, description, deadline, JSON.stringify(criteria), p.username, new Date().toISOString());
    audit({ actorId: p.sub, actorName: p.username, action: "campaign.created", targetType: "campaign", targetId: id, outcome: "ok" });
    return Response.json({ id }, { status: 201 });
  },
  { anyRole: [ROLE.orgAdmin] },
);
