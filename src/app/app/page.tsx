"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RefreshCw, RotateCcw } from "lucide-react";
import { useTideCloak } from "@tidecloak/nextjs";
import { useApi } from "@/lib/client/api";
import { useRoles } from "@/components/AppShell";
import { Badge, Button, Card, Enforcer, Notice, PageHeader, SecurityState, StageBadge, cx } from "@/components/ui";
import { ROLE, type Stage } from "@/lib/veil";

interface Me {
  username: string;
  roles: string[];
  capabilities: Record<string, boolean>;
}
interface Step {
  id: string;
  persona: string;
  title: string;
  where: string;
  done: boolean;
  detail?: string;
}

// Four Tide accounts, one per team member. The three staff accounts also form the security
// committee (tide-realm-admin), so TideCloak's quorum is max(1, floor(3 x 0.7)) = 2.
const PERSONAS = [
  { user: "applicant", app: "Applicant", committee: false, does: "The only outsider. Applies; identity is encrypted in the browser under a write-only policy." },
  { user: "reviewer", app: "Evaluator", committee: true, does: "Scores anonymous work. Is a security admin, and is still refused by the Tide network when it tries to decrypt." },
  { user: "hr-lead", app: "Organisation admin", committee: true, does: "Runs the campaign and requests disclosure. Can file the officer grant, but cannot complete it alone." },
  { user: "officer", app: "Disclosure officer (after quorum)", committee: true, does: "Can reveal identities only once 2 of 3 committee members approve the role, and only at Disclosure." },
];

export default function Overview() {
  const api = useApi();
  const has = useRoles();
  const [me, setMe] = useState<Me | null>(null);
  const [demo, setDemo] = useState<{ campaign: { title: string; status: Stage }; steps: Step[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const { forceRefreshToken, login } = useTideCloak();
  const [refreshing, setRefreshing] = useState(false);

  // Roles are read from the token. After a quorum grant commits, pull a fresh token so the new role
  // (and the Tide credential the ORKs check) is picked up; fall back to a fresh sign-in.
  async function refreshPermissions() {
    setRefreshing(true);
    try {
      const ok = await forceRefreshToken();
      if (!ok) return login();
      window.location.reload();
    } catch {
      login();
    } finally {
      setRefreshing(false);
    }
  }

  const load = useCallback(() => {
    api<Me>("/api/me").then(setMe).catch((e) => setError(e.message));
    api<{ campaign: { title: string; status: Stage }; steps: Step[] }>("/api/demo/status").then(setDemo).catch(() => {});
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  async function reset() {
    if (!window.confirm("Reset demo data? Submissions, scores, disclosure requests and the app log are cleared. Signed policies and TideCloak roles stay.")) return;
    setResetting(true);
    try {
      await api("/api/demo/reset", { method: "POST" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  }

  const next = demo?.steps.find((s) => !s.done);

  return (
    <div>
      <PageHeader
        title={me ? `Signed in as ${me.username}` : "Signed in"}
        description="Your permissions come from your verified TideCloak token, checked by VEIL's server on every request."
        action={
          <Button variant="secondary" busy={refreshing} onClick={refreshPermissions} title="Pick up roles granted since you signed in">
            <RefreshCw className="size-3.5" strokeWidth={1.5} /> Refresh permissions
          </Button>
        }
      />
      {error && (
        <Notice kind="denied" title="VEIL's server could not verify your session" by="veil" className="mb-6">
          {error}
        </Notice>
      )}

      {me && (
        <Card title="Your verified permissions" className="mb-6" action={<Enforcer by="veil" />}>
          <div className="grid gap-5 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[13px] text-ink-3">Roles in your token</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {me.roles.length ? (
                  me.roles.map((r) => (
                    <Badge key={r} tone={r.startsWith("_tide") ? "seal" : r === ROLE.realmAdmin ? "quorum" : "neutral"} className="font-mono">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-ink-3">No VEIL roles.</span>
                )}
              </div>
            </div>
            <div className="md:text-right">
              <p className="text-[13px] text-ink-3">Candidate identities</p>
              <div className="mt-2">
                {me.capabilities.disclose ? <SecurityState kind="authorized" label="You may disclose (network permitting)" /> : <SecurityState kind="denied" label="You cannot decrypt" />}
              </div>
            </div>
          </div>
        </Card>
      )}

      {demo && (
        <Card
          className="mb-6"
          title="Demo runbook"
          subtitle={
            <span className="inline-flex items-center gap-2">
              {demo.campaign.title} <StageBadge stage={demo.campaign.status} />
            </span>
          }
          action={
            has(ROLE.orgAdmin) && (
              <Button variant="ghost" size="sm" busy={resetting} onClick={reset} title="Clear demo data for a retake">
                <RotateCcw className="size-3.5" strokeWidth={1.5} /> Reset demo data
              </Button>
            )
          }
          flush
        >
          <ol>
            {demo.steps.map((s, i) => {
              const isNext = s === next;
              return (
                <li key={s.id} className={cx("flex items-start gap-3 px-4 py-3", i && "border-t border-line-2", isNext && "bg-accent-soft/60")}>
                  <span
                    className={cx(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      s.done ? "bg-grant text-white" : isNext ? "bg-accent text-white" : "bg-surface text-ink-3 ring-1 ring-line",
                    )}
                  >
                    {s.done ? <Check className="size-3" strokeWidth={2} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("text-sm", s.done ? "text-ink-3" : "font-medium text-ink")}>{s.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      as <span className="font-mono text-ink-2">{s.persona}</span>
                      {s.detail ? ` · ${s.detail}` : ""}
                    </p>
                  </div>
                  {isNext && (
                    <Link href={s.where} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline">
                      Go <ArrowRight className="size-3.5" strokeWidth={1.5} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Card title="The four demo accounts" subtitle="One Tide account per team member. Use a separate browser profile for each, so switching persona is instant." flush>
        <ul>
          {PERSONAS.map((p, i) => (
            <li key={p.user} className={cx("grid items-start gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[110px_190px_1fr]", i && "border-t border-line-2")}>
              <span className="font-mono text-sm font-medium">{p.user}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge>{p.app}</Badge>
                {p.committee && <Badge tone="quorum">Committee</Badge>}
              </span>
              <span className="text-sm text-ink-2">{p.does}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
