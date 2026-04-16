#!/usr/bin/env node

/**
 * Sync Source Frontier
 *
 * Seeds and maintains a crawl frontier for:
 * - Known grant-source landing pages and APIs
 * - Foundation homepages
 * - Foundation candidate grants/news/apply pages
 * - Known scraped foundation URLs
 * - Foundation program URLs discovered from scans
 *
 * The goal is to make repeated discovery stateful: the system knows what URLs
 * exist, why they matter, and when each one should be checked next.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-source-frontier.mjs
 *   node --env-file=.env scripts/sync-source-frontier.mjs --dry-run
 *   node --env-file=.env scripts/sync-source-frontier.mjs --limit-foundations=500 --no-candidates
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'sync-source-frontier';
const AGENT_NAME = 'Sync Source Frontier';
const PAGE_SIZE = 1000;
const AUTO_DISABLE_REASON = 'repeated_404_candidate_page';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const NO_CANDIDATES = process.argv.includes('--no-candidates');
const limitArg = process.argv.find(arg => arg.startsWith('--limit-foundations='));
const LIMIT_FOUNDATIONS = limitArg ? Math.max(0, Number.parseInt(limitArg.split('=')[1], 10) || 0) : null;
const NOW = new Date();
const NOW_ISO = NOW.toISOString();

const FOUNDATION_CANDIDATE_PATHS = [
  '/grants',
  '/programs',
  '/apply',
  '/what-we-fund',
  '/news',
  '/annual-report',
];

const EXCLUDED_AUTO_GRANT_SOURCES = new Set([
  'foundation_program',
  'ghl_sync',
  'manual-research',
  'web-search',
  'web_research',
  'meeting_notes',
  'alta_agent',
  'agreement',
  'grantscope_sweep',
]);

const LONG_TAIL_FUNDER_TYPES = new Set([
  'university',
  'primary_health_network',
  'community_foundation',
  'education_body',
  'research_body',
  'indigenous_organisation',
  'public_ancillary_fund',
  'private_ancillary_fund',
  'legal_aid',
]);

const SOURCE_KIND_RANK = {
  foundation_homepage: 1,
  foundation_candidate_page: 2,
  foundation_known_page: 3,
  foundation_program_page: 4,
  grant_source_page: 5,
};

const GRANT_SOURCE_TARGETS = [
  {
    sourceKey: 'grant-source:grantconnect:rss',
    sourceKind: 'grant_source_page',
    sourceName: 'GrantConnect RSS',
    targetUrl: 'https://www.grants.gov.au/public_data/rss/rss.xml',
    parserHint: 'grantconnect-rss',
    owningAgentId: 'grantscope-discovery',
    discoverySource: 'grantconnect',
    cadenceHours: 4,
    priority: 10,
    changeDetection: 'rss',
    metadata: { roles: ['feed'], source_plugin: 'grantconnect' },
  },
  {
    sourceKey: 'grant-source:grantconnect:list',
    sourceKind: 'grant_source_page',
    sourceName: 'GrantConnect List',
    targetUrl: 'https://www.grants.gov.au/Go/List',
    parserHint: 'grantconnect-html',
    owningAgentId: 'grantscope-discovery',
    discoverySource: 'grantconnect',
    cadenceHours: 6,
    priority: 9,
    changeDetection: 'html',
    metadata: { roles: ['list'], source_plugin: 'grantconnect' },
  },
  {
    sourceKey: 'grant-source:business-gov-au',
    sourceKind: 'grant_source_page',
    sourceName: 'Business.gov.au Grants',
    targetUrl: 'https://business.gov.au/grants-and-programs',
    parserHint: 'business-gov-au',
    owningAgentId: 'grantscope-discovery',
    discoverySource: 'business-gov-au',
    cadenceHours: 12,
    priority: 8,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'business-gov-au' },
  },
  {
    sourceKey: 'grant-source:data-gov-au:ckan',
    sourceKind: 'grant_source_page',
    sourceName: 'Data.gov.au CKAN API',
    targetUrl: 'https://data.gov.au/data/api/3/action/package_search',
    parserHint: 'data-gov-au-api',
    owningAgentId: 'grantscope-discovery',
    discoverySource: 'data-gov-au',
    cadenceHours: 24,
    priority: 6,
    changeDetection: 'api',
    metadata: { roles: ['api'], source_plugin: 'data-gov-au' },
  },
  {
    sourceKey: 'grant-source:qld-grants:ckan',
    sourceKind: 'grant_source_page',
    sourceName: 'Queensland Grants Finder Meta Resource',
    targetUrl: 'https://www.data.qld.gov.au/api/3/action/datastore_search?resource_id=cca41845-9898-4efe-9ca0-17fbd44a3321&limit=1',
    parserHint: 'qld-grants-api',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'qld-grants',
    cadenceHours: 24,
    priority: 7,
    changeDetection: 'api',
    metadata: { roles: ['api'], source_plugin: 'qld-grants' },
  },
  {
    sourceKey: 'grant-source:nsw-grants:list',
    sourceKind: 'grant_source_page',
    sourceName: 'NSW Grants and Funding',
    targetUrl: 'https://www.nsw.gov.au/grants-and-funding',
    parserHint: 'nsw-grants-html',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'nsw-grants',
    cadenceHours: 12,
    priority: 8,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'nsw-grants' },
  },
  {
    sourceKey: 'grant-source:nsw-grants:api',
    sourceKind: 'grant_source_page',
    sourceName: 'NSW Grants Search API',
    targetUrl: 'https://www.nsw.gov.au/api/v1/elasticsearch/prod_content/_search',
    parserHint: 'nsw-grants-api',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'nsw-grants',
    cadenceHours: 12,
    priority: 9,
    changeDetection: 'api',
    metadata: { roles: ['api'], source_plugin: 'nsw-grants' },
  },
  {
    sourceKey: 'grant-source:vic-grants:main',
    sourceKind: 'grant_source_page',
    sourceName: 'VIC Grants',
    targetUrl: 'https://www.vic.gov.au/grants',
    parserHint: 'vic-grants-main',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'vic-grants',
    cadenceHours: 12,
    priority: 8,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'vic-grants' },
  },
  {
    sourceKey: 'grant-source:vic-grants:creative',
    sourceKind: 'grant_source_page',
    sourceName: 'Creative Victoria Funding',
    targetUrl: 'https://creative.vic.gov.au/funding',
    parserHint: 'vic-grants-department',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'vic-grants',
    cadenceHours: 24,
    priority: 6,
    changeDetection: 'html',
    metadata: { roles: ['department'], source_plugin: 'vic-grants' },
  },
  {
    sourceKey: 'grant-source:vic-grants:regional',
    sourceKind: 'grant_source_page',
    sourceName: 'Regional Development Victoria Grants',
    targetUrl: 'https://www.rdv.vic.gov.au/grants-and-programs',
    parserHint: 'vic-grants-department',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'vic-grants',
    cadenceHours: 24,
    priority: 6,
    changeDetection: 'html',
    metadata: { roles: ['department'], source_plugin: 'vic-grants' },
  },
  {
    sourceKey: 'grant-source:act-grants',
    sourceKind: 'grant_source_page',
    sourceName: 'ACT Grants',
    targetUrl: 'https://www.act.gov.au/grants',
    parserHint: 'act-grants',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'act-grants',
    cadenceHours: 24,
    priority: 7,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'act-grants' },
  },
  {
    sourceKey: 'grant-source:nt-grants:directory',
    sourceKind: 'grant_source_page',
    sourceName: 'NT Grants Directory',
    targetUrl: 'https://nt.gov.au/community/grants-and-volunteers/grants/grants-directory',
    parserHint: 'nt-grants-directory',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'nt-grants',
    cadenceHours: 24,
    priority: 7,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'nt-grants' },
  },
  {
    sourceKey: 'grant-source:nt-grants:portal',
    sourceKind: 'grant_source_page',
    sourceName: 'GrantsNT Portal',
    targetUrl: 'https://grantsnt.nt.gov.au/grants',
    parserHint: 'nt-grants-portal',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'nt-grants',
    cadenceHours: 24,
    priority: 8,
    changeDetection: 'html',
    metadata: { roles: ['portal'], source_plugin: 'nt-grants' },
  },
  {
    sourceKey: 'grant-source:sa-grants:main',
    sourceKind: 'grant_source_page',
    sourceName: 'SA Grants',
    targetUrl: 'https://www.sa.gov.au/topics/care-and-support/concessions/financial-aid/grants',
    parserHint: 'sa-grants-main',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'sa-grants',
    cadenceHours: 24,
    priority: 7,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'sa-grants' },
  },
  {
    sourceKey: 'grant-source:sa-grants:dhs',
    sourceKind: 'grant_source_page',
    sourceName: 'DHS Grants SA',
    targetUrl: 'https://dhs.sa.gov.au/how-we-help/grants/available-grants',
    parserHint: 'sa-grants-department',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'sa-grants',
    cadenceHours: 24,
    priority: 6,
    changeDetection: 'html',
    metadata: { roles: ['department'], source_plugin: 'sa-grants' },
  },
  {
    sourceKey: 'grant-source:tas-grants',
    sourceKind: 'grant_source_page',
    sourceName: 'Tasmania Grants List',
    targetUrl: 'https://www.stategrowth.tas.gov.au/grants_and_funding_opportunities/grants_list',
    parserHint: 'tas-grants',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'tas-grants',
    cadenceHours: 24,
    priority: 7,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'tas-grants' },
  },
  {
    sourceKey: 'grant-source:wa-grants:main',
    sourceKind: 'grant_source_page',
    sourceName: 'WA Community Grants',
    targetUrl: 'https://www.wa.gov.au/service/community-services/grants-and-subsidies',
    parserHint: 'wa-grants-main',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'wa-grants',
    cadenceHours: 24,
    priority: 7,
    changeDetection: 'html',
    metadata: { roles: ['directory'], source_plugin: 'wa-grants' },
  },
  {
    sourceKey: 'grant-source:wa-grants:lotterywest',
    sourceKind: 'grant_source_page',
    sourceName: 'Lotterywest Opportunities',
    targetUrl: 'https://www.lotterywest.wa.gov.au/grants/grant-opportunities',
    parserHint: 'wa-grants-lotterywest',
    owningAgentId: 'scrape-state-grants',
    discoverySource: 'wa-grants',
    cadenceHours: 12,
    priority: 8,
    changeDetection: 'html',
    metadata: { roles: ['funder'], source_plugin: 'wa-grants' },
  },
  {
    sourceKey: 'grant-source:arc-grants',
    sourceKind: 'grant_source_page',
    sourceName: 'ARC Grants API',
    targetUrl: 'https://dataportal.arc.gov.au/NCGP/API/grants',
    parserHint: 'arc-grants-api',
    owningAgentId: 'grantscope-discovery',
    discoverySource: 'arc-grants',
    cadenceHours: 168,
    priority: 4,
    changeDetection: 'api',
    metadata: { roles: ['historical-awards'], source_plugin: 'arc-grants' },
  },
  {
    sourceKey: 'grant-source:nhmrc-grants',
    sourceKind: 'grant_source_page',
    sourceName: 'NHMRC Funding Outcomes',
    targetUrl: 'https://www.nhmrc.gov.au/funding/data-research/outcomes-funding-rounds',
    parserHint: 'nhmrc-outcomes',
    owningAgentId: 'grantscope-discovery',
    discoverySource: 'nhmrc',
    cadenceHours: 168,
    priority: 4,
    changeDetection: 'html',
    metadata: { roles: ['historical-awards'], source_plugin: 'nhmrc' },
  },
];

function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    url.hash = '';

    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = '';
    }

    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function addHours(isoString, hours) {
  return new Date(new Date(isoString).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function shortHash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

async function fetchAll(table, select, configureQuery) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = db.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (typeof configureQuery === 'function') query = configureQuery(query);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function normalizeRoles(existingRoles, rolesToAdd) {
  const roles = new Set(Array.isArray(existingRoles) ? existingRoles : []);
  for (const role of Array.isArray(rolesToAdd) ? rolesToAdd : [rolesToAdd]) {
    if (role) roles.add(role);
  }
  return [...roles].sort();
}

function computeFoundationBasePriority(foundation) {
  if (!foundation.last_scraped_at) return 7;
  if ((foundation.total_giving_annual || 0) >= 10_000_000) return 6;
  return 4;
}

function shouldTreatAsOpen(program) {
  if (program.status === 'open') return true;
  if (!program.deadline) return false;
  return new Date(program.deadline) >= NOW;
}

function buildNextCheckAt(existingRow, cadenceHours) {
  if (existingRow?.next_check_at) return existingRow.next_check_at;
  if (existingRow?.last_checked_at) return addHours(existingRow.last_checked_at, cadenceHours);
  return NOW_ISO;
}

function shouldPreserveAutoDisabledCandidate(existingRow, target) {
  return Boolean(
    existingRow
    && existingRow.enabled === false
    && existingRow.source_kind === 'foundation_candidate_page'
    && target.sourceKind === 'foundation_candidate_page'
    && existingRow.last_http_status === 404
    && (existingRow.metadata?.auto_disabled_reason === AUTO_DISABLE_REASON)
  );
}

function mergeTarget(existingTarget, nextTarget) {
  if (!existingTarget) return nextTarget;

  const existingRank = SOURCE_KIND_RANK[existingTarget.sourceKind] || 0;
  const nextRank = SOURCE_KIND_RANK[nextTarget.sourceKind] || 0;
  const winner = nextRank >= existingRank ? nextTarget : existingTarget;
  const roles = normalizeRoles(existingTarget.metadata?.roles, nextTarget.metadata?.roles || [nextTarget.sourceKind]);

  return {
    ...existingTarget,
    ...winner,
    cadenceHours: Math.min(existingTarget.cadenceHours, nextTarget.cadenceHours),
    priority: Math.max(existingTarget.priority, nextTarget.priority),
    changeDetection: winner.changeDetection || existingTarget.changeDetection,
    metadata: {
      ...existingTarget.metadata,
      ...nextTarget.metadata,
      roles,
    },
  };
}

function makeFoundationTargetKey(foundationId, url) {
  return `foundation:${foundationId}:${shortHash(url)}`;
}

function makeGrantSourceAutoKey(source, url) {
  return `grant-source:auto:${source}:${shortHash(url)}`;
}

function inferChangeDetectionFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith('.xml') || pathname.includes('/rss')) return 'rss';
    if (pathname.endsWith('.json') || pathname.includes('/api/')) return 'api';
    if (pathname.endsWith('.csv')) return 'csv';
    return 'html';
  } catch {
    return 'html';
  }
}

function deriveGrantSourceLandingUrl(rawUrl) {
  const normalized = canonicalizeUrl(rawUrl);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const pathname = url.pathname.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (
      hostname.includes('data.brisbane.qld.gov.au') ||
      pathname.includes('/explore/dataset/') ||
      pathname.includes('/dataset/') ||
      pathname.includes('/data/dataset/')
    ) {
      url.search = '';
    }

    return canonicalizeUrl(url.toString());
  } catch {
    return normalized;
  }
}

function shouldExpandLongTailFoundation(foundation, programCount) {
  if (!foundation.website) return false;
  if ((programCount || 0) > 0) return false;
  if (LONG_TAIL_FUNDER_TYPES.has(foundation.type)) return true;
  return Number(foundation.total_giving_annual || 0) >= 25_000_000;
}

function getLongTailFunderPaths(foundation) {
  const paths = new Set(['/funding', '/grants-and-funding']);

  if (['university', 'education_body', 'research_body'].includes(foundation.type)) {
    paths.add('/scholarships');
    paths.add('/research/grants');
  }

  if ([
    'community_foundation',
    'primary_health_network',
    'indigenous_organisation',
    'legal_aid',
    'public_ancillary_fund',
    'private_ancillary_fund',
    'corporate_foundation',
    'service_delivery',
    'international_aid',
  ].includes(foundation.type)) {
    paths.add('/community-grants');
  }

  return [...paths];
}

function compareFrontierRow(existingRow, nextRow) {
  if (!existingRow) return false;

  const comparableFields = [
    'source_kind',
    'source_name',
    'target_url',
    'domain',
    'parser_hint',
    'owning_agent_id',
    'discovery_source',
    'foundation_id',
    'gs_entity_id',
    'cadence_hours',
    'priority',
    'enabled',
    'change_detection',
    'confidence',
    'next_check_at',
  ];

  for (const field of comparableFields) {
    const existingValue = existingRow[field] ?? null;
    const nextValue = nextRow[field] ?? null;
    if (existingValue !== nextValue) return false;
  }

  return stableStringify(existingRow.metadata || {}) === stableStringify(nextRow.metadata || {});
}

function targetToRow(target, existingRow) {
  const preserveAutoDisabled = shouldPreserveAutoDisabledCandidate(existingRow, target);
  const metadata = {
    ...(existingRow?.metadata || {}),
    ...(target.metadata || {}),
  };

  if (!preserveAutoDisabled && metadata.auto_disabled_reason === AUTO_DISABLE_REASON) {
    metadata.auto_disabled_reason = null;
    metadata.auto_disabled_at = null;
    metadata.auto_disabled_status = null;
    metadata.auto_disabled_failure_count = null;
  }

  return {
    source_key: target.sourceKey,
    source_kind: target.sourceKind,
    source_name: target.sourceName,
    target_url: target.targetUrl,
    domain: getDomain(target.targetUrl),
    parser_hint: target.parserHint,
    owning_agent_id: target.owningAgentId,
    discovery_source: target.discoverySource,
    foundation_id: target.foundationId || null,
    gs_entity_id: target.gsEntityId || null,
    cadence_hours: target.cadenceHours,
    priority: target.priority,
    enabled: preserveAutoDisabled ? false : true,
    change_detection: target.changeDetection,
    confidence: target.confidence || 'seeded',
    next_check_at: buildNextCheckAt(existingRow, target.cadenceHours),
    metadata,
    updated_at: NOW_ISO,
  };
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    console.log(`[${NOW_ISO}] Syncing source frontier${DRY_RUN ? ' (dry run)' : ''}`);

    const [existingRows, allFoundations, programRows, grantRows] = await Promise.all([
      fetchAll(
        'source_frontier',
        'source_key, source_kind, source_name, target_url, domain, parser_hint, owning_agent_id, discovery_source, foundation_id, gs_entity_id, cadence_hours, priority, enabled, change_detection, confidence, next_check_at, last_checked_at, last_http_status, failure_count, metadata'
      ),
      fetchAll(
        'foundations',
        'id, name, website, gs_entity_id, total_giving_annual, last_scraped_at, scraped_urls',
        query => query.not('website', 'is', null).order('total_giving_annual', { ascending: false, nullsFirst: false })
      ),
      fetchAll(
        'foundation_programs',
        'foundation_id, name, url, status, deadline, scraped_at',
        query => query.not('url', 'is', null)
      ),
      fetchAll(
        'grant_opportunities',
        'source, discovery_method, url',
        query => query.not('source', 'is', null).not('url', 'is', null)
      ),
    ]);

    const foundations = LIMIT_FOUNDATIONS !== null
      ? allFoundations.slice(0, LIMIT_FOUNDATIONS)
      : allFoundations;

    const existingByKey = new Map(existingRows.map(row => [row.source_key, row]));
    const desiredTargets = new Map();
    const foundationEntityById = new Map(foundations.map(foundation => [foundation.id, foundation.gs_entity_id]));
    const includedFoundationIds = new Set(foundations.map(foundation => foundation.id));
    const programCountByFoundationId = new Map();
    const explicitDiscoverySources = new Set(
      GRANT_SOURCE_TARGETS.map((source) => source.discoverySource).filter(Boolean)
    );

    const addTarget = (target) => {
      const normalizedUrl = canonicalizeUrl(target.targetUrl);
      if (!normalizedUrl) return;
      const nextTarget = { ...target, targetUrl: normalizedUrl };
      const current = desiredTargets.get(nextTarget.sourceKey);
      desiredTargets.set(nextTarget.sourceKey, mergeTarget(current, nextTarget));
    };

    for (const source of GRANT_SOURCE_TARGETS) {
      addTarget(source);
    }

    const grantSourceGroups = new Map();
    for (const row of grantRows) {
      const source = String(row.source || '').trim();
      if (!source || EXCLUDED_AUTO_GRANT_SOURCES.has(source) || explicitDiscoverySources.has(source)) continue;
      const landingUrl = deriveGrantSourceLandingUrl(row.url);
      if (!landingUrl) continue;

      const current = grantSourceGroups.get(source) || {
        source,
        discoveryMethod: row.discovery_method || null,
        totalRows: 0,
        urlCounts: new Map(),
      };
      current.totalRows += 1;
      if (!current.discoveryMethod && row.discovery_method) current.discoveryMethod = row.discovery_method;
      current.urlCounts.set(landingUrl, (current.urlCounts.get(landingUrl) || 0) + 1);
      grantSourceGroups.set(source, current);
    }

    for (const group of [...grantSourceGroups.values()].sort((a, b) => b.totalRows - a.totalRows)) {
      if (group.totalRows < 25) continue;
      if (group.urlCounts.size > 8) continue;

      const rankedUrls = [...group.urlCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const [landingUrl, dominantCount] = rankedUrls[0] || [];
      if (!landingUrl || !dominantCount) continue;
      if (dominantCount < Math.max(5, Math.ceil(group.totalRows * 0.2))) continue;

      const discoveryMethod = group.discoveryMethod || 'derived-from-grants';
      const changeDetection = inferChangeDetectionFromUrl(landingUrl);
      const priority = group.totalRows >= 1000 ? 9 : group.totalRows >= 100 ? 7 : 6;
      const cadenceHours = changeDetection === 'api' ? 24 : 48;

      addTarget({
        sourceKey: makeGrantSourceAutoKey(group.source, landingUrl),
        sourceKind: 'grant_source_page',
        sourceName: `${group.source} derived landing page`,
        targetUrl: landingUrl,
        parserHint: 'grant-source-auto',
        owningAgentId: 'sync-source-frontier',
        discoverySource: group.source,
        cadenceHours,
        priority,
        changeDetection,
        confidence: 'derived',
        metadata: {
          roles: ['derived-from-grants'],
          source_plugin: group.source,
          discovery_method: discoveryMethod,
          derived_grant_rows: group.totalRows,
          derived_url_count: group.urlCounts.size,
          dominant_url_rows: dominantCount,
        },
      });
    }

    for (const program of programRows) {
      if (!includedFoundationIds.has(program.foundation_id)) continue;
      programCountByFoundationId.set(
        program.foundation_id,
        (programCountByFoundationId.get(program.foundation_id) || 0) + 1,
      );
    }

    for (const foundation of foundations) {
      const website = canonicalizeUrl(foundation.website);
      if (!website) continue;

      const origin = new URL(website).origin;
      const basePriority = computeFoundationBasePriority(foundation);
      const homepageKey = makeFoundationTargetKey(foundation.id, origin);

      addTarget({
        sourceKey: homepageKey,
        sourceKind: 'foundation_homepage',
        sourceName: `${foundation.name} homepage`,
        targetUrl: origin,
        parserHint: 'foundation-profile',
        owningAgentId: 'build-foundation-profiles',
        discoverySource: 'foundation-profile',
        foundationId: foundation.id,
        gsEntityId: foundation.gs_entity_id,
        cadenceHours: foundation.last_scraped_at ? 168 : 72,
        priority: basePriority,
        changeDetection: 'html',
        metadata: {
          foundation_name: foundation.name,
          roles: ['homepage'],
        },
      });

      if (!NO_CANDIDATES) {
        for (const path of FOUNDATION_CANDIDATE_PATHS) {
          const candidateUrl = new URL(path, origin).toString();
          addTarget({
            sourceKey: makeFoundationTargetKey(foundation.id, candidateUrl),
            sourceKind: 'foundation_candidate_page',
            sourceName: `${foundation.name} ${path.slice(1)}`,
            targetUrl: candidateUrl,
            parserHint: 'foundation-program-search',
            owningAgentId: 'discover-foundation-programs',
            discoverySource: 'foundation-candidate',
            foundationId: foundation.id,
            gsEntityId: foundation.gs_entity_id,
            cadenceHours: foundation.last_scraped_at ? 168 : 72,
            priority: basePriority + 1,
            changeDetection: 'html',
            metadata: {
              foundation_name: foundation.name,
              roles: [`candidate:${path}`],
              candidate_path: path,
            },
          });
        }
      }

      if (shouldExpandLongTailFoundation(foundation, programCountByFoundationId.get(foundation.id) || 0)) {
        for (const path of getLongTailFunderPaths(foundation)) {
          const candidateUrl = new URL(path, origin).toString();
          addTarget({
            sourceKey: makeFoundationTargetKey(foundation.id, candidateUrl),
            sourceKind: 'foundation_candidate_page',
            sourceName: `${foundation.name} ${path.slice(1)}`,
            targetUrl: candidateUrl,
            parserHint: 'foundation-program-search',
            owningAgentId: 'discover-foundation-programs',
            discoverySource: 'foundation-candidate',
            foundationId: foundation.id,
            gsEntityId: foundation.gs_entity_id,
            cadenceHours: 72,
            priority: Math.max(basePriority + 1, 8),
            changeDetection: 'html',
            confidence: 'derived',
            metadata: {
              foundation_name: foundation.name,
              roles: [`long-tail:${path}`],
              candidate_path: path,
              long_tail_priority: true,
              foundation_type: foundation.type,
              total_giving_annual: foundation.total_giving_annual || null,
            },
          });
        }
      }

      if (Array.isArray(foundation.scraped_urls)) {
        for (const scrapedUrl of foundation.scraped_urls) {
          addTarget({
            sourceKey: makeFoundationTargetKey(foundation.id, scrapedUrl),
            sourceKind: 'foundation_known_page',
            sourceName: `${foundation.name} known page`,
            targetUrl: scrapedUrl,
            parserHint: 'foundation-profile',
            owningAgentId: 'build-foundation-profiles',
            discoverySource: 'foundation-profile',
            foundationId: foundation.id,
            gsEntityId: foundation.gs_entity_id,
            cadenceHours: 96,
            priority: basePriority + 1,
            changeDetection: scrapedUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
            metadata: {
              foundation_name: foundation.name,
              roles: ['scraped-url'],
            },
          });
        }
      }
    }

    for (const program of programRows) {
      const programUrl = canonicalizeUrl(program.url);
      if (!programUrl || !program.foundation_id) continue;
      if (LIMIT_FOUNDATIONS !== null && !includedFoundationIds.has(program.foundation_id)) continue;
      const openNow = shouldTreatAsOpen(program);
      addTarget({
        sourceKey: makeFoundationTargetKey(program.foundation_id, programUrl),
        sourceKind: 'foundation_program_page',
        sourceName: program.name || 'Foundation program',
        targetUrl: programUrl,
        parserHint: 'foundation-program',
        owningAgentId: 'discover-foundation-programs',
        discoverySource: 'foundation_program',
        foundationId: program.foundation_id,
        gsEntityId: foundationEntityById.get(program.foundation_id) || null,
        cadenceHours: openNow ? 24 : 168,
        priority: openNow ? 9 : 5,
        changeDetection: programUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
        metadata: {
          program_name: program.name,
          roles: ['program-page'],
          current_status: program.status,
          deadline: program.deadline,
          last_program_scrape_at: program.scraped_at,
        },
      });
    }

    const rowsToUpsert = [];
    let unchanged = 0;

    for (const target of desiredTargets.values()) {
      const existingRow = existingByKey.get(target.sourceKey);
      const row = targetToRow(target, existingRow);
      if (compareFrontierRow(existingRow, row)) {
        unchanged++;
        continue;
      }
      rowsToUpsert.push(row);
    }

    const inserted = rowsToUpsert.filter(row => !existingByKey.has(row.source_key)).length;
    const updated = rowsToUpsert.length - inserted;

    console.log(`Existing frontier rows: ${existingRows.length}`);
    console.log(`Desired frontier rows: ${desiredTargets.size}`);
    console.log(`Pending upserts: ${rowsToUpsert.length} (${inserted} new, ${updated} changed, ${unchanged} unchanged)`);

    if (!DRY_RUN && rowsToUpsert.length > 0) {
      for (let i = 0; i < rowsToUpsert.length; i += 500) {
        const batch = rowsToUpsert.slice(i, i + 500);
        const { error } = await db
          .from('source_frontier')
          .upsert(batch, { onConflict: 'source_key' });

        if (error) {
          throw new Error(`Failed to upsert source_frontier batch: ${error.message}`);
        }
      }
    }

    if (!DRY_RUN) {
      await logComplete(db, run.id, {
        items_found: desiredTargets.size,
        items_new: inserted,
        items_updated: updated,
      });
    }
  } catch (error) {
    if (!DRY_RUN) {
      await logFailed(db, run.id, error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
