# VEIL — Judge the work. Not the person.

**VEIL is a blind-evaluation trust layer where candidate identities are encrypted by the Tide network, reviewers provably cannot decrypt them, and only a disclosure officer appointed by a 2-of-3 admin quorum can reveal them after scoring is final.**

### Vision & originality
VEIL is infrastructure, not another hiring site: one trust layer any recruiter, scholarship board, grant panel or competition can plug in to assess work before identity. Hiding names is common; VEIL removes the *ability* to look them up, from everyone, including us.

### Trust constraint insight
"Anonymous" review today means trusting whoever runs the database or holds the admin password. Names are hidden by the interface, not the system, so one curious reviewer, HR lead or rogue admin can unmask a candidate, and nobody can prove they didn't. That is why high-stakes evaluations still reveal identity early.

### Value & impact
Graduates from less prestigious universities, international students and career-changers get judged on their case study first. Organisations get defensible, bias-resistant shortlists. Example: in our demo the top-ranked answer comes from a regional university; its author is revealed only after every score is locked.

### Why TideCloak matters
- **Encryption:** identity is encrypted in the applicant's browser through TideCloak's `doEncrypt` under a `RelationshipAttestation:1` policy (write-only). VEIL stores ciphertext only and holds no key.
- **Enforced decryption:** a second signed policy lets only `veil-disclosure-officer` decrypt. The Tide ORK network checks every request; a reviewer handed the ciphertext *and* the policy is still refused.
- **Quorum governance (QEA):** granting the officer role is a TideCloak change request needing 2 of 3 realm admins, so no single admin can grant themselves access.

### Prototype & storytelling
One complete campaign, Graduate Analyst Challenge 2026, with synthetic data and four Tide accounts (one per team member): applicant submits → identity encrypted → reviewer scores blind → **the reviewer, a security admin, is still refused by the Tide network** → hr-lead alone can't appoint a disclosure officer; the reviewer's second approval commits it → officer reveals the shortlist.

> VEIL doesn't simply hide names. It changes who has the power to reveal them.

---

Tide network overloaded? Run `npm run dev:sim` for a clearly labelled simulation: [docs/SIMULATED.md](docs/SIMULATED.md).

Two-minute demo: [docs/veil-demo.mp4](docs/veil-demo.mp4).

Everything below is setup and reference: see [docs/SETUP.md](docs/SETUP.md), [docs/TEST-CHECKLIST.md](docs/TEST-CHECKLIST.md) and [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md).
