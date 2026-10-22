"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UserPlus } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { useRoles } from "@/components/AppShell";
import { Badge, Button, Card, Enforcer, ErrorText, inputCls, Metrics, Notice, PageHeader, StageBadge, StageStepper, stageLabel } from "@/components/ui";
import { ROLE, type Criterion, type Stage } from "@/lib/veil";

interface Detail {
  id: string;
  title: string;
  description: string;
  status: Stage;
  deadline: string | null;
  criteria: Criterion[];
  requiredReviews: number;
  policies: { purpose: string; granted_by: string; created_at: string }[];
  stats?: { submissions: number; finalizedSubmissions: number; evaluationsFinalized: number; evaluationsDraft: number };
  reviewers?: string[];
  nextStage?: Stage | null;
  nextStageBlocker?: string | null;
}

export default function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const has = useRoles();
  const [d, setD] = useState<Detail | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api<Detail>(`/api/campaigns/${id}`).then(setD), [api, id]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!d) return <p className="pt-6 text-sm text-ink-3">{error ?? "Loading…"}</p>;
  const isOrgAdmin = has(ROLE.orgAdmin);
  const canAdvance = isOrgAdmin && d.nextStage && d.nextStage !== "DISCLOSURE";

  return (
    <div>
      <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Campaigns
      </Link>
      <div className="mt-3">
        <PageHeader title={d.title} description={d.description} action={<StageBadge stage={d.status} />} />
      </div>

      <section className="mb-6 rounded-lg ring-1 ring-line">
        <div className="overflow-x-auto px-4 py-4">
          <StageStepper stage={d.status} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 bg-canvas px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Enforcer by="veil" />
            {d.nextStage === "DISCLOSURE" ? (
              <span className="text-ink-3">Disclosure starts when a disclosure officer approves a request on the Disclosure page.</span>
            ) : d.nextStage && d.nextStageBlocker ? (
              <span className="text-warn">
                {stageLabel(d.nextStage)} blocked: {d.nextStageBlocker}
              </span>
            ) : d.nextStage ? (
              <span className="text-ink-3">Ready to move to {stageLabel(d.nextStage)}.</span>
            ) : (
              <span className="text-ink-3">Campaign closed.</span>
            )}
          </div>
          {canAdvance && (
            <Button busy={busy === "stage"} onClick={() => act("stage", () => api(`/api/campaigns/${id}/stage`, { method: "POST", body: { to: d.nextStage } }))}>
              Move to {stageLabel(d.nextStage!)} <ArrowRight className="size-3.5" strokeWidth={1.5} />
            </Button>
          )}
        </div>
        {error && (
          <div className="border-t border-line-2 px-4 pb-3">
            <ErrorText error={error} />
          </div>
        )}
      </section>

      <Metrics
        items={[
          { label: "Applications", value: d.stats?.submissions ?? 0 },
          { label: "Fully reviewed", value: `${d.stats?.finalizedSubmissions ?? 0}/${d.stats?.submissions ?? 0}` },
          { label: "Finalized scores", value: d.stats?.evaluationsFinalized ?? 0 },
          { label: "Draft scores", value: d.stats?.evaluationsDraft ?? 0 },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Rubric" flush>
          <ul>
            {d.criteria.map((c, i) => (
              <li key={c.key} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i ? "border-t border-line-2" : ""}`}>
                <span>{c.label}</span>
                <span className="flex items-center gap-3">
                  <span className="h-1 w-24 overflow-hidden rounded-full bg-line-2">
                    <span className="block h-full bg-accent" style={{ width: `${c.weight * 2.5}%` }} />
                  </span>
                  <span className="tabular w-9 text-right font-medium">{c.weight}%</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Reviewers" subtitle="Assignment grants access to the work only, never to identities.">
          <div className="flex flex-wrap gap-1.5">
            {d.reviewers?.map((r) => (
              <Badge key={r} tone="accent" className="font-mono">
                {r}
              </Badge>
            ))}
          </div>
          {isOrgAdmin && (
            <div className="mt-4 flex gap-2">
              <input className={inputCls} placeholder="TideCloak username" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
              <Button
                variant="secondary"
                busy={busy === "rev"}
                onClick={() => act("rev", () => api(`/api/campaigns/${id}/reviewers`, { method: "POST", body: { username: reviewer } }).then(() => setReviewer("")))}
              >
                <UserPlus className="size-3.5" strokeWidth={1.5} /> Assign
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Notice kind="protected" by="tide" title="Identities in this campaign are sealed by the Tide network" className="mt-6">
        Every identity is encrypted with tag <span className="font-mono">{d.id}</span> under policies signed by Tide realm admins (
        {d.policies.length ? d.policies.map((p) => `${p.purpose} by ${p.granted_by}`).join(", ") : "not yet signed"}). Running the campaign gives you no way to decrypt anyone.
      </Notice>
    </div>
  );
}
