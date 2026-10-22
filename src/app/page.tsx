"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { ArrowRight, Check, ShieldX, X } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { CandidateId, Enforcer, SecurityState, cx, type EnforcerKind } from "@/components/ui";

const SERVES = ["Graduate recruitment", "Scholarships", "Research grants", "Pitch competitions", "Academic peer review", "Hackathon judging"];

const TRUST: { who: string; ok: boolean; by: EnforcerKind }[] = [
  { who: "Reviewer scoring the work", ok: false, by: "tide" },
  { who: "Reviewer with leaked ciphertext and policy", ok: false, by: "tide" },
  { who: "HR lead running the campaign", ok: false, by: "tide" },
  { who: "One security admin acting alone", ok: false, by: "quorum" },
  { who: "VEIL's own server", ok: false, by: "tide" },
  { who: "Disclosure officer, after scores lock", ok: true, by: "quorum" },
];

export default function Landing() {
  const { authenticated, login } = useTideCloak();
  const start = () => (authenticated ? (window.location.href = "/app") : login());

  return (
    <div className="bg-surface text-ink">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-line-2 bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">VEIL</span>
          </Link>
          <nav className="flex items-center gap-1 text-[13px]">
            <a href="#how" className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:bg-sunken hover:text-ink sm:block">
              How it works
            </a>
            <a href="#trust" className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:bg-sunken hover:text-ink sm:block">
              Trust model
            </a>
            <button onClick={start} className="ml-2 h-8 rounded-md px-3 font-medium text-ink ring-1 ring-line hover:bg-canvas">
              {authenticated ? "Open app" : "Sign in"}
            </button>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:pt-24">
        <div>
          <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[60px]">
            Judge the work.
            <br />
            <span className="text-ink-3">Not the person.</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-pretty text-ink-2">
            The independent trust layer for fair evaluation. Collect anonymous submissions, assess work without identity bias, and protect disclosure through TideCloak.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={start} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white shadow-[0_1px_2px_rgb(12_26_46/0.2)] hover:bg-accent-hover">
              Start evaluating <ArrowRight className="size-4" strokeWidth={1.5} />
            </button>
            <a href="#how" className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-ink ring-1 ring-line hover:bg-canvas">
              See how VEIL works
            </a>
          </div>
        </div>
        <ProductPreview />
      </section>

      {/* serves */}
      <section className="border-y border-line-2 bg-canvas">
        <div className="mx-auto max-w-[1200px] px-6 py-5">
          <p className="text-[13px] text-ink-3">One trust layer for every evaluation where identity shouldn&apos;t count</p>
          <ul className="mt-2 flex flex-wrap gap-x-7 gap-y-1.5">
            {SERVES.map((s) => (
              <li key={s} className="text-[13px] font-medium text-ink-2">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* how it works: one real product state per step */}
      <section id="how" className="mx-auto max-w-[1200px] scroll-mt-16 px-6 py-24">
        <h2 className="max-w-2xl text-[32px] leading-tight font-semibold tracking-[-0.025em] text-balance">One submission, split in two. Only the work is ever shared.</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-3">
          A complete campaign runs in VEIL today: the Graduate Analyst Challenge 2026, with synthetic candidates and a live TideCloak realm.
        </p>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line md:grid-cols-2 lg:grid-cols-4">
          <Step n={1} title="Submit" text="Name, email and university are encrypted in the candidate's browser by the Tide network. VEIL stores ciphertext only.">
            <div className="rounded-md bg-seal-soft p-3 ring-1 ring-seal/15 ring-inset">
              <SecurityState kind="sealed" by="tide" />
              <p className="mt-2 font-mono text-[11px] leading-relaxed break-all text-seal">kQ3xZ0h7Yw2pV9mLr4tN8cBf1sJ6aEuD…</p>
            </div>
          </Step>
          <Step n={2} title="Review blind" text="Reviewers see a random ID and the case study. Weighted scores lock before anyone can learn who wrote what.">
            <div className="rounded-md p-3 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <CandidateId id="VEIL-K7M2Q" />
                <span className="tabular text-[15px] font-semibold">86.0</span>
              </div>
              <div className="mt-2.5">
                <SecurityState kind="finalized" label="Finalized" by="veil" />
              </div>
            </div>
          </Step>
          <Step n={3} title="Bypass refused" text="Hand a reviewer the stored ciphertext and its decryption policy anyway: the network checks their own credential and refuses.">
            <div className="rounded-md bg-deny-soft p-3 ring-1 ring-deny/20 ring-inset">
              <SecurityState kind="denied" by="tide" />
              <p className="mt-2 text-[11px] leading-relaxed text-ink-2">Every ORK refused: role not found in the reviewer&apos;s credential.</p>
            </div>
          </Step>
          <Step n={4} title="Governed disclosure" text="Only a disclosure officer can reveal the shortlist, and appointing one takes two of three security admins.">
            <div className="rounded-md p-3 ring-1 ring-line">
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-xs font-medium text-ink-2">Grant disclosure officer</span>
                <Enforcer by="quorum" />
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {[
                  ["admin-a", true],
                  ["admin-b", true],
                  ["admin-c", false],
                ].map(([who, ok]) => (
                  <li key={who as string} className="flex items-center justify-between">
                    <span className="font-mono text-ink-2">{who}</span>
                    {ok ? <span className="font-medium text-quorum">Approved</span> : <span className="text-ink-4">Not needed</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-line-2 pt-2 text-xs font-medium text-grant">2 of 3 · committed</p>
            </div>
          </Step>
        </ol>
      </section>

      {/* trust model */}
      <section id="trust" className="scroll-mt-16 border-t border-line-2 bg-canvas">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.025em] text-balance">Anonymous review usually means &ldquo;trust the admin&rdquo;.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              In most platforms the name is hidden by the interface, not by the system. Whoever runs the database or holds the admin password can look a candidate up, and nobody can prove they didn&apos;t.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              VEIL changes who holds the power to reveal. With TideCloak&apos;s Emergent Authority there is no key on our server, and no single person can grant themselves access.
            </p>
          </div>
          <div>
            <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-canvas text-left text-xs text-ink-3">
                    <th className="h-10 px-4 font-medium">Who tries to reveal a candidate</th>
                    <th className="h-10 px-4 font-medium">Outcome</th>
                    <th className="hidden h-10 px-4 font-medium sm:table-cell">Decided by</th>
                  </tr>
                </thead>
                <tbody>
                  {TRUST.map((r) => (
                    <tr key={r.who} className="border-t border-line-2 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{r.who}</p>
                        <Enforcer by={r.by} className="mt-1.5 sm:hidden" />
                      </td>
                      <td className="px-4 py-3">
                        {r.ok ? (
                          <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-grant">
                            <Check className="size-3.5" strokeWidth={1.5} /> Can reveal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-deny">
                            <X className="size-3.5" strokeWidth={1.5} /> Refused
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Enforcer by={r.by} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-6 grid gap-4 text-[13px] sm:grid-cols-3">
              {[
                { by: "tide" as const, text: "Checks every decryption against the caller's own credential and the campaign's signed policy." },
                { by: "quorum" as const, text: "Commits privileged role changes only after 2 of 3 admins approve in their enclaves." },
                { by: "veil" as const, text: "Runs stages, score locks and requests: decides when ciphertext is released, never who can open it." },
              ].map((l) => (
                <div key={l.by}>
                  <dt>
                    <Enforcer by={l.by} />
                  </dt>
                  <dd className="mt-2 leading-relaxed text-ink-3">{l.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* close */}
      <section className="border-t border-line-2 bg-ink text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-8 px-6 py-16 md:flex-row md:items-center">
          <div>
            <p className="text-[26px] leading-snug font-semibold tracking-[-0.02em] text-balance">VEIL doesn&apos;t simply hide names. It changes who has the power to reveal them.</p>
            <p className="mt-2 text-[13px] text-white/70">Prototype for the RMIT × Tide UNLOCKED hackathon. One campaign, synthetic data, live TideCloak.</p>
          </div>
          <button onClick={start} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-ink hover:bg-white/90">
            Start evaluating <ArrowRight className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </section>
      <footer className="bg-ink text-white/70">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-5 text-xs">
          <span>VEIL · identity protection by TideCloak (Tide Foundation)</span>
          <span>All candidates, organisations and results shown are synthetic.</span>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="flex flex-col bg-surface p-6">
      <span className="tabular text-xs text-ink-4">Step {n}</span>
      <h3 className="mt-1 text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{text}</p>
      <div className="mt-5 flex-1 content-end">{children}</div>
    </li>
  );
}

/** A faithful rendering of VEIL's own blind-review screen (synthetic candidate). */
function ProductPreview() {
  const rubric = [
    ["Analytical reasoning", 40, 9],
    ["Financial understanding", 30, 8],
    ["Clarity of recommendations", 20, 9],
    ["Creativity", 10, 7],
  ] as const;
  return (
    <div className="veil-rise relative sm:pb-[72px]">
      <div className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-window)] ring-1 ring-line">
        <div className="flex h-9 items-center gap-2 border-b border-line-2 bg-canvas px-3">
          <span className="size-2.5 rounded-full bg-mark" />
          <span className="size-2.5 rounded-full bg-mark" />
          <span className="size-2.5 rounded-full bg-mark" />
          <span className="ml-3 truncate text-xs text-ink-3">VEIL · Blind review · Graduate Analyst Challenge 2026</span>
        </div>
        <div className="grid sm:grid-cols-[1.25fr_1fr]">
          <div className="border-line-2 p-5 sm:border-r">
            <div className="flex items-center gap-2">
              <CandidateId id="VEIL-K7M2Q" />
              <span className="text-xs text-ink-4">Submitted 21 Oct</span>
            </div>
            <p className="mt-4 text-[15px] leading-snug font-semibold">Margin leak is in the afternoon, not the beans</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              Gross margin fell from 64% to 57% while bean costs rose only 3%. Splitting sales by hour shows 2pm–5pm revenue is down 31%, but labour in that window is unchanged…
            </p>
            <div className="mt-4 rounded-md bg-seal-soft p-3 ring-1 ring-seal/15 ring-inset">
              <div className="flex items-center justify-between gap-2">
                <SecurityState kind="sealed" />
                <Enforcer by="tide" />
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {["Name", "Email", "University"].map((f) => (
                  <div key={f}>
                    <p className="text-[11px] text-seal">{f}</p>
                    <div className="mt-1 h-2 rounded-full bg-seal/15" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-ink-3">Scoring rubric</p>
            <ul className="mt-3 space-y-3">
              {rubric.map(([label, w, s]) => (
                <li key={label}>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-2">
                      {label} <span className="text-ink-4">{w}%</span>
                    </span>
                    <span className="tabular font-semibold">{s}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-10 gap-0.5">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className={cx("h-1.5 rounded-[1px]", i < s ? "bg-accent" : "bg-line-2")} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-line-2 pt-3">
              <span className="text-xs text-ink-3">Weighted total</span>
              <span className="tabular text-xl font-semibold tracking-tight">86.0</span>
            </div>
            <div className="mt-3">
              <SecurityState kind="finalized" by="veil" />
            </div>
          </div>
        </div>
      </div>
      <div className="veil-toast relative mx-3 -mt-4 rounded-lg bg-surface p-3.5 shadow-[var(--shadow-pop)] ring-1 ring-deny/25 sm:absolute sm:bottom-0 sm:left-6 sm:mx-0 sm:mt-0 sm:w-[380px]">
        <div className="flex items-start gap-2.5">
          <ShieldX className="mt-0.5 size-4 shrink-0 text-deny" strokeWidth={1.5} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-deny">Access denied</p>
              <Enforcer by="tide" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">Reviewer tried to decrypt VEIL-K7M2Q with the leaked policy. The ORKs refused: role not found in credential.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
