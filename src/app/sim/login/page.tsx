"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SIM } from "@/lib/sim/mode";
import { SIM_PERSONAS } from "@/lib/sim/personas";
import { simLogin } from "@/lib/sim/client/session";

// Sign-in for SIMULATED TideCloak: pick one of the four demo accounts. No password, no Tide enclave.
function Picker() {
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = params.get("returnUrl");
  const target = back && back.startsWith("/") && !back.startsWith("//") ? back : "/app";

  if (!SIM) return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-sm text-ink-3">Simulated sign-in is disabled.</main>;

  async function go(username: string) {
    setBusy(username);
    setError(null);
    try {
      await simLogin(username);
      window.location.assign(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <section className="w-full max-w-[640px] rounded-[24px] bg-surface p-7 shadow-[var(--shadow-window)] ring-1 ring-line sm:p-10">
        <p className="text-[13px] font-semibold tracking-[0.13em] text-ink-3 uppercase">Simulated TideCloak</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">Choose a demo account</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          The Tide network is not involved. Tokens, roles, change requests and encryption come from VEIL&apos;s in-process stand-ins, which follow the same rules as the real realm.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SIM_PERSONAS.map((p) => (
            <button
              key={p.username}
              onClick={() => go(p.username)}
              disabled={!!busy}
              className="rounded-xl p-4 text-left ring-1 ring-line transition-colors hover:bg-canvas disabled:opacity-60"
            >
              <span className="block font-mono text-sm font-semibold text-ink">{p.username}</span>
              <span className="mt-0.5 block text-[13px] font-medium text-ink-2">{p.title}</span>
              <span className="mt-2 block text-[13px] leading-relaxed text-ink-3">{busy === p.username ? "Signing in…" : p.does}</span>
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-deny">{error}</p>}
      </section>
    </main>
  );
}

export default function SimLogin() {
  return (
    <Suspense>
      <Picker />
    </Suspense>
  );
}
