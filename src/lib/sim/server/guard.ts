import type { NextRequest } from "next/server";
import type { JWTPayload } from "jose";
import { extractToken, verifyTideJWT } from "@/lib/auth/tideJWT";
import { verifyDpop } from "@/lib/auth/verifyDpop";
import { SIM } from "../mode";

/** The sim endpoints must not exist outside simulated mode. */
export const simOff = () => (SIM ? null : Response.json({ error: "Simulated TideCloak is disabled (NEXT_PUBLIC_TIDE_MODE is not 'simulated')" }, { status: 404 }));

/** Same checks VEIL applies to its own API: token signature/issuer/azp/expiry, then the DPoP proof. */
export async function authed(req: NextRequest): Promise<JWTPayload> {
  const token = extractToken(req.headers.get("authorization"));
  const jwt = await verifyTideJWT(token);
  await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } });
  return jwt;
}
