"use client";

import { useSyncExternalStore } from "react";
import type { IdentityPayload } from "../veil";

// Decrypted identities live ONLY in this tab's memory. Never persisted, never sent to the server.
let store: Record<string, IdentityPayload> = {};
const listeners = new Set<() => void>();

export function useRevealed() {
  const revealed = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => store,
  );
  return {
    revealed,
    reveal(candidateId: string, id: IdentityPayload) {
      store = { ...store, [candidateId]: id };
      listeners.forEach((l) => l());
    },
  };
}
