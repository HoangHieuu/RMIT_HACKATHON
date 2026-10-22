"use client";

// Browser-side Tide operations for VEIL. All cryptography happens through the official SDK and the
// Tide network (ORKs). There is no local/fake crypto anywhere in VEIL.
import { signRelationshipPolicy, encryptForRecord, decryptForRecord, describeRelationshipPolicy, type RelationshipSubject, type RelationshipAccess } from "@/lib/tide/relationship";
import { ROLE, type IdentityPayload } from "@/lib/veil";
import { b64ToBytes } from "./api";

export type Purpose = "write" | "read";

/** The two policies every campaign needs. The campaign id is the record id and the only tag. */
export const CAMPAIGN_POLICY: Record<Purpose, { subject: RelationshipSubject; access: RelationshipAccess; label: string; explains: string }> = {
  write: {
    subject: { type: "Role", id: ROLE.applicant },
    access: "write",
    label: "Applicant drop-box (encrypt only)",
    explains: "Holders of veil-applicant may ENCRYPT identities into this campaign. Nobody can decrypt with this policy, including the applicant.",
  },
  read: {
    subject: { type: "Role", id: ROLE.officer },
    access: "read",
    label: "Disclosure officer (decrypt only)",
    explains: "Only holders of veil-disclosure-officer (which carries _tide_decryptor) may DECRYPT identities in this campaign. Granting that role requires a 2-of-3 admin quorum.",
  },
};

/**
 * Fetch the realm's admin policy (signed bytes) straight from TideCloak with the admin's own,
 * DPoP-bound token. It authorises the network to sign relationship policies.
 */
export async function fetchAdminPolicy(adminApi: <T>(p: string) => Promise<T>): Promise<Uint8Array> {
  const res = await adminApi<{ policy?: string } | string>("/iga/role-policies/name/tide-realm-admin");
  const b64 = typeof res === "string" ? res : res.policy;
  if (!b64) throw new Error("TideCloak returned no admin policy for tide-realm-admin");
  return b64ToBytes(b64);
}

/** Opens the Tide enclave in the admin's browser; the admin's approval IS the grant. */
export async function signCampaignPolicy(campaignId: string, purpose: Purpose, vendorId: string, adminPolicy: Uint8Array): Promise<string> {
  const p = CAMPAIGN_POLICY[purpose];
  return signRelationshipPolicy({ vendorId, subject: p.subject, recordId: campaignId, access: p.access }, adminPolicy);
}

export async function encryptIdentity(identity: IdentityPayload, campaignId: string, writePolicyB64: string): Promise<string> {
  return encryptForRecord(JSON.stringify(identity), campaignId, writePolicyB64);
}

export async function decryptIdentity(encrypted: string, campaignId: string, readPolicyB64: string): Promise<IdentityPayload> {
  const plain = await decryptForRecord(encrypted, campaignId, readPolicyB64);
  return JSON.parse(plain) as IdentityPayload;
}

export function describePolicy(b64: string) {
  try {
    return describeRelationshipPolicy(b64);
  } catch {
    return null;
  }
}
