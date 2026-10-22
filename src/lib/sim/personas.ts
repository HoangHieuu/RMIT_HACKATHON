// The four demo accounts, one per team member, as the real bootstrap (scripts/init-veil.sh) leaves
// them: three form the security committee (tide-realm-admin); the officer holds NO decrypt role
// until a 2-of-3 quorum grants veil-disclosure-officer.
export interface SimPersona {
  username: string;
  title: string;
  realmRoles: string[];
  realmAdmin: boolean;
  does: string;
}

export const SIM_PERSONAS: SimPersona[] = [
  { username: "applicant", title: "Applicant", realmRoles: [], realmAdmin: false, does: "Applies. Identity is encrypted under a write-only policy." },
  { username: "reviewer", title: "Evaluator", realmRoles: ["veil-evaluator"], realmAdmin: true, does: "Scores anonymous work. Security admin, yet refused when it tries to decrypt." },
  { username: "hr-lead", title: "Organisation admin", realmRoles: ["veil-org-admin"], realmAdmin: true, does: "Runs the campaign, files the officer grant. Cannot complete it alone." },
  { username: "officer", title: "Disclosure officer (after quorum)", realmRoles: [], realmAdmin: true, does: "Reveals identities only after 2 of 3 admins approve the role." },
];
