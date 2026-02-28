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
export { GrantEngine } from './engine.js';

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
} from './types.js';

// Source plugins
export { createWebSearchPlugin } from './sources/web-search.js';
export { createLLMKnowledgePlugin } from './sources/llm-knowledge.js';
export { createGrantConnectPlugin } from './sources/grantconnect.js';
export { createDataGovAuPlugin } from './sources/data-gov-au.js';
export { createQLDGrantsPlugin } from './sources/qld-grants.js';
export { createBusinessGovAuPlugin } from './sources/business-gov-au.js';
export { SourceRegistry } from './sources/registry.js';

// Foundations
export { parseACNCRegister, downloadACNCRegister, acncToFoundation } from './foundations/acnc-importer.js';
export { FoundationRepository } from './foundations/repository.js';
export type { Foundation, FoundationType, FoundationProgram } from './foundations/types.js';

// Reports
export { buildSankeyData, buildYouthJusticeReport } from './reports/money-flow.js';
export type { SankeyNode, SankeyLink, SankeyData, ProgramComparison, YouthJusticeReport } from './reports/money-flow.js';

export { buildPowerReport } from './reports/power-analysis.js';
export type { PowerMetrics, FoundationPowerProfile, PowerReport } from './reports/power-analysis.js';
export { buildAdminBurdenReport } from './reports/admin-burden.js';
export type { AdminBurdenReport, AdminTier, GrantComplexityEstimate } from './reports/admin-burden.js';

// Data sources (non-grant)
export { ingestYouthJusticeData, searchQLDYouthJusticeDatasets, QLD_YOUTH_JUSTICE_PROGRAMS, QLD_YOUTH_JUSTICE_FLOWS } from './sources/qld-youth-justice.js';

// Community
export { importCommunityOrgs, estimateAdminBurden } from './foundations/community-profiler.js';
export type { CommunityOrgProfile } from './foundations/community-profiler.js';

// Agents
export { runAllAgents, runAgent, shouldRun } from './agents/agent-runner.js';
export type { AgentConfig, AgentRunResult, AgentRunLog } from './agents/agent-runner.js';
export { createGrantMonitor } from './agents/grant-monitor.js';
export { createFoundationWatcher } from './agents/foundation-watcher.js';
export { createGovernmentSpendWatcher } from './agents/government-spend.js';

// Utilities
export { normalize, normalizeDate, normalizeAmount, normalizeCategories, generateDedupKey } from './normalizer.js';
export { deduplicateGrants, filterExisting } from './deduplicator.js';
export { GrantRepository } from './storage/repository.js';
