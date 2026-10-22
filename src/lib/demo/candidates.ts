// SYNTHETIC demo candidates. Fictional people, fictional emails on the reserved .invalid TLD.
import type { IdentityPayload } from "../veil";

export interface DemoCandidate {
  label: string;
  identity: IdentityPayload;
  title: string;
  work: string;
  skills: string;
}

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    label: "Strong answer · regional university",
    identity: { fullName: "Linh Tran", email: "linh.tran@candidate.invalid", university: "Federation University", phone: "0400 000 101" },
    title: "Margin leak is in the afternoon, not the beans",
    skills: "Excel modelling, cohort analysis, two internships in retail operations analytics.",
    work: `Diagnosis. Gross margin fell from 64% to 57% over four quarters while bean costs rose only 3%. Splitting sales by hour shows 2pm-5pm revenue is down 31%, but labour in that window is unchanged (roster is fixed at 4 staff). Labour as a share of afternoon revenue went from 28% to 41%. That single window explains ~5 of the 7 points lost.

Evidence. Morning (6-11am) margin is stable at 66%. Food waste rose from 4% to 9% of food sales, concentrated in pastries baked for afternoon demand that no longer exists.

Recommendation. Move to a demand-based roster (3 staff 2-5pm in the 9 lowest-traffic stores) and bake afternoon pastry to order using the morning sales signal. Expected impact: +3.8 pts margin from labour, +1.2 pts from waste, ~A$410k annualised across 22 stores, payback inside one quarter. Risk: service times at peak-afternoon stores, so pilot in 4 stores for 6 weeks with a 3-minute wait-time guardrail.`,
  },
  {
    label: "Solid answer · Group of Eight university",
    identity: { fullName: "Oliver Bennett", email: "oliver.bennett@candidate.invalid", university: "University of Melbourne", phone: "0400 000 202" },
    title: "Raise prices on specialty drinks",
    skills: "Financial statement analysis, valuation coursework, investment society treasurer.",
    work: `The chain's margin decline is mainly driven by input costs and competition. Coffee bean prices are up and two new competitors opened nearby, which has pressured pricing.

I looked at the revenue mix: specialty drinks are 35% of revenue but have the highest perceived value. A 6% price rise on specialty drinks, assuming elasticity of -0.8, would lift revenue by about 1.1% and margin by roughly 2 points.

Recommendation: implement the price rise across all stores next quarter and monitor volumes monthly. Secondary: renegotiate the bean supply contract. Risk: customers may switch to competitors, but loyalty-card data suggests a core of regulars.`,
  },
  {
    label: "Weaker answer · international student",
    identity: { fullName: "Aisha Rahman", email: "aisha.rahman@candidate.invalid", university: "RMIT University", phone: "0400 000 303" },
    title: "Cut costs across the board",
    skills: "Data visualisation, customer-service background, CFA Level I candidate.",
    work: `The company should reduce costs because margins are falling. Costs that could be reduced include rent, staff, marketing and ingredients.

A 10% cut in all costs would bring the margin back to where it was. The company could also open new stores to grow revenue and spread fixed costs.

Recommendation: start a cost-reduction programme and review results after one year.`,
  },
];
