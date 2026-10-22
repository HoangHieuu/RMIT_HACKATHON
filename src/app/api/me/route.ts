import { route } from "@/lib/server/session";
import { ROLE } from "@/lib/veil";

// Who am I, according to the VERIFIED token (not the database).
export const GET = route(async (_req, p) => {
  return Response.json({
    sub: p.sub,
    username: p.username,
    hasTideKey: !!p.tideUserKey,
    roles: p.roles.filter((r) => r.startsWith("veil-") || r.startsWith("_tide_") || r === ROLE.realmAdmin),
    capabilities: {
      apply: p.has(ROLE.applicant),
      evaluate: p.has(ROLE.evaluator),
      manageCampaigns: p.has(ROLE.orgAdmin),
      disclose: p.has(ROLE.officer),
      governRealm: p.has(ROLE.realmAdmin),
      tideEncryptor: p.has(ROLE.encryptor),
      tideDecryptor: p.has(ROLE.decryptor),
    },
  });
});
