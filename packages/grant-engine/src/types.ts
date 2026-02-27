/**
 * GrantScope — Core type definitions
 *
 * These interfaces define the contract between source plugins,
 * the normalizer, deduplicator, and storage layer.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISCOVERY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DiscoveryQuery {
  geography?: string[];       // e.g. ['AU', 'AU-QLD']
  categories?: string[];      // e.g. ['arts', 'indigenous', 'community']
  keywords?: string[];        // free-text search terms
  minAmount?: number;
  maxAmount?: number;
  status?: 'open' | 'upcoming' | 'all';
}

export interface DiscoveryRunStats {
  source: string;
  grantsFound: number;
  errors: string[];
  durationMs: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GRANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Minimal grant shape returned by source plugins */
export interface RawGrant {
  title: string;
  provider: string;
  sourceUrl?: string;
  amount?: { min?: number; max?: number };
  deadline?: string;          // any parseable date string
  description?: string;
  categories?: string[];
  program?: string;
  geography?: string[];       // e.g. ['AU', 'AU-QLD']
  sourceId: string;           // which plugin found this
}

/** Normalized grant ready for storage */
export interface CanonicalGrant {
  name: string;
  provider: string;
  program: string | null;
  amountMin: number | null;
  amountMax: number | null;
  currency: string;
  closesAt: string | null;    // ISO date string
  url: string | null;
  description: string | null;
  categories: string[];
  geography: string[];
  sources: GrantSource[];
  discoveryMethod: string;
  dedupKey: string;           // lowercase(provider):lowercase(name)
}

export interface GrantSource {
  pluginId: string;
  foundAt: string;            // ISO timestamp
  rawUrl?: string;
  confidence: 'verified' | 'llm_knowledge' | 'scraped';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOURCE PLUGINS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SourcePlugin {
  id: string;
  name: string;
  type: 'scraper' | 'api' | 'ai_search' | 'llm_knowledge';
  geography: string[];        // countries/regions this source covers
  discover(query: DiscoveryQuery): AsyncGenerator<RawGrant>;
}

export interface SourcePluginConfig {
  id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCORING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ScoredGrant {
  grant: CanonicalGrant;
  fitScore: number;           // 0-100
  eligibilityScore: number;   // 0-100
  alignedProjects: string[];
  fitNotes: string | null;
}

export interface GrantScorer {
  id: string;
  name: string;
  score(grants: CanonicalGrant[]): Promise<ScoredGrant[]>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENGINE CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface GrantEngineConfig {
  supabase: SupabaseClient;
  sources?: string[];         // plugin IDs to enable (default: all registered)
  scorer?: GrantScorer;       // optional org-specific scorer
  dryRun?: boolean;
  onProgress?: (message: string) => void;
}

export interface ExistingGrantRecord {
  url: string | null;
  name: string;
}

export interface DiscoveryRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  sourcesUsed: string[];
  grantsDiscovered: number;
  grantsNew: number;
  grantsUpdated: number;
  errors: Array<{ source: string; error: string }>;
  status: 'completed' | 'failed' | 'partial';
}
