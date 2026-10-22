// End-to-end check of SIMULATED TideCloak against a running `npm run dev:sim` (default
// http://localhost:3000). Replays the demo story over HTTP with real DPoP proofs and prints PASS/FAIL.
// It writes to the demo database: a signed policy pair, one submission, one quorum grant. Reset with
// `rm data/veil.db*` before a recording.
//   node scripts/sim-e2e.mjs [baseUrl]
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createHash, randomUUID } from "node:crypto";

const BASE = process.argv[2] || "http://localhost:3000";
const CAMPAIGN = "gac-2026";
const ADMIN = "/api/sim/auth/admin/realms/veil";
let failed = 0;

const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
};

async function login(username) {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  const session = { username, privateKey, jwk };
  await refresh(session, { username });
  return session;
}

async function refresh(s, body) {
  const res = await fetch(`${BASE}/api/sim/auth/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, jwk: s.jwk }) });
  const t = await res.json();
  if (!res.ok) throw new Error(`token: ${JSON.stringify(t)}`);
  s.token = t.access_token;
  s.refreshToken = t.refresh_token;
}

const claims = (s) => JSON.parse(Buffer.from(s.token.split(".")[1], "base64url").toString());

async function call(s, method, path, body, { scheme = "DPoP", proofToken = s.token } = {}) {
  const url = new URL(path, BASE);
  const proof = await new SignJWT({
    jti: randomUUID(),
    htm: method,
    htu: `${url.origin}${url.pathname}`,
    iat: Math.floor(Date.now() / 1000),
    ath: createHash("sha256").update(proofToken).digest("base64url"),
  })
    .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: s.jwk })
    .sign(s.privateKey);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `${scheme} ${s.token}`, DPoP: proof, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const policyOf = (grantee, access) => ({
  contractId: "RelationshipAttestation:1",
  version: "sim-1",
  modelId: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
  keyId: "sim-vendor",
  params: { subjectType: "Role", subjectId: grantee, assignmentId: CAMPAIGN, roles: JSON.stringify([access]) },
  simulated: true,
});

const [applicant, reviewer, hrLead, officer] = await Promise.all(["applicant", "reviewer", "hr-lead", "officer"].map(login));

// --- token + DPoP enforcement (VEIL's own verifier) ---
check("applicant token carries _tide_encryptor, not _tide_decryptor", claims(applicant).realm_access.roles.includes("_tide_encryptor") && !claims(applicant).realm_access.roles.includes("_tide_decryptor"));
check("officer has no decrypt role before quorum", !claims(officer).realm_access.roles.includes("_tide_decryptor"));
check("security committee = reviewer, hr-lead, officer", [reviewer, hrLead, officer].every((s) => claims(s).resource_access?.["realm-management"]?.roles.includes("tide-realm-admin")) && !claims(applicant).resource_access);
let r = await call(applicant, "GET", "/api/me");
check("VEIL accepts a DPoP-bound simulated token", r.status === 200 && r.data.capabilities?.apply === true, JSON.stringify(r));
r = await call(applicant, "GET", "/api/me", undefined, { scheme: "Bearer" });
check("Bearer replay of a bound token is rejected (401)", r.status === 401, JSON.stringify(r));
r = await call(applicant, "GET", "/api/me", undefined, { proofToken: "other-token" });
check("proof for a different token is rejected (401)", r.status === 401, JSON.stringify(r));

// --- policies: signed by the sim network, admin only ---
const adminPolicy = (await call(hrLead, "GET", `${ADMIN}/iga/role-policies/name/tide-realm-admin`)).data.policy;
check("hr-lead can read the signed admin policy", !!adminPolicy);
r = await call(applicant, "GET", `${ADMIN}/iga/role-policies/name/tide-realm-admin`);
check("applicant cannot use the admin API (403)", r.status === 403, JSON.stringify(r));
r = await call(applicant, "POST", "/api/sim/ork/sign", { policy: policyOf("veil-applicant", "_tide_encryptor"), adminPolicy });
check("non-admin cannot get a policy signed (refused)", r.status === 403 && /THRESHOLD_FAILURE/.test(r.data.error), JSON.stringify(r));
const write = (await call(hrLead, "POST", "/api/sim/ork/sign", { policy: policyOf("veil-applicant", "_tide_encryptor"), adminPolicy })).data.policy;
const read = (await call(hrLead, "POST", "/api/sim/ork/sign", { policy: policyOf("veil-disclosure-officer", "_tide_decryptor"), adminPolicy })).data.policy;
check("admin gets write and read policies signed", !!write && !!read);
r = await call(hrLead, "POST", `/api/campaigns/${CAMPAIGN}/policy`, { purpose: "write", policy: write });
check("VEIL stores + verifies the write policy", r.status === 200 && r.data.verifiedOnServer === true, JSON.stringify(r));
r = await call(hrLead, "POST", `/api/campaigns/${CAMPAIGN}/policy`, { purpose: "read", policy: read });
check("VEIL stores + verifies the read policy", r.status === 200 && r.data.verifiedOnServer === true, JSON.stringify(r));
const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(read, "base64").toString()), params: { ...policyOf("veil-evaluator", "_tide_decryptor").params } })).toString("base64");
r = await call(hrLead, "POST", `/api/campaigns/${CAMPAIGN}/policy`, { purpose: "read", policy: forged });
check("VEIL rejects a tampered policy", r.status === 400, JSON.stringify(r));

// --- encrypt / decrypt, enforced by the "network" ---
const identity = JSON.stringify({ fullName: "Test Person", email: "t@example.invalid", university: "Sim U" });
r = await call(applicant, "POST", "/api/sim/ork/encrypt", { policy: write, items: [{ data: identity, tags: [CAMPAIGN] }] });
const ciphertext = r.data.results?.[0];
check("applicant encrypts identity under the write policy", r.status === 200 && !!ciphertext && !Buffer.from(ciphertext, "base64").toString("latin1").includes("Test Person"), JSON.stringify(r));
r = await call(applicant, "POST", "/api/sim/ork/encrypt", { policy: write, items: [{ data: identity, tags: ["other-campaign"] }] });
check("a tag other than the record id is refused", r.status === 403 && /Tags do not contain/.test(r.data.cause), JSON.stringify(r));
r = await call(applicant, "POST", "/api/submissions", { campaignId: CAMPAIGN, title: "Sim e2e", work: "x".repeat(80), skills: "", encryptedIdentity: ciphertext });
check("VEIL accepts the ciphertext as a submission", r.status === 201, JSON.stringify(r));
r = await call(applicant, "POST", "/api/sim/ork/decrypt", { policy: write, items: [{ encrypted: ciphertext, tags: [CAMPAIGN] }] });
check("applicant cannot decrypt, even with the write policy", r.status === 403, JSON.stringify(r));
r = await call(reviewer, "POST", "/api/sim/ork/decrypt", { policy: read, items: [{ encrypted: ciphertext, tags: [CAMPAIGN] }] });
check("reviewer (security admin) holding ciphertext AND read policy is refused", r.status === 403 && /_tide_decryptor.*not found in doken/.test(r.data.cause), JSON.stringify(r));
r = await call(officer, "POST", "/api/sim/ork/decrypt", { policy: read, items: [{ encrypted: ciphertext, tags: [CAMPAIGN] }] });
check("officer is refused before the quorum grant", r.status === 403, JSON.stringify(r));

// --- quorum governance ---
const users = (await call(hrLead, "GET", `${ADMIN}/users`)).data;
const officerId = users.find((u) => u.username === "officer").id;
const role = (await call(hrLead, "GET", `${ADMIN}/roles/veil-disclosure-officer`)).data;
r = await call(hrLead, "POST", `${ADMIN}/users/${officerId}/role-mappings/realm`, [role]);
const crId = r.data.id;
check("granting the officer role is captured, not applied (202 PENDING)", r.status === 202 && !!crId, JSON.stringify(r));
r = await call(hrLead, "POST", `${ADMIN}/iga/change-requests/${crId}/commit`, {});
check("commit below threshold is refused (412 QUORUM_NOT_MET)", r.status === 412 && r.data.error === "QUORUM_NOT_MET", JSON.stringify(r));
r = await call(hrLead, "POST", `${ADMIN}/iga/change-requests/${crId}/approve`, {});
check("first approval recorded, 1 of 2, not committed", r.status === 200 && r.data.committed === false && r.data.authCount === 1 && r.data.threshold === 2, JSON.stringify(r));
r = await call(hrLead, "POST", `${ADMIN}/iga/change-requests/${crId}/approve`, {});
check("same admin approving twice does not count", r.status === 200 && r.data.committed === false && r.data.authCount === 1, JSON.stringify(r));
r = await call(applicant, "POST", `${ADMIN}/iga/change-requests/${crId}/approve`, {});
check("a non-admin cannot approve (403)", r.status === 403, JSON.stringify(r));
r = await call(reviewer, "POST", `${ADMIN}/iga/change-requests/${crId}/approve`, {});
check("second admin's approval commits (2 of 2)", r.status === 200 && r.data.committed === true && r.data.status === "APPROVED", JSON.stringify(r));
r = await call(reviewer, "POST", `${ADMIN}/iga/change-requests/${crId}/approve`, {});
check("approving a committed request is refused (409)", r.status === 409, JSON.stringify(r));
r = await call(officer, "POST", "/api/sim/ork/decrypt", { policy: read, items: [{ encrypted: ciphertext, tags: [CAMPAIGN] }] });
check("officer's OLD token still lacks the role (roles are fixed at sign-in)", r.status === 403, JSON.stringify(r));
await refresh(officer, { refreshToken: officer.refreshToken });
check("after refresh the token carries veil-disclosure-officer + _tide_decryptor", ["veil-disclosure-officer", "_tide_decryptor"].every((x) => claims(officer).realm_access.roles.includes(x)));
r = await call(officer, "POST", "/api/sim/ork/decrypt", { policy: read, items: [{ encrypted: ciphertext, tags: [CAMPAIGN] }] });
check("officer decrypts the identity after quorum", r.status === 200 && r.data.results?.[0] === identity, JSON.stringify(r));
r = await call(officer, "POST", "/api/sim/ork/decrypt", { policy: read, items: [{ encrypted: ciphertext, tags: ["other-campaign"] }] });
check("a different tag cannot open the ciphertext", r.status === 403, JSON.stringify(r));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
