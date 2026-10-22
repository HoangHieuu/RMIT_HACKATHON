"use client";

import { useEffect, useState } from "react";
import { CalendarClock, FileSignature } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { Badge, Card, CandidateId, Empty, LinkButton, PageHeader, StageBadge, td, th, tr } from "@/components/ui";
import type { Stage } from "@/lib/veil";

interface Campaign {
  id: string;
  title: string;
  description: string;
  status: Stage;
  deadline: string | null;
  policies: { write: boolean };
}
interface Mine {
  id: string;
  anonymous_candidate_id: string;
  title: string;
  submitted_at: string;
  campaign_title: string;
  campaign_status: Stage;
  score: number | null;
}

export default function ApplyIndex() {
  const api = useApi();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);

  useEffect(() => {
    api<{ campaigns: Campaign[] }>("/api/campaigns").then((r) => setCampaigns(r.campaigns.filter((c) => c.status === "OPEN")));
    api<{ submissions: Mine[] }>("/api/submissions/mine").then((r) => setMine(r.submissions)).catch(() => {});
  }, [api]);

  return (
    <div>
      <PageHeader title="Open opportunities" description="Your identity and your work are submitted separately. Reviewers only ever see your work and a random candidate ID." />

      <div className="grid gap-3">
        {campaigns?.map((c) => (
          <div key={c.id} className="flex flex-col gap-4 rounded-lg p-4 ring-1 ring-line sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[15px] font-semibold">{c.title}</h3>
                <StageBadge stage={c.status} />
              </div>
              <p className="mt-1 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-ink-3">{c.description}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-3">
                <CalendarClock className="size-3.5" strokeWidth={1.5} /> Closes {c.deadline ?? "—"}
              </p>
            </div>
            {c.policies.write ? (
              <LinkButton href={`/app/apply/${c.id}`} arrow>
                Apply
              </LinkButton>
            ) : (
              <Badge tone="warn">Awaiting identity policy</Badge>
            )}
          </div>
        ))}
        {campaigns && campaigns.length === 0 && <Empty title="No campaigns are open right now" icon={FileSignature} />}
      </div>

      <h2 className="mt-10 mb-3 text-[13px] font-semibold">Your submissions</h2>
      {mine.length === 0 ? (
        <Empty title="You haven't applied yet" icon={FileSignature}>
          Submissions appear here with their candidate ID and, once published, their result.
        </Empty>
      ) : (
        <Card flush>
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className={th}>Candidate ID</th>
                <th className={th}>Campaign</th>
                <th className={th}>Stage</th>
                <th className={`${th} text-right`}>Result</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((m) => (
                <tr key={m.id} className={tr}>
                  <td className={td}>
                    <CandidateId id={m.anonymous_candidate_id} />
                  </td>
                  <td className={td}>
                    <p className="font-medium">{m.campaign_title}</p>
                    <p className="text-xs text-ink-3">{m.title}</p>
                  </td>
                  <td className={td}>
                    <StageBadge stage={m.campaign_status} />
                  </td>
                  <td className={`${td} tabular text-right`}>{m.score != null ? <span className="font-semibold">{m.score} / 100</span> : <span className="text-ink-3">Not published</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
