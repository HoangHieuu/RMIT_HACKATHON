"use client";

import { useCallback, useEffect, useState } from "react";
import { useTideCloak } from "@/lib/tc";
import { Models } from "@tideorg/js";
import { ExternalLink, FilePlus2, Lock, PenLine, RefreshCw } from "lucide-react";
import { useApi, useTideAdminApi, b64ToBytes, bytesToB64 } from "@/lib/client/api";
import { CAMPAIGN_POLICY, fetchAdminPolicy, signCampaignPolicy, type Purpose } from "@/lib/client/tide";
import { useRoles } from "@/components/AppShell";
import { Badge, Button, Card, Enforcer, type EnforcerKind, ErrorText, Metrics, Notice, PageHeader, RawDetail, StageBadge, cx, td, th, tr } from "@/components/ui";
import { ROLE, collectErrorText, type Stage } from "@/lib/veil";
import { SIM } from "@/lib/sim/mode";
import { simEnclave } from "@/lib/sim/client/enclave";

interface Campaign {
  id: string;
  title: string;
  status: Stage;
  policies: { write: boolean; read: boolean };
}

interface ChangeRequest {
  id: string;
  entityType: string;
  actionType: string;
  status: string;
  readyToCommit?: boolean;
  threshold?: number;
  authorizationCount?: number;
  authCount?: number;
  authorizers?: { username?: string; timestamp?: number }[];
  rows?: Record<string, unknown>[];
  [k: string]: unknown;
}

export default function GovernancePage() {
  const api = useApi();
  const adminApi = useTideAdminApi();
  const has = useRoles();
  const { getConfig, approveTideRequests } = useTideCloak();
  const isRealmAdmin = has(ROLE.realmAdmin);
  const cfg = getConfig() as { "auth-server-url": string; realm: string; vendorId: string };
  const consoleUrl = `${cfg["auth-server-url"].replace(/\/+$/, "")}/realms/${cfg.realm}/tide-console/`;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; title: string; text: string; by: EnforcerKind } | null>(null);
  const [crs, setCrs] = useState<ChangeRequest[] | null>(null);
  const [crErr, setCrErr] = useState<string | null>(null);
  const [admins, setAdmins] = useState<string[] | null>(null);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [target, setTarget] = useState("officer");
  const [privRole, setPrivRole] = useState<string>(ROLE.officer);
  const [privAction, setPrivAction] = useState<"grant" | "revoke">("grant");

  const load = useCallback(async () => {
    const r = await api<{ campaigns: Campaign[] }>("/api/campaigns");
    setCampaigns(r.campaigns);
    if (isRealmAdmin) {
      try {
        const pending = await adminApi<ChangeRequest[]>("/iga/change-requests?status=PENDING");
        const approved = await adminApi<ChangeRequest[]>("/iga/change-requests?status=APPROVED").catch(() => [] as ChangeRequest[]);
        setCrs([...(Array.isArray(pending) ? pending : []), ...(Array.isArray(approved) ? approved.slice(-8).reverse() : [])]);
        setCrErr(null);
      } catch (e) {
        setCrErr(collectErrorText(e));
      }
      try {
        const clients = await adminApi<{ id: string }[]>("/clients?clientId=realm-management");
        const list = await adminApi<{ username: string }[]>(`/clients/${clients[0].id}/roles/tide-realm-admin/users`);
        setAdmins(list.map((u) => u.username));
      } catch {
        setAdmins(null);
      }
    }
  }, [api, adminApi, isRealmAdmin]);

  useEffect(() => {
    load().catch((e) => setMsg({ kind: "err", title: "Could not load governance data", text: collectErrorText(e), by: "veil" }));
  }, [load]);

  useEffect(() => {
    if (!isRealmAdmin) return;
    adminApi<{ id: string; username: string }[]>("/users?max=100&briefRepresentation=true")
      .then((u) => setUsers(u))
      .catch(() => {});
  }, [adminApi, isRealmAdmin]);

  const threshold = admins ? Math.max(1, Math.floor(admins.length * 0.7)) : null;

  async function sign(c: Campaign, purpose: Purpose) {
    setBusy(`${c.id}:${purpose}`);
    setMsg(null);
    try {
      const adminPolicy = await fetchAdminPolicy(adminApi);
      const signed = await signCampaignPolicy(c.id, purpose, cfg.vendorId, adminPolicy);
      const r = await api<{ verifiedOnServer: boolean }>(`/api/campaigns/${c.id}/policy`, { method: "POST", body: { purpose, policy: signed } });
      setMsg({
        kind: "ok",
        by: "tide",
        title: "Policy signed by the Tide network",
        text: `${CAMPAIGN_POLICY[purpose].label} for ${c.id} is stored${r.verifiedOnServer ? " and its contents were verified by VEIL's server" : ""}.`,
      });
      await load();
    } catch (e) {
      const text = collectErrorText(e);
      api("/api/audit", { method: "POST", body: { action: "tide.policy.sign_failed", target: c.id, detail: text.slice(0, 200) } }).catch(() => {});
      setMsg({ kind: "err", title: "Signing was refused or failed", text, by: "tide" });
    } finally {
      setBusy(null);
    }
  }

  // Propose a privileged change straight to TideCloak with this admin's own token. On an IGA realm
  // the write is parked as a change request (HTTP 202) until the quorum approves it.
  async function propose() {
    setBusy("propose");
    setMsg(null);
    try {
      const u = users.find((x) => x.username === target);
      if (!u) throw new Error(`No TideCloak user named ${target}`);
      if (privRole === ROLE.realmAdmin) {
        const clients = await adminApi<{ id: string }[]>("/clients?clientId=realm-management");
        const role = await adminApi<Record<string, unknown>>(`/clients/${clients[0].id}/roles/tide-realm-admin`);
        await adminApi(`/users/${u.id}/role-mappings/clients/${clients[0].id}`, { method: privAction === "grant" ? "POST" : "DELETE", body: [role] });
      } else {
        const role = await adminApi<Record<string, unknown>>(`/roles/${encodeURIComponent(privRole)}`);
        await adminApi(`/users/${u.id}/role-mappings/realm`, { method: privAction === "grant" ? "POST" : "DELETE", body: [role] });
      }
      setMsg({
        kind: "ok",
        by: "quorum",
        title: "Change request filed in TideCloak",
        text: `${privAction === "grant" ? "Grant" : "Revoke"} ${privRole} ${privAction === "grant" ? "to" : "from"} ${target}. It has no effect until ${threshold ?? "the required number of"} admin(s) approve it below.`,
      });
      await load();
    } catch (e) {
      setMsg({ kind: "err", title: "TideCloak refused the change request", text: collectErrorText(e), by: "quorum" });
    } finally {
      setBusy(null);
    }
  }

  async function approve(cr: ChangeRequest) {
    setBusy(`cr:${cr.id}`);
    setMsg(null);
    try {
      if (SIM) {
        const ok = await simEnclave({ title: "Approve this change request?", lines: [`${cr.actionType.replace(/_/g, " ").toLowerCase()}: ${describeCr(cr)}`, `Needs ${cr.threshold ?? threshold ?? 1} approvals; each admin counts once`], approveLabel: "Approve" });
        if (!ok) throw new Error("You denied the request in the Tide enclave.");
      }
      const first = await adminApi<{ mode?: string; requestModel?: string; committed?: boolean; authCount?: number; threshold?: number }>(`/iga/change-requests/${cr.id}/approve`, {
        method: "POST",
        body: {},
      });
      let result = first;
      if (first.mode === "needs-approval" && first.requestModel) {
        const bytes = b64ToBytes(first.requestModel);
        let tideId = cr.id;
        try {
          tideId = Models.BaseTideRequest.decode(bytes).getUniqueId();
        } catch {
          /* fall back to the change-request id */
        }
        const [res] = await approveTideRequests([{ id: tideId, request: bytes }]);
        if (!res?.approved) throw new Error(res?.denied ? "You denied the request in the Tide enclave." : "The Tide enclave did not return an approval.");
        result = await adminApi(`/iga/change-requests/${cr.id}/approve`, { method: "POST", body: { requestModel: bytesToB64(res.approved.request) } });
      }
      setMsg(
        result.committed
          ? { kind: "ok", title: "Quorum reached", text: "TideCloak committed the change request. It is now in effect.", by: "quorum" }
          : { kind: "ok", title: `Approval recorded: ${result.authCount ?? "?"} of ${result.threshold ?? "?"}`, text: "Not in effect yet. Another security admin must approve in their own Tide enclave.", by: "quorum" },
      );
      await load();
    } catch (e) {
      setMsg({ kind: "err", title: "Approval failed", text: `${collectErrorText(e)}\n\nYou can also approve in the TideCloak console.`, by: "quorum" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Governance"
        description="No single person holds the key. Who may encrypt or decrypt identities is written into policies signed by the Tide network, and the privileged roles those policies name change only through TideCloak's quorum."
        action={
          <a href={consoleUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-canvas">
            TideCloak console <ExternalLink className="size-3.5" strokeWidth={1.5} />
          </a>
        }
      />

      <Metrics
        items={[
          { label: "Tide realm admins", value: admins ? admins.length : "—", hint: admins ? admins.join(", ") : "visible to realm admins" },
          { label: "Approvals required", value: threshold ?? "—", hint: "max(1, ⌊admins × 0.7⌋), set by TideCloak" },
          { label: "Pending change requests", value: crs ? crs.filter((c) => c.status === "PENDING").length : "—" },
          { label: "Keys held by VEIL's server", value: "0", hint: "ciphertext and signed policies only" },
        ]}
      />

      {msg && (
        <Notice kind={msg.kind === "ok" ? "authorized" : "denied"} title={msg.title} by={msg.by} className="mb-6">
          {msg.kind === "ok" ? msg.text : <RawDetail label="Response">{msg.text}</RawDetail>}
        </Notice>
      )}

      {/* quorum */}
      <Card
        className="mb-6"
        title="Privileged changes"
        subtitle="Read live from TideCloak's IGA API with your own DPoP-bound token. These are TideCloak governance events, kept separate from VEIL's application log."
        action={
          <div className="flex items-center gap-2">
            <Enforcer by="quorum" />
            {isRealmAdmin && (
              <Button variant="ghost" size="sm" onClick={() => load()} title="Refresh">
                <RefreshCw className="size-3.5" strokeWidth={1.5} />
              </Button>
            )}
          </div>
        }
        flush
      >
        {!isRealmAdmin && <p className="p-4 text-sm text-ink-3">Visible to Tide realm admins.</p>}
        {isRealmAdmin && (
          <div className="flex flex-wrap items-end gap-3 border-b border-line-2 bg-canvas px-4 py-3">
            <label className="text-[13px] text-ink-3">
              Action
              <select className="mt-1 block h-8 rounded-md bg-surface px-2 text-sm text-ink ring-1 ring-line" value={privAction} onChange={(e) => setPrivAction(e.target.value as "grant" | "revoke")}>
                <option value="grant">Grant</option>
                <option value="revoke">Revoke</option>
              </select>
            </label>
            <label className="text-[13px] text-ink-3">
              Role
              <select className="mt-1 block h-8 rounded-md bg-surface px-2 text-sm text-ink ring-1 ring-line" value={privRole} onChange={(e) => setPrivRole(e.target.value)}>
                <option value={ROLE.officer}>veil-disclosure-officer</option>
                <option value={ROLE.decryptor}>_tide_decryptor</option>
                <option value={ROLE.realmAdmin}>tide-realm-admin</option>
              </select>
            </label>
            <label className="text-[13px] text-ink-3">
              {privAction === "grant" ? "to user" : "from user"}
              <select className="mt-1 block h-8 min-w-36 rounded-md bg-surface px-2 text-sm text-ink ring-1 ring-line" value={target} onChange={(e) => setTarget(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.username}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" busy={busy === "propose"} onClick={propose}>
              <FilePlus2 className="size-3.5" strokeWidth={1.5} /> File change request
            </Button>
          </div>
        )}
        {crErr && (
          <div className="px-4 pb-3">
            <ErrorText error={crErr} />
          </div>
        )}
        {isRealmAdmin && crs && crs.length === 0 && <p className="p-4 text-sm text-ink-3">No pending or recent change requests.</p>}
        {isRealmAdmin && crs && crs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Change</th>
                  <th className={th}>Detail</th>
                  <th className={th}>Approvals</th>
                  <th className={th}>Status</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {crs.map((cr) => {
                  const count = cr.authorizationCount ?? cr.authCount ?? (Array.isArray(cr.authorizers) ? cr.authorizers.length : 0);
                  const need = cr.threshold ?? threshold ?? 1;
                  return (
                    <tr key={cr.id} className={`${tr} align-top`}>
                      <td className={td}>
                        <p className="font-medium">{cr.actionType.replace(/_/g, " ").toLowerCase()}</p>
                        <p className="text-[13px] text-ink-4">{cr.entityType.toLowerCase()}</p>
                      </td>
                      <td className={`${td} max-w-[320px] text-[13px] break-words text-ink-2`}>{describeCr(cr)}</td>
                      <td className={td}>
                        <div className="flex items-center gap-1" aria-label={`${count} of ${need} approvals`}>
                          {Array.from({ length: Math.max(need, count) }, (_, i) => (
                            <span key={i} className={cx("h-1.5 w-5 rounded-full", i < count ? "bg-quorum" : "bg-line")} />
                          ))}
                          <span className="tabular ml-1.5 text-[13px] text-ink-3">
                            {count}/{need}
                          </span>
                        </div>
                        {Array.isArray(cr.authorizers) && cr.authorizers.length > 0 && (
                          <p className="mt-1 text-[13px] text-ink-3">{cr.authorizers.map((a) => a.username).filter(Boolean).join(", ")}</p>
                        )}
                      </td>
                      <td className={td}>
                        {cr.status === "APPROVED" ? <Badge tone="grant">Committed</Badge> : cr.readyToCommit ? <Badge tone="accent">Ready</Badge> : <Badge tone="warn">Awaiting quorum</Badge>}
                      </td>
                      <td className={`${td} text-right`}>
                        {cr.status === "PENDING" && (
                          <Button variant="secondary" size="sm" busy={busy === `cr:${cr.id}`} onClick={() => approve(cr)}>
                            <PenLine className="size-3.5" strokeWidth={1.5} /> Approve in enclave
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* policies */}
      <Card title="Campaign identity policies" subtitle="RelationshipAttestation:1, built into the Tide ORK network. The campaign ID is the record and the only tag." action={<Enforcer by="tide" />} flush>
        {campaigns.map((c, i) => (
          <div key={c.id} className={cx("grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]", i && "border-t border-line-2")}>
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <StageBadge stage={c.status} />
                <span className="font-mono text-xs text-ink-4">{c.id}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["write", "read"] as Purpose[]).map((purpose) => {
                const spec = CAMPAIGN_POLICY[purpose];
                const signed = c.policies[purpose];
                return (
                  <div key={purpose} className="flex flex-col rounded-md p-3 ring-1 ring-line">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{spec.label}</p>
                      {signed ? (
                        <Badge tone="seal" icon={Lock}>
                          Signed
                        </Badge>
                      ) : (
                        <Badge tone="warn">Not signed</Badge>
                      )}
                    </div>
                    <p className="mt-1 flex-1 text-[13px] leading-relaxed text-ink-3">{spec.explains}</p>
                    <p className="mt-2 font-mono text-xs text-ink-2">
                      Role:{spec.subject.id} · {spec.access}
                    </p>
                    {isRealmAdmin && (
                      <Button variant={signed ? "secondary" : "primary"} size="sm" className="mt-3" busy={busy === `${c.id}:${purpose}`} onClick={() => sign(c, purpose)}>
                        {signed ? "Re-sign in Tide enclave" : "Approve & sign in Tide enclave"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!isRealmAdmin && <p className="border-t border-line-2 px-4 py-3 text-[13px] text-ink-3">Only a Tide realm admin can approve a policy, in their own Tide enclave.</p>}
      </Card>

      {/* layers */}
      <div className="mt-6 grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line md:grid-cols-3">
        {[
          { by: "tide" as const, title: "Cryptographic", text: "Encrypting and decrypting identities: subject role, _tide_encryptor / _tide_decryptor, the single campaign tag and a signed policy, checked by every ORK on every request." },
          { by: "quorum" as const, title: "Quorum-governed", text: `Granting veil-disclosure-officer, adding realm admins, any role change: a change request that needs ${threshold ?? "the configured number of"} admin approvals in their Tide enclaves.` },
          { by: "veil" as const, title: "Application rules", text: "Campaign stages, reviewer assignment, score locks and disclosure requests. Enforced on the server, not cryptographic: they decide when ciphertext is released, not who can open it." },
        ].map((l) => (
          <div key={l.by} className="bg-surface p-4">
            <Enforcer by={l.by} />
            <p className="mt-3 text-sm font-semibold">{l.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-3">{l.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pull a readable summary out of a change request's rows (user, role, client names). */
function describeCr(cr: ChangeRequest): string {
  const parts: string[] = [];
  for (const row of cr.rows ?? []) {
    for (const k of ["USERNAME", "ROLE_NAME", "NAME", "CLIENT_ID", "ROLE_ID"]) {
      const v = row[k];
      if (typeof v === "string" && v && !parts.includes(v) && !/^[0-9a-f-]{36}$/.test(v)) parts.push(v);
    }
  }
  if (parts.length) return parts.slice(0, 4).join(" · ");
  for (const k of ["summary", "description", "entityName"]) {
    const v = cr[k];
    if (typeof v === "string" && v) return v.slice(0, 200);
  }
  return cr.id;
}
