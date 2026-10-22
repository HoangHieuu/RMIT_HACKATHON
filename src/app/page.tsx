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
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Logo } from "@/components/AppShell";
import { CandidateId, Enforcer, cx, type EnforcerKind } from "@/components/ui";

const USE_CASES = ["Hiring", "Scholarships", "Research grants", "Pitch competitions", "Peer review"];

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
      <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="VEIL home">
            <Logo className="size-8" />
            <span className="text-[15px] font-semibold tracking-[-0.04em]">VEIL</span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="hidden text-[11px] font-medium tracking-[0.02em] text-ink-3 sm:block">Fair evaluation infrastructure</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
            <a href="#method" className="hidden rounded-md px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-canvas hover:text-ink sm:block">How it works</a>
            <a href="#trust" className="hidden rounded-md px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-canvas hover:text-ink sm:block">Trust model</a>
            <button onClick={start} className="ml-1 inline-flex h-9 items-center gap-2 rounded-[7px] bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-2 sm:ml-2">
              {authenticated ? "Open workspace" : "Sign in"}
              <ArrowUpRight className="size-3.5" />
            </button>
          </nav>
        </div>
      </header>

      <section className="border-b border-line-2">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 xl:grid-cols-2 xl:gap-12 xl:py-24">
          <div className="relative z-10">
            <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold tracking-[0.13em] text-ink-3 uppercase">
              <span className="size-1.5 rounded-full bg-accent" /> Independent evaluation infrastructure
            </div>
            <h1 className="max-w-[660px] text-[clamp(3.25rem,6vw,5.75rem)] leading-[0.93] font-semibold tracking-[-0.075em] text-balance text-ink">
              Judge the work.
              <br />
              <span className="font-display pr-2 font-normal italic tracking-[-0.065em] text-seal">Not the person.</span>
            </h1>
            <p className="mt-7 max-w-[510px] text-[16px] leading-[1.75] text-ink-2 sm:text-[17px]">
              VEIL separates a submission from the person behind it. Reviewers assess the work; identity stays encrypted until a governed disclosure is allowed.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={start} className="inline-flex h-11 items-center gap-2.5 rounded-[7px] bg-accent px-4.5 text-sm font-medium text-white shadow-[0_2px_5px_rgb(49_95_232/0.2)] transition-[background,transform] hover:-translate-y-px hover:bg-accent-hover">
                Start a blind review <ArrowRight className="size-4" />
              </button>
              <a href="#method" className="inline-flex h-11 items-center gap-2 rounded-[7px] px-4 text-sm font-medium text-ink-2 transition-colors hover:bg-canvas">
                See the safeguards <ArrowRight className="size-3.5" />
              </a>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-2 pt-5 text-[12px] text-ink-3">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5 text-seal" /> Identity encrypted at submission</span>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <span className="inline-flex items-center gap-1.5"><EyeOff className="size-3.5 text-accent" /> No identity in reviewer view</span>
            </div>
          </div>
          <EvidenceSplit />
        </div>
      </section>

      <section aria-label="Use cases" className="border-b border-line-2 bg-canvas/70">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-5 sm:px-8">
          <span className="mr-1 text-[10px] font-semibold tracking-[0.13em] text-ink-4 uppercase">Where fairness matters</span>
          {USE_CASES.map((item) => <span key={item} className="text-[12px] font-medium text-ink-2">{item}</span>)}
        </div>
      </section>

      <section id="method" className="scroll-mt-20">
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-5 border-b border-line-2 pb-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.13em] text-accent uppercase">The review path</p>
              <h2 className="mt-3 max-w-[440px] text-[32px] leading-[1.08] font-semibold tracking-[-0.055em] text-balance sm:text-[40px]">One record. Two separate paths.</h2>
            </div>
            <p className="max-w-[540px] text-sm leading-relaxed text-ink-3 md:justify-self-end md:text-[15px]">
              The work moves through evaluation. Identity follows a protected route governed by Tide policies and a multi-admin quorum.
            </p>
          </div>
          <ol className="grid gap-0 md:grid-cols-4">
            <FlowStep index="01" title="Submit" tag="Identity sealed" color="seal">
              Identity is encrypted in the applicant&apos;s browser. VEIL stores ciphertext, never a readable profile.
            </FlowStep>
            <FlowStep index="02" title="Review blind" tag="Work only" color="accent">
              Reviewers get a random candidate ID, the submitted work, and the scoring rubric.
            </FlowStep>
            <FlowStep index="03" title="Lock results" tag="Scores finalized" color="final">
              Scores are finalized before an organisation can request a disclosure.
            </FlowStep>
            <FlowStep index="04" title="Govern disclosure" tag="2 of 3 approvals" color="quorum">
              A disclosure officer can reveal identity only after the required approvals and final scoring.
            </FlowStep>
          </ol>
        </div>
      </section>

      <section id="trust" className="scroll-mt-20 border-y border-line-2 bg-canvas/65">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div>
            <div className="grid size-11 place-items-center rounded-xl bg-white text-seal ring-1 ring-line"><Fingerprint className="size-5" strokeWidth={1.7} /></div>
            <p className="mt-7 text-[11px] font-semibold tracking-[0.13em] text-seal uppercase">A boundary enforced by the network</p>
            <h2 className="mt-3 max-w-[440px] text-[32px] leading-[1.08] font-semibold tracking-[-0.055em] text-balance sm:text-[40px]">The person running the review can&apos;t look up the person who wrote it.</h2>
            <p className="mt-5 max-w-[480px] text-sm leading-[1.8] text-ink-2 sm:text-[15px]">
              Hiding a name in the interface is not enough. VEIL keeps identity ciphertext separate, while the Tide network checks each decryption request against a signed policy.
            </p>
            <div className="mt-7 flex items-start gap-3 border-t border-line pt-5">
              <Network className="mt-0.5 size-4 shrink-0 text-seal" strokeWidth={1.7} />
              <p className="text-[12px] leading-relaxed text-ink-3">VEIL controls when disclosure can be requested. Tide controls whether the caller can decrypt.</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-line shadow-[0_2px_8px_rgb(21_38_59/0.04)]">
            <div className="flex items-center justify-between border-b border-line-2 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[13px] font-semibold text-ink">Who can reveal an identity?</p>
                <p className="mt-1 text-[11px] text-ink-3">Each request is checked at the layer that holds authority.</p>
              </div>
              <ShieldCheck className="size-5 text-seal" strokeWidth={1.7} />
            </div>
            <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(142px,max-content)] gap-4 bg-canvas px-5 py-2.5 text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase sm:grid sm:px-6">
              <span>Actor</span><span>Outcome</span><span>Authority</span>
            </div>
            {TRUST.map((row) => (
              <div key={row.actor} className="grid gap-2 border-t border-line-2 px-5 py-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(142px,max-content)] sm:items-center sm:gap-4 sm:px-6">
                <span className="text-[13px] font-medium text-ink">{row.actor}</span>
                <span className={cx("inline-flex items-center gap-1.5 text-[12px] font-medium", row.allowed ? "text-grant" : "text-deny")}>
                  {row.allowed ? <Check className="size-3.5" /> : <ShieldX className="size-3.5" />}{row.result}
                </span>
                <div className="flex justify-start"><Enforcer by={row.by} /></div>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-line-2 bg-canvas/70 px-5 py-3 text-[11px] text-ink-3 sm:px-6">
              <KeyRound className="size-3.5 text-quorum" /> Role changes require approval from the security committee.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-7 rounded-2xl bg-accent-soft p-6 ring-1 ring-accent/10 sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div className="max-w-[650px]">
            <p className="text-[11px] font-semibold tracking-[0.13em] text-accent uppercase">RMIT × Tide UNLOCKED</p>
            <h2 className="mt-2 text-[27px] leading-tight font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Make the work the only thing in view.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">Explore the Graduate Analyst Challenge prototype and its blind-review safeguards.</p>
          </div>
          <button onClick={start} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[7px] bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-2">
            Open VEIL <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-line-2">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
          <div className="flex items-center gap-2"><Logo className="size-6" /><span className="text-[12px] font-semibold tracking-[-0.03em]">VEIL</span><span className="text-[11px] text-ink-4">· Judge the work. Not the person.</span></div>
          <span className="text-[11px] text-ink-4">Prototype for RMIT × Tide UNLOCKED · Demo identities are synthetic</span>
        </div>
      </footer>
    </main>
  );
}

function FlowStep({ index, title, tag, color, children }: { index: string; title: string; tag: string; color: "seal" | "accent" | "final" | "quorum"; children: ReactNode }) {
  const marker = {
    seal: "bg-seal",
    accent: "bg-accent",
    final: "bg-final",
    quorum: "bg-quorum",
  }[color];
  const tone = {
    seal: "text-seal",
    accent: "text-accent",
    final: "text-final",
    quorum: "text-quorum",
  }[color];

  return (
    <li className="relative border-b border-line-2 py-6 first:pt-7 last:border-b-0 md:border-b-0 md:py-8 md:pr-7 md:first:pt-8 md:last:pr-0">
      <div className="absolute left-0 top-0 hidden h-px w-full bg-line md:block" />
      <span className={cx("relative z-10 mb-5 grid size-2.5 rounded-full ring-[5px] ring-surface", marker)} />
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-ink-4">{index}</span>
        <h3 className="text-[16px] font-semibold tracking-[-0.025em] text-ink">{title}</h3>
      </div>
      <p className="mt-2 min-h-[66px] max-w-[280px] text-[12px] leading-[1.7] text-ink-3">{children}</p>
      <span className={cx("mt-4 inline-flex rounded-full bg-surface px-2.5 py-1 text-[10px] font-medium ring-1 ring-line", tone)}>{tag}</span>
    </li>
  );
}

/** A single submission is visibly separated into work for reviewers and encrypted identity. */
function EvidenceSplit() {
  const rubric = [
    ["Analytical reasoning", 40, 9],
    ["Financial understanding", 30, 8],
    ["Recommendations", 20, 9],
  ] as const;

  return (
    <div className="veil-rise relative mx-auto w-full max-w-[690px] lg:ml-auto">
      <div className="absolute -inset-5 -z-10 rounded-[28px] border border-dashed border-line/80 sm:-inset-7" />
      <div className="overflow-hidden rounded-[15px] bg-surface shadow-[var(--shadow-window)] ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line-2 bg-white px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent"><ScanEyeIcon /></span>
            <div>
              <p className="text-[11px] font-semibold text-ink">Graduate Analyst Challenge</p>
              <p className="text-[9px] tracking-[0.07em] text-ink-4 uppercase">Submission · blind review</p>
            </div>
          </div>
          <span className="rounded-full bg-grant-soft px-2.5 py-1 text-[9px] font-semibold tracking-[0.05em] text-grant">REVIEW OPEN</span>
        </div>

        <div className="grid sm:grid-cols-[1.12fr_0.88fr]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <CandidateId id="VEIL-K7M2Q" />
              <span className="text-[10px] text-ink-4">Submitted 21 Oct</span>
            </div>
            <h2 className="mt-4 max-w-[390px] text-[16px] leading-snug font-semibold tracking-[-0.025em] text-ink sm:text-[18px]">Margin pressure starts in the afternoon, not at the supplier.</h2>
            <p className="mt-2 max-w-[390px] text-[11px] leading-[1.75] text-ink-3">Gross margin fell while bean costs stayed nearly flat. Splitting revenue by hour points to a sharp drop in the afternoon trading window.</p>
            <div className="mt-5 border-t border-line-2 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase">Scoring rubric</span>
                <span className="text-[9px] text-ink-4">Weighted</span>
              </div>
              <div className="space-y-3">
                {rubric.map(([label, weight, score]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between gap-3 text-[10px]">
                      <span className="text-ink-2">{label} <span className="text-ink-4">{weight}%</span></span>
                      <span className="tabular font-semibold text-ink">{score}/10</span>
                    </div>
                    <div className="grid grid-cols-10 gap-0.5">{Array.from({ length: 10 }, (_, i) => <span key={i} className={cx("h-1 rounded-[2px]", i < score ? "bg-accent" : "bg-line-2")} />)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line-2 pt-3">
                <span className="text-[10px] text-ink-3">Weighted score</span>
                <span className="tabular text-[20px] font-semibold tracking-[-0.05em] text-ink">86.0</span>
              </div>
            </div>
          </div>

          <div className="relative border-t border-line-2 bg-seal-soft/55 p-4 sm:border-t-0 sm:border-l sm:p-5">
            <div className="absolute inset-y-0 left-0 hidden w-px bg-seal/25 sm:block" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold tracking-[0.1em] text-seal uppercase">Identity vault</span>
              <span className="grid size-7 place-items-center rounded-full bg-white text-seal ring-1 ring-seal/15"><LockKeyhole className="size-3.5" /></span>
            </div>
            <p className="mt-3 text-[12px] font-semibold text-ink">Encrypted at source</p>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-3">Identity is encrypted in the applicant&apos;s browser. VEIL receives ciphertext only.</p>
            <div className="mt-4 space-y-2">
              {["Full name", "Email address", "University"].map((field) => (
                <div key={field} className="flex h-8 items-center justify-between rounded-md bg-white/80 px-2.5 ring-1 ring-seal/10">
                  <span className="text-[10px] text-ink-3">{field}</span>
                  <span className="flex gap-0.5" aria-label={`${field} encrypted`}><i className="h-2.5 w-1 rounded-full bg-seal/35" /><i className="h-2.5 w-1 rounded-full bg-seal/20" /><i className="h-2.5 w-1 rounded-full bg-seal/35" /><i className="h-2.5 w-1 rounded-full bg-seal/20" /><i className="h-2.5 w-1 rounded-full bg-seal/35" /></span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-seal/10 pt-3 text-[10px] text-seal">
              <Network className="size-3.5 shrink-0" /> Decryption authority stays with Tide
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas/75 px-4 py-3 sm:px-5">
          <span className="inline-flex items-center gap-2 text-[10px] text-ink-3"><span className="size-1.5 rounded-full bg-deny" /> Reviewer attempted identity access</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold tracking-[0.04em] text-deny ring-1 ring-deny/15"><ShieldX className="size-3" /> REFUSED BY TIDE NETWORK</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[9px] font-medium tracking-[0.11em] text-ink-4 uppercase">
        <span>Visible work packet</span><span>Independent identity boundary</span>
      </div>
    </div>
  );
}

function ScanEyeIcon() {
  return <EyeOff className="size-3.5" strokeWidth={1.8} />;
}
