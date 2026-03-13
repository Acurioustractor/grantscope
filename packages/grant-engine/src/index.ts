/**
 * GrantScope — Open Source Grant Discovery Engine
 *
 * Pluggable source architecture for discovering grants from:
 * - Government portals (GrantConnect, QLD, business.gov.au, data.gov.au)
 * - AI web search (Anthropic web_search)
 * - LLM knowledge (Claude training data)
 *
 * Usage:
 *   import { GrantEngine } from '@grantscope/engine';
 *
 *   const engine = new GrantEngine({ supabase, sources: ['grantconnect', 'web-search'] });
 *   const result = await engine.discover({ geography: ['AU'], categories: ['arts'] });
 */

// Core engine
export { GrantEngine } from './engine';

// Types
export type {
  SourcePlugin,
  SourcePluginConfig,
  DiscoveryQuery,
  DiscoveryRunResult,
  DiscoveryRunStats,
  RawGrant,
  CanonicalGrant,
  GrantSource,
  ScoredGrant,
  GrantScorer,
  GrantEngineConfig,
  ExistingGrantRecord,
} from './types';

// Source plugins
export { createWebSearchPlugin } from './sources/web-search';
export { createLLMKnowledgePlugin } from './sources/llm-knowledge';
export { createGrantConnectPlugin } from './sources/grantconnect';
export { createDataGovAuPlugin } from './sources/data-gov-au';
export { createQLDGrantsPlugin } from './sources/qld-grants';
export { createBusinessGovAuPlugin } from './sources/business-gov-au';
export { createNSWGrantsPlugin } from './sources/nsw-grants';
export { createVICGrantsPlugin } from './sources/vic-grants';
export { createARCGrantsPlugin } from './sources/arc-grants';
export { createNHMRCGrantsPlugin } from './sources/nhmrc-grants';
export { createTASGrantsPlugin } from './sources/tas-grants';
export { createACTGrantsPlugin } from './sources/act-grants';
export { createNTGrantsPlugin } from './sources/nt-grants';
export { createSAGrantsPlugin } from './sources/sa-grants';
export { createWAGrantsPlugin } from './sources/wa-grants';
export { SourceRegistry } from './sources/registry';

// Foundations
export { parseACNCRegister, downloadACNCRegister, acncToFoundation } from './foundations/acnc-importer';
export { FoundationRepository } from './foundations/repository';
export type { Foundation, FoundationType, FoundationProgram } from './foundations/types';

// Reports
export { buildSankeyData, buildYouthJusticeReport } from './reports/money-flow';
export type { SankeyNode, SankeyLink, SankeyData, ProgramComparison, YouthJusticeReport } from './reports/money-flow';

export { buildPowerReport } from './reports/power-analysis';
export type { PowerMetrics, FoundationPowerProfile, PowerReport } from './reports/power-analysis';
export { buildAdminBurdenReport } from './reports/admin-burden';
export type { AdminBurdenReport, AdminTier, GrantComplexityEstimate } from './reports/admin-burden';

// Data sources (non-grant)
export { ingestYouthJusticeData, searchQLDYouthJusticeDatasets, QLD_YOUTH_JUSTICE_PROGRAMS, QLD_YOUTH_JUSTICE_FLOWS } from './sources/qld-youth-justice';

// Community
export { importCommunityOrgs, estimateAdminBurden } from './foundations/community-profiler';
export type { CommunityOrgProfile } from './foundations/community-profiler';

// Agents
export { runAllAgents, runAgent, shouldRun } from './agents/agent-runner';
export type { AgentConfig, AgentRunResult, AgentRunLog } from './agents/agent-runner';
export { createGrantMonitor } from './agents/grant-monitor';
export { createFoundationWatcher } from './agents/foundation-watcher';
export { createGovernmentSpendWatcher } from './agents/government-spend';

// Embeddings & Enrichment
export { buildEmbeddingText, generateEmbeddings, embedQuery, backfillEmbeddings, searchGrantsSemantic } from './embeddings';
export { enrichGrant, batchEnrich } from './enrichment';
export { enrichGrantFree, batchEnrichFree } from './enrichment-free';

// Utilities
export { normalize, normalizeDate, normalizeAmount, normalizeCategories, generateDedupKey } from './normalizer';
export { deduplicateGrants, filterExisting } from './deduplicator';
export { GrantRepository } from './storage/repository';
