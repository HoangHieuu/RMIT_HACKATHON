// SIMULATED TideCloak mode. Off by default: VEIL talks to a real TideCloak + Tide network.
// `NEXT_PUBLIC_TIDE_MODE=simulated` (see scripts/dev-sim.mjs) swaps in the in-process stand-ins under
// src/lib/sim. The stand-ins enforce the same rules and return the same errors, but they are NOT
// the Tide network: no threshold cryptography, no decentralised nodes. Every screen says so.
export const SIM = process.env.NEXT_PUBLIC_TIDE_MODE === "simulated";

/** Fixed values shared by the simulated IdP, ORK and client. */
export const SIM_REALM = "veil";
export const SIM_CLIENT_ID = "veil-client";
export const SIM_VENDOR_ID = "sim-vendor";
/** `iss` of simulated tokens. A reserved .invalid host: nothing ever connects to it. */
export const SIM_ISSUER_BASE = "https://sim.tidecloak.invalid";
export const SIM_API_BASE = "/api/sim/auth";
export const SIM_ORK_BASE = "/api/sim/ork";
export const REALM_MGMT = "realm-management";
export const REALM_ADMIN_ROLE = "tide-realm-admin";
