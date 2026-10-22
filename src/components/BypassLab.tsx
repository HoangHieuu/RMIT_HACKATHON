"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { decryptIdentity } from "@/lib/client/tide";
import { explainTideRefusal, collectErrorText } from "@/lib/veil";
import { Button, Notice, RawDetail, type EnforcerKind } from "./ui";

type Out = { kind: "denied" | "authorized" | "info"; title: string; body: string; by: EnforcerKind } | null;

/**
 * Two honest attempts to reveal a candidate's identity from a non-authorised account:
 *  1. Ask VEIL's API (application rule refuses).
 *  2. Skip VEIL entirely: take the leaked ciphertext + signed policy and ask the Tide network.
 *     The ORKs check this user's own credential against the policy and refuse.
 */
export function BypassLab({ submissionId }: { submissionId: string }) {
  const api = useApi();
  const [a, setA] = useState<Out>(null);
  const [b, setB] = useState<Out>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function viaVeil() {
    setBusy("a");
    try {
      await api(`/api/submissions/${submissionId}/identity`);
      setA({ kind: "authorized", title: "VEIL released the ciphertext", body: "Your account satisfies VEIL's disclosure conditions.", by: "veil" });
    } catch (e) {
      setA({ kind: "denied", title: "Access denied", body: collectErrorText(e), by: "veil" });
    } finally {
      setBusy(null);
    }
  }

  async function viaTide() {
    setBusy("b");
    setB({ kind: "info", title: "Asking the Tide network to decrypt…", body: "", by: "tide" });
    try {
      const kit = await api<{ encrypted: string; tags: string[]; policy: string; candidateId: string }>(`/api/security-lab/${submissionId}`);
      const id = await decryptIdentity(kit.encrypted, kit.tags[0], kit.policy);
      api("/api/audit", { method: "POST", body: { action: "tide.decrypt.succeeded", target: kit.candidateId, detail: "security lab" } }).catch(() => {});
      setB({ kind: "authorized", title: "Decrypted: this account IS authorised by the Tide network", body: `${id.fullName} · ${id.university}`, by: "tide" });
    } catch (e) {
      const r = explainTideRefusal(e);
      api("/api/audit", { method: "POST", body: { action: "tide.decrypt.refused", target: submissionId, detail: r.detail.slice(0, 200) } }).catch(() => {});
      setB({ kind: r.denied ? "denied" : "info", title: r.message, body: r.detail, by: "tide" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg ring-1 ring-line">
      <header className="flex items-start gap-3 border-b border-line-2 px-4 py-3">
        <FlaskConical className="mt-0.5 size-4 text-ink-3" strokeWidth={1.5} />
        <div>
          <h2 className="text-[13px] font-semibold">Security test: try to reveal this candidate</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Hiding the name in the interface is not what protects it. Try both routes.</p>
        </div>
      </header>
      <div className="divide-y divide-line-2">
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">1 · Ask VEIL for the identity</p>
              <p className="text-xs text-ink-3">The normal API route, with your verified token.</p>
            </div>
            <Button variant="secondary" busy={busy === "a"} onClick={viaVeil}>
              Request identity
            </Button>
          </div>
          {a && (
            <Notice kind={a.kind} title={a.title} by={a.by} className="mt-3">
              <span className="font-mono text-xs">{a.body}</span>
            </Notice>
          )}
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-md">
              <p className="text-[13px] font-medium">2 · Bypass VEIL completely</p>
              <p className="text-xs leading-relaxed text-ink-3">
                Simulates a malicious insider or compromised server: you receive the stored ciphertext <em>and</em> the signed decryption policy, then ask the Tide network directly.
              </p>
            </div>
            <Button variant="danger" busy={busy === "b"} onClick={viaTide}>
              Attempt decryption
            </Button>
          </div>
          {b && (
            <Notice kind={b.kind} title={b.title} by={b.by} className="mt-3">
              {b.kind === "denied" && <p>Every ORK checked your own credential against the campaign&apos;s signed policy, and refused.</p>}
              {b.body && (b.kind === "authorized" ? <p className="font-medium">{b.body}</p> : <RawDetail label="Response from the Tide network">{b.body}</RawDetail>)}
            </Notice>
          )}
        </div>
      </div>
    </section>
  );
}
