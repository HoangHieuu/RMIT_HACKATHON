// SQLite persistence (Node's built-in node:sqlite; no native build step).
// Server-only. Stores ciphertext, never plaintext identity.
import { mkdirSync } from "fs";
import { join } from "path";
import { randomBytes, randomUUID } from "crypto";
import { DEFAULT_CRITERIA } from "../veil";

type Sqlite = typeof import("node:sqlite");
// getBuiltinModule keeps bundlers from trying to resolve the builtin.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as Sqlite;

type DB = InstanceType<Sqlite["DatabaseSync"]>;
const g = globalThis as unknown as { __veilDb?: DB };

export function db(): DB {
  if (g.__veilDb) return g.__veilDb;
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const d = new DatabaseSync(process.env.VEIL_DB_PATH || join(dir, "veil.db"));
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(d);
  seed(d);
  g.__veilDb = d;
  return d;
}

function migrate(d: DB) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
  );
  -- App profile only. Security roles are NEVER read from here: they come from the verified token.
  CREATE TABLE IF NOT EXISTS users (
    tidecloak_user_id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT,
    tide_user_key TEXT, organization_id TEXT, application_role TEXT, last_seen TEXT
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, deadline TEXT,
    criteria TEXT NOT NULL, required_reviews INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS campaign_reviewers (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id), reviewer_username TEXT NOT NULL,
    PRIMARY KEY (campaign_id, reviewer_username)
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    applicant_user_id TEXT NOT NULL, anonymous_candidate_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL, anonymized_work_content TEXT NOT NULL, skills TEXT,
    encrypted_identity_payload TEXT NOT NULL, identity_encryption_tags TEXT NOT NULL,
    submitted_at TEXT NOT NULL, status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
    evaluator_id TEXT NOT NULL, evaluator_username TEXT NOT NULL,
    criterion_scores TEXT NOT NULL, weighted_total_score REAL NOT NULL, feedback TEXT,
    status TEXT NOT NULL, finalized_at TEXT, updated_at TEXT NOT NULL,
    UNIQUE (submission_id, evaluator_id)
  );
  CREATE TABLE IF NOT EXISTS disclosure_requests (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id), submission_id TEXT,
    requested_by TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL,
    approved_by TEXT, created_at TEXT NOT NULL, resolved_at TEXT
  );
  -- Signed RelationshipAttestation:1 policies (opaque bytes signed by the Tide network).
  CREATE TABLE IF NOT EXISTS relationship_policies (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    purpose TEXT NOT NULL CHECK (purpose IN ('write','read')),
    subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, record_id TEXT NOT NULL,
    policy_b64 TEXT NOT NULL, granted_by TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE (campaign_id, purpose)
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, actor_id TEXT, actor_name TEXT, action TEXT NOT NULL,
    target_type TEXT, target_id TEXT, outcome TEXT NOT NULL, detail TEXT,
    source TEXT NOT NULL DEFAULT 'app', timestamp TEXT NOT NULL
  );
  `);
}

export const DEMO_ORG_ID = "org-northwind";
export const DEMO_CAMPAIGN_ID = "gac-2026";

function seed(d: DB) {
  const now = new Date().toISOString();
  const has = d.prepare("SELECT 1 FROM organizations WHERE id = ?").get(DEMO_ORG_ID);
  if (has) return;
  d.prepare("INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)").run(DEMO_ORG_ID, "Northwind Capital (synthetic)", now);
  const deadline = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  d.prepare(
    `INSERT INTO campaigns (id, organization_id, title, description, status, deadline, criteria, required_reviews, created_by, created_at)
     VALUES (?, ?, ?, ?, 'OPEN', ?, ?, 1, 'seed', ?)`,
  ).run(
    DEMO_CAMPAIGN_ID,
    DEMO_ORG_ID,
    "Graduate Analyst Challenge 2026",
    "Evaluate analytical reasoning and financial problem-solving through a written case study. Brief: a regional coffee chain (synthetic) is losing margin. Diagnose the cause and recommend one action with numbers.",
    deadline,
    JSON.stringify(DEFAULT_CRITERIA),
    now,
  );
  d.prepare("INSERT INTO campaign_reviewers (campaign_id, reviewer_username) VALUES (?, ?)").run(DEMO_CAMPAIGN_ID, "reviewer");
  audit({ actorId: "seed", actorName: "seed", action: "campaign.seeded", targetType: "campaign", targetId: DEMO_CAMPAIGN_ID, outcome: "ok" }, d);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function newCandidateId(): string {
  const bytes = randomBytes(5);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `VEIL-${s}`;
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export interface AuditInput {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome: "ok" | "denied" | "error";
  detail?: string;
  source?: "app" | "tidecloak";
}

/** Never pass identity fields, plaintext, tokens or ciphertext in `detail`. */
export function audit(e: AuditInput, d: DB = db()) {
  d.prepare(
    `INSERT INTO audit_events (id, actor_id, actor_name, action, target_type, target_id, outcome, detail, source, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("evt"),
    e.actorId ?? null,
    e.actorName ?? null,
    e.action,
    e.targetType ?? null,
    e.targetId ?? null,
    e.outcome,
    e.detail ? e.detail.slice(0, 500) : null,
    e.source ?? "app",
    new Date().toISOString(),
  );
}
