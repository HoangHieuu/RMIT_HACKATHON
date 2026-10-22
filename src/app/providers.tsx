"use client";

import type { ComponentProps } from "react";
import { TideCloakProvider } from "@/lib/tc";
// next.config.ts aliases @tide-config to data/tidecloak.json (live) or data/tidecloak.sim.json (simulated).
import tcConfig from "@tide-config";

type Config = ComponentProps<typeof TideCloakProvider>["config"];

// Playbook: add-auth-nextjs-fresh Step 4a
// useDPoP goes inside config object (not as a separate JSX prop).
// Enables client-side DPoP proof generation (required for secureFetch).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TideCloakProvider
      config={{ ...(tcConfig as unknown as Config), useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      {children}
    </TideCloakProvider>
  );
}
