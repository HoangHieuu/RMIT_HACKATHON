"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/client/api";
import { Badge, Card, Enforcer, PageHeader, cx, td, th, tr, type EnforcerKind } from "@/components/ui";

/** Which layer decided the event, derived from fields the API already returns. */
function layerOf(e: { action: string; source: string }): EnforcerKind {
  // Every event VEIL records with source "tidecloak" is a Tide network operation (policy signing,
  // client-reported encrypt/decrypt results). Quorum events live in TideCloak, on the Governance page.
  if (e.source === "tidecloak" || e.action.startsWith("tide.")) return "tide";
  return "veil";
}

interface Event {
  id: string;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: "ok" | "denied" | "error";
  detail: string | null;
  source: "app" | "tidecloak";
  timestamp: string;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "denied", label: "Denied" },
  { id: "tidecloak", label: "Tide" },
] as const;

export default function AuditPage() {
  const api = useApi();
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  useEffect(() => {
    api<{ events: Event[] }>("/api/audit").then((r) => setEvents(r.events));
  }, [api]);

  const shown = events.filter((e) => (filter === "all" ? true : filter === "denied" ? e.outcome === "denied" : e.source === "tidecloak"));

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Application events recorded by VEIL. No names, emails, ciphertext or tokens are ever written here. Tide entries are client-reported outcomes of network operations; TideCloak's own governance record lives on the Governance page."
        action={
          <div role="tablist" className="flex gap-0.5 rounded-md bg-canvas p-0.5 ring-1 ring-line">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cx("h-7 rounded px-3 text-sm", filter === f.id ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(12_26_46/0.08)]" : "text-ink-3 hover:text-ink")}
              >
                {f.label}
                <span className="tabular ml-1.5 text-ink-3">
                  {f.id === "all" ? events.length : f.id === "denied" ? events.filter((e) => e.outcome === "denied").length : events.filter((e) => e.source === "tidecloak").length}
                </span>
              </button>
            ))}
          </div>
        }
      />
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Actor</th>
                <th className={th}>Action</th>
                <th className={th}>Target</th>
                <th className={th}>Outcome</th>
                <th className={th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className={`${tr} align-top`}>
                  <td className={`${td} tabular whitespace-nowrap text-ink-3`}>{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className={`${td} font-medium`}>{e.actor_name ?? "—"}</td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Enforcer by={layerOf(e)} compact />
                      <span className="font-mono text-[13px]">{e.action}</span>
                    </div>
                  </td>
                  <td className={`${td} font-mono text-[13px] text-ink-2`}>{e.target_id ?? "—"}</td>
                  <td className={td}>
                    <Badge tone={e.outcome === "ok" ? "grant" : e.outcome === "denied" ? "deny" : "warn"}>{e.outcome}</Badge>
                  </td>
                  <td className={`${td} max-w-sm text-[13px] break-words text-ink-3`}>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="border-t border-line-2 px-4 py-8 text-center text-sm text-ink-3">No events match this filter.</p>}
        </div>
      </Card>
    </div>
  );
}
