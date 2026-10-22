# VEIL: two-minute demo script (four-person team)

## Cast: four Tide accounts

| Account | In VEIL | Security committee (`tide-realm-admin`) |
|---|---|---|
| `applicant` | Candidate, the only outsider | no |
| `reviewer` | Evaluator | yes, member C |
| `hr-lead` | Organisation admin | yes, member A |
| `officer` | Disclosure officer, but only after the quorum grants it | yes, member B |

Three committee members make TideCloak's threshold **max(1, ⌊3 × 0.7⌋) = 2**. Nobody, including the reviewer who is also an admin, can decrypt or grant themselves decryption alone.

**Setup:** give each account its own browser profile (or a separate browser) and sign it in before recording, so switching persona is instant. The **Overview → Demo runbook** shows which step is next, who does it and where. Use **Reset demo data** (hr-lead) between takes.

## Before recording (off camera)

1. hr-lead → Governance → **Approve & sign** both identity policies (Tide enclave pop-up).
2. If the committee shows fewer than 3 admins, hr-lead approves the pending `tide-realm-admin` grants on the same page.
3. Each account signs in once (the runbook counts the committee from sign-ins).

## Script

| Time | Who / screen | Voice-over |
|---|---|---|
| **0:00–0:15** The possibility | Landing hero | "Graduate hiring, scholarships, grants: they all *say* they judge the work, but the evaluator usually knows who wrote it. VEIL is a trust layer that lets any organisation judge the work before the person." |
| **0:15–0:30** The constraint | Landing trust table | "Today 'anonymous review' means trusting the admin. Names are hidden by the interface, not the system. Anyone with database or admin access can look a candidate up." |
| **0:30–0:45** Submit | **applicant** → Apply → **Submit all 3** (or one candidate by hand) | "The candidate's identity is encrypted in their browser by the Tide network under a write-only policy. VEIL only ever stores ciphertext." |
| **0:45–1:00** Blind review | **hr-lead** moves campaign to Review (off camera) → **reviewer** → Blind review → open a card → **Finalize score** | "The reviewer sees a random ID and the case study. Scores lock once finalized." |
| **1:00–1:20** Bypass | **reviewer** → Security test → **Request identity** (VEIL refuses) → **Attempt decryption** (red, Tide network) | "Our reviewer is even a security admin. Hand them the stored ciphertext *and* the decryption policy: the Tide network checks their own credential and refuses. There is no key on our server to steal." |
| **1:20–1:40** Quorum | **hr-lead** → Governance → **File change request**: grant `veil-disclosure-officer` to `officer` → **Approve in enclave** → "1 of 2, not in effect". **reviewer** → Governance → **Approve in enclave** → "Quorum reached". | "Who can reveal? Only a disclosure officer, and appointing one is a TideCloak change request. One admin approving does nothing. It takes two of three, each signing in their own Tide enclave." |
| **1:40–2:00** What changes | **hr-lead** moves to Finalized and requests disclosure → **officer** signs in again → Disclosure → **Approve disclosure** → **Reveal identity** | "After scores are final, the officer reveals the shortlist. The best answer came from a regional university, judged on the work alone. VEIL doesn't simply hide names. It changes who has the power to reveal them." |

## Retakes

- **Reset demo data** clears submissions, scores, requests and the app log; signed policies and TideCloak roles stay.
- To re-record the quorum scene, revoke the officer role first: Governance → Action **Revoke** → `veil-disclosure-officer` from `officer` → two committee approvals.
