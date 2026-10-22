"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { useRoles } from "@/components/AppShell";
import { Badge, Button, Card, ErrorText, Field, inputCls, Metrics, PageHeader, Progress, StageBadge, td, th, tr } from "@/components/ui";
import { DEFAULT_CRITERIA, ROLE, type Stage } from "@/lib/veil";

interface Campaign {
  id: string;
  title: string;
  description: string;
  status: Stage;
  deadline: string | null;
  stats?: { submissions: number; finalizedSubmissions: number; evaluationsFinalized: number; evaluationsDraft: number };
  reviewers?: string[];
  policies: { write: boolean; read: boolean };
}

export default function CampaignsPage() {
  const api = useApi();
  const has = useRoles();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ campaigns: Campaign[] }>("/api/campaigns").then((r) => setCampaigns(r.campaigns)), [api]);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/campaigns", { method: "POST", body: { ...form, criteria: DEFAULT_CRITERIA } });
      setCreating(false);
      setForm({ title: "", description: "", deadline: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const totals = campaigns.reduce(
    (a, c) => ({
      subs: a.subs + (c.stats?.submissions ?? 0),
      fin: a.fin + (c.stats?.finalizedSubmissions ?? 0),
      open: a.open + (c.status === "OPEN" ? 1 : 0),
      sealed: a.sealed + (c.stats?.submissions ?? 0),
    }),
    { subs: 0, fin: 0, open: 0, sealed: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Run blind assessments end to end. Managing a campaign never gives you access to who applied."
        action={
          has(ROLE.orgAdmin) && (
            <Button variant={creating ? "secondary" : "primary"} onClick={() => setCreating((v) => !v)}>
              {creating ? "Cancel" : (
                <>
                  <Plus className="size-3.5" strokeWidth={1.5} /> New campaign
                </>
              )}
            </Button>
          )
        }
      />

      <Metrics
        items={[
          { label: "Open campaigns", value: totals.open },
          { label: "Applications", value: totals.subs },
          { label: "Fully reviewed", value: totals.fin, hint: "every review finalized" },
          { label: "Identities sealed", value: totals.sealed, hint: "Tide ciphertext only" },
        ]}
      />

      {creating && (
        <Card className="mb-6" title="New campaign" subtitle="Starts as a draft with the default weighted rubric.">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Field label="Title">
              <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Deadline">
              <input className={inputCls} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <textarea className={`${inputCls} min-h-24`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_CRITERIA.map((c) => (
                <Badge key={c.key}>
                  {c.label} <span className="tabular text-ink-4">{c.weight}%</span>
                </Badge>
              ))}
            </div>
            <Button busy={busy} onClick={create}>
              Create draft
            </Button>
          </div>
          <ErrorText error={error} />
        </Card>
      )}

      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Campaign</th>
                <th className={th}>Stage</th>
                <th className={`${th} text-right`}>Applications</th>
                <th className={`${th} w-52`}>Review progress</th>
                <th className={th}>Deadline</th>
                <th className={th}>Identity policies</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className={tr}>
                  <td className={td}>
                    <Link href={`/app/campaigns/${c.id}`} className="font-medium text-ink hover:text-accent">
                      {c.title}
                    </Link>
                    <p className="font-mono text-xs text-ink-4">{c.id}</p>
                  </td>
                  <td className={td}>
                    <StageBadge stage={c.status} />
                  </td>
                  <td className={`${td} tabular text-right`}>{c.stats?.submissions ?? "—"}</td>
                  <td className={td}>{c.stats ? <Progress value={c.stats.finalizedSubmissions} max={c.stats.submissions} /> : "—"}</td>
                  <td className={`${td} tabular text-ink-2`}>{c.deadline ?? "—"}</td>
                  <td className={td}>
                    <div className="flex gap-1">
                      <Badge tone={c.policies.write ? "seal" : "warn"} icon={c.policies.write ? Lock : undefined}>
                        Write
                      </Badge>
                      <Badge tone={c.policies.read ? "seal" : "warn"} icon={c.policies.read ? Lock : undefined}>
                        Read
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
