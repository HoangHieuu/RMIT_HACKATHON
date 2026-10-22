"use client";

// One import point for the TideCloak React surface. In live mode these are the official
// @tidecloak/nextjs exports; in simulated mode (NEXT_PUBLIC_TIDE_MODE=simulated) they are the
// stand-ins from src/lib/sim/client. Screens import from here and never know the difference.
import { TideCloakProvider as LiveProvider, useAuthCallback as useLiveAuthCallback, useTideCloak as useLiveTideCloak } from "@tidecloak/nextjs";
import { SIM } from "@/lib/sim/mode";
import { SimTideCloakProvider, useSimAuthCallback, useSimTideCloak } from "@/lib/sim/client/provider";

export const TideCloakProvider = (SIM ? SimTideCloakProvider : LiveProvider) as unknown as typeof LiveProvider;
export const useTideCloak = (SIM ? useSimTideCloak : useLiveTideCloak) as unknown as typeof useLiveTideCloak;
export const useAuthCallback = (SIM ? useSimAuthCallback : useLiveAuthCallback) as unknown as typeof useLiveAuthCallback;
