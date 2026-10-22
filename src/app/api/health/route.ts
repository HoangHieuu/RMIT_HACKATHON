import { db, DEMO_CAMPAIGN_ID } from "@/lib/server/db";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";
import { SIM } from "@/lib/sim/mode";

// Pre-flight for the demo: is every moving part up? Public on purpose, and it returns only
// operational facts (no identities, ciphertext, tokens or user data).
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  let base = "";
  let realm = "";
  try {
    const cfg = loadTideConfig();
    base = cfg["auth-server-url"].replace(/\/+$/, "");
    realm = cfg.realm;
    checks.adapter = { ok: !!cfg.jwk && !!cfg.vendorId, detail: `realm ${realm}, client ${cfg.resource}` };
  } catch (e) {
    checks.adapter = { ok: false, detail: e instanceof Error ? e.message : "data/tidecloak.json unreadable" };
  }

  if (SIM) {
    checks.tidecloak = { ok: true, detail: "SIMULATED realm, served in-process (no Tide network)" };
  } else if (base) {
    try {
      const r = await fetch(`${base}/realms/${realm}/.well-known/openid-configuration`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      checks.tidecloak = { ok: r.ok, detail: `${base} → HTTP ${r.status}` };
      // A re-bootstrapped realm signs with new keys: the exported adapter must match them.
      const certs = (await (await fetch(`${base}/realms/${realm}/protocol/openid-connect/certs`, { cache: "no-store", signal: AbortSignal.timeout(4000) })).json()) as {
        keys?: { kid?: string }[];
      };
      const live = new Set((certs.keys ?? []).map((k) => k.kid));
      const mine = (loadTideConfig().jwk?.keys ?? []).map((k: { kid?: string }) => k.kid);
      const match = mine.some((k: string | undefined) => k && live.has(k));
      checks.adapterMatchesRealm = {
        ok: match,
        detail: match ? "adapter key is one of the realm's signing keys" : "adapter is stale (exported from an older realm): re-export data/tidecloak.json",
      };
    } catch (e) {
      checks.tidecloak = { ok: false, detail: `${base} unreachable (${e instanceof Error ? e.message : "error"})` };
    }
  }

  try {
    const d = db();
    const pol = d.prepare("SELECT purpose FROM relationship_policies WHERE campaign_id = ?").all(DEMO_CAMPAIGN_ID) as { purpose: string }[];
    const has = (p: string) => pol.some((x) => x.purpose === p);
    checks.policies = { ok: has("write") && has("read"), detail: `write ${has("write") ? "signed" : "missing"}, read ${has("read") ? "signed" : "missing"}` };
    const n = (d.prepare("SELECT COUNT(*) n FROM submissions WHERE campaign_id = ?").get(DEMO_CAMPAIGN_ID) as { n: number }).n;
    const st = (d.prepare("SELECT status FROM campaigns WHERE id = ?").get(DEMO_CAMPAIGN_ID) as { status: string } | undefined)?.status;
    checks.database = { ok: true, detail: `campaign ${DEMO_CAMPAIGN_ID} ${st ?? "missing"}, ${n} submissions` };
  } catch (e) {
    checks.database = { ok: false, detail: e instanceof Error ? e.message : "database error" };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
