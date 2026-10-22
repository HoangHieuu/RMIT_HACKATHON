"use client";

import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { useRevealed } from "@/lib/client/revealed";
import { Badge, Card, CandidateId, Empty, inputCls, PageHeader, StageBadge, td, th, tr } from "@/components/ui";
import type { Stage } from "@/lib/veil";

interface Result {
  id: string;
  anonymous_candidate_id: string;
  title: string;
  score: number | null;
  finalized_reviews: number;
}

export default function ResultsPage() {
  const api = useApi();
  const { revealed } = useRevealed();
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; status: Stage }[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [data, setData] = useState<{ campaign: { title: string; status: Stage }; results: Result[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ campaigns: { id: string; title: string; status: Stage }[] }>("/api/campaigns").then((r) => {
      setCampaigns(r.campaigns);
      setSel((s) => s ?? r.campaigns.find((c) => c.status !== "DRAFT" && c.status !== "OPEN")?.id ?? r.campaigns[0]?.id ?? null);
    });
  }, [api]);

  useEffect(() => {
    if (!sel) return;
    setError(null);
    api<{ campaign: { title: string; status: Stage }; results: Result[] }>(`/api/results/${sel}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(e.message);
      });
  }, [api, sel]);

  const max = Math.max(1, ...(data?.results.map((r) => r.score ?? 0) ?? [1]));

  return (
    <div>
      <PageHeader
        title="Results"
        description="Ranked on the work alone. Scores were finalized before anyone could see who wrote what; names appear only in the browser of someone the Tide network allowed to decrypt them."
        action={
          <select className={`${inputCls} w-auto`} value={sel ?? ""} onChange={(e) => setSel(e.target.value)} aria-label="Campaign">
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        }
      />
      {error && <Empty title="No results yet">{error}</Empty>}
      {data && (
        <Card title={data.campaign.title} action={<StageBadge stage={data.campaign.status} />} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} w-14`}>Rank</th>
                  <th className={th}>Candidate</th>
                  <th className={th}>Submission</th>
                  <th className={`${th} w-64`}>Weighted score</th>
                  <th className={th}>Identity</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => {
                  const id = revealed[r.anonymous_candidate_id];
                  return (
                    <tr key={r.id} className={tr}>
                      <td className={`${td} tabular font-semibold`}>{r.score != null ? i + 1 : "—"}</td>
                      <td className={td}>
                        <CandidateId id={r.anonymous_candidate_id} />
                      </td>
                      <td className={`${td} max-w-[280px] truncate text-ink-2`}>{r.title}</td>
                      <td className={td}>
                        {r.score != null ? (
                          <div className="flex items-center gap-3">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-2">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${(r.score / max) * 100}%` }} />
                            </div>
                            <span className="tabular w-10 text-right font-semibold">{r.score}</span>
                          </div>
                        ) : (
                          <Badge tone="warn">Not finalized</Badge>
                        )}
                      </td>
                      <td className={td}>
                        {id ? (
                          <span className="font-medium text-grant">
                            {id.fullName} <span className="font-normal text-ink-3">· {id.university}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-seal">
                            <EyeOff className="size-3.5" strokeWidth={1.5} /> Sealed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
