"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { weightedTotal, type Criterion, type Stage } from "@/lib/veil";
import { BypassLab } from "@/components/BypassLab";
import { Button, CandidateId, Enforcer, ErrorText, inputCls, Notice, SecurityState, StageBadge, cx } from "@/components/ui";

interface Detail {
  submission: { id: string; candidateId: string; title: string; work: string; skills: string; submittedAt: string };
  campaign: { id: string; title: string; status: Stage; criteria: Criterion[] };
  evaluation: { criterion_scores: Record<string, number>; weighted_total_score: number; feedback: string; status: string; finalized_at: string | null } | null;
}

/** Ten divisions, one point each: click or arrow keys to set (half-points via the arrow keys). */
function DivisionScale({ value, disabled, onChange, label }: { value: number; disabled: boolean; onChange: (v: number) => void; label: string }) {
  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(10, value + 0.5));
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - 0.5));
      }}
      className="mt-2 grid grid-cols-10 gap-1 rounded focus-visible:outline-offset-4"
    >
      {Array.from({ length: 10 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => onChange(i + 1 === value ? i + 0.5 : i + 1)}
            className={cx("relative h-6 overflow-hidden rounded-[3px] bg-line-2 transition-colors", !disabled && "hover:bg-line")}
            aria-label={`${i + 1}`}
          >
            <span className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-200" style={{ width: `${fill * 100}%` }} />
            <span className={cx("relative text-[10px] font-medium tabular", fill === 1 ? "text-white" : "text-ink-4")}>{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const [d, setD] = useState<Detail | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Detail>(`/api/review/${id}`);
      setD(r);
      setScores(r.evaluation?.criterion_scores ?? Object.fromEntries(r.campaign.criteria.map((c) => [c.key, 5])));
      setFeedback(r.evaluation?.feedback ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, id]);
  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => (d ? weightedTotal(d.campaign.criteria, scores) : 0), [d, scores]);
  const locked = d?.evaluation?.status === "FINALIZED" || d?.campaign.status !== "REVIEW";

  async function save(finalize: boolean) {
    setBusy(finalize ? "final" : "draft");
    setError(null);
    setSaved(null);
    try {
      const r = await api<{ status: string; weightedTotal: number }>(`/api/review/${id}`, { method: "POST", body: { scores, feedback, finalize } });
      setSaved(r.status === "FINALIZED" ? "finalized" : "draft");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!d) return <div className="pt-6">{error ? <Notice kind="denied" title={error} by="veil" /> : <p className="text-sm text-ink-3">Loading…</p>}</div>;

  return (
    <div>
      <Link href="/app/review" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Blind review
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <CandidateId id={d.submission.candidateId} size="lg" />
          <SecurityState kind="sealed" by="tide" />
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-3">
          {d.campaign.title}
          <StageBadge stage={d.campaign.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <article className="rounded-lg ring-1 ring-line">
            <header className="border-b border-line-2 px-5 py-4">
              <h1 className="text-[17px] leading-snug font-semibold tracking-[-0.01em]">{d.submission.title}</h1>
              <p className="mt-1 text-[13px] text-ink-3">Submitted {new Date(d.submission.submittedAt).toLocaleString()}</p>
            </header>
            <div className="max-w-[68ch] px-5 py-5 text-[15px] leading-[1.7] whitespace-pre-wrap text-ink">{d.submission.work}</div>
            {d.submission.skills && (
              <div className="border-t border-line-2 px-5 py-4">
                <p className="text-[13px] font-medium text-ink-3">Skills and experience</p>
                <p className="mt-1 text-sm text-ink-2">{d.submission.skills}</p>
              </div>
            )}
          </article>
          <BypassLab submissionId={id} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg ring-1 ring-line">
            <header className="flex items-center justify-between border-b border-line-2 px-4 py-3">
              <h2 className="text-sm font-semibold">Scoring rubric</h2>
              <span className="text-[13px] text-ink-3">0–10 per criterion</span>
            </header>
            <div className="space-y-5 p-4">
              {d.campaign.criteria.map((c) => (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">
                      {c.label} <span className="font-normal text-ink-4">{c.weight}%</span>
                    </p>
                    <span className="tabular text-sm font-semibold">{scores[c.key] ?? 0}</span>
                  </div>
                  {c.description && <p className="text-[13px] text-ink-3">{c.description}</p>}
                  <DivisionScale label={c.label} value={scores[c.key] ?? 0} disabled={locked} onChange={(v) => setScores({ ...scores, [c.key]: v })} />
                </div>
              ))}
              <div>
                <p className="text-sm font-medium">Feedback</p>
                <textarea className={`${inputCls} mt-1.5 min-h-24`} disabled={locked} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-line-2 bg-canvas px-4 py-3">
              <span className="text-sm text-ink-2">Weighted total</span>
              <span className="tabular text-2xl font-semibold tracking-tight">{total.toFixed(1)}</span>
            </div>
            <div className="border-t border-line-2 p-4">
              {d.evaluation?.status === "FINALIZED" ? (
                <Notice kind="finalized" title="Evaluation finalized" by="veil">
                  Locked {new Date(d.evaluation.finalized_at!).toLocaleString()}. Scores can no longer change.
                </Notice>
              ) : d.campaign.status !== "REVIEW" ? (
                <Notice kind="info" title={`Scoring is closed while the campaign is ${d.campaign.status.toLowerCase()}.`} by="veil" />
              ) : (
                <div className="flex gap-2">
                  <Button variant="secondary" busy={busy === "draft"} onClick={() => save(false)}>
                    Save draft
                  </Button>
                  <Button className="flex-1" busy={busy === "final"} onClick={() => save(true)}>
                    Finalize score
                  </Button>
                </div>
              )}
              {saved === "draft" && <p className="mt-2 text-[13px] text-grant">Draft saved.</p>}
              <ErrorText error={error} />
            </div>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            This response carried no identity. <Enforcer by="veil" />
          </p>
        </aside>
      </div>
    </div>
  );
}
