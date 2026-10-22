"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { decryptIdentity } from "@/lib/client/tide";
import { useRoles } from "@/components/AppShell";
import { Badge, Button, CandidateId, Card, Enforcer, ErrorText, inputCls, Metrics, Notice, PageHeader, RawDetail, SecurityState, StageStepper, cx } from "@/components/ui";
import { ROLE, explainTideRefusal, type IdentityPayload, type Stage } from "@/lib/veil";
import { useRevealed } from "@/lib/client/revealed";

interface Campaign {
  id: string;
  title: string;
  status: Stage;
  stats?: { submissions: number; finalizedSubmissions: number; evaluationsFinalized: number };
  policies: { write: boolean; read: boolean };
}
interface Detail {
  disclosureRequests?: { id: string; requested_by: string; reason: string; status: string; approved_by: string | null; created_at: string; resolved_at: string | null }[];
}
interface Result {
  id: string;
  anonymous_candidate_id: string;
  title: string;
  score: number | null;
}
type Outcome = { denied: boolean; message: string; detail: string; by: "veil" | "tide" };

export default function DisclosurePage() {
  const api = useApi();
  const has = useRoles();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [reason, setReason] = useState("Shortlist top candidates for interview after blind review.");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const { revealed, reveal } = useRevealed();

  const loadAll = useCallback(async () => {
    const r = await api<{ campaigns: Campaign[] }>("/api/campaigns");
    setCampaigns(r.campaigns);
    const id = sel ?? r.campaigns.find((c) => ["FINALIZED", "DISCLOSURE"].includes(c.status))?.id ?? r.campaigns[0]?.id ?? null;
    setSel(id);
    if (id) {
      setDetail(await api<Detail>(`/api/campaigns/${id}`));
      const res = await api<{ results: Result[] }>(`/api/results/${id}`).catch(() => ({ results: [] as Result[] }));
      setResults(res.results);
    }
  }, [api, sel]);

  useEffect(() => {
    loadAll().catch((e) => setError(e.message));
  }, [loadAll]);

  const c = campaigns.find((x) => x.id === sel);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function decrypt(r: Result) {
    setBusy(`dec:${r.id}`);
    try {
      const kit = await api<{ encrypted: string; tags: string[]; policy: string; candidateId: string }>(`/api/submissions/${r.id}/identity`);
      const id: IdentityPayload = await decryptIdentity(kit.encrypted, kit.tags[0], kit.policy);
      reveal(r.anonymous_candidate_id, id);
      setOutcome((o) => ({ ...o, [r.id]: { denied: false, message: "Disclosure authorized", detail: "", by: "tide" } }));
      api("/api/audit", { method: "POST", body: { action: "tide.decrypt.succeeded", target: r.anonymous_candidate_id } }).catch(() => {});
    } catch (e) {
      const x = explainTideRefusal(e);
      // A 403 from VEIL's own API is an application refusal: say so precisely.
      const appDenied = e instanceof Error && "status" in e && (e as { status: number }).status === 403;
      setOutcome((o) => ({ ...o, [r.id]: appDenied ? { denied: true, message: "Access denied", detail: x.detail, by: "veil" } : { ...x, by: "tide" } }));
      if (!appDenied) api("/api/audit", { method: "POST", body: { action: "tide.decrypt.refused", target: r.anonymous_candidate_id, detail: x.detail.slice(0, 200) } }).catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  // Security lab for non-officers (org admin, realm admin): use the leaked ciphertext + read policy
  // and ask the Tide network directly, bypassing VEIL's rules entirely.
  async function bypass(r: Result) {
    setBusy(`lab:${r.id}`);
    try {
      const kit = await api<{ encrypted: string; tags: string[]; policy: string }>(`/api/security-lab/${r.id}`);
      const id: IdentityPayload = await decryptIdentity(kit.encrypted, kit.tags[0], kit.policy);
      reveal(r.anonymous_candidate_id, id);
      setOutcome((o) => ({ ...o, [r.id]: { denied: false, message: "Decrypted: this account is authorised by the Tide network", detail: "", by: "tide" } }));
    } catch (e) {
      const x = explainTideRefusal(e);
      setOutcome((o) => ({ ...o, [r.id]: { ...x, denied: true, by: "tide" } }));
      api("/api/audit", { method: "POST", body: { action: "tide.decrypt.refused", target: r.anonymous_candidate_id, detail: x.detail.slice(0, 200) } }).catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  const pending = detail?.disclosureRequests?.find((d) => d.status === "PENDING");
  const isOfficer = has(ROLE.officer);

  return (
    <div>
      <PageHeader
        title="Identity disclosure"
        description="Disclosure needs two layers to agree: VEIL's workflow (finalized reviews, an approved request) and the Tide network (your own credential must satisfy the campaign's signed read policy)."
        action={
          <select className={`${inputCls} w-auto`} value={sel ?? ""} onChange={(e) => setSel(e.target.value)} aria-label="Campaign">
            {campaigns.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        }
      />

      {c && (
        <>
          <div className="mb-6 overflow-x-auto rounded-lg px-4 py-4 ring-1 ring-line">
            <StageStepper stage={c.status} />
          </div>
          <Metrics
            items={[
              { label: "Submissions", value: c.stats?.submissions ?? 0 },
              { label: "Finalized evaluations", value: c.stats?.evaluationsFinalized ?? 0 },
              { label: "Identities sealed", value: c.stats?.submissions ?? 0, hint: `Tide ciphertext, tag ${c.id}` },
              { label: "Your decrypt capability", value: isOfficer ? "Granted" : "None", hint: isOfficer ? "veil-disclosure-officer in token" : "no officer role in token" },
            ]}
          />
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="space-y-6">
          <Card title="Disclosure requests" subtitle="Application workflow: requester and approver must be different people." action={<Enforcer by="veil" />}>
            {detail?.disclosureRequests?.length ? (
              <ul className="-my-1 divide-y divide-line-2">
                {detail.disclosureRequests.map((r) => (
                  <li key={r.id} className="py-3 first:pt-1 last:pb-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">Requested by {r.requested_by}</span>
                      <Badge tone={r.status === "APPROVED" ? "grant" : r.status === "DENIED" ? "deny" : "warn"}>{r.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{r.reason}</p>
                    {r.approved_by && <p className="mt-1 text-[13px] text-ink-3">Decided by {r.approved_by}</p>}
                    {r.status === "PENDING" && isOfficer && (
                      <div className="mt-3 flex gap-2">
                        <Button busy={busy === "approve"} onClick={() => run("approve", () => api(`/api/disclosure-requests/${r.id}`, { method: "POST", body: { decision: "APPROVED" } }))}>
                          <Check className="size-3.5" strokeWidth={1.5} /> Approve disclosure
                        </Button>
                        <Button variant="secondary" onClick={() => run("deny", () => api(`/api/disclosure-requests/${r.id}`, { method: "POST", body: { decision: "DENIED" } }))}>
                          <X className="size-3.5" strokeWidth={1.5} /> Deny
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">No disclosure requests yet.</p>
            )}
            {has(ROLE.orgAdmin) && c?.status === "FINALIZED" && !pending && (
              <div className="mt-4 border-t border-line-2 pt-4">
                <label className="text-sm font-medium" htmlFor="reason">
                  Reason for disclosure
                </label>
                <textarea id="reason" className={`${inputCls} mt-1.5 min-h-16`} value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button className="mt-2" busy={busy === "req"} onClick={() => run("req", () => api(`/api/campaigns/${c.id}/disclosure-requests`, { method: "POST", body: { reason } }))}>
                  Request identity disclosure
                </Button>
              </div>
            )}
            {c && !["FINALIZED", "DISCLOSURE", "CLOSED"].includes(c.status) && (
              <p className="mt-3 text-[13px] text-ink-3">Disclosure can be requested once every review is finalized and the campaign is Finalized.</p>
            )}
            <ErrorText error={error} />
          </Card>

          <Card title="Who can decrypt, and why" flush>
            <ul className="text-sm">
              {[
                { who: "Reviewers, org admins, VEIL's server", ok: false, why: "They do not hold the role the campaign's read policy names.", by: "tide" as const },
                { who: "One Tide realm admin acting alone", ok: false, why: "Admin rights don't satisfy the policy, and self-granting the officer role needs 2 of 3 admins.", by: "quorum" as const },
                { who: "The disclosure officer", ok: true, why: "Only after the quorum granted the role, and only once VEIL releases ciphertext at Disclosure.", by: "quorum" as const },
              ].map((r, i) => (
                <li key={r.who} className={cx("flex gap-3 px-4 py-3", i && "border-t border-line-2")}>
                  {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-grant" strokeWidth={1.5} /> : <X className="mt-0.5 size-4 shrink-0 text-deny" strokeWidth={1.5} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.who}</p>
                    <p className="mt-0.5 text-ink-3">{r.why}</p>
                  </div>
                  <Enforcer by={r.by} className="self-start" />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Candidates" subtitle={isOfficer ? "Decryption happens in your browser, through the Tide network." : "You can attempt disclosure. Both layers will check you."} flush>
          {results.length === 0 ? (
            <p className="p-4 text-sm text-ink-3">No submissions.</p>
          ) : (
            <ul>
              {results.map((r, i) => {
                const id = revealed[r.anonymous_candidate_id];
                const out = outcome[r.id];
                return (
                  <li key={r.id} className={cx("px-4 py-3", i && "border-t border-line-2")}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="tabular w-4 text-sm text-ink-4">{i + 1}</span>
                        <CandidateId id={r.anonymous_candidate_id} />
                        <span className="tabular text-sm font-semibold">{r.score ?? "—"}</span>
                      </div>
                      {id ? (
                        <SecurityState kind="authorized" />
                      ) : (
                        <div className="flex gap-2">
                          {!isOfficer && (
                            <Button variant="danger" size="sm" busy={busy === `lab:${r.id}`} onClick={() => bypass(r)} title="Simulated insider: leaked ciphertext and policy, straight to the Tide network">
                              Try with leaked data
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" busy={busy === `dec:${r.id}`} onClick={() => decrypt(r)}>
                            Reveal identity
                          </Button>
                        </div>
                      )}
                    </div>
                    {id && (
                      <div className="mt-2.5 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-grant-soft px-3 py-2 text-sm ring-1 ring-grant/20 ring-inset">
                        <span className="font-semibold text-ink">{id.fullName}</span>
                        <span className="text-ink-2">{id.university}</span>
                        <span className="text-ink-3">{id.email}</span>
                        {id.phone && <span className="text-ink-3">{id.phone}</span>}
                        <Enforcer by="tide" className="ml-auto" />
                      </div>
                    )}
                    {out?.denied && (
                      <Notice kind="denied" title={out.message} by={out.by} className="mt-2.5 ml-7">
                        <RawDetail>{out.detail}</RawDetail>
                      </Notice>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
