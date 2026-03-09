/**
 * Agent Registry — canonical map of all GrantScope data agents.
 *
 * Each entry: { command, displayName, category, defaultPriority, timeoutMs, dependencies }
 *
 * Categories: sync, discovery, enrichment, profiling, graph, embedding, analytics, import
 */

export const AGENTS = {
  // ── Sync (external source mirrors) ──────────────────────────────────────────
  'sync-acnc-charities': {
    command: ['node', '--env-file=.env', 'scripts/sync-acnc-charities.mjs'],
    displayName: 'Sync ACNC Charities',
    category: 'sync',
    defaultPriority: 3,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'sync-acnc-register': {
    command: ['node', '--env-file=.env', 'scripts/sync-acnc-register.mjs'],
    displayName: 'Sync ACNC Register',
    category: 'sync',
    defaultPriority: 3,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'sync-oric-corporations': {
    command: ['node', '--env-file=.env', 'scripts/sync-oric-corporations.mjs'],
    displayName: 'Sync ORIC Corporations',
    category: 'sync',
    defaultPriority: 3,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'sync-austender-contracts': {
    command: ['node', '--env-file=.env', 'scripts/sync-austender-contracts.mjs'],
    displayName: 'Sync AusTender Contracts',
    category: 'sync',
    defaultPriority: 3,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'sync-ato-tax-transparency': {
    command: ['node', '--env-file=.env', 'scripts/sync-ato-tax-transparency.mjs'],
    displayName: 'Sync ATO Tax Transparency',
    category: 'sync',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'sync-asx-companies': {
    command: ['node', '--env-file=.env', 'scripts/sync-asx-companies.mjs'],
    displayName: 'Sync ASX Companies',
    category: 'sync',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'sync-asic-companies': {
    command: ['node', '--env-file=.env', 'scripts/sync-asic-companies.mjs'],
    displayName: 'Sync ASIC Companies',
    category: 'sync',
    defaultPriority: 5,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'sync-foundation-programs': {
    command: ['node', '--env-file=.env', 'scripts/sync-foundation-programs.mjs'],
    displayName: 'Sync Foundation Programs',
    category: 'sync',
    defaultPriority: 4,
    timeoutMs: 120_000,
    dependencies: [],
  },
  'sync-ghl-to-tracker': {
    command: ['node', '--env-file=.env', 'scripts/sync-ghl-to-tracker.mjs'],
    displayName: 'Sync GHL to Tracker',
    category: 'sync',
    defaultPriority: 5,
    timeoutMs: 120_000,
    dependencies: [],
  },

  // ── Import (one-off or periodic bulk loads) ─────────────────────────────────
  'import-aec-donations': {
    command: ['node', '--env-file=.env', 'scripts/import-aec-donations.mjs'],
    displayName: 'Import AEC Donations',
    category: 'import',
    defaultPriority: 3,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'import-oric-register': {
    command: ['node', '--env-file=.env', 'scripts/import-oric-register.mjs'],
    displayName: 'Import ORIC Register',
    category: 'import',
    defaultPriority: 3,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-acnc-financials': {
    command: ['node', '--env-file=.env', 'scripts/import-acnc-financials.mjs'],
    displayName: 'Import ACNC Financials',
    category: 'import',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'import-rogs-justice': {
    command: ['node', '--env-file=.env', 'scripts/import-rogs-justice.mjs'],
    displayName: 'Import ROGS Justice',
    category: 'import',
    defaultPriority: 4,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-seifa-postcodes': {
    command: ['node', '--env-file=.env', 'scripts/import-seifa-postcodes.mjs'],
    displayName: 'Import SEIFA Postcodes',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 120_000,
    dependencies: [],
  },
  'import-social-traders': {
    command: ['node', '--env-file=.env', 'scripts/import-social-traders.mjs'],
    displayName: 'Import Social Traders',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-bcorp-au': {
    command: ['node', '--env-file=.env', 'scripts/import-bcorp-au.mjs'],
    displayName: 'Import B Corp AU',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-state-se-networks': {
    command: ['node', '--env-file=.env', 'scripts/import-state-se-networks.mjs'],
    displayName: 'Import State SE Networks',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-buyability': {
    command: ['node', '--env-file=.env', 'scripts/import-buyability.mjs'],
    displayName: 'Import Buyability',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-gov-procurement-se': {
    command: ['node', '--env-file=.env', 'scripts/import-gov-procurement-se.mjs'],
    displayName: 'Import Gov Procurement SE',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-indigenous-directories': {
    command: ['node', '--env-file=.env', 'scripts/import-indigenous-directories.mjs'],
    displayName: 'Import Indigenous Directories',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-modern-slavery': {
    command: ['node', '--env-file=.env', 'scripts/import-modern-slavery.mjs'],
    displayName: 'Import Modern Slavery Register',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-lobbying-register': {
    command: ['node', '--env-file=.env', 'scripts/import-lobbying-register.mjs'],
    displayName: 'Import Lobbying Register',
    category: 'import',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'import-gov-grants': {
    command: ['node', '--env-file=.env', 'scripts/import-gov-grants.mjs'],
    displayName: 'Import Gov Grants',
    category: 'import',
    defaultPriority: 3,
    timeoutMs: 600_000,
    dependencies: [],
  },

  // ── Discovery ───────────────────────────────────────────────────────────────
  'grantscope-discovery': {
    command: ['npx', 'tsx', 'scripts/grantscope-discovery.mjs'],
    displayName: 'Grant Discovery',
    category: 'discovery',
    defaultPriority: 2,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'discover-foundation-programs': {
    command: ['node', '--env-file=.env', 'scripts/discover-foundation-programs.mjs'],
    displayName: 'Discover Foundation Programs',
    category: 'discovery',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'scrape-state-grants': {
    command: ['node', '--env-file=.env', 'scripts/scrape-state-grants.mjs'],
    displayName: 'Scrape State Grants',
    category: 'discovery',
    defaultPriority: 3,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'run-scraping-agents': {
    command: ['node', '--env-file=.env', 'scripts/run-scraping-agents.mjs'],
    displayName: 'Run Scraping Agents',
    category: 'discovery',
    defaultPriority: 3,
    timeoutMs: 1_200_000,
    dependencies: [],
  },

  // ── Enrichment ──────────────────────────────────────────────────────────────
  'enrich-grants-free': {
    command: ['npx', 'tsx', 'scripts/enrich-grants-free.mjs', '--limit=100'],
    displayName: 'Enrich Grants (Free)',
    category: 'enrichment',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'enrich-grants': {
    command: ['node', '--env-file=.env', 'scripts/enrich-grants.mjs'],
    displayName: 'Enrich Grants',
    category: 'enrichment',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'enrich-foundations': {
    command: ['node', '--env-file=.env', 'scripts/enrich-foundations.mjs'],
    displayName: 'Enrich Foundations',
    category: 'enrichment',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'enrich-charities': {
    command: ['node', '--env-file=.env', 'scripts/enrich-charities.mjs'],
    displayName: 'Enrich Charities',
    category: 'enrichment',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'enrich-oric-corporations': {
    command: ['node', '--env-file=.env', 'scripts/enrich-oric-corporations.mjs'],
    displayName: 'Enrich ORIC Corporations',
    category: 'enrichment',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'enrich-social-enterprises': {
    command: ['node', '--env-file=.env', 'scripts/enrich-social-enterprises.mjs'],
    displayName: 'Enrich Social Enterprises',
    category: 'enrichment',
    defaultPriority: 5,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'enrich-programs': {
    command: ['node', '--env-file=.env', 'scripts/enrich-programs.mjs'],
    displayName: 'Enrich Programs',
    category: 'enrichment',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },

  // ── Profiling ───────────────────────────────────────────────────────────────
  'build-foundation-profiles': {
    command: ['npx', 'tsx', 'scripts/build-foundation-profiles.mjs', '--limit=25', '--concurrency=5'],
    displayName: 'Build Foundation Profiles',
    category: 'profiling',
    defaultPriority: 4,
    timeoutMs: 1_200_000,
    dependencies: [],
  },
  'profile-vip-foundations': {
    command: ['node', '--env-file=.env', 'scripts/profile-vip-foundations.mjs'],
    displayName: 'Profile VIP Foundations',
    category: 'profiling',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'profile-community-orgs': {
    command: ['node', '--env-file=.env', 'scripts/profile-community-orgs.mjs'],
    displayName: 'Profile Community Orgs',
    category: 'profiling',
    defaultPriority: 5,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'reprofile-low-confidence': {
    command: ['node', '--env-file=.env', 'scripts/reprofile-low-confidence.mjs'],
    displayName: 'Reprofile Low Confidence',
    category: 'profiling',
    defaultPriority: 6,
    timeoutMs: 600_000,
    dependencies: [],
  },
  'reprofile-missing-descriptions': {
    command: ['node', '--env-file=.env', 'scripts/reprofile-missing-descriptions.mjs'],
    displayName: 'Reprofile Missing Descriptions',
    category: 'profiling',
    defaultPriority: 6,
    timeoutMs: 600_000,
    dependencies: [],
  },

  // ── Graph ───────────────────────────────────────────────────────────────────
  'build-entity-graph': {
    command: ['node', '--env-file=.env', 'scripts/build-entity-graph.mjs'],
    displayName: 'Build Entity Graph',
    category: 'graph',
    defaultPriority: 3,
    timeoutMs: 1_800_000,
    dependencies: [],
  },
  'resolve-donor-entities': {
    command: ['node', '--env-file=.env', 'scripts/resolve-donor-entities.mjs'],
    displayName: 'Resolve Donor Entities',
    category: 'graph',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: ['build-entity-graph'],
  },
  'classify-community-controlled': {
    command: ['node', '--env-file=.env', 'scripts/classify-community-controlled.mjs', '--apply'],
    displayName: 'Classify Community-Controlled',
    category: 'graph',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: ['build-entity-graph'],
  },

  // ── Embedding ───────────────────────────────────────────────────────────────
  'backfill-embeddings': {
    command: ['node', '--env-file=.env', 'scripts/backfill-embeddings.mjs', '--batch-size', '100'],
    displayName: 'Backfill Embeddings',
    category: 'embedding',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },

  // ── Analytics ───────────────────────────────────────────────────────────────
  'refresh-materialized-views': {
    command: ['node', '--env-file=.env', 'scripts/refresh-materialized-views.mjs'],
    displayName: 'Refresh Materialized Views',
    category: 'analytics',
    defaultPriority: 2,
    timeoutMs: 300_000,
    dependencies: [],
  },
  'build-money-flow-data': {
    command: ['node', '--env-file=.env', 'scripts/build-money-flow-data.mjs'],
    displayName: 'Build Money Flow Data',
    category: 'analytics',
    defaultPriority: 4,
    timeoutMs: 600_000,
    dependencies: ['build-entity-graph', 'resolve-donor-entities'],
  },
  'flag-acnc-social-enterprises': {
    command: ['node', '--env-file=.env', 'scripts/flag-acnc-social-enterprises.mjs'],
    displayName: 'Flag ACNC Social Enterprises',
    category: 'analytics',
    defaultPriority: 5,
    timeoutMs: 300_000,
    dependencies: [],
  },
};

export const CATEGORIES = ['sync', 'import', 'discovery', 'enrichment', 'profiling', 'graph', 'embedding', 'analytics'];

export function getAgent(agentId) {
  return AGENTS[agentId] ?? null;
}

export function listAgents() {
  return Object.entries(AGENTS).map(([id, agent]) => ({ id, ...agent }));
}

export function listByCategory(category) {
  return listAgents().filter(a => a.category === category);
}
