"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Network,
  ScanEye,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Logo } from "@/components/AppShell";
import { CandidateId, Enforcer, cx, type EnforcerKind } from "@/components/ui";

const USE_CASES = ["Graduate hiring", "Scholarships", "Research grants", "Pitch competitions", "Peer review"];

const TRUST: { actor: string; result: string; by: EnforcerKind; allowed: boolean }[] = [
  { actor: "Reviewer, even with leaked ciphertext", result: "Identity remains sealed", by: "tide", allowed: false },
  { actor: "Organisation admin acting alone", result: "Cannot appoint an officer", by: "quorum", allowed: false },
  { actor: "Disclosure officer after scores lock", result: "Can reveal the shortlist", by: "quorum", allowed: true },
];

export default function Landing() {
  const { authenticated, login } = useTideCloak();
  const start = () => (authenticated ? (window.location.href = "/app") : login());

  return (
    <main className="overflow-hidden bg-surface text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/95 backdrop-blur-lg">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3" aria-label="VEIL home">
            <Logo className="size-9" />
            <span className="text-[17px] font-semibold tracking-[-0.045em]">VEIL</span>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="hidden text-[13px] font-medium text-ink-3 sm:block">Fair evaluation infrastructure</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-3">
            <a href="#method" className="hidden rounded-lg px-3 py-2.5 text-sm text-ink-2 transition-colors hover:bg-canvas hover:text-ink sm:block">How it works</a>
            <a href="#trust" className="hidden rounded-lg px-3 py-2.5 text-sm text-ink-2 transition-colors hover:bg-canvas hover:text-ink sm:block">Trust model</a>
            <button onClick={start} className="ml-1 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink-2 sm:ml-2">
              {authenticated ? "Open workspace" : "Sign in"}
              <ArrowUpRight className="size-4" />
            </button>
          </nav>
        </div>
      </header>

      <section className="relative border-b border-line-2 bg-canvas/75">
        <div className="mx-auto grid max-w-[1440px] items-center gap-16 px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:grid-cols-[0.92fr_1.08fr] xl:gap-14 xl:py-24">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold tracking-[0.04em] text-seal ring-1 ring-seal/15">
              <span className="size-2 rounded-full bg-seal" /> RMIT × Tide UNLOCKED · Challenge 2
            </div>
            <h1 className="max-w-[700px] text-[clamp(3.1rem,5.6vw,5.4rem)] leading-[0.94] font-semibold tracking-[-0.075em] text-balance text-ink">
              Judge the work.
              <br />
              <span className="font-display pr-2 font-normal italic tracking-[-0.065em] text-seal">Not the person.</span>
            </h1>
            <p className="mt-8 max-w-[570px] text-[18px] leading-[1.7] text-ink-2 sm:text-[19px]">
              VEIL keeps a submission and its author on separate paths. Reviewers see the work; the Tide network protects identity until a governed disclosure is allowed.
            </p>
            <div className="mt-9 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
              <button onClick={start} className="inline-flex h-[52px] items-center justify-center gap-3 rounded-lg bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_3px_10px_rgb(49_95_232/0.22)] transition-[background,transform,box-shadow] hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_6px_16px_rgb(49_95_232/0.25)]">
                Start a blind review <ArrowRight className="size-4" />
              </button>
              <a href="#method" className="inline-flex h-[48px] items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-medium text-ink-2 transition-colors hover:bg-white sm:h-[52px]">
                See the safeguards <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="mt-10 grid max-w-[590px] gap-4 border-t border-line pt-6 sm:grid-cols-2 sm:gap-6">
              <TrustMark icon={LockKeyhole}>Identity encrypted at submission</TrustMark>
              <TrustMark icon={EyeOff}>No identity in reviewer view</TrustMark>
            </div>
          </div>
          <EvidenceSplit />
        </div>
      </section>

      <section aria-label="Where fair evaluation matters" className="border-y border-accent/10 bg-accent-soft/55">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-3.5 gap-y-3 px-5 py-7 sm:gap-x-4 sm:px-8 sm:py-8 lg:px-12">
          <span className="mb-1 inline-flex w-full items-center justify-center gap-2 text-[12px] font-bold tracking-[0.12em] text-accent uppercase sm:mb-0 sm:w-auto sm:justify-start">
            <span className="size-2 rounded-full bg-seal" /> Fair evaluation for
          </span>
          {USE_CASES.map((item) => (
            <span key={item} className="rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-ink-2 shadow-[0_1px_3px_rgb(21_38_59/0.07)] ring-1 ring-line transition-colors hover:text-accent">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="method" className="scroll-mt-20">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="grid gap-6 pb-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.12em] text-accent uppercase">The review path</p>
              <h2 className="mt-4 max-w-[560px] text-[clamp(2.4rem,4vw,3.5rem)] leading-[1.04] font-semibold tracking-[-0.06em] text-balance">One record.<br />Two separate paths.</h2>
            </div>
            <p className="max-w-[620px] text-[17px] leading-[1.7] text-ink-3 md:justify-self-end">
              The submission moves through evaluation. Identity follows a protected route governed by Tide policies and a multi-admin quorum.
            </p>
          </div>
          <ol className="grid gap-0 pt-3 md:grid-cols-4">
            <FlowStep index="01" title="Submit" tag="Identity sealed" color="seal">
              Identity is encrypted in the applicant&apos;s browser. VEIL stores ciphertext, never a readable profile.
            </FlowStep>
            <FlowStep index="02" title="Review blind" tag="Work only" color="accent">
              Reviewers get a random candidate ID, the submitted work, and the scoring rubric.
            </FlowStep>
            <FlowStep index="03" title="Lock results" tag="Scores finalized" color="final">
              Scores are finalized before an organisation can request disclosure.
            </FlowStep>
            <FlowStep index="04" title="Govern disclosure" tag="2 of 3 approvals" color="quorum">
              A disclosure officer can reveal identity only after the required approvals and final scoring.
            </FlowStep>
          </ol>
        </div>
      </section>

      <section id="trust" className="scroll-mt-20 border-y border-line-2 bg-canvas/70">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-12 lg:py-28">
          <div className="max-w-[550px]">
            <div className="grid size-14 place-items-center rounded-2xl bg-white text-seal ring-1 ring-line shadow-sm"><Fingerprint className="size-6" strokeWidth={1.7} /></div>
            <p className="mt-8 text-[13px] font-semibold tracking-[0.12em] text-seal uppercase">A boundary enforced by the network</p>
            <h2 className="mt-4 text-[clamp(2.2rem,3.8vw,3.35rem)] leading-[1.06] font-semibold tracking-[-0.06em] text-balance">The reviewer can&apos;t look up the person who wrote the work.</h2>
            <p className="mt-6 text-[17px] leading-[1.75] text-ink-2">
              Hiding a name in the interface is not enough. VEIL keeps identity ciphertext separate, while the Tide network checks every decryption request against a signed policy.
            </p>
            <div className="mt-8 flex items-start gap-3.5 border-t border-line pt-6">
              <Network className="mt-1 size-5 shrink-0 text-seal" strokeWidth={1.7} />
              <p className="text-[15px] leading-[1.65] text-ink-3">VEIL controls when disclosure can be requested. Tide controls whether the caller can decrypt.</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line shadow-[0_8px_28px_rgb(21_38_59/0.06)]">
            <div className="flex items-center justify-between gap-5 border-b border-line-2 px-6 py-6 sm:px-8">
              <div>
                <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink">Who can reveal an identity?</p>
                <p className="mt-1.5 text-[14px] text-ink-3">Each request is checked at the layer that holds authority.</p>
              </div>
              <ShieldCheck className="size-6 shrink-0 text-seal" strokeWidth={1.7} />
            </div>
            <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(174px,max-content)] gap-5 bg-canvas px-6 py-3 text-[11px] font-semibold tracking-[0.1em] text-ink-4 uppercase sm:grid sm:px-8">
              <span>Actor</span><span>Outcome</span><span>Authority</span>
            </div>
            {TRUST.map((row) => (
              <div key={row.actor} className="grid gap-3 border-t border-line-2 px-6 py-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(174px,max-content)] sm:items-center sm:gap-5 sm:px-8">
                <span className="text-[14px] font-medium leading-snug text-ink">{row.actor}</span>
                <span className={cx("inline-flex items-center gap-2 text-[14px] font-medium", row.allowed ? "text-grant" : "text-deny")}>
                  {row.allowed ? <Check className="size-4 shrink-0" /> : <ShieldX className="size-4 shrink-0" />}{row.result}
                </span>
                <div className="flex justify-start"><Enforcer by={row.by} /></div>
              </div>
            ))}
            <div className="flex items-start gap-2.5 border-t border-line-2 bg-canvas/70 px-6 py-4 text-[13px] leading-relaxed text-ink-3 sm:px-8">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-quorum" /> Role changes require approval from the security committee.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="relative overflow-hidden rounded-[24px] bg-ink px-7 py-9 text-white sm:px-10 sm:py-11 lg:px-12">
          <div className="absolute inset-y-0 right-0 hidden w-[38%] border-l border-white/10 bg-white/[0.025] lg:block" />
          <div className="relative z-10 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[720px]">
              <p className="text-[13px] font-semibold tracking-[0.12em] text-[#90cfc5] uppercase">RMIT × Tide UNLOCKED</p>
              <h2 className="mt-3 text-[clamp(2rem,3.2vw,2.8rem)] leading-[1.08] font-semibold tracking-[-0.05em]">Make the work the only thing in view.</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-white/70">Explore the Graduate Analyst Challenge prototype and its blind-review safeguards.</p>
            </div>
            <button onClick={start} className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2.5 rounded-lg bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-[#e8f5f2]">
              Open VEIL <ArrowRight className="size-4" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-[38%] hidden w-2 bg-seal lg:block" />
        </div>
      </section>

      <footer className="border-t border-line-2 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8 lg:px-12">
          <div className="flex items-center gap-2.5"><Logo className="size-7" /><span className="text-[14px] font-semibold tracking-[-0.03em]">VEIL</span><span className="hidden text-[13px] text-ink-4 sm:inline">· Judge the work. Not the person.</span></div>
          <span className="text-[12px] text-ink-4">Prototype for RMIT × Tide UNLOCKED · Demo identities are synthetic</span>
        </div>
      </footer>
    </main>
  );
}

function TrustMark({ icon: Icon, children }: { icon: typeof LockKeyhole; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2.5 text-[14px] font-medium text-ink-3"><Icon className="size-4 shrink-0 text-seal" strokeWidth={1.8} />{children}</span>;
}

function FlowStep({ index, title, tag, color, children }: { index: string; title: string; tag: string; color: "seal" | "accent" | "final" | "quorum"; children: ReactNode }) {
  const marker = { seal: "bg-seal", accent: "bg-accent", final: "bg-final", quorum: "bg-quorum" }[color];
  const tone = { seal: "text-seal", accent: "text-accent", final: "text-final", quorum: "text-quorum" }[color];

  return (
    <li className="relative border-b border-line-2 py-7 first:pt-8 last:border-b-0 md:border-b-0 md:py-10 md:pr-8 md:first:pt-10 md:last:pr-0">
      <div className="absolute left-0 top-0 hidden h-px w-full bg-line md:block" />
      <span className={cx("relative z-10 mb-6 grid size-3 rounded-full ring-[6px] ring-surface", marker)} />
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-ink-4">{index}</span>
        <h3 className="text-[18px] font-semibold tracking-[-0.025em] text-ink">{title}</h3>
      </div>
      <p className="mt-3 min-h-[80px] max-w-[310px] text-[15px] leading-[1.7] text-ink-3">{children}</p>
      <span className={cx("mt-5 inline-flex rounded-full bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-line", tone)}>{tag}</span>
    </li>
  );
}

/** A review packet split by VEIL's visible seal spine. */
function EvidenceSplit() {
  const rubric = [
    ["Analytical reasoning", 40, 9],
    ["Financial understanding", 30, 8],
    ["Recommendations", 20, 9],
  ] as const;

  return (
    <div className="veil-rise relative mx-auto w-full max-w-[790px] xl:ml-auto">
      <div className="absolute -inset-4 -z-10 rounded-[32px] border border-dashed border-line/90 sm:-inset-6" />
      <article className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-window)] ring-1 ring-line">
        <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-line-2 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><ScanEye className="size-5" strokeWidth={1.7} /></span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Graduate Analyst Challenge</p>
              <p className="mt-0.5 text-[12px] font-medium text-ink-4">Submission · Blind review</p>
            </div>
          </div>
          <span className="rounded-full bg-grant-soft px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-grant">REVIEW OPEN</span>
        </header>

        <div className="grid sm:grid-cols-[minmax(0,1fr)_30px_minmax(220px,0.78fr)]">
          <section aria-label="Work visible to reviewers" className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <CandidateId id="VEIL-K7M2Q" size="lg" />
              <span className="text-[13px] text-ink-4">Submitted 21 Oct</span>
            </div>
            <h2 className="mt-5 max-w-[430px] text-[21px] leading-[1.25] font-semibold tracking-[-0.035em] text-ink sm:text-[23px]">Margin pressure starts in the afternoon, not at the supplier.</h2>
            <p className="mt-3 max-w-[430px] text-[15px] leading-[1.7] text-ink-3">Gross margin fell while bean costs stayed nearly flat. Splitting revenue by hour points to a sharp drop in the afternoon trading window.</p>
            <div className="mt-7 border-t border-line-2 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[12px] font-semibold tracking-[0.1em] text-ink-4 uppercase">Scoring rubric</span>
                <span className="text-[12px] text-ink-4">Weighted</span>
              </div>
              <div className="space-y-4">
                {rubric.map(([label, weight, score]) => (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between gap-3 text-[13px]">
                      <span className="text-ink-2">{label} <span className="text-ink-4">{weight}%</span></span>
                      <span className="tabular font-semibold text-ink">{score}/10</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">{Array.from({ length: 10 }, (_, i) => <span key={i} className={cx("h-1.5 rounded-full", i < score ? "bg-accent" : "bg-line-2")} />)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line-2 pt-4">
                <span className="text-[13px] text-ink-3">Weighted score</span>
                <span className="tabular text-[28px] leading-none font-semibold tracking-[-0.05em] text-ink">86.0</span>
              </div>
            </div>
          </section>

          <div className="seal-spine flex items-center justify-center gap-2 bg-seal px-4 py-2 text-white sm:flex-col sm:px-0 sm:py-5" aria-label="Identity is sealed from reviewers">
            <LockKeyhole className="size-4 shrink-0" strokeWidth={1.8} />
            <span className="seal-spine-label text-[10px] font-bold tracking-[0.16em]">IDENTITY SEALED</span>
          </div>

          <section aria-label="Encrypted identity vault" className="bg-seal-soft/55 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold tracking-[0.11em] text-seal uppercase">Identity vault</span>
              <span className="grid size-9 place-items-center rounded-full bg-white text-seal ring-1 ring-seal/15"><LockKeyhole className="size-4" /></span>
            </div>
            <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.03em] text-ink">Encrypted at source</h3>
            <p className="mt-2 text-[14px] leading-[1.65] text-ink-3">The applicant&apos;s identity is encrypted in their browser. VEIL receives ciphertext only.</p>
            <div className="mt-5 space-y-2.5">
              {["Full name", "Email address", "University"].map((field) => (
                <div key={field} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white px-3.5 ring-1 ring-seal/10">
                  <span className="text-[13px] text-ink-3">{field}</span>
                  <span className="inline-flex items-center gap-2 text-[12px] font-medium text-seal"><span className="flex gap-0.5" aria-hidden="true"><i className="h-3 w-1 rounded-full bg-seal/50" /><i className="h-3 w-1 rounded-full bg-seal/25" /><i className="h-3 w-1 rounded-full bg-seal/50" /><i className="h-3 w-1 rounded-full bg-seal/25" /><i className="h-3 w-1 rounded-full bg-seal/50" /></span>Sealed</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-2 border-t border-seal/15 pt-4 text-[13px] leading-relaxed text-seal">
              <Network className="mt-0.5 size-4 shrink-0" /> Decryption authority stays with Tide
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas/75 px-5 py-4 sm:px-7">
          <span className="inline-flex items-center gap-2.5 text-[13px] text-ink-3"><span className="size-2 rounded-full bg-deny" /> Reviewer attempted identity access</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-bold tracking-[0.04em] text-deny ring-1 ring-deny/15"><ShieldX className="size-3.5" /> REFUSED BY TIDE NETWORK</span>
        </footer>
      </article>
      <div className="mt-4 flex items-center justify-between px-1 text-[11px] font-semibold tracking-[0.12em] text-ink-4 uppercase">
        <span>Work visible to reviewers</span><span>Author identity remains private</span>
      </div>
    </div>
  );
}
