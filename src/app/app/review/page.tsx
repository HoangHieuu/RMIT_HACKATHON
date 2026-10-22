"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ScanEye } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { Badge, CandidateId, Empty, Notice, PageHeader, Progress, SecurityState, StageBadge } from "@/components/ui";
import type { Stage } from "@/lib/veil";

interface Row {
  id: string;
  anonymous_candidate_id: string;
  title: string;
  submitted_at: string;
  campaign_id: string;
  campaign_title: string;
  campaign_status: Stage;
  my_status: "DRAFT" | "FINALIZED" | null;
  my_score: number | null;
}

export default function ReviewIndex() {
  const api = useApi();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [assigned, setAssigned] = useState<{ id: string; title: string; status: Stage }[]>([]);

  useEffect(() => {
    api<{ submissions: Row[]; assignedCampaigns: { id: string; title: string; status: Stage }[] }>("/api/review").then((r) => {
      setRows(r.submissions);
      setAssigned(r.assignedCampaigns);
    });
  }, [api]);

  return (
    <div>
      <PageHeader title="Blind review" description="You are assessing work, not people. Candidate identities are encrypted by the Tide network and are not available to your account." />
      <Notice kind="protected" by="tide" title="Identity protected" className="mb-6">
        This queue receives no names, emails, universities or applicant account IDs, and VEIL&apos;s server could not hand them to you even if asked.
      </Notice>

      {rows && rows.length === 0 && (
        <Empty title="Nothing to review yet" icon={ScanEye}>
          Submissions appear here once a campaign you are assigned to enters the Review stage.
        </Empty>
      )}

      {assigned.map((c) => {
        const list = rows?.filter((r) => r.campaign_id === c.id) ?? [];
        const done = list.filter((r) => r.my_status === "FINALIZED").length;
        if (!list.length) return null;
        return (
          <section key={c.id} className="mb-8 overflow-hidden rounded-lg ring-1 ring-line">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-2 bg-canvas px-4 py-2.5">
              <div className="flex items-center gap-3">
                <h2 className="text-[13px] font-semibold">{c.title}</h2>
                <StageBadge stage={c.status} />
              </div>
              <div className="flex w-64 items-center gap-3">
                <span className="tabular text-xs whitespace-nowrap text-ink-3">
                  {done}/{list.length} finalized
                </span>
                <Progress value={done} max={list.length} />
              </div>
            </header>
            <ul>
              {list.map((r, i) => (
                <li key={r.id} className={i ? "border-t border-line-2" : ""}>
                  <Link href={`/app/review/${r.id}`} className="group grid items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-canvas sm:grid-cols-[132px_1fr_auto_auto_16px]">
                    <CandidateId id={r.anonymous_candidate_id} />
                    <span className="truncate text-[13px] font-medium text-ink">{r.title}</span>
                    <SecurityState kind="sealed" by="tide" compact />
                    {r.my_status === "FINALIZED" ? (
                      <Badge tone="final">
                        Finalized <span className="tabular">{r.my_score}</span>
                      </Badge>
                    ) : r.my_status === "DRAFT" ? (
                      <Badge tone="warn">Draft</Badge>
                    ) : (
                      <Badge>Not started</Badge>
                    )}
                    <ChevronRight className="hidden size-4 text-ink-4 group-hover:text-ink-2 sm:block" strokeWidth={1.5} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
