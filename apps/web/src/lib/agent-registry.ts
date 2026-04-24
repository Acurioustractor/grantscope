/**
 * Agent Registry — TypeScript mirror of scripts/lib/agent-registry.mjs
 * Used by Next.js API routes and frontend.
 */

export interface AgentDef {
  command: string[];
  displayName: string;
  category: AgentCategory;
  defaultPriority: number;
  timeoutMs: number;
  dependencies: string[];
}

export type AgentCategory =
  | 'sync'
  | 'import'
  | 'discovery'
  | 'enrichment'
  | 'profiling'
  | 'graph'
  | 'embedding'
  | 'analytics'
  | 'intelligence'
  | 'goods'
  | 'nz'
  | 'scraping';

export const AGENTS: Record<string, AgentDef> = {
  // ── Sync ────────────────────────────────────────────────────────────────────
  'sync-acnc-charities':       { command: ['node', '--env-file=.env', 'scripts/sync-acnc-charities.mjs'], displayName: 'Sync ACNC Charities', category: 'sync', defaultPriority: 3, timeoutMs: 600_000, dependencies: [] },
  'sync-acnc-register':        { command: ['node', '--env-file=.env', 'scripts/sync-acnc-register.mjs'], displayName: 'Sync ACNC Register', category: 'sync', defaultPriority: 3, timeoutMs: 600_000, dependencies: [] },
  'sync-oric-corporations':    { command: ['node', '--env-file=.env', 'scripts/sync-oric-corporations.mjs'], displayName: 'Sync ORIC Corporations', category: 'sync', defaultPriority: 3, timeoutMs: 300_000, dependencies: [] },
  'sync-austender-contracts':   { command: ['node', '--env-file=.env', 'scripts/sync-austender-contracts.mjs'], displayName: 'Sync AusTender Contracts', category: 'sync', defaultPriority: 3, timeoutMs: 600_000, dependencies: [] },
  'sync-ato-tax-transparency': { command: ['node', '--env-file=.env', 'scripts/sync-ato-tax-transparency.mjs'], displayName: 'Sync ATO Tax Transparency', category: 'sync', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'sync-asx-companies':        { command: ['node', '--env-file=.env', 'scripts/sync-asx-companies.mjs'], displayName: 'Sync ASX Companies', category: 'sync', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'sync-asic-companies':       { command: ['node', '--env-file=.env', 'scripts/sync-asic-companies.mjs'], displayName: 'Sync ASIC Companies', category: 'sync', defaultPriority: 5, timeoutMs: 600_000, dependencies: [] },
  'sync-foundation-programs':  { command: ['node', '--env-file=.env', 'scripts/sync-foundation-programs.mjs', '--cleanup-invalid', '--priority-only', '--frontier-window-hours=72'], displayName: 'Sync Foundation Programs', category: 'sync', defaultPriority: 4, timeoutMs: 120_000, dependencies: [] },
  'sync-foundation-programs-full-sweep': { command: ['node', '--env-file=.env', 'scripts/sync-foundation-programs.mjs', '--cleanup-invalid', '--skip-embed', '--frontier-window-hours=72', '--full-sweep', '--foundation-limit=120', '--agent-id=sync-foundation-programs-full-sweep'], displayName: 'Sync Foundation Programs (Full Sweep)', category: 'sync', defaultPriority: 6, timeoutMs: 900_000, dependencies: [] },
  'sync-ghl-to-tracker':       { command: ['node', '--env-file=.env', 'scripts/sync-ghl-to-tracker.mjs'], displayName: 'Sync GHL to Tracker', category: 'sync', defaultPriority: 5, timeoutMs: 120_000, dependencies: [] },

  // ── Import ──────────────────────────────────────────────────────────────────
  'import-aec-donations':          { command: ['node', '--env-file=.env', 'scripts/import-aec-donations.mjs'], displayName: 'Import AEC Donations', category: 'import', defaultPriority: 3, timeoutMs: 600_000, dependencies: [] },
  'import-oric-register':          { command: ['node', '--env-file=.env', 'scripts/import-oric-register.mjs'], displayName: 'Import ORIC Register', category: 'import', defaultPriority: 3, timeoutMs: 300_000, dependencies: [] },
  'import-acnc-financials':        { command: ['node', '--env-file=.env', 'scripts/import-acnc-financials.mjs'], displayName: 'Import ACNC Financials', category: 'import', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'import-rogs-justice':           { command: ['node', '--env-file=.env', 'scripts/import-rogs-justice.mjs'], displayName: 'Import ROGS Justice', category: 'import', defaultPriority: 4, timeoutMs: 300_000, dependencies: [] },
  'import-seifa-postcodes':        { command: ['node', '--env-file=.env', 'scripts/import-seifa-postcodes.mjs'], displayName: 'Import SEIFA Postcodes', category: 'import', defaultPriority: 5, timeoutMs: 120_000, dependencies: [] },
  'import-social-traders':         { command: ['node', '--env-file=.env', 'scripts/ingest-social-traders.mjs'], displayName: 'Import Social Traders', category: 'import', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'import-bcorp-au':               { command: ['node', '--env-file=.env', 'scripts/import-bcorp-au.mjs'], displayName: 'Import B Corp AU', category: 'import', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'import-ndis-participants':      { command: ['node', '--env-file=.env', 'scripts/import-ndis-participants.mjs', '--apply'], displayName: 'Import NDIS Participants', category: 'import', defaultPriority: 4, timeoutMs: 300_000, dependencies: [] },
  'import-ndis-provider-market':   { command: ['node', '--env-file=.env', 'scripts/import-ndis-provider-market.mjs'], displayName: 'Import NDIS Provider Market', category: 'import', defaultPriority: 4, timeoutMs: 300_000, dependencies: [] },
  'import-ndis-provider-register': { command: ['node', '--env-file=.env', 'scripts/import-ndis-provider-register.mjs'], displayName: 'Import NDIS Provider Register', category: 'import', defaultPriority: 4, timeoutMs: 3_600_000, dependencies: [] },
  'import-modern-slavery':         { command: ['node', '--env-file=.env', 'scripts/import-modern-slavery.mjs'], displayName: 'Import Modern Slavery Register', category: 'import', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'import-lobbying-register':      { command: ['node', '--env-file=.env', 'scripts/import-lobbying-register.mjs'], displayName: 'Import Lobbying Register', category: 'import', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'import-gov-grants':             { command: ['node', '--env-file=.env', 'scripts/import-gov-grants.mjs'], displayName: 'Import Gov Grants', category: 'import', defaultPriority: 3, timeoutMs: 600_000, dependencies: [] },

  // ── Discovery ───────────────────────────────────────────────────────────────
  'grantscope-discovery':          { command: ['npx', 'tsx', 'scripts/grantscope-discovery.mjs'], displayName: 'Grant Discovery', category: 'discovery', defaultPriority: 2, timeoutMs: 600_000, dependencies: [] },
  'discover-foundation-programs':  { command: ['node', '--env-file=.env', 'scripts/discover-foundation-programs.mjs', '--refresh-existing', '--rescan-days=14', '--limit=15', '--concurrency=2'], displayName: 'Discover Foundation Programs', category: 'discovery', defaultPriority: 4, timeoutMs: 900_000, dependencies: [] },
  'discover-foundation-programs-full-sweep': { command: ['node', '--env-file=.env', 'scripts/discover-foundation-programs.mjs', '--refresh-existing', '--rescan-days=30', '--limit=120', '--concurrency=2', '--full-sweep', '--agent-id=discover-foundation-programs-full-sweep'], displayName: 'Discover Foundation Programs (Full Sweep)', category: 'discovery', defaultPriority: 6, timeoutMs: 3_600_000, dependencies: [] },
  'extract-foundation-relationships': { command: ['node', '--env-file=.env', 'scripts/extract-foundation-relationships.mjs', '--limit=15', '--concurrency=2', '--max-pages=6', '--frontier-window-hours=168', '--refresh-days=30'], displayName: 'Extract Foundation Relationships', category: 'enrichment', defaultPriority: 4, timeoutMs: 1_200_000, dependencies: ['sync-source-frontier', 'poll-foundation-frontier'] },
  'scrape-state-grants':           { command: ['node', '--env-file=.env', 'scripts/scrape-state-grants.mjs'], displayName: 'Scrape State Grants', category: 'discovery', defaultPriority: 3, timeoutMs: 600_000, dependencies: [] },

  // ── Enrichment ──────────────────────────────────────────────────────────────
  'enrich-grants-free':            { command: ['npx', 'tsx', 'scripts/enrich-grants-free.mjs', '--limit=100'], displayName: 'Enrich Grants (Free)', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'enrich-grants':                 { command: ['node', '--env-file=.env', 'scripts/enrich-grants.mjs'], displayName: 'Enrich Grants', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'enrich-foundations':            { command: ['node', '--env-file=.env', 'scripts/enrich-foundations.mjs'], displayName: 'Enrich Foundations', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'enrich-entity-contacts':        { command: ['node', '--env-file=.env', 'scripts/enrich-entity-contacts.mjs', '--apply'], displayName: 'Enrich Entity Contacts', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: ['build-entity-graph'] },
  'enrich-charities':              { command: ['node', '--env-file=.env', 'scripts/enrich-charities.mjs'], displayName: 'Enrich Charities', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'enrich-oric-corporations':      { command: ['node', '--env-file=.env', 'scripts/enrich-oric-corporations.mjs'], displayName: 'Enrich ORIC Corporations', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'enrich-programs':               { command: ['node', '--env-file=.env', 'scripts/enrich-programs.mjs'], displayName: 'Enrich Programs', category: 'enrichment', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },

  // ── Profiling ───────────────────────────────────────────────────────────────
  'build-foundation-profiles':       { command: ['npx', 'tsx', 'scripts/build-foundation-profiles.mjs', '--limit=20', '--concurrency=2'], displayName: 'Build Foundation Profiles', category: 'profiling', defaultPriority: 4, timeoutMs: 2_400_000, dependencies: [] },
  'profile-vip-foundations':         { command: ['node', '--env-file=.env', 'scripts/profile-vip-foundations.mjs'], displayName: 'Profile VIP Foundations', category: 'profiling', defaultPriority: 4, timeoutMs: 600_000, dependencies: [] },
  'profile-community-orgs':         { command: ['node', '--env-file=.env', 'scripts/profile-community-orgs.mjs'], displayName: 'Profile Community Orgs', category: 'profiling', defaultPriority: 5, timeoutMs: 600_000, dependencies: [] },
  'classify-foundation-power-profiles': { command: ['node', '--env-file=.env', 'scripts/classify-foundation-power-profiles.mjs'], displayName: 'Classify Foundation Power Profiles', category: 'profiling', defaultPriority: 4, timeoutMs: 600_000, dependencies: ['sync-foundation-programs', 'enrich-foundations'] },
  'reprofile-low-confidence':       { command: ['node', '--env-file=.env', 'scripts/reprofile-low-confidence.mjs'], displayName: 'Reprofile Low Confidence', category: 'profiling', defaultPriority: 6, timeoutMs: 600_000, dependencies: [] },
  'reprofile-missing-descriptions': { command: ['node', '--env-file=.env', 'scripts/reprofile-missing-descriptions.mjs'], displayName: 'Reprofile Missing Descriptions', category: 'profiling', defaultPriority: 6, timeoutMs: 600_000, dependencies: [] },

  // ── Graph ───────────────────────────────────────────────────────────────────
  'build-entity-graph':            { command: ['node', '--env-file=.env', 'scripts/build-entity-graph.mjs'], displayName: 'Build Entity Graph', category: 'graph', defaultPriority: 3, timeoutMs: 3_600_000, dependencies: [] },
  'resolve-donor-entities':        { command: ['node', '--env-file=.env', 'scripts/resolve-donor-entities.mjs'], displayName: 'Resolve Donor Entities', category: 'graph', defaultPriority: 4, timeoutMs: 600_000, dependencies: ['build-entity-graph'] },
  'classify-community-controlled': { command: ['node', '--env-file=.env', 'scripts/classify-community-controlled.mjs', '--apply'], displayName: 'Classify Community-Controlled', category: 'graph', defaultPriority: 5, timeoutMs: 300_000, dependencies: ['build-entity-graph'] },
  'bridge-person-roles':           { command: ['node', '--env-file=.env', 'scripts/bridge-person-roles.mjs', '--apply'], displayName: 'Bridge Person Roles', category: 'graph', defaultPriority: 4, timeoutMs: 600_000, dependencies: ['build-entity-graph'] },
  'link-alma-entities':            { command: ['node', '--env-file=.env', 'scripts/link-alma-entities.mjs', '--apply'], displayName: 'Link ALMA Entities', category: 'graph', defaultPriority: 4, timeoutMs: 300_000, dependencies: ['build-entity-graph'] },
  'resolve-donation-abns-v2':      { command: ['node', '--env-file=.env', 'scripts/resolve-donation-abns-v2.mjs', '--apply'], displayName: 'Resolve Donation ABNs v2', category: 'graph', defaultPriority: 3, timeoutMs: 3_600_000, dependencies: ['build-entity-graph'] },

  // ── Embedding ───────────────────────────────────────────────────────────────
  'backfill-embeddings':           { command: ['node', '--env-file=.env', 'scripts/backfill-embeddings.mjs', '--batch-size', '100', '--limit=100', '--exclude-sources=foundation_program'], displayName: 'Backfill Embeddings', category: 'embedding', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'backfill-entity-embeddings':    { command: ['node', '--env-file=.env', 'scripts/backfill-entity-embeddings.mjs', '--batch-size', '100'], displayName: 'Backfill Entity Embeddings', category: 'embedding', defaultPriority: 4, timeoutMs: 3_600_000, dependencies: ['build-entity-graph'] },
  'backfill-foundation-embeddings': { command: ['node', '--env-file=.env', 'scripts/backfill-foundation-embeddings.mjs', '--batch-size', '100'], displayName: 'Backfill Foundation Embeddings', category: 'embedding', defaultPriority: 4, timeoutMs: 600_000, dependencies: ['enrich-foundations'] },

  // ── Analytics ───────────────────────────────────────────────────────────────
  'refresh-materialized-views':    { command: ['node', '--env-file=.env', 'scripts/refresh-views.mjs'], displayName: 'Refresh Materialized Views', category: 'analytics', defaultPriority: 2, timeoutMs: 600_000, dependencies: [] },
  'build-money-flow-data':        { command: ['node', '--env-file=.env', 'scripts/build-money-flow-data.mjs'], displayName: 'Build Money Flow Data', category: 'analytics', defaultPriority: 4, timeoutMs: 600_000, dependencies: ['build-entity-graph', 'resolve-donor-entities'] },
  'flag-acnc-social-enterprises': { command: ['node', '--env-file=.env', 'scripts/flag-acnc-social-enterprises.mjs'], displayName: 'Flag ACNC Social Enterprises', category: 'analytics', defaultPriority: 5, timeoutMs: 300_000, dependencies: [] },
  'reconcile-grant-source-identity': { command: ['node', '--env-file=.env', 'scripts/reconcile-grant-source-identity.mjs', '--apply', '--limit=100'], displayName: 'Reconcile Grant Source Identity', category: 'analytics', defaultPriority: 3, timeoutMs: 300_000, dependencies: ['grantscope-discovery'] },
  'check-grant-source-identity-health': { command: ['node', '--env-file=.env', 'scripts/check-grant-source-identity-health.mjs', '--max-blank-source-id=0', '--max-canonical-mismatch=0'], displayName: 'Check Grant Source Identity Health', category: 'analytics', defaultPriority: 2, timeoutMs: 120_000, dependencies: ['reconcile-grant-source-identity'] },
  'check-grant-semantics-health': { command: ['node', '--env-file=.env', 'scripts/check-grant-semantics-health.mjs', '--max-status-null=0', '--max-application-status-null=0', '--max-open-past-deadline=0'], displayName: 'Check Grant Semantics Health', category: 'analytics', defaultPriority: 2, timeoutMs: 120_000, dependencies: ['reconcile-grant-semantics'] },

  // ── Intelligence ──────────────────────────────────────────────────────────
  'contract-alert-checker':       { command: ['node', '--env-file=.env', 'scripts/check-contract-alerts.mjs', '--apply'], displayName: 'Contract Alert Checker', category: 'intelligence', defaultPriority: 1, timeoutMs: 120_000, dependencies: [] },
  'donor-contract-crossover':     { command: ['node', '--env-file=.env', 'scripts/check-donor-contract-crossover.mjs', '--apply'], displayName: 'Donor-Contract Crossover', category: 'intelligence', defaultPriority: 1, timeoutMs: 120_000, dependencies: [] },
  'scout-grants-for-profiles':    { command: ['node', '--env-file=.env', 'scripts/scout-grants-for-profiles.mjs'], displayName: 'Grant Scout', category: 'intelligence', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'deliver-grant-notifications':  { command: ['node', '--env-file=.env', 'scripts/deliver-grant-notifications.mjs'], displayName: 'Deliver Grant Notifications', category: 'intelligence', defaultPriority: 2, timeoutMs: 300_000, dependencies: ['scout-grants-for-profiles'] },
  'send-grant-alert-digests':     { command: ['npx', 'tsx', '--tsconfig', 'apps/web/tsconfig.json', 'scripts/send-grant-alert-digests.ts'], displayName: 'Send Grant Alert Digests', category: 'intelligence', defaultPriority: 3, timeoutMs: 300_000, dependencies: ['scout-grants-for-profiles'] },
  'send-billing-reminders':       { command: ['npx', 'tsx', '--tsconfig', 'apps/web/tsconfig.json', 'scripts/send-billing-reminders.ts'], displayName: 'Send Billing Reminders', category: 'intelligence', defaultPriority: 3, timeoutMs: 300_000, dependencies: [] },

  // ── New Zealand ───────────────────────────────────────────────────────────
  'import-nz-charities':          { command: ['node', '--env-file=.env', 'scripts/import-nz-charities.mjs', '--apply'], displayName: 'NZ Charities Register', category: 'nz', defaultPriority: 2, timeoutMs: 600_000, dependencies: [] },

  // ── Scraping ─────────────────────────────────────────────────────────────
  'scrape-acnc-persons':          { command: ['node', '--env-file=.env', 'scripts/scrape-acnc-responsible-persons.mjs', '--priority-only', '--apply'], displayName: 'ACNC Responsible Persons', category: 'scraping', defaultPriority: 2, timeoutMs: 3_600_000, dependencies: [] },

  // ── State Donations ──────────────────────────────────────────────────────
  'import-qld-donations':         { command: ['node', '--env-file=.env', 'scripts/import-qld-donations.mjs', '--apply'], displayName: 'QLD Political Donations', category: 'import', defaultPriority: 2, timeoutMs: 600_000, dependencies: [] },

  // ── Research Grants ────────────────────────────────────────────────────────
  'import-arc-grants':            { command: ['node', '--env-file=.env', 'scripts/import-arc-grants.mjs', '--apply'], displayName: 'ARC Research Grants', category: 'import', defaultPriority: 2, timeoutMs: 900_000, dependencies: [] },
  'import-nhmrc-grants':          { command: ['node', '--env-file=.env', 'scripts/import-nhmrc-grants.mjs', '--apply'], displayName: 'NHMRC Research Grants', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'link-research-grants-entities': { command: ['node', '--env-file=.env', 'scripts/link-research-grants-entities.mjs', '--apply'], displayName: 'Link Research Grants → Entities', category: 'graph', defaultPriority: 3, timeoutMs: 300_000, dependencies: ['import-arc-grants', 'import-nhmrc-grants'] },

  // ── Justice Funding Bridge ─────────────────────────────────────────────────
  'bridge-justice-funding':       { command: ['node', '--env-file=.env', 'scripts/bridge-justice-funding.mjs', '--apply'], displayName: 'Justice Funding → Entity Bridge', category: 'graph', defaultPriority: 3, timeoutMs: 1_800_000, dependencies: [] },

  // ── State Procurement ──────────────────────────────────────────────────────
  'import-nsw-contracts':         { command: ['node', '--env-file=.env', 'scripts/import-nsw-contracts.mjs', '--apply'], displayName: 'NSW eTendering Contracts', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'import-qld-contracts':         { command: ['node', '--env-file=.env', 'scripts/import-qld-contracts.mjs', '--apply'], displayName: 'QLD Awarded Contracts', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'import-nt-contracts':          { command: ['node', '--env-file=.env', 'scripts/import-nt-contracts.mjs', '--apply'], displayName: 'NT Awarded Contracts', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'import-act-contracts':         { command: ['node', '--env-file=.env', 'scripts/import-act-contracts.mjs', '--apply'], displayName: 'ACT Government Contracts', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'import-rogs-youth-justice':    { command: ['node', '--env-file=.env', 'scripts/import-rogs-youth-justice.mjs', '--apply'], displayName: 'ROGS Youth Justice Expenditure', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'scrape-tas-contracts':         { command: ['node', '--env-file=.env', 'scripts/scrape-tas-contracts.mjs', '--apply', '--resume'], displayName: 'TAS Awarded Contracts', category: 'import', defaultPriority: 2, timeoutMs: 7_200_000, dependencies: [] },
  'import-ctg-youth-justice':     { command: ['node', '--env-file=.env', 'scripts/import-ctg-youth-justice.mjs', '--apply'], displayName: 'Closing the Gap Youth Justice', category: 'import', defaultPriority: 2, timeoutMs: 300_000, dependencies: [] },
  'import-bocsar-crime':          { command: ['node', '--env-file=.env', 'scripts/import-bocsar-crime.mjs', '--download', '--apply'], displayName: 'NSW BOCSAR LGA Crime Stats', category: 'import', defaultPriority: 2, timeoutMs: 600_000, dependencies: [] },
};

export const CATEGORIES: AgentCategory[] = ['sync', 'import', 'discovery', 'enrichment', 'profiling', 'graph', 'embedding', 'analytics', 'intelligence', 'goods', 'nz', 'scraping'];

export function getAgent(agentId: string): AgentDef | null {
  return AGENTS[agentId] ?? null;
}

export function listAgents(): Array<{ id: string } & AgentDef> {
  return Object.entries(AGENTS).map(([id, agent]) => ({ id, ...agent }));
}

export function listByCategory(category: AgentCategory): Array<{ id: string } & AgentDef> {
  return listAgents().filter(a => a.category === category);
}
