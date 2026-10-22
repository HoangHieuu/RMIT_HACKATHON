// Shared VEIL domain rules (used by both server routes and client screens).
// Nothing here is a security boundary on its own: the server re-checks every rule.

export const STAGES = ["DRAFT", "OPEN", "REVIEW", "FINALIZED", "DISCLOSURE", "CLOSED"] as const;
export type Stage = (typeof STAGES)[number];

export const ROLE = {
  applicant: "veil-applicant",
  evaluator: "veil-evaluator",
  orgAdmin: "veil-org-admin",
  officer: "veil-disclosure-officer",
  realmAdmin: "tide-realm-admin",
  encryptor: "_tide_encryptor",
  decryptor: "_tide_decryptor",
} as const;

export interface Criterion {
  key: string;
  label: string;
  weight: number; // percent, all criteria sum to 100
  description?: string;
}

export const DEFAULT_CRITERIA: Criterion[] = [
  { key: "analysis", label: "Analytical reasoning", weight: 40, description: "Structure, logic and use of evidence." },
  { key: "finance", label: "Financial understanding", weight: 30, description: "Correct use of financial concepts and numbers." },
  { key: "clarity", label: "Clarity of recommendations", weight: 20, description: "Actionable, well-argued recommendation." },
  { key: "creativity", label: "Creativity", weight: 10, description: "Original angles or insight." },
];

/** Scores are 0-10 per criterion; total is a weighted score out of 100. */
export function weightedTotal(criteria: Criterion[], scores: Record<string, number>): number {
  let total = 0;
  for (const c of criteria) {
    const s = Number(scores[c.key]);
    if (!Number.isFinite(s)) continue;
    total += (Math.max(0, Math.min(10, s)) / 10) * c.weight;
  }
  return Math.round(total * 10) / 10;
}

export function nextStage(s: Stage): Stage | null {
  const i = STAGES.indexOf(s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

/**
 * Simple heuristics that flag identifying details inside the WORK section.
 * This is a warning aid, not anonymisation: it cannot catch everything.
 */
export function detectIdentityLeaks(
  text: string,
  identity?: { fullName?: string; email?: string; university?: string; phone?: string },
): string[] {
  const warnings: string[] = [];
  const t = text || "";
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t)) warnings.push("An email address appears in your submission.");
  if (/(\+?\d[\d\s().-]{7,}\d)/.test(t)) warnings.push("A phone-number-like sequence appears in your submission.");
  if (/\b(university|universit[äe]t|college|institute of technology|RMIT|UNSW|Monash|Melbourne Uni)\b/i.test(t))
    warnings.push("Your submission mentions a university or institution.");
  if (/\b(my name is|i am [A-Z][a-z]+ [A-Z][a-z]+|linkedin\.com|github\.com\/)/i.test(t))
    warnings.push("Your submission may contain a self-introduction or profile link.");
  if (identity?.fullName) {
    for (const part of identity.fullName.split(/\s+/).filter((p) => p.length >= 3)) {
      if (new RegExp(`\\b${escapeRe(part)}\\b`, "i").test(t)) {
        warnings.push(`Your name ("${part}") appears in your submission.`);
        break;
      }
    }
  }
  if (identity?.email && t.toLowerCase().includes(identity.email.toLowerCase())) warnings.push("Your email appears in your submission.");
  if (identity?.university && identity.university.length >= 3 && t.toLowerCase().includes(identity.university.toLowerCase()))
    warnings.push("Your university's name appears in your submission.");
  return Array.from(new Set(warnings));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface IdentityPayload {
  fullName: string;
  email: string;
  university: string;
  phone?: string;
}

/** Plain-language mapping of a Tide network refusal. The raw cause is still shown to the user. */
export function explainTideRefusal(err: unknown): { denied: boolean; message: string; detail: string } {
  const detail = collectErrorText(err);
  const denied =
    /not found in doken|not found in list of roles|subjectId does not match|role not found|Tags do not contain|THRESHOLD_FAILURE|Could not reach enough/i.test(detail);
  return {
    denied,
    message: denied
      ? "Access denied. Your identity permissions do not allow decryption of this record."
      : "Decryption failed. See the technical detail below.",
    detail,
  };
}

export function collectErrorText(err: unknown, depth = 0): string {
  if (!err || depth > 4) return "";
  if (typeof err === "string") return err;
  const e = err as { message?: string; cause?: unknown; details?: unknown; errors?: unknown[] };
  const parts: string[] = [];
  if (e.message) parts.push(e.message);
  if (e.details) parts.push(typeof e.details === "string" ? e.details : safeJson(e.details));
  if (Array.isArray(e.errors)) for (const x of e.errors) parts.push(collectErrorText(x, depth + 1));
  if (e.cause) parts.push(collectErrorText(e.cause, depth + 1));
  if (!parts.length) parts.push(safeJson(err));
  return parts.filter(Boolean).join("\n");
}

function safeJson(x: unknown) {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}
