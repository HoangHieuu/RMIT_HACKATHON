# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience for the current build: **RMIT × Tide UNLOCKED hackathon judges**, who meet VEIL through a two-minute demo video and the public GitHub repository. They must understand within seconds that identity protection is real (encrypted, enforced by the Tide network, quorum-governed), not a hidden UI element. Judging weights: vision & originality 25%, trust-constraint insight 20%, value & impact 20%, why TideCloak matters 20%, prototype & storytelling 15%.

Secondary audience (the product's real users): organisations that run evaluations — recruiters/HR teams, universities, scholarship boards, grant panels, competitions. In-product roles:

- **Applicant** — submits identity and work separately, sees status and published results.
- **Evaluator / reviewer** — scores anonymised work against a weighted rubric.
- **Organisation admin** (`veil-org-admin`) — runs campaigns, assigns reviewers, requests disclosure; cannot decrypt.
- **Disclosure officer** (`veil-disclosure-officer`) — reveals identities after review; role granted only by a 2-of-3 Tide admin quorum.
- **Security / governance admin** (`tide-realm-admin`) — signs campaign identity policies and approves privileged changes in their Tide enclave.

## Product Purpose

VEIL lets organisations assess people's work before learning who they are. Each submission is split into the **work** (shared with evaluators) and the **identity** (encrypted by the Tide network). Success: a reviewer finalizes scores without any way to see identity; identity is disclosed only to an authorised officer, after scores lock, under a defined workflow.

Long-term vision: an infrastructure trust layer that recruitment platforms, universities, competitions and grant programs integrate without replacing their workflow. The MVP implements **one** campaign end to end (Graduate Analyst Challenge 2026, blind case-study assessment). Pitch the platform; demo one working application.

## Positioning

"We don't ask evaluators to promise impartiality. We remove unnecessary access to identity from the evaluation process."
"VEIL doesn't simply hide names. It changes who has the power to reveal them."

What an ordinary anonymous-hiring site cannot truthfully claim: VEIL's server holds no key; identities are encrypted under TideCloak `RelationshipAttestation:1` policies and every decryption is checked by the Tide ORK network against the caller's own credential; granting decryption power is a TideCloak change request that needs 2 of 3 admins. No single reviewer, HR lead, admin or VEIL itself can unilaterally reveal a candidate.

## Operating Context

- Campaign lifecycle: DRAFT → OPEN → REVIEW → FINALIZED → DISCLOSURE → CLOSED, enforced server-side.
- Rubric: Analytical reasoning 40%, Financial understanding 30%, Clarity of recommendations 20%, Creativity 10%; scores 0–10 per criterion, weighted total out of 100; finalized scores lock.
- Anonymous candidate IDs like `VEIL-K7M2Q`.
- Tide enclave pop-ups appear for login, policy signing and quorum approvals; personas switch by signing out/in.
- Demo is recorded on a desktop browser; judges also read the repository README.

## Capabilities and Constraints

- Next.js 16 (webpack), React 19, Tailwind v4, SQLite (`node:sqlite`), TideCloak (`@tidecloak/nextjs`, DPoP-bound tokens), local TideCloak in Docker on the production Tide network.
- Three non-negotiables (must never be cut or faked): identity genuinely encrypted via TideCloak; reviewer genuinely cannot decrypt (network refusal, not UI hiding); at least one privileged permission change proven through real TideCloak quorum governance.
- UI must never claim cryptographic protection for something enforced only by application logic; application workflow approvals must be visibly distinguished from TideCloak quorum (QEA).
- Errors from the Tide network are shown verbatim alongside plain-language explanations.
- Synthetic data only.

## Brand Commitments

- Name **VEIL**, tagline **"Judge the work. Not the person."**, closing line "VEIL doesn't simply hide names. It changes who has the power to reveal them."
- Must feel credible to universities, major companies and professional organisations. The PRD's palette suggestion (light surfaces, navy type, muted blue/teal, no gradients/glassmorphism/neon) is **not binding**: the user allows a distinct visual world as long as it stays serious and trustworthy.
- Security outcomes must be visually explicit: identity protected, access denied, evaluation finalized, disclosure authorized. Plain human language over cryptographic jargon.
- Visual direction chosen by the user (2026-10-22): **the category standard** for enterprise trust SaaS, executed without irony. Craft bar: **Linear**.

## Evidence on Hand

- Three synthetic candidates (`src/lib/demo/candidates.ts`), seeded campaign, live Tide network responses (refusal messages, change-request state).
- No customers, testimonials, pilots, metrics or press exist. Do not fabricate any.

## Product Principles

1. Prove, don't promise: every protection claim on screen is backed by a real enforcement the viewer can trigger.
2. Separate the work from the person, everywhere: identity never appears where judgement happens.
3. Name the enforcer: always make clear whether VEIL, TideCloak governance or the Tide network decided.
4. One credible journey beats many shallow features.
