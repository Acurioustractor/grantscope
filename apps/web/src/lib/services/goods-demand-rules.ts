// No imports on purpose: the Goods app's scripts (Goods Asset Register v2/scripts/pull-procurement.mjs)
// load this file straight from the grantscope checkout with Node's type stripping, so both repos
// classify contracts with one set of rules. Keep it to erasable TypeScript: no enums, no namespaces.

// Who buys beds, mattresses and whitegoods for people in communities. Two halves:
//  1. Government purchases on record (austender_contracts, state_tenders), classified by title.
//  2. Community organisations shaped like the ones already buying from Goods (health services,
//     hostels, homeland schools, councils, stores, housing), found by role in remote Australia.
// Vetted by hand on 2026-09-24: title keywords alone are mostly noise (roadside "furniture",
// "4 x 2 bed dwellings", hospital beds, garden beds, reno mattresses), so every rule below exists
// because a false match was seen. Custodial buyers are kept apart: whether Goods sells into prisons
// and youth detention is Ben's call, and the page never mixes them into the main list.

export type PurchaseKind = 'household' | 'custodial';

const WANTED = /mattress|\bbeds?\b|bedding|bunk ?beds?|whitegoods?|white goods|washing machines?|dryers?|fridges?|refrigerators?|household (furniture|goods|items)|appliances/i;

const NOT_A_BED = new RegExp(
  [
    'hospital', 'patient', '\\bicu\\b', 'birthing', 'bariatric', 'medical', 'clinical', 'examination', 'ward',
    'palliative', 'aged care', 'neuro', 'psychiatr', 'surgical', 'intensive', 'stryker', '\\bcots\\b', 'women.?s and children',
    'demolition', 'construct', 'flat ?bed', 'hill-?rom', 'smart ?care', 'centrella', 'electric beds', 'bed lights',
    'waterhole', 'gorge', 'mental health beds', 'bed mover', 'bed bay', 'overbed',
    'road', 'aerodrome', 'airfield', 'guardrail', 'garden', 'sludge', 'digester', 'reno ?mattress', 'fossil',
    'lake bed', 'stable bedding', 'embedding',
    'dwelling', 'bedroom', 'bedsit', '\\d+ ?x ?\\d+ ?bed', '\\d+ bed (quick|modular|unit|facility)',
    'office', 'workstation', 'laboratory', 'vaccine', 'freezers? and', 'fridge filling', 'recycling',
  ].join('|'),
  'i',
);

const CUSTODIAL = /correct|prison|custod|detention|youth justice|secure care|cell mattress|watch ?house|police|work camp|\bAMC\b/i;

/** household = beds and whitegoods for people to live with; custodial = prisons, detention, watch houses. */
export function classifyPurchase(title: string, buyer: string): PurchaseKind | null {
  if (!WANTED.test(title) || NOT_A_BED.test(title)) return null;
  return CUSTODIAL.test(`${title} ${buyer}`) ? 'custodial' : 'household';
}

export type CommunityRole =
  | 'health service' | 'hostel / accommodation' | 'housing' | 'council' | 'homelands / resource centre'
  | 'aged, women and youth' | 'community store' | 'school';

// Order matters: first match wins. Built from the buyers Goods already has (Anyinginyi and Miwatj
// health, Aboriginal Hostels, Homeland School Company, Centrecorp).
export const ROLES: [CommunityRole, RegExp][] = [
  ['health service', /health|medical|clinic|nganampa|miwatj|anyinginyi|sunrise|wurli|katherine west/i],
  ['hostel / accommodation', /hostel|accommodation|lodge/i],
  ['housing', /housing|\bhomes\b/i],
  ['council', /regional council|shire|aboriginal council|community council/i],
  ['homelands / resource centre', /resource cent|homeland|outstation/i],
  ['aged, women and youth', /\baged\b|elder|women.?s cent|safe house|night patrol|youth/i],
  ['community store', /\bstores?\b|\bALPA\b|arnhem land progress/i],
  ['school', /school|college|education/i],
];

export function communityRole(name: string): CommunityRole | null {
  for (const [role, re] of ROLES) if (re.test(name)) return role;
  return null;
}

