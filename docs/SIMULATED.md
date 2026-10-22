# Simulated TideCloak mode

Use this when the Tide network is overloaded and you cannot license a realm or create users. The challenge brief allows a simulated integration and judges it the same as a live one, as long as it is labelled. Live mode stays the default and is unchanged.

```bash
npm install
npm run dev:sim      # http://localhost:3000, no Docker, no Tide account, no .env
node scripts/sim-e2e.mjs   # optional: replays the demo story over HTTP (30 checks)
```

`npm run build:sim` builds the same way. Every page shows a **SIMULATED TIDECLOAK** badge, and the Tide enclave pop-up is replaced by a dialog labelled the same.

## What is simulated

| Real | Simulated by | Where |
|---|---|---|
| TideCloak realm, OIDC login, tokens | Persona picker; ES256 tokens with the same claims (`realm_access`, `resource_access`, `tideuserkey`, `groups`, `cnf.jkt`) | `src/lib/sim/server/realm.ts`, `src/app/sim/login` |
| DPoP-bound tokens, `secureFetch` | Real RFC 9449 proofs from WebCrypto. VEIL's own `verifyTideJWT` and `verifyDpop` run unchanged | `src/lib/sim/client/session.ts` |
| `@tidecloak/nextjs` provider and hook | Same hook surface | `src/lib/sim/client/provider.tsx`, `src/lib/tc.ts` |
| IGA / QEA change requests | 202 PENDING capture; threshold `max(1, floor(0.7 x admins))`; each admin counts once; commit at threshold; 412 / 409 / 403 as documented | `src/lib/sim/server/realm.ts` |
| ORK network: policy signing, `doEncrypt`, `doDecrypt` | `RelationshipAttestation:1` rules (signed policy, subject role, `_tide_encryptor` / `_tide_decryptor`, single record tag). Refusals use `THRESHOLD_FAILURE` with the reason in `cause` | `src/lib/sim/server/ork.ts`, `src/app/api/sim/ork` |

VEIL's own routes never import the sim ORK. They hand out ciphertext and the policy, and a separate endpoint decides whether to open it, as the network does live.

## What it is not

- **No threshold cryptography.** One process holds the key (`data/sim-keys.json`, gitignored); ciphertext is AES-256-GCM bound to the record tag. The plaintext identity reaches that process, whereas live it never leaves the browser.
- **No decentralised nodes** and no zero-knowledge proofs.
- **Policy signing needs one admin's confirmation**, not a quorum.
- **Passwordless sign-in.** Do not expose simulated mode on a public host.
- Change-request row field names and the admin policy format are chosen to fit VEIL; upstream does not document them.

## Reset and switching back

`rm data/veil.db* data/sim-keys.json` resets the simulated realm, roles, change requests and demo data. Run `npm run init` and `npm run dev` for live mode; no code change is needed.
