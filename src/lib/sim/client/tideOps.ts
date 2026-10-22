"use client";

// SIMULATED counterparts of src/lib/tide/relationship.ts: same signatures, same policy parameters,
// same refusals. Every call goes to the sim ORK (/api/sim/ork/*) with the caller's DPoP-bound token,
// so the "network" decides, not VEIL.
import { SIM_ORK_BASE, SIM_VENDOR_ID } from "../mode";
import { simEnclave } from "./enclave";
import { current, secureFetch } from "./session";

const CONTRACT_ID = "RelationshipAttestation:1";
const ENCRYPT_ROLE = "_tide_encryptor";
const DECRYPT_ROLE = "_tide_decryptor";
const ROLES_FOR = { read: [DECRYPT_ROLE], write: [ENCRYPT_ROLE], "read-write": [ENCRYPT_ROLE, DECRYPT_ROLE] } as const;

interface Grant {
  vendorId?: string;
  subject: { type: "User" | "Group" | "Role"; id: string; clientId?: string };
  recordId: string;
  access: keyof typeof ROLES_FOR;
  expiry?: number;
}

/** Thrown like the SDK throws: the generic network message, the contract's own text in `cause`. */
class NetworkRefusal extends Error {
  constructor(message: string, cause: string, public code: string) {
    super(`${code}: ${message}`, { cause: new Error(cause) });
  }
}

async function ork<T>(op: string, body: unknown): Promise<T> {
  if (!current()) throw new Error("Not signed in");
  const res = await secureFetch(new URL(`${SIM_ORK_BASE}/${op}`, window.location.origin).href, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; cause?: string };
  if (res.status === 403 && data.cause) throw new NetworkRefusal(data.message ?? "refused", data.cause, data.error ?? "TIDE-TIDEJS-NET-THRESHOLD_FAILURE");
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

export async function signRelationshipPolicy(grant: Grant, adminPolicy: Uint8Array): Promise<string> {
  if (!grant.subject?.id) throw new Error("subject.id is required");
  if (!grant.recordId) throw new Error("recordId is required");
  const ok = await simEnclave({
    title: "Approve this policy?",
    lines: [`Contract ${CONTRACT_ID}`, `Subject: ${grant.subject.type} ${grant.subject.id}`, `Record: ${grant.recordId}`, `May: ${ROLES_FOR[grant.access].join(", ")}`],
    approveLabel: "Approve and sign",
  });
  if (!ok) throw new Error("the grant was not approved (denied)");
  const policy = {
    contractId: CONTRACT_ID,
    version: "sim-1",
    modelId: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
    keyId: grant.vendorId || SIM_VENDOR_ID,
    params: {
      subjectType: grant.subject.type,
      subjectId: grant.subject.id,
      ...(grant.subject.type === "Role" && grant.subject.clientId ? { clientId: grant.subject.clientId } : {}),
      assignmentId: grant.recordId,
      roles: JSON.stringify(ROLES_FOR[grant.access]),
    },
    ...(grant.expiry ? { expiry: grant.expiry } : {}),
    simulated: true,
  };
  return (await ork<{ policy: string }>("sign", { policy, adminPolicy: toB64(adminPolicy) })).policy;
}

export async function encryptForRecord(data: string, recordId: string, signedPolicyB64: string): Promise<string> {
  const { results } = await ork<{ results: string[] }>("encrypt", { policy: signedPolicyB64, items: [{ data, tags: [recordId] }] });
  return results[0];
}

export async function decryptForRecord(encrypted: string, recordId: string, signedPolicyB64: string): Promise<string> {
  const { results } = await ork<{ results: string[] }>("decrypt", { policy: signedPolicyB64, items: [{ encrypted, tags: [recordId] }] });
  return results[0];
}

export function describeRelationshipPolicy(signedPolicyB64: string) {
  const p = JSON.parse(atob(signedPolicyB64)) as { contractId: string; params: Record<string, string>; signature?: string };
  return {
    contractId: p.contractId,
    subjectType: p.params.subjectType ?? "",
    subjectId: p.params.subjectId ?? "",
    clientId: p.params.clientId ?? "",
    recordId: p.params.assignmentId ?? "",
    roles: p.params.roles ?? "",
    signed: !!p.signature,
    isRelationshipPolicy: p.contractId === CONTRACT_ID,
  };
}
