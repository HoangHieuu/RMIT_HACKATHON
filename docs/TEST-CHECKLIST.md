# VEIL test checklist: authorised vs unauthorised access

Each row is run against the live stack (TideCloak `veil` realm + VEIL dev server). **Layer** says who enforces it: **Tide** = ORK network / TideCloak, **VEIL** = VEIL's server.
The *Result* column records what was actually observed; rows not yet run are marked "not run".

| # | Scenario | Expected | Layer | Result |
|---|---|---|---|---|
| 1 | Call any `/api/*` route without a token | 401 | VEIL (JWT) | PASS: `GET /api/me` → 401 `Missing Authorization header` |
| 2 | Call an API with a valid token but no DPoP proof (plain Bearer replay) | 401 | VEIL (DPoP) | not run |
| 3 | applicant submits with identity encrypted under the campaign write policy | 201, DB holds ciphertext only | Tide + VEIL | not run |
| 4 | POST `/api/submissions` with a plaintext `email` field | 400 refused | VEIL | not run |
| 5 | reviewer opens `/api/review/:id` | work only: no identity, no ciphertext, no applicant id | VEIL | not run |
| 6 | reviewer → *Request identity* | 403 from VEIL | VEIL | not run |
| 7 | reviewer (evaluator **and** security-committee admin) → *Attempt decryption* with leaked ciphertext + read policy | refused by ORKs (`… role not found in doken` / threshold failure) | **Tide** | not run |
| 8 | hr-lead (org admin + committee admin) → Disclosure → *Try with leaked data* | refused by ORKs | **Tide** | not run |
| 9 | officer before the quorum grant → Disclosure → *Try with leaked data* | refused by ORKs | **Tide** | not run |
| 10 | officer before quorum grant → reveal | 403 from VEIL (no role in token); ORK would refuse too | VEIL + Tide | not run |
| 11 | hr-lead files CR "grant veil-disclosure-officer to officer" and approves | recorded 1/2, **not committed**; officer still has no role | **TideCloak QEA** | not run |
| 12 | reviewer approves the same CR | 2/2, committed | **TideCloak QEA** | not run |
| 13 | officer (re-signed-in) reveals identity in DISCLOSURE stage | plaintext identity in officer's browser only | Tide + VEIL | not run |
| 14 | officer reveals while campaign is still REVIEW | 403 from VEIL | VEIL | not run |
| 15 | Stage jump OPEN → FINALIZED via API | 409 | VEIL | not run |
| 16 | Move to FINALIZED with unfinalized reviews | 409 with reason | VEIL | not run |
| 17 | Edit a finalized evaluation | 409 locked | VEIL | not run |
| 18 | hr-lead approves their own disclosure request | 403 (only officer, and not the requester) | VEIL | not run |
| 19 | Audit log contains no names/emails/ciphertext | true | VEIL | not run |
| 20 | officer tries to self-approve its own grant as the only approver | not committed (needs a second committee member) | **TideCloak QEA** | not run |
