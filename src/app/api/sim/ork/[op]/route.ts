// SIMULATED Tide ORK network. A refusal is HTTP 403 with the code the real SDK surfaces; the
// contract's own message is in `cause`, as it is on the real network.
import type { NextRequest } from "next/server";
import { authed, simOff } from "@/lib/sim/server/guard";
import { Refusal, decrypt, encrypt, signRelationship, type SimPolicy } from "@/lib/sim/server/ork";

type Ctx = { params: Promise<{ op: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const off = simOff();
  if (off) return off;
  let claims;
  try {
    claims = await authed(req);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
  const { op } = await ctx.params;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  try {
    if (op === "sign") return Response.json({ policy: await signRelationship(claims, b.policy as SimPolicy, String(b.adminPolicy ?? "")) });
    if (op === "encrypt") return Response.json({ results: await encrypt(claims, String(b.policy ?? ""), b.items as { data: string; tags: string[] }[]) });
    if (op === "decrypt") return Response.json({ results: await decrypt(claims, String(b.policy ?? ""), b.items as { encrypted: string; tags: string[] }[]) });
    return Response.json({ error: "Unknown operation" }, { status: 404 });
  } catch (e) {
    if (e instanceof Refusal) {
      return Response.json({ error: "TIDE-TIDEJS-NET-THRESHOLD_FAILURE", message: e.message, cause: e.reason, simulated: true }, { status: 403 });
    }
    return Response.json({ error: e instanceof Error ? e.message : "Simulated ORK error" }, { status: 500 });
  }
}
