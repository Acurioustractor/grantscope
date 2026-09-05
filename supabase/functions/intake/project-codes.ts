// GENERATED FILE — do not edit by hand.
// Source: act-global-infrastructure/config/project-codes.json
// Regenerate: supabase/functions/intake/regenerate-project-codes.py
//
// The canonical project registry, 74 codes. An intake submission carrying a
// projectCode absent from this map is rejected with 400 — it is never silently seated
// into a default project. That silent fallback (route.ts:289 in act-regenerative-studio)
// is what turned correct ACT-FM farm-stay submissions into project:act-in with the
// wrong comms list.
//
// commsSlug is pinned for the seven projects that have a live comms list today and
// derived from the code for the rest; a derived slug never reaches GHL because only
// the newsletter form type writes a comms: tag, and that only in the commerce lane.

export interface ProjectEntry {
  name: string;
  commsSlug: string;
}

export const PROJECT_CODES: ReadonlyMap<string, ProjectEntry> = new Map<string, ProjectEntry>([
  ['ACT-JH', { name: "JusticeHub", commsSlug: 'justicehub' }],
  ['ACT-DG', { name: "Diagrama", commsSlug: 'dg' }],
  ['ACT-GD', { name: "Goods", commsSlug: 'goods' }],
  ['ACT-EL', { name: "Empathy Ledger", commsSlug: 'empathy-ledger' }],
  ['ACT-CORE', { name: "ACT Regenerative Studio", commsSlug: 'core' }],
  ['ACT-PI', { name: "PICC", commsSlug: 'pi' }],
  ['ACT-ER', { name: "PICC Elders Room", commsSlug: 'er' }],
  ['ACT-PS', { name: "PICC On Country Photo Studio", commsSlug: 'ps' }],
  ['ACT-SS', { name: "Storm Stories", commsSlug: 'ss' }],
  ['ACT-MR', { name: "MingaMinga Rangers", commsSlug: 'mr' }],
  ['ACT-UA', { name: "Uncle Allan Palm Island Art", commsSlug: 'ua' }],
  ['ACT-MN', { name: "Maningrida", commsSlug: 'mn' }],
  ['ACT-FN', { name: "First Nations Youth Advocacy", commsSlug: 'fn' }],
  ['ACT-FM', { name: "The Farm", commsSlug: 'farm' }],
  ['ACT-HV', { name: "The Harvest Witta", commsSlug: 'harvest' }],
  ['ACT-CN', { name: "Contained", commsSlug: 'cn' }],
  ['ACT-FO', { name: "Fishers Oysters", commsSlug: 'fo' }],
  ['ACT-SM', { name: "SMART", commsSlug: 'sm' }],
  ['ACT-CF', { name: "The Confessional", commsSlug: 'cf' }],
  ['ACT-CM', { name: "CAMPFIRE", commsSlug: 'cm' }],
  ['ACT-GP', { name: "Gold Phone", commsSlug: 'gp' }],
  ['ACT-MD', { name: "ACT Monthly Dinners", commsSlug: 'md' }],
  ['ACT-QF', { name: "QFCC Empathy Ledger", commsSlug: 'qf' }],
  ['ACT-DD', { name: "Double Disadvantage", commsSlug: 'dd' }],
  ['ACT-BM', { name: "Bimberi", commsSlug: 'bm' }],
  ['ACT-AI', { name: "AIME", commsSlug: 'ai' }],
  ['ACT-JP', { name: "June's Patch", commsSlug: 'jp' }],
  ['ACT-RT', { name: "Redtape", commsSlug: 'rt' }],
  ['ACT-BG', { name: "BG Fit", commsSlug: 'bg' }],
  ['ACT-CS', { name: "Civic Scope", commsSlug: 'cs' }],
  ['ACT-MY', { name: "Mounty Yarns", commsSlug: 'my' }],
  ['ACT-TN', { name: "TOMNET", commsSlug: 'tn' }],
  ['ACT-10', { name: "10x10 Retreat", commsSlug: '10' }],
  ['ACT-CP', { name: "Community Capital", commsSlug: 'cp' }],
  ['ACT-CT', { name: "ConFit Pathways", commsSlug: 'ct' }],
  ['ACT-DL', { name: "DadLab", commsSlug: 'dl' }],
  ['ACT-SH', { name: "The Shed", commsSlug: 'sh' }],
  ['ACT-SE', { name: "SEFA Partnership", commsSlug: 'se' }],
  ['ACT-CE', { name: "Custodian First Economy", commsSlug: 'ce' }],
  ['ACT-AS', { name: "Art for Social Change", commsSlug: 'art' }],
  ['ACT-RA', { name: "Regional Arts Fellowship", commsSlug: 'ra' }],
  ['ACT-WJ', { name: "Wilya Janta", commsSlug: 'wj' }],
  ['ACT-YC', { name: "YAC Story and Action", commsSlug: 'yc' }],
  ['ACT-TW', { name: "Travelling Women's Car", commsSlug: 'tw' }],
  ['ACT-HS', { name: "Project Her-Self", commsSlug: 'hs' }],
  ['ACT-DH', { name: "Deadly Homes and Gardens", commsSlug: 'dh' }],
  ['ACT-MM', { name: "MMEIC Justice", commsSlug: 'mm' }],
  ['ACT-MU', { name: "Murrup + ACT", commsSlug: 'mu' }],
  ['ACT-OO', { name: "Oonchiumpa", commsSlug: 'oo' }],
  ['ACT-CA', { name: "Caring for those who care", commsSlug: 'ca' }],
  ['ACT-MC', { name: "Cars and Microcontrollers", commsSlug: 'mc' }],
  ['ACT-BR', { name: "ACT Bali Retreat", commsSlug: 'br' }],
  ['ACT-BB', { name: "Barkly Backbone", commsSlug: 'bb' }],
  ['ACT-JC', { name: "JusticeHub Centre of Excellence", commsSlug: 'jc' }],
  ['ACT-TR', { name: "Treacher", commsSlug: 'tr' }],
  ['ACT-DO', { name: "Designing for Obsolescence", commsSlug: 'do' }],
  ['ACT-GL', { name: "Global Laundry Alliance", commsSlug: 'gl' }],
  ['ACT-CC', { name: "ACT Conservation Collective", commsSlug: 'cc' }],
  ['ACT-FP', { name: "Fairfax PLACE Tech", commsSlug: 'fp' }],
  ['ACT-FA', { name: "Festival Activations", commsSlug: 'fa' }],
  ['ACT-SF', { name: "SAF Foundation", commsSlug: 'sf' }],
  ['ACT-SX', { name: "SXSW 2025", commsSlug: 'sx' }],
  ['ACT-WE', { name: "Westpac Summit 2025", commsSlug: 'we' }],
  ['ACT-RP', { name: "RPPP Stream Two", commsSlug: 'rp' }],
  ['ACT-OE', { name: "Olive Express", commsSlug: 'oe' }],
  ['ACT-OS', { name: "Orange Sky EL", commsSlug: 'os' }],
  ['ACT-IN', { name: "ACT Infrastructure", commsSlug: 'act' }],
  ['ACT-GCC', { name: "Global Community Connections", commsSlug: 'gcc' }],
  ['ACT-EFI', { name: "Economic Freedom Initiative", commsSlug: 'efi' }],
  ['ACT-FG', { name: "Feel Good Project", commsSlug: 'fg' }],
  ['ACT-CB', { name: "Marriage Celebrant", commsSlug: 'cb' }],
  ['ACT-GS', { name: "GrantScope (CivicGraph)", commsSlug: 'gs' }],
  ['ACT-PB', { name: "Place-Based Policy Lab", commsSlug: 'pb' }],
  ['ACT-DLB', { name: "Deadly Labs", commsSlug: 'dlb' }],
]);

/** The namespaced CRM tag for a project. Never a flat tag. */
export function projectTag(code: string): string {
  return `project:${code.trim().toLowerCase()}`;
}

export function isKnownProjectCode(code: string): boolean {
  return PROJECT_CODES.has((code ?? '').trim().toUpperCase());
}
