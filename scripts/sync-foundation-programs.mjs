#!/usr/bin/env node

/**
 * Sync Foundation Programs → Grant Opportunities
 *
 * Upserts foundation_programs into grant_opportunities so they appear
 * in search results alongside government grants. Uses a composite
 * dedup key (foundation_id + program name) to avoid duplicates.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-foundation-programs.mjs [--dry-run]
 *   node --env-file=.env scripts/sync-foundation-programs.mjs [--frontier-window-hours=72]
 *   node --env-file=.env scripts/sync-foundation-programs.mjs [--priority-only]
 *   node --env-file=.env scripts/sync-foundation-programs.mjs [--agent-id=sync-foundation-programs-full-sweep]
 *   node --env-file=.env scripts/sync-foundation-programs.mjs [--full-sweep] [--foundation-limit=120]
 *
 * Run daily to pick up newly discovered programs from foundation enrichment.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

const execFileAsync = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getArgValue(prefix) {
  const arg = process.argv.find(entry => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const DRY_RUN = process.argv.includes('--dry-run');
const CLEANUP_INVALID = process.argv.includes('--cleanup-invalid');
const PRIORITY_ONLY = process.argv.includes('--priority-only');
const AGENT_ID = getArgValue('--agent-id') || 'sync-foundation-programs';
const FULL_SWEEP = process.argv.includes('--full-sweep') || AGENT_ID === 'sync-foundation-programs-full-sweep';
const AGENT_NAME = getArgValue('--agent-name') || ({
  'sync-foundation-programs': 'Sync Foundation Programs',
  'sync-foundation-programs-full-sweep': 'Sync Foundation Programs (Full Sweep)',
}[AGENT_ID] || AGENT_ID);
const frontierWindowArg = getArgValue('--frontier-window-hours');
const FRONTIER_WINDOW_HOURS = frontierWindowArg ? Math.max(1, Number.parseInt(frontierWindowArg, 10) || 72) : 72;
const foundationLimitArg = getArgValue('--foundation-limit');
const FOUNDATION_LIMIT = foundationLimitArg
  ? Math.max(1, Number.parseInt(foundationLimitArg, 10) || 120)
  : (FULL_SWEEP ? 120 : null);
const SKIP_EMBED = process.argv.includes('--skip-embed');
const embedBatchSizeArg = getArgValue('--embed-batch-size');
const EMBED_BATCH_SIZE = embedBatchSizeArg ? Math.max(1, Number.parseInt(embedBatchSizeArg, 10) || 100) : 100;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getAgentRuntimeState(agentId) {
  const { data, error } = await supabase
    .from('agent_runtime_state')
    .select('state')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error) {
    console.warn(`Failed to fetch runtime state for ${agentId}: ${error.message}`);
    return {};
  }

  return data?.state && typeof data.state === 'object' ? data.state : {};
}

async function updateAgentRuntimeState(agentId, patch) {
  if (!patch || typeof patch !== 'object') return;

  const currentState = await getAgentRuntimeState(agentId);
  const nextState = {
    ...currentState,
    ...patch,
  };

  const { error } = await supabase
    .from('agent_runtime_state')
    .upsert({
      agent_id: agentId,
      state: nextState,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' });

  if (error) {
    console.warn(`Failed to update runtime state for ${agentId}: ${error.message}`);
  }
}

const PUBLIC_GRANT_SIGNALS = /(grant|grant round|community giving|fellowship|scholarship|award|bursary|funding round|apply now|how to apply|applications? open|grant guidelines|expression of interest|eoi)/i;
const URL_GRANT_SIGNALS = /(\/grants?\/|\/grant-programs?\/|\/funding\/|\/apply\/|\/applications?\/|\/community-giving\/|\/fellowships?\/|\/scholarships?\/)/i;
const NON_GRANT_SIGNALS = /(appeal|donation|donate|sponsorship|sponsor a child|child sponsorship|orphan sponsorship|water project|food packs?|relief fund|crisis relief|family support|support program|housing support|clean water|fiscal sponsorship|disaster relief|donations program|community support|direct sponsorship)/i;
const DIRECT_SERVICE_SIGNALS = /(supports? .*famil(y|ies)|provides? (financial|emotional|practical) support|regular donations|major sponsors?|channeling donations|fundraising campaign|supports the creation of|responding to global disasters|provides access to clean water|vouchers|care packages|hospital stays)/i;

const GRANT_DEPENDENCIES = [
  { table: 'grant_feedback', column: 'grant_id' },
  { table: 'saved_grants', column: 'grant_id' },
  { table: 'org_deadlines', column: 'grant_id' },
  { table: 'org_milestones', column: 'grant_id' },
  { table: 'org_sessions', column: 'grant_id' },
  { table: 'org_grant_budget_lines', column: 'grant_id' },
  { table: 'org_grant_transactions', column: 'grant_id' },
  { table: 'bgfit_budget_items', column: 'grant_id' },
  { table: 'bgfit_deadlines', column: 'grant_id' },
  { table: 'bgfit_transactions', column: 'grant_id' },
  { table: 'grant_answer_bank', column: 'source_grant_id' },
];

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function fetchPaginated(queryFactory, pageSize = 1000) {
  const rows = [];
  let page = 0;

  while (true) {
    const { data, error } = await queryFactory(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    page++;
  }

  return rows;
}

function dedupeStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeUrl(url) {
  if (!url) return null;
  const text = String(url).trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function detectProgramType(name, description) {
  const text = `${name} ${description || ''}`.toLowerCase();
  if (/fellowship/.test(text)) return 'fellowship';
  if (/scholarship|bursary|bursaries/.test(text)) return 'scholarship';
  if (/award|prize/.test(text)) return 'award';
  if (/grant/.test(text)) return 'grant';
  if (/program|programme|initiative|project/.test(text)) return 'program';
  return 'grant';
}

function buildProgramKey(program) {
  return `${program.foundations.id}::${program.name}`;
}

function buildGrantPayload(program, foundation) {
  const desiredStatus = getDesiredProgramStatus(program, foundation);
  return {
    name: program.name,
    provider: foundation.name,
    program: program.name,
    description: program.description,
    amount_min: program.amount_min ? Number(program.amount_min) : null,
    amount_max: program.amount_max ? Number(program.amount_max) : null,
    deadline: program.deadline,
    closes_at: program.deadline,
    url: normalizeUrl(program.url || foundation.website),
    source: 'foundation_program',
    source_id: String(program.id),
    grant_type: 'open_opportunity',
    foundation_id: foundation.id,
    program_type: program.program_type || detectProgramType(program.name, program.description),
    categories: dedupeStrings([
      ...(program.categories || []),
      ...(foundation.thematic_focus || []),
    ]),
    application_status: desiredStatus === 'closed' ? 'closed' : 'open',
    status: desiredStatus,
  };
}

function areArraysEqual(a, b) {
  const left = dedupeStrings(a);
  const right = dedupeStrings(b);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function grantNeedsUpdate(existingGrant, desiredGrant) {
  const comparableFields = [
    'name',
    'provider',
    'program',
    'description',
    'amount_min',
    'amount_max',
    'deadline',
    'closes_at',
    'url',
    'grant_type',
    'foundation_id',
    'program_type',
    'application_status',
    'status',
    'source_id',
  ];

  for (const field of comparableFields) {
    if ((existingGrant?.[field] ?? null) !== (desiredGrant?.[field] ?? null)) {
      return true;
    }
  }

  return !areArraysEqual(existingGrant?.categories, desiredGrant?.categories);
}

function recordFoundationSyncStat(statsByFoundation, foundationId, field) {
  const current = statsByFoundation.get(foundationId) || { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  current[field] += 1;
  statsByFoundation.set(foundationId, current);
}

function isDuplicateUrlError(error) {
  return /idx_grants_unique_url/i.test(error?.message || '');
}

async function resolvePriorityFoundationStats() {
  const cutoffIso = new Date(Date.now() - (FRONTIER_WINDOW_HOURS * 60 * 60 * 1000)).toISOString();
  const statsByFoundation = new Map();

  const changedFrontierRows = await fetchPaginated((from, to) => (
    supabase
      .from('source_frontier')
      .select('foundation_id, source_kind')
      .not('foundation_id', 'is', null)
      .gte('last_changed_at', cutoffIso)
      .order('last_changed_at', { ascending: false })
      .range(from, to)
  ));

  for (const row of changedFrontierRows) {
    const current = statsByFoundation.get(row.foundation_id) || {
      changedTargetCount: 0,
      changedProgramTargetCount: 0,
      recentProgramCount: 0,
    };
    current.changedTargetCount += 1;
    if (row.source_kind === 'foundation_program_page') current.changedProgramTargetCount += 1;
    statsByFoundation.set(row.foundation_id, current);
  }

  const recentlyScrapedPrograms = await fetchPaginated((from, to) => (
    supabase
      .from('foundation_programs')
      .select('foundation_id')
      .gte('scraped_at', cutoffIso)
      .order('scraped_at', { ascending: false })
      .range(from, to)
  ));

  for (const row of recentlyScrapedPrograms) {
    const current = statsByFoundation.get(row.foundation_id) || {
      changedTargetCount: 0,
      changedProgramTargetCount: 0,
      recentProgramCount: 0,
    };
    current.recentProgramCount += 1;
    statsByFoundation.set(row.foundation_id, current);
  }

  return statsByFoundation;
}

async function resolveFullSweepFoundationScope() {
  const foundationProgramRows = await fetchPaginated((from, to) => (
    supabase
      .from('foundation_programs')
      .select('foundation_id, scraped_at, created_at, foundations!inner(id, name)')
      .range(from, to)
  ));

  const candidatesByFoundation = new Map();
  for (const row of foundationProgramRows) {
    const foundationId = row?.foundation_id || row?.foundations?.id;
    const foundationName = row?.foundations?.name;
    if (!foundationId || !foundationName) continue;

    const current = candidatesByFoundation.get(foundationId) || {
      foundationId,
      foundationName,
      latestProgramActivityAt: null,
      programCount: 0,
      latestGrantSyncAt: null,
    };

    current.programCount += 1;
    const candidateActivityAt = row.scraped_at || row.created_at || null;
    if (candidateActivityAt) {
      const currentTs = current.latestProgramActivityAt ? new Date(current.latestProgramActivityAt).getTime() : 0;
      const candidateTs = new Date(candidateActivityAt).getTime();
      if (!current.latestProgramActivityAt || candidateTs > currentTs) {
        current.latestProgramActivityAt = candidateActivityAt;
      }
    }

    candidatesByFoundation.set(foundationId, current);
  }

  const frontierRows = await fetchPaginated((from, to) => (
    supabase
      .from('source_frontier')
      .select('foundation_id, metadata')
      .not('foundation_id', 'is', null)
      .range(from, to)
  ));

  for (const row of frontierRows) {
    const foundationId = row?.foundation_id;
    const current = foundationId ? candidatesByFoundation.get(foundationId) : null;
    if (!current) continue;

    const candidateSyncAt = row?.metadata?.last_grant_sync_at || null;
    if (!candidateSyncAt) continue;

    const currentTs = current.latestGrantSyncAt ? new Date(current.latestGrantSyncAt).getTime() : 0;
    const candidateTs = new Date(candidateSyncAt).getTime();
    if (!current.latestGrantSyncAt || candidateTs > currentTs) {
      current.latestGrantSyncAt = candidateSyncAt;
    }
  }

  const candidates = [...candidatesByFoundation.values()].sort((a, b) => {
    if (!a.latestGrantSyncAt && b.latestGrantSyncAt) return -1;
    if (a.latestGrantSyncAt && !b.latestGrantSyncAt) return 1;
    if (a.latestGrantSyncAt && b.latestGrantSyncAt) {
      const syncDelta = new Date(a.latestGrantSyncAt).getTime() - new Date(b.latestGrantSyncAt).getTime();
      if (syncDelta !== 0) return syncDelta;
    }
    if (a.latestProgramActivityAt && b.latestProgramActivityAt) {
      const activityDelta = new Date(b.latestProgramActivityAt).getTime() - new Date(a.latestProgramActivityAt).getTime();
      if (activityDelta !== 0) return activityDelta;
    } else if (a.latestProgramActivityAt && !b.latestProgramActivityAt) {
      return -1;
    } else if (!a.latestProgramActivityAt && b.latestProgramActivityAt) {
      return 1;
    }
    return String(a.foundationName || '').localeCompare(String(b.foundationName || ''));
  });

  const totalCandidates = candidates.length;
  if (totalCandidates === 0) {
    return {
      foundationIds: [],
      foundationNames: [],
      fullSweepCursorStart: 0,
      fullSweepCandidateCount: 0,
    };
  }

  const runtimeState = await getAgentRuntimeState(AGENT_ID);
  const rawCursor = Number(runtimeState?.fullSweepCursor || 0);
  const normalizedCursor = Number.isFinite(rawCursor) && rawCursor >= 0
    ? rawCursor % totalCandidates
    : 0;
  const rotatedCandidates = [
    ...candidates.slice(normalizedCursor),
    ...candidates.slice(0, normalizedCursor),
  ];
  const selectedCandidates = rotatedCandidates.slice(0, FOUNDATION_LIMIT || totalCandidates);

  return {
    foundationIds: selectedCandidates.map((candidate) => candidate.foundationId),
    foundationNames: selectedCandidates.map((candidate) => candidate.foundationName),
    fullSweepCursorStart: normalizedCursor,
    fullSweepCandidateCount: totalCandidates,
  };
}

function getProgramPriorityScore(program, priorityStats) {
  const foundationId = program?.foundations?.id;
  const stats = priorityStats.get(foundationId);
  if (!stats) return 0;
  return (stats.recentProgramCount * 10) + (stats.changedProgramTargetCount * 6) + (stats.changedTargetCount * 2);
}

function getPriorityFoundationIds(priorityStats) {
  return [...priorityStats.entries()]
    .sort((a, b) => {
      const aScore = (a[1].recentProgramCount * 10) + (a[1].changedProgramTargetCount * 6) + (a[1].changedTargetCount * 2);
      const bScore = (b[1].recentProgramCount * 10) + (b[1].changedProgramTargetCount * 6) + (b[1].changedTargetCount * 2);
      return bScore - aScore || String(a[0]).localeCompare(String(b[0]));
    })
    .map(([foundationId]) => foundationId);
}

async function applyFrontierSyncMetadata(statsByFoundation) {
  const foundationIds = [...statsByFoundation.keys()];
  if (foundationIds.length === 0) return;

  const now = new Date().toISOString();
  for (const foundationBatch of chunkArray(foundationIds, 100)) {
    const rows = await fetchPaginated((from, to) => (
      supabase
        .from('source_frontier')
        .select('id, foundation_id, metadata')
        .in('foundation_id', foundationBatch)
        .range(from, to)
    ));

    for (const row of rows) {
      const stats = statsByFoundation.get(row.foundation_id);
      if (!stats) continue;

      const metadata = {
        ...(row.metadata || {}),
        last_grant_sync_at: now,
        last_grant_sync_inserted: stats.inserted,
        last_grant_sync_updated: stats.updated,
        last_grant_sync_skipped: stats.skipped,
        last_grant_sync_errors: stats.errors,
      };

      const { error } = await supabase
        .from('source_frontier')
        .update({ metadata, updated_at: now })
        .eq('id', row.id);

      if (error) {
        console.warn(`Failed to write frontier sync metadata for foundation ${row.foundation_id}: ${error.message}`);
      }
    }
  }
}

async function runGrantEmbeddingBackfill(grantIds) {
  const uniqueGrantIds = [...new Set((grantIds || []).filter(Boolean))];
  if (uniqueGrantIds.length === 0) {
    return { embedded: 0, errors: 0, skipped: true };
  }

  try {
    const { stdout, stderr } = await execFileAsync('node', [
      '--env-file=.env',
      'scripts/backfill-embeddings.mjs',
      '--source',
      'foundation_program',
      '--batch-size',
      String(EMBED_BATCH_SIZE),
      `--grant-ids=${uniqueGrantIds.join(',')}`,
    ], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = `${stdout || ''}\n${stderr || ''}`;
    const match = output.match(/Done:\s+(\d+)\s+embedded,\s+(\d+)\s+errors/i);
    return {
      embedded: match ? Number(match[1]) : uniqueGrantIds.length,
      errors: match ? Number(match[2]) : 0,
      skipped: false,
      output,
    };
  } catch (error) {
    return {
      embedded: 0,
      errors: uniqueGrantIds.length,
      skipped: false,
      output: `${error.stdout || ''}\n${error.stderr || ''}`.trim(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function hasPastDeadline(deadline) {
  if (!deadline) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed < today;
}

function isGrantLikeFoundationProgram(program, foundation) {
  const text = `${program.name || ''} ${program.description || ''} ${program.eligibility || ''} ${program.application_process || ''}`;
  const url = String(program.url || foundation.website || '').toLowerCase();
  const foundationType = String(foundation.type || '').toLowerCase();
  const hasGrantLanguage = PUBLIC_GRANT_SIGNALS.test(text);
  const hasGrantUrl = URL_GRANT_SIGNALS.test(url);
  const hasStructuredGrantSignal = Boolean(program.amount_min || program.amount_max || program.deadline);
  const looksLikeNonGrant = NON_GRANT_SIGNALS.test(text) || DIRECT_SERVICE_SIGNALS.test(text);
  const trustedFoundationType = ['private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation', 'grantmaker'].includes(foundationType);

  if (looksLikeNonGrant && !hasGrantLanguage && !hasGrantUrl) return false;
  if (!trustedFoundationType) return false;
  return hasGrantLanguage || hasGrantUrl || hasStructuredGrantSignal;
}

function getDesiredProgramStatus(program, foundation) {
  if (!isGrantLikeFoundationProgram(program, foundation)) return 'non_grant';
  return hasPastDeadline(program.deadline) ? 'closed' : 'open';
}

async function main() {
  console.log('=== Sync Foundation Programs → Grant Opportunities ===');
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Cleanup invalid: ${CLEANUP_INVALID}`);
  console.log(`  Priority only: ${PRIORITY_ONLY}`);
  console.log(`  Full sweep: ${FULL_SWEEP}`);
  if (FULL_SWEEP) {
    console.log(`  Foundation limit: ${FOUNDATION_LIMIT}`);
  }
  console.log(`  Frontier window hours: ${FRONTIER_WINDOW_HOURS}`);
  console.log(`  Auto-embed: ${!SKIP_EMBED}`);
  console.log(`  Embed batch size: ${EMBED_BATCH_SIZE}`);

  const priorityFoundationStats = await resolvePriorityFoundationStats();
  console.log(`  Priority foundations: ${priorityFoundationStats.size}`);
  const priorityFoundationIds = getPriorityFoundationIds(priorityFoundationStats);
  let fullSweepScope = null;
  let targetFoundationIds = null;
  if (PRIORITY_ONLY) {
    targetFoundationIds = priorityFoundationIds;
  } else if (FULL_SWEEP) {
    fullSweepScope = await resolveFullSweepFoundationScope();
    targetFoundationIds = fullSweepScope.foundationIds;
    console.log(`  Full sweep candidates: ${fullSweepScope.fullSweepCandidateCount}`);
    console.log(`  Full sweep cursor start: ${fullSweepScope.fullSweepCursorStart}`);
  }
  if (PRIORITY_ONLY && targetFoundationIds.length === 0) {
    console.log('  No priority foundations in scope');
  } else if (FULL_SWEEP && (!targetFoundationIds || targetFoundationIds.length === 0)) {
    console.log('  No full-sweep foundations in scope');
  }

  // Fetch all foundation programs with their foundation details (paginated)
  let programs = [];
  try {
    if (targetFoundationIds) {
      for (const foundationBatch of chunkArray(targetFoundationIds, 100)) {
        const scopedPrograms = await fetchPaginated((from, to) => (
          supabase
            .from('foundation_programs')
            .select(`
              id, name, url, description, amount_min, amount_max, deadline,
              status, categories, eligibility, application_process, program_type,
              scraped_at, created_at,
              foundations!inner(id, name, type, website, thematic_focus, geographic_focus)
            `)
            .in('foundation_id', foundationBatch)
            .order('created_at', { ascending: false })
            .range(from, to)
        ));
        programs.push(...scopedPrograms);
      }
    } else {
      programs = await fetchPaginated((from, to) => (
        supabase
          .from('foundation_programs')
          .select(`
            id, name, url, description, amount_min, amount_max, deadline,
            status, categories, eligibility, application_process, program_type,
            scraped_at, created_at,
            foundations!inner(id, name, type, website, thematic_focus, geographic_focus)
          `)
          .order('created_at', { ascending: false })
          .range(from, to)
      ));
    }
  } catch (pageError) {
    console.error('Failed to fetch foundation programs:', pageError.message);
    process.exit(1);
  }

  console.log(`  Found ${programs.length} foundation programs`);
  if (targetFoundationIds) {
    console.log(`  Scoped foundations: ${targetFoundationIds.length}`);
  }

  const eligiblePrograms = programs
    .filter((program) => isGrantLikeFoundationProgram(program, program.foundations))
    .sort((a, b) => {
      const priorityDelta = getProgramPriorityScore(b, priorityFoundationStats) - getProgramPriorityScore(a, priorityFoundationStats);
      if (priorityDelta !== 0) return priorityDelta;
      const scrapedDelta = new Date(b.scraped_at || b.created_at || 0).getTime() - new Date(a.scraped_at || a.created_at || 0).getTime();
      if (scrapedDelta !== 0) return scrapedDelta;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  const filteredPrograms = programs.length - eligiblePrograms.length;
  console.log(`  ${eligiblePrograms.length} look like public grant opportunities`);
  if (filteredPrograms > 0) {
    console.log(`  ${filteredPrograms} skipped as non-grant / direct-service / appeal programs`);
  }
  const priorityProgramCount = eligiblePrograms.filter((program) => priorityFoundationStats.has(program.foundations.id)).length;
  if (priorityProgramCount > 0) {
    console.log(`  ${priorityProgramCount} eligible programs belong to priority foundations`);
  }

  // Check which programs are already synced (paginated)
  let existing = [];
  try {
    if (targetFoundationIds) {
      for (const foundationBatch of chunkArray(targetFoundationIds, 100)) {
        const scopedExisting = await fetchPaginated((from, to) => (
          supabase
            .from('grant_opportunities')
            .select('id, name, foundation_id, source_id, description, amount_min, amount_max, deadline, closes_at, url, provider, program, categories, program_type, application_status, status, grant_type')
            .eq('source', 'foundation_program')
            .in('foundation_id', foundationBatch)
            .range(from, to)
        ));
        existing.push(...scopedExisting);
      }
    } else {
      existing = await fetchPaginated((from, to) => (
        supabase
          .from('grant_opportunities')
          .select('id, name, foundation_id, source_id, description, amount_min, amount_max, deadline, closes_at, url, provider, program, categories, program_type, application_status, status, grant_type')
          .eq('source', 'foundation_program')
          .not('foundation_id', 'is', null)
          .range(from, to)
      ));
    }
  } catch (existError) {
    console.error('Failed to check existing:', existError.message);
    process.exit(1);
  }

  const existingByKey = new Map(existing.map(grant => [`${grant.foundation_id}::${grant.name}`, grant]));
  const existingBySourceId = new Map(
    existing
      .filter(grant => grant.source_id)
      .map(grant => [String(grant.source_id), grant])
  );

  console.log(`  ${existingByKey.size} already synced${targetFoundationIds ? ' in scope' : ''}`);

  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let cleaned = 0;
  let statusesUpdated = 0;
  const foundationSyncStats = new Map();
  const touchedGrantIds = [];

  if (CLEANUP_INVALID) {
    const existingProgramsByKey = new Map(
      programs.map((program) => [buildProgramKey(program), program])
    );
    const statusBuckets = new Map();
    for (const program of programs) {
      const desiredStatus = getDesiredProgramStatus(program, program.foundations);
      if (program.status !== desiredStatus) {
        const bucket = statusBuckets.get(desiredStatus) || [];
        bucket.push(program.id);
        statusBuckets.set(desiredStatus, bucket);
      }
    }

    if (statusBuckets.size > 0) {
      for (const [status, ids] of statusBuckets.entries()) {
        console.log(`  ${ids.length} foundation programs should be marked ${status}`);
        if (!DRY_RUN) {
          for (const idBatch of chunkArray(ids, 250)) {
            const { error: statusUpdateError } = await supabase
              .from('foundation_programs')
              .update({ status })
              .in('id', idBatch);
            if (statusUpdateError) {
              console.error(`Failed to update foundation_programs status -> ${status}: ${statusUpdateError.message}`);
              process.exit(1);
            }
          }
          statusesUpdated += ids.length;
        }
      }
    }

    let existingFoundationGrants = [];
    try {
      if (targetFoundationIds) {
        for (const foundationBatch of chunkArray(targetFoundationIds, 100)) {
          const scopedGrants = await fetchPaginated((from, to) => (
            supabase
              .from('grant_opportunities')
              .select('id, foundation_id, name')
              .eq('source', 'foundation_program')
              .in('foundation_id', foundationBatch)
              .range(from, to)
          ));
          existingFoundationGrants.push(...scopedGrants);
        }
      } else {
        existingFoundationGrants = await fetchPaginated((from, to) => (
          supabase
            .from('grant_opportunities')
            .select('id, foundation_id, name')
            .eq('source', 'foundation_program')
            .not('foundation_id', 'is', null)
            .range(from, to)
        ));
      }
    } catch (existingFoundationGrantsError) {
      console.error('Failed to fetch existing foundation-program grants for cleanup:', existingFoundationGrantsError.message);
      process.exit(1);
    }

    const invalidGrantIds = (existingFoundationGrants || [])
      .filter((grant) => {
        const program = existingProgramsByKey.get(`${grant.foundation_id}::${grant.name}`);
        return !program || !isGrantLikeFoundationProgram(program, program.foundations);
      })
      .map((grant) => grant.id);

    if (invalidGrantIds.length > 0) {
      console.log(`  Cleaning up ${invalidGrantIds.length} invalid foundation-program grants already in search`);
      if (!DRY_RUN) {
        for (const dependency of GRANT_DEPENDENCIES) {
          const { error: dependencyDeleteError } = await supabase
            .from(dependency.table)
            .delete()
            .in(dependency.column, invalidGrantIds);
          if (dependencyDeleteError) {
            const message = dependencyDeleteError.message || '';
            const missingTable = /Could not find the table|relation .* does not exist/i.test(message);
            if (missingTable) {
              console.warn(`Skipping missing dependency table ${dependency.table}`);
              continue;
            }
            console.error(`Failed to delete dependent ${dependency.table} rows: ${message}`);
            process.exit(1);
          }
        }
        const { error: deleteError } = await supabase
          .from('grant_opportunities')
          .delete()
          .in('id', invalidGrantIds);
        if (deleteError) {
          console.error('Failed to delete invalid foundation-program grants:', deleteError.message);
          process.exit(1);
        }
        cleaned = invalidGrantIds.length;
      }
    }
  }

  for (const program of eligiblePrograms) {
    const foundation = program.foundations;
    const key = buildProgramKey(program);
    const grant = buildGrantPayload(program, foundation);
    const existingGrant = existingBySourceId.get(String(program.id)) || existingByKey.get(key);

    if (DRY_RUN) {
      const action = existingGrant ? (grantNeedsUpdate(existingGrant, grant) ? 'update' : 'skip') : 'insert';
      console.log(`  Would ${action}: ${program.name} (${foundation.name})`);
      if (action === 'insert') inserted++;
      else if (action === 'update') updated++;
      else skipped++;
      recordFoundationSyncStat(foundationSyncStats, foundation.id, action === 'insert' ? 'inserted' : action === 'update' ? 'updated' : 'skipped');
      continue;
    }

    if (existingGrant) {
      if (!grantNeedsUpdate(existingGrant, grant)) {
        skipped++;
        recordFoundationSyncStat(foundationSyncStats, foundation.id, 'skipped');
        continue;
      }

      const { error: updateError } = await supabase
        .from('grant_opportunities')
        .update({ ...grant, updated_at: new Date().toISOString() })
        .eq('id', existingGrant.id);

      if (updateError) {
        if (isDuplicateUrlError(updateError)) {
          const fallbackGrant = { ...grant, url: existingGrant.url || null, updated_at: new Date().toISOString() };
          const { error: fallbackUpdateError } = await supabase
            .from('grant_opportunities')
            .update(fallbackGrant)
            .eq('id', existingGrant.id);

          if (fallbackUpdateError) {
            console.error(`  Error updating "${program.name}": ${fallbackUpdateError.message}`);
            errors++;
            recordFoundationSyncStat(foundationSyncStats, foundation.id, 'errors');
          } else {
            updated++;
            if (existingGrant.name && existingGrant.name !== grant.name) {
              existingByKey.delete(`${foundation.id}::${existingGrant.name}`);
            }
            const merged = { ...existingGrant, ...grant, url: existingGrant.url || null };
            existingByKey.set(key, merged);
            existingBySourceId.set(String(program.id), merged);
            recordFoundationSyncStat(foundationSyncStats, foundation.id, 'updated');
            touchedGrantIds.push(existingGrant.id);
          }
        } else {
          console.error(`  Error updating "${program.name}": ${updateError.message}`);
          errors++;
          recordFoundationSyncStat(foundationSyncStats, foundation.id, 'errors');
        }
      } else {
        updated++;
        if (existingGrant.name && existingGrant.name !== grant.name) {
          existingByKey.delete(`${foundation.id}::${existingGrant.name}`);
        }
        const merged = { ...existingGrant, ...grant };
        existingByKey.set(key, merged);
        existingBySourceId.set(String(program.id), merged);
        recordFoundationSyncStat(foundationSyncStats, foundation.id, 'updated');
        touchedGrantIds.push(existingGrant.id);
      }
      continue;
    }

    const { data: insertedGrant, error: insertError } = await supabase
      .from('grant_opportunities')
      .insert(grant)
      .select('id')
      .single();

    if (insertError) {
      if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
        if (isDuplicateUrlError(insertError)) {
          const fallbackGrant = { ...grant, url: null };
          const { data: fallbackInsertedGrant, error: fallbackInsertError } = await supabase
            .from('grant_opportunities')
            .insert(fallbackGrant)
            .select('id')
            .single();

          if (fallbackInsertError) {
            console.error(`  Error syncing "${program.name}": ${fallbackInsertError.message}`);
            errors++;
            recordFoundationSyncStat(foundationSyncStats, foundation.id, 'errors');
          } else {
            inserted++;
            const merged = { ...fallbackGrant, id: fallbackInsertedGrant?.id };
            existingByKey.set(key, merged);
            existingBySourceId.set(String(program.id), merged);
            recordFoundationSyncStat(foundationSyncStats, foundation.id, 'inserted');
            if (fallbackInsertedGrant?.id) touchedGrantIds.push(fallbackInsertedGrant.id);
          }
        } else {
          skipped++;
          recordFoundationSyncStat(foundationSyncStats, foundation.id, 'skipped');
        }
      } else {
        console.error(`  Error syncing "${program.name}": ${insertError.message}`);
        errors++;
        recordFoundationSyncStat(foundationSyncStats, foundation.id, 'errors');
      }
    } else {
      inserted++;
      const merged = { ...grant, id: insertedGrant?.id };
      existingByKey.set(key, merged);
      existingBySourceId.set(String(program.id), merged);
      recordFoundationSyncStat(foundationSyncStats, foundation.id, 'inserted');
      if (insertedGrant?.id) touchedGrantIds.push(insertedGrant.id);
    }
  }

  if (!DRY_RUN) {
    const touchedFoundations = new Map(
      [...foundationSyncStats.entries()].filter(([, stats]) => stats.inserted > 0 || stats.updated > 0 || stats.errors > 0)
    );
    await applyFrontierSyncMetadata(touchedFoundations);
  }

  let embeddingResult = { embedded: 0, errors: 0, skipped: true, output: '' };
  if (!DRY_RUN && !SKIP_EMBED && touchedGrantIds.length > 0) {
    console.log(`\nEmbedding ${new Set(touchedGrantIds).size} inserted/updated foundation grants...`);
    embeddingResult = await runGrantEmbeddingBackfill(touchedGrantIds);
    if (embeddingResult.output) {
      const lines = embeddingResult.output.trim().split('\n').filter(Boolean);
      for (const line of lines.slice(-5)) {
        console.log(`  ${line}`);
      }
    }
    if (embeddingResult.error) {
      console.warn(`  Embedding handoff failed: ${embeddingResult.error}`);
    }
  }

  await logComplete(supabase, run.id, {
    items_found: programs.length,
    items_new: inserted,
    items_updated: updated + statusesUpdated + cleaned,
    status: errors > 0 || embeddingResult.errors > 0 ? 'partial' : 'success',
    errors: [
      ...(errors > 0 ? [`${errors} sync errors`] : []),
      ...(embeddingResult.errors > 0 ? [`${embeddingResult.errors} embedding errors`] : []),
    ],
  });

  if (FULL_SWEEP && !PRIORITY_ONLY && !DRY_RUN && fullSweepScope && fullSweepScope.fullSweepCandidateCount > 0) {
    const nextCursor = ((fullSweepScope.fullSweepCursorStart || 0) + targetFoundationIds.length) % fullSweepScope.fullSweepCandidateCount;
    await updateAgentRuntimeState(AGENT_ID, {
      fullSweepCursor: nextCursor,
      fullSweepCandidateCount: fullSweepScope.fullSweepCandidateCount,
      fullSweepAdvancedBy: targetFoundationIds.length,
      fullSweepLastRunAt: new Date().toISOString(),
      fullSweepLastInserted: inserted,
      fullSweepLastUpdated: updated,
      fullSweepLastSkipped: skipped,
      fullSweepLastErrors: errors,
      fullSweepLastBatchFoundationIds: targetFoundationIds,
      fullSweepLastBatchFoundationNames: fullSweepScope.foundationNames,
    });
    console.log(`  Full sweep cursor advanced to ${nextCursor}/${fullSweepScope.fullSweepCandidateCount}`);
  }

  console.log(`\nComplete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${cleaned} cleaned, ${statusesUpdated} status updates, ${errors} errors`);
  if (targetFoundationIds) {
    console.log(`Foundation-program grants in scope: ${existing.length - cleaned + inserted}`);
  } else {
    console.log(`Total foundation programs in grants: ${existing.length - cleaned + inserted}`);
  }
  if (!DRY_RUN && !SKIP_EMBED && touchedGrantIds.length > 0) {
    console.log(`Embeddings: ${embeddingResult.embedded} embedded, ${embeddingResult.errors} errors`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
