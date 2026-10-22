# VEIL setup

Local, reproducible setup: TideCloak in Docker (wired to the production Tide network), VEIL as a Next.js 16 app with SQLite.

## Prerequisites

- Node.js **22.13+** (VEIL uses the built-in `node:sqlite`; tested on 24.12)
- Docker Desktop (running)
- `curl` and `jq` (on Windows: Git Bash; put `jq.exe` on PATH)
- Internet access (TideCloak talks to Tide's ORK network)

## 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | What |
|---|---|
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | TideCloak master-admin password for your local container. Any strong value. Server-side only, never shipped to the browser. |
| `TIDE_LICENSE_EMAIL` | A real address you control; it manages the Tide licence of the realm. |
| `TIDE_TERMS_ACCEPTED` | `yes` only after **you** have read and agreed to https://tide.org/legal |

## 2. Bootstrap TideCloak and the VEIL realm

```bash
npm run init        # bash scripts/init-veil.sh
```

The script (adapted from the Tide pack's `init-tidecloak.sh`):

1. starts `tideorg/tidecloak-dev:latest` as container `veil-tidecloak` on `:8080`
2. creates realm `veil` and public client `veil-client` from `scripts/realm.json.template` (DPoP-bound tokens, `tideuserkey`/`vuid`/`groups` mappers, VEIL roles)
3. licenses the realm (`setUpTideRealm`), stamps `iga.attestor=tide`, enables IGA
4. creates four personas while the realm is still FirstAdmin (one Tide account per team member) and assigns non-privileged roles (`hr-lead` → `veil-org-admin`, `reviewer` → `veil-evaluator`)
5. writes one invite link per persona to `data/invite-links.txt` and **waits**

**Human step:** open each link in a fresh private window (or the browser profile you will use for that persona) and create/link a Tide account. Keep the usernames and passwords; you sign in with them in the app. If a link expires: `bash scripts/invite.sh <persona>`.

When all four are linked, the script signs the IdP settings and makes `hr-lead`, `officer` and `reviewer` the **security committee** (`tide-realm-admin`). The first committed grant flips the realm to multi-admin; grants still pending after that are approved by hr-lead in VEIL → Governance. It then exports `data/tidecloak.json`.

If the script stops after enrolment (e.g. a transient Tide 503 during licensing is retried from scratch, but an interruption later is not), resume with `RESUME=1 npm run init`.

### Cast and roles

| Account | Realm roles | Security committee | Meaning |
|---|---|---|---|
| `applicant` | `veil-applicant` (default; composite incl. `_tide_encryptor`) | no | may submit; may encrypt into a campaign under its write-only policy |
| `reviewer` | `veil-evaluator` | yes | scores anonymised work; no decrypt capability |
| `hr-lead` | `veil-org-admin` | yes (bootstrap admin) | runs campaigns, requests disclosure; no decrypt capability |
| `officer` | `veil-disclosure-officer` (composite incl. `_tide_decryptor`) **granted only through quorum** | yes | subject of every campaign's read policy |

Three committee members ⇒ TideCloak requires **max(1, ⌊3 × 0.7⌋) = 2** approvals for every governed change. Being a committee member gives no decryption power: the read policy names `veil-disclosure-officer`, and granting it to anyone, yourself included, needs a second member.

`_tide_encryptor`/`_tide_decryptor` are fixed names required by the ORK's built-in `RelationshipAttestation:1` contract. `_tide_encryptor` reaches every user through the default applicant role on purpose: applying is open to the public, and the campaign's write policy is encrypt-only, so it never lets anyone read.

## 3. Run VEIL

```bash
npm run dev         # http://localhost:3000
```

The SQLite database is created and seeded at `data/veil.db` on first request (one organisation, the *Graduate Analyst Challenge 2026* campaign, `reviewer` assigned).

## 4. Governance setup (one-time, in the app)

1. Sign in as **hr-lead** → *Governance* → **Approve & sign** both policies for *Graduate Analyst Challenge 2026* (each opens the Tide enclave). Do this before the committee grows, while hr-lead's approval alone is sufficient.
2. If *Tide realm admins* shows fewer than 3, approve the pending `tide-realm-admin` grants in *Privileged changes* (still threshold 1 at that point).
3. Every account signs in once; *Overview → Demo runbook* then tracks the demo step by step.

The TideCloak console for the realm is at http://localhost:8080/realms/veil/tide-console/ (same change requests, official UI).

## 5. Demo data

Sign in as **applicant** → *Apply* → **Submit all 3** (or fill *Candidate 1/2/3* and submit by hand). The candidates are synthetic people on the `.invalid` TLD; every submission is a real Tide encryption. **Reset demo data** on the Overview (hr-lead) clears a take without touching policies or roles.

## Reset

```bash
docker rm -f veil-tidecloak && rm -f data/veil.db* data/tidecloak.json && npm run init
```

`docker stop/start veil-tidecloak` keeps the realm; `docker rm` deletes it (the H2 database lives in the container).

## Troubleshooting

| Symptom | Fix |
|---|---|
| API returns 401 `DPoP…` | Sign out and in again; every VEIL call goes through `secureFetch`, which adds the DPoP proof. |
| Roles missing after an approval | Tokens carry roles from sign-in time: sign out and in again. |
| Decrypt shows `THRESHOLD_FAILURE: Could not reach enough VVK ORKs` | That is the network **refusing** (contract message is in the detail), not an outage. |
| Policy signing does nothing | Allow pop-ups for localhost:3000 (the Tide enclave opens in a pop-up). |
