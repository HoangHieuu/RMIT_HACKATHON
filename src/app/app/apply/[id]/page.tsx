"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, EyeOff, Lock, Users } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { encryptIdentity } from "@/lib/client/tide";
import { DEMO_CANDIDATES } from "@/lib/demo/candidates";
import { detectIdentityLeaks, collectErrorText, type Criterion, type IdentityPayload } from "@/lib/veil";
import { Badge, Button, CandidateId, Enforcer, ErrorText, Field, inputCls, Notice, RawDetail, cx } from "@/components/ui";

interface Campaign {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  criteria: Criterion[];
}

type Phase = "form" | "encrypting" | "done";
const STEPS = ["Fetch the campaign's write-only policy", "Encrypt identity on the Tide network", "Send ciphertext and work to VEIL"];

export default function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [identity, setIdentity] = useState<IdentityPayload>({ fullName: "", email: "", university: "", phone: "" });
  const [title, setTitle] = useState("");
  const [work, setWork] = useState("");
  const [skills, setSkills] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ candidateId: string; cipherPreview: string } | null>(null);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    api<Campaign>(`/api/campaigns/${id}`).then(setCampaign).catch((e) => setError(e.message));
  }, [api, id]);

  const warnings = useMemo(() => detectIdentityLeaks(`${title}\n${work}\n${skills}`, identity), [title, work, skills, identity]);

  function fill(i: number) {
    const d = DEMO_CANDIDATES[i];
    setIdentity({ ...d.identity });
    setTitle(d.title);
    setWork(d.work);
    setSkills(d.skills);
    setAck(false);
  }

  // Demo helper: submits all three synthetic candidates. Each one is a separate, real Tide
  // encryption under the campaign's write-only policy; nothing is stored in plaintext.
  const [batch, setBatch] = useState<{ done: string[]; running: boolean; error?: string } | null>(null);
  async function submitAll() {
    setError(null);
    setBatch({ done: [], running: true });
    try {
      const { policy } = await api<{ policy: string }>(`/api/campaigns/${id}/policy?purpose=write`);
      const done: string[] = [];
      for (const d of DEMO_CANDIDATES) {
        const encrypted = await encryptIdentity(d.identity, id, policy);
        const r = await api<{ candidateId: string }>("/api/submissions", {
          method: "POST",
          body: { campaignId: id, title: d.title, work: d.work, skills: d.skills, encryptedIdentity: encrypted },
        });
        done.push(r.candidateId);
        setBatch({ done: [...done], running: true });
      }
      api("/api/audit", { method: "POST", body: { action: "tide.encrypt.succeeded", target: id, detail: `${done.length} synthetic candidates` } }).catch(() => {});
      setBatch({ done, running: false });
    } catch (e) {
      const text = collectErrorText(e);
      api("/api/audit", { method: "POST", body: { action: "tide.encrypt.failed", target: id, detail: text.slice(0, 200) } }).catch(() => {});
      setBatch((b) => ({ done: b?.done ?? [], running: false, error: `Stopped. Nothing was stored in plaintext.
${text}` }));
    }
  }

  async function submit() {
    setError(null);
    if (!identity.fullName || !identity.email || !identity.university) return setError("Name, email and university are required.");
    if (work.trim().length < 50) return setError("Your case study answer is too short.");
    if (warnings.length && !ack) return setError("Review the anonymity warnings, or confirm you want to submit anyway.");
    setPhase("encrypting");
    try {
      setStep(0);
      const { policy } = await api<{ policy: string }>(`/api/campaigns/${id}/policy?purpose=write`);
      setStep(1);
      const encrypted = await encryptIdentity(
        { fullName: identity.fullName.trim(), email: identity.email.trim(), university: identity.university.trim(), phone: identity.phone?.trim() || undefined },
        id,
        policy,
      );
      api("/api/audit", { method: "POST", body: { action: "tide.encrypt.succeeded", target: id } }).catch(() => {});
      setStep(2);
      const r = await api<{ candidateId: string }>("/api/submissions", { method: "POST", body: { campaignId: id, title, work, skills, encryptedIdentity: encrypted } });
      setResult({ candidateId: r.candidateId, cipherPreview: encrypted.slice(0, 120) });
      setIdentity({ fullName: "", email: "", university: "", phone: "" });
      setPhase("done");
    } catch (e) {
      const text = collectErrorText(e);
      api("/api/audit", { method: "POST", body: { action: "tide.encrypt.failed", target: id, detail: text.slice(0, 200) } }).catch(() => {});
      setError(`Submission failed. Nothing was stored in plaintext.\n${text}`);
      setPhase("form");
    }
  }

  if (phase === "done" && result) {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <Notice kind="protected" by="tide" title="Your submission has been received. Your identity is protected and will not be displayed during blind review.">
          Reviewers will only see your work and this candidate ID.
        </Notice>
        <div className="mt-6 rounded-lg p-5 ring-1 ring-line">
          <p className="text-[13px] text-ink-3">Your anonymous candidate ID</p>
          <div className="mt-2">
            <CandidateId id={result.candidateId} size="lg" />
          </div>
          <p className="mt-6 text-[13px] text-ink-3">What VEIL stored for your identity: Tide ciphertext (first 120 characters)</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-ink-2 ring-1 ring-line">{result.cipherPreview}…</pre>
          <p className="mt-3 text-sm leading-relaxed text-ink-3">
            It is encrypted under a write-only policy, so not even you can decrypt it with that policy. Only the quorum-appointed disclosure officer can open it, and only after reviews are final.
          </p>
          <Link href="/app/apply" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Back to my submissions
          </Link>
        </div>
      </div>
    );
  }

  const encrypting = phase === "encrypting";

  return (
    <div>
      <Link href="/app/apply" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Opportunities
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.015em]">{campaign?.title ?? "…"}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{campaign?.description}</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-canvas p-1 ring-1 ring-line">
          <span className="px-2 text-[13px] text-ink-3">Synthetic candidate</span>
          {DEMO_CANDIDATES.map((d, i) => (
            <button key={i} onClick={() => fill(i)} title={d.label} className="h-6 rounded px-2 text-[13px] font-medium text-ink-2 hover:bg-surface hover:text-ink hover:shadow-[0_1px_2px_rgb(12_26_46/0.08)]">
              {i + 1}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          <Button size="sm" variant="secondary" busy={batch?.running} disabled={campaign?.status !== "OPEN"} onClick={submitAll}>
            Submit all 3
          </Button>
        </div>
      </div>
      {batch && (
        <Notice
          kind={batch.error ? "denied" : batch.running ? "info" : "protected"}
          by="tide"
          title={batch.error ? "Batch submission stopped" : batch.running ? `Encrypting and submitting… ${batch.done.length}/${DEMO_CANDIDATES.length}` : `${batch.done.length} synthetic candidates submitted, identities sealed`}
          className="mb-6"
        >
          {batch.done.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {batch.done.map((c) => (
                <CandidateId key={c} id={c} />
              ))}
            </span>
          )}
          {batch.error && <RawDetail>{batch.error}</RawDetail>}
        </Notice>
      )}
      {campaign && campaign.status !== "OPEN" && <Notice kind="warn" title={`This campaign is ${campaign.status.toLowerCase()}. Submissions are closed.`} by="veil" className="mb-6" />}

      <div className="grid overflow-hidden rounded-lg ring-1 ring-line lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)]">
        {/* identity */}
        <section className="border-line bg-seal-soft/40 p-5 lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-seal">
              <Lock className="size-4" strokeWidth={1.5} /> Your identity · Protected
            </h2>
            <Enforcer by="tide" />
          </div>
          <p className="mt-1 text-sm text-ink-3">Encrypted in this browser before it leaves your device.</p>
          <div className="mt-5 space-y-4">
            <Field label="Full name">
              <input className={inputCls} autoComplete="name" value={identity.fullName} onChange={(e) => setIdentity({ ...identity, fullName: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" autoComplete="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} />
            </Field>
            <Field label="University">
              <input className={inputCls} value={identity.university} onChange={(e) => setIdentity({ ...identity, university: e.target.value })} />
            </Field>
            <Field label="Phone" hint="Optional">
              <input className={inputCls} type="tel" autoComplete="tel" value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })} />
            </Field>
          </div>
          <div className="mt-6 border-t border-seal/15 pt-4">
            <p className="text-[13px] font-medium text-ink-2">Who can see this</p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              <li className="flex gap-2">
                <EyeOff className="mt-0.5 size-3.5 shrink-0 text-ink-4" strokeWidth={1.5} /> Reviewers: never.
              </li>
              <li className="flex gap-2">
                <EyeOff className="mt-0.5 size-3.5 shrink-0 text-ink-4" strokeWidth={1.5} /> VEIL&apos;s server and its operators: never. They hold ciphertext only.
              </li>
              <li className="flex gap-2">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-seal" strokeWidth={1.5} /> A disclosure officer, after reviews are final, appointed by 2 of 3 security admins.
              </li>
            </ul>
          </div>
        </section>

        {/* work */}
        <section className="bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-accent" strokeWidth={1.5} /> Your submission · Shared with evaluators
            </h2>
          </div>
          <p className="mt-1 text-sm text-ink-3">Keep this section free of anything that identifies you.</p>
          <div className="mt-5 space-y-4">
            <Field label="Case study title">
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Case study answer" hint="Diagnose the problem and recommend one action with numbers.">
              <textarea className={`${inputCls} min-h-64 leading-relaxed`} value={work} onChange={(e) => setWork(e.target.value)} />
            </Field>
            <Field label="Skills or relevant experience" hint="What you can do, not where you studied or who you are.">
              <textarea className={`${inputCls} min-h-20`} value={skills} onChange={(e) => setSkills(e.target.value)} />
            </Field>
          </div>

          {warnings.length > 0 && (
            <Notice kind="warn" title="Possible identifying details in your work" className="mt-5">
              <ul className="space-y-0.5">
                {warnings.map((w) => (
                  <li key={w} className="flex gap-1.5">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" strokeWidth={1.5} />
                    {w}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-ink-3">These are simple pattern checks and cannot catch everything.</p>
              <label className="mt-2 flex items-center gap-2 text-[13px] font-medium text-ink">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand, submit anyway
              </label>
            </Notice>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-2 pt-4">
            <div className="flex flex-wrap gap-1.5">
              {campaign?.criteria.map((c) => (
                <Badge key={c.key}>
                  {c.label} <span className="tabular text-ink-4">{c.weight}%</span>
                </Badge>
              ))}
            </div>
            <Button size="lg" onClick={submit} busy={encrypting} disabled={campaign?.status !== "OPEN"}>
              <Lock className="size-3.5" strokeWidth={1.5} /> Encrypt identity &amp; submit
            </Button>
          </div>
          {encrypting && (
            <ol className="mt-4 space-y-1.5">
              {STEPS.map((s, i) => (
                <li key={s} className={cx("flex items-center gap-2 text-sm", i < step ? "text-ink-2" : i === step ? "font-medium text-ink" : "text-ink-4")}>
                  {i < step ? (
                    <Check className="size-3.5 text-grant" strokeWidth={1.5} />
                  ) : (
                    <span className={cx("size-3.5 rounded-full border-[1.5px]", i === step ? "animate-pulse border-accent" : "border-line")} />
                  )}
                  {s}
                </li>
              ))}
            </ol>
          )}
          {error && (
            <div className="mt-3">
              <ErrorText error={error.split("\n")[0]} />
              {error.includes("\n") && <RawDetail>{error.split("\n").slice(1).join("\n")}</RawDetail>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
