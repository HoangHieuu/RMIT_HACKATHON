// Key material of the SIMULATED realm and Tide network. Server-only.
// Generated on first use and kept in data/sim-keys.json (gitignored). Only the sim modules read it:
// VEIL's own routes never import this file.
import { generateKeyPair, exportJWK, type JWK } from "jose";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

export interface SimKeys {
  /** Signs access/id/refresh tokens (stands in for the Fabric-signed realm key). */
  realm: { priv: JWK; pub: JWK };
  /** Signs policies and the admin policy (stands in for the VVK). */
  fabric: { priv: JWK; pub: JWK };
  /** Root secret of the sim ORK. Per-tag encryption keys are derived from it. */
  ork: string;
}

const g = globalThis as unknown as { __simKeys?: Promise<SimKeys> };

async function pair(kid: string) {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const priv = { ...(await exportJWK(privateKey)), kid, alg: "ES256", use: "sig" };
  const pub = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };
  return { priv, pub };
}

async function load(): Promise<SimKeys> {
  const dir = join(process.cwd(), "data");
  const file = join(dir, "sim-keys.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")) as SimKeys;
  const keys: SimKeys = { realm: await pair("sim-realm-key"), fabric: await pair("sim-fabric-key"), ork: randomBytes(32).toString("base64") };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

export function simKeys(): Promise<SimKeys> {
  return (g.__simKeys ??= load());
}
