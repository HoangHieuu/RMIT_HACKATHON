"use client";

import { SIM } from "@/lib/sim/mode";

/** Always-visible label: simulated runs must never pass for the real Tide network. */
export function SimBadge() {
  if (!SIM) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-3 left-3 z-[2147482000] rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-amber-900 shadow-sm ring-1 ring-amber-300"
    >
      SIMULATED TIDECLOAK · no Tide network
    </div>
  );
}
