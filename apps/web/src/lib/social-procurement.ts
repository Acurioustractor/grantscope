/**
 * Social procurement policy reference — the demand-side rules that make
 * social/Indigenous enterprise supply worth money to a buyer.
 *
 * Used by the procurement tender-pack (policy insert), analyse
 * recommendations, and the public supplier finder.
 */

export type PolicyInsert = {
  jurisdiction: string;
  policy: string;
  url: string;
  summary: string;
  tender_text: string;
};

export const SOCIAL_PROCUREMENT_POLICIES: Record<string, PolicyInsert> = {
  VIC: {
    jurisdiction: 'VIC',
    policy: "Victoria's Social Procurement Framework (SPF)",
    url: 'https://www.buyingfor.vic.gov.au/social-procurement-framework',
    summary:
      'Mandatory for Victorian Government procurement. Contracts over $20M require Social Procurement Plans; social and sustainable outcomes are weighted in tender evaluation (commonly 5-15%).',
    tender_text:
      "This procurement supports Victoria's Social Procurement Framework objectives, including opportunities for Victorian social enterprises and Aboriginal businesses. Suppliers listed hold public delivery evidence compiled by CivicGraph from AusTender and public registries.",
  },
  QLD: {
    jurisdiction: 'QLD',
    policy: 'Buy Queensland procurement policy + Queensland Indigenous Procurement Policy',
    url: 'https://www.epw.qld.gov.au/about/strategy/buy-qld',
    summary:
      'Buy Queensland weights local benefits in evaluation. The Queensland Indigenous Procurement Policy targets 3% of addressable spend to Indigenous businesses.',
    tender_text:
      'This procurement supports Buy Queensland local-benefit objectives and the Queensland Indigenous Procurement Policy 3% target. Suppliers listed hold public delivery evidence compiled by CivicGraph from AusTender and public registries.',
  },
  NSW: {
    jurisdiction: 'NSW',
    policy: 'NSW Social Enterprise Policy + Aboriginal Procurement Policy',
    url: 'https://www.buy.nsw.gov.au/policy-library',
    summary:
      'NSW agencies can directly engage social enterprises for procurements under $150K. The Aboriginal Procurement Policy targets a minimum 3% of addressable spend.',
    tender_text:
      'This procurement supports the NSW Social Enterprise Policy (direct engagement available under $150K) and the NSW Aboriginal Procurement Policy 3% target. Suppliers listed hold public delivery evidence compiled by CivicGraph from AusTender and public registries.',
  },
  SA: {
    jurisdiction: 'SA',
    policy: 'South Australian Industry Participation Policy (SAIPP) + Economic and Social Procurement Guideline',
    url: 'https://www.industryadvocate.sa.gov.au/policy-and-resources/south-australian-industry-participation-policy',
    summary:
      'SAIPP (Office of the Industry Advocate) mandates a minimum 20% tender-evaluation weighting for economic contribution to SA via Industry Participation Plans. SA has no mandated social-enterprise weighting — SE outcomes are applied at agency discretion under Procurement SA’s Economic and Social Procurement Guideline. Aboriginal businesses can be directly engaged up to $550K, with an across-government target of at least 0.5% of spend.',
    tender_text:
      'This procurement supports the South Australian Industry Participation Policy (minimum 20% evaluation weighting for SA economic contribution) and the Economic and Social Procurement Guideline. Aboriginal-owned suppliers may be eligible for direct engagement up to $550K. Suppliers listed hold public delivery evidence compiled by CivicGraph from AusTender and public registries.',
  },
  FEDERAL: {
    jurisdiction: 'Federal',
    policy: 'Indigenous Procurement Policy (IPP)',
    url: 'https://www.niaa.gov.au/indigenous-affairs/economic-development/indigenous-procurement-policy-ipp',
    summary:
      'Commonwealth portfolios carry annual Indigenous procurement targets (3% of new contracts by volume) with mandatory set-aside checks; Supply Nation Indigenous Business Direct is the first port of call.',
    tender_text:
      'This procurement supports Commonwealth Indigenous Procurement Policy targets. Indigenous-registered suppliers listed are drawn from public registries (Supply Nation, ORIC) with delivery evidence compiled by CivicGraph from AusTender.',
  },
};

/** Pick the policy inserts relevant to a set of states (always includes Federal). */
export function policyInsertsForStates(states: string[]): PolicyInsert[] {
  const wanted = new Set(states.map((s) => s.toUpperCase()));
  const inserts = Object.values(SOCIAL_PROCUREMENT_POLICIES).filter(
    (p) => p.jurisdiction === 'Federal' || wanted.has(p.jurisdiction),
  );
  // Federal last — state policy is usually the operative one
  return inserts.sort((a, b) => (a.jurisdiction === 'Federal' ? 1 : 0) - (b.jurisdiction === 'Federal' ? 1 : 0));
}
