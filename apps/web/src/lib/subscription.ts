/**
 * CivicGraph subscription tier system.
 *
 * Modules are gated by tier. Enterprise unlocks everything.
 * The tier name is stored on org_profiles.subscription_plan.
 */

export type Tier = 'community' | 'professional' | 'organisation' | 'funder' | 'enterprise';

export type Module =
  | 'grants'           // Grant search, AI matching, alerts
  | 'tracker'          // Pipeline/kanban, foundation relationship CRM
  | 'procurement'      // Tender Intelligence — discovery, enrichment, packs
  | 'supply-chain'     // Goods Intelligence — community economics, corridor analysis
  | 'allocation'       // Place packs, gap analysis, commissioning
  | 'research'         // Reports, investigations, entity graph
  | 'relationships'    // Relationship Flywheel — contact→entity linkage, warm paths, playbooks
  | 'governed-proof'   // Outcome evidence, community voice (pilot)
  | 'api';             // Programmatic access

export type AlertFrequency = 'daily' | 'weekly' | 'monthly';

export interface AlertEntitlements {
  maxAlerts: number;
  frequencies: AlertFrequency[];
  weeklyDigest: boolean;
}

/** Which tier unlocks which modules */
const TIER_MODULES: Record<Tier, Module[]> = {
  community:     ['grants', 'research'],
  professional:  ['grants', 'tracker', 'research'],
  organisation:  ['grants', 'tracker', 'procurement', 'allocation', 'research', 'relationships'],
  funder:        ['grants', 'tracker', 'procurement', 'allocation', 'research', 'relationships', 'api'],
  enterprise:    ['grants', 'tracker', 'procurement', 'supply-chain', 'allocation', 'research', 'relationships', 'governed-proof', 'api'],
};

const TIER_ORDER: Tier[] = ['community', 'professional', 'organisation', 'funder', 'enterprise'];

const TIER_ALERTS: Record<Tier, AlertEntitlements> = {
  community: {
    maxAlerts: 1,
    frequencies: ['weekly'],
    weeklyDigest: false,
  },
  professional: {
    maxAlerts: 10,
    frequencies: ['daily', 'weekly', 'monthly'],
    weeklyDigest: true,
  },
  organisation: {
    maxAlerts: 25,
    frequencies: ['daily', 'weekly', 'monthly'],
    weeklyDigest: true,
  },
  funder: {
    maxAlerts: 100,
    frequencies: ['daily', 'weekly', 'monthly'],
    weeklyDigest: true,
  },
  enterprise: {
    maxAlerts: 1000,
    frequencies: ['daily', 'weekly', 'monthly'],
    weeklyDigest: true,
  },
};

export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

export function hasModule(tier: Tier, module: Module): boolean {
  return TIER_MODULES[tier].includes(module);
}

export function getModules(tier: Tier): Module[] {
  return TIER_MODULES[tier];
}

export function getAlertEntitlements(tier: Tier): AlertEntitlements {
  return TIER_ALERTS[tier];
}

/** Minimum tier required for a module */
export function minimumTier(module: Module): Tier {
  for (const tier of TIER_ORDER) {
    if (TIER_MODULES[tier].includes(module)) return tier;
  }
  return 'enterprise';
}

/** Human-readable labels */
export const TIER_LABELS: Record<Tier, string> = {
  community: 'Community',
  professional: 'Professional',
  organisation: 'Organisation',
  funder: 'Funder',
  enterprise: 'Enterprise',
};

export const MODULE_LABELS: Record<Module, string> = {
  grants: 'Grants',
  tracker: 'Grant Tracker',
  procurement: 'Procurement Intelligence',
  'supply-chain': 'Supply Chain Intelligence',
  allocation: 'Allocation Intelligence',
  research: 'Research & Data',
  relationships: 'Relationship Intelligence',
  'governed-proof': 'Governed Proof',
  api: 'API Access',
};

/**
 * Determine effective tier from org_profiles.subscription_plan.
 * Falls back to 'community' (free).
 */
export function resolveSubscriptionTier(plan: string | null | undefined): Tier {
  if (!plan) return 'community';
  const normalised = plan.toLowerCase().trim();
  if (TIER_ORDER.includes(normalised as Tier)) return normalised as Tier;
  return 'community';
}
