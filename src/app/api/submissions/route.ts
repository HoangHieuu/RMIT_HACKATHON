import { route, body, str, HttpError } from "@/lib/server/session";
import { db, audit, newId, newCandidateId } from "@/lib/server/db";
import { getCampaign } from "@/lib/server/repo";
import { ROLE } from "@/lib/veil";

// Applicant submission. The browser has ALREADY encrypted the identity through the Tide network
// (doEncrypt + the campaign's write-only policy). This route only ever sees ciphertext.
const FORBIDDEN_PLAINTEXT_FIELDS = ["fullName", "name", "email", "university", "phone", "identity"];

export const POST = route(
  async (req, p) => {
    const b = await body<Record<string, unknown>>(req);
    for (const f of FORBIDDEN_PLAINTEXT_FIELDS) {
      if (f in b) throw new HttpError(400, `Refusing plaintext identity field "${f}". Identity must arrive encrypted.`);
    }
    const campaignId = str(b.campaignId, "campaignId", 64);
    const c = getCampaign(campaignId);
    if (c.status !== "OPEN") throw new HttpError(409, `Campaign is ${c.status}; submissions are closed.`);
    const title = str(b.title, "title", 160);
    const work = str(b.work, "work", 20000, 50);
    const skills = typeof b.skills === "string" ? b.skills.trim().slice(0, 2000) : "";
    const encrypted = str(b.encryptedIdentity, "encryptedIdentity", 200000, 40);
    if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) throw new HttpError(400, "encryptedIdentity must be base64 ciphertext");
    // Plain JSON would mean the browser skipped encryption. Never store it.
    try {
      const decoded = Buffer.from(encrypted, "base64").toString("utf8");
      if (/"(fullName|email|university)"\s*:/.test(decoded)) throw new Error("plaintext");
    } catch {
      throw new HttpError(400, "encryptedIdentity looks like plaintext, refusing to store it");
    }

    const d = db();
    let candidateId = newCandidateId();
    while (d.prepare("SELECT 1 FROM submissions WHERE anonymous_candidate_id = ?").get(candidateId)) candidateId = newCandidateId();
    const id = newId("sub");
    d.prepare(
      `INSERT INTO submissions (id, campaign_id, applicant_user_id, anonymous_candidate_id, title, anonymized_work_content, skills,
        encrypted_identity_payload, identity_encryption_tags, submitted_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
    ).run(id, campaignId, p.sub, candidateId, title, work, skills, encrypted, JSON.stringify([campaignId]), new Date().toISOString());
    audit({ actorId: p.sub, actorName: p.username, action: "submission.created", targetType: "submission", targetId: candidateId, outcome: "ok", detail: "identity stored as Tide ciphertext only" });
    return Response.json({ candidateId }, { status: 201 });
  },
  { anyRole: [ROLE.applicant] },
);
