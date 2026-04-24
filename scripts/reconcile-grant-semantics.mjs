#!/usr/bin/env node

/**
 * Reconcile Grant Semantics
 *
 * Continuously revisits suspicious grant rows and corrects status,
 * application_status, closes_at, and last_verified_at using deterministic
 * page-text rules plus structured dates already stored in the row.
 *
 * Usage:
 *   node --env-file=.env scripts/reconcile-grant-semantics.mjs [--apply] [--limit=100] [--sources=a,b]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLY = process.argv.includes('--apply');
const LIMIT = Math.max(1, Number.parseInt(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '100', 10));
const SOURCES = (process.argv.find((arg) => arg.startsWith('--sources='))?.split('=')[1] || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const SOURCE_IDS = (process.argv.find((arg) => arg.startsWith('--source-ids='))?.split('=')[1] || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 10_000;
const PAGE_CHAR_LIMIT = 6_000;
const STALE_VERIFY_DAYS = 45;
const DB_WRITE_RETRIES = 3;
const USER_AGENT = 'GrantScope/1.0 (https://grantscope.au; semantics reconciliation)';
const MANUAL_SOURCES = new Set(['manual', 'manual_entry', 'ghl_sync']);
const LIFECYCLE_APPLICATION_STATUSES = new Set(['open', 'closed', 'ongoing', 'upcoming', 'unknown']);

const MONTH_LOOKUP = new Map([
  ['jan', 0], ['january', 0],
  ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2],
  ['apr', 3], ['april', 3],
  ['may', 4],
  ['jun', 5], ['june', 5],
  ['jul', 6], ['july', 6],
  ['aug', 7], ['august', 7],
  ['sep', 8], ['sept', 8], ['september', 8],
  ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10],
  ['dec', 11], ['december', 11],
]);

const WINDOW_PATTERNS = [
  /applications?(?:\s+for[\w\s/()-]+?)?\s+(?:are\s+)?open\s+from\s+([A-Za-z0-9,\s/]+?)\s+(?:to|until|-)\s+([A-Za-z0-9,\s/]+?)(?=[.;,\n]|$)/gi,
  /open(?:s|ed)?(?:\s+for[\w\s/()-]+?)?\s+from\s+([A-Za-z0-9,\s/]+?)\s+(?:to|until|-)\s+([A-Za-z0-9,\s/]+?)(?=[.;,\n]|$)/gi,
  /applications?\s+open\s+([A-Za-z0-9,\s/]+?)\s+and\s+close(?:s|d)?\s+([A-Za-z0-9,\s/]+?)(?=[.;,\n]|$)/gi,
  /opens?\s+([A-Za-z0-9,\s/]+?)\s+and\s+close(?:s|d)?\s+([A-Za-z0-9,\s/]+?)(?=[.;,\n]|$)/gi,
];

const OPEN_PATTERNS = [
  /\bapplications?\s+(?:are\s+)?open\b/i,
  /\bnow\s+accepting\s+applications\b/i,
  /\bopen\s+for\s+applications\b/i,
];

const CLOSED_PATTERNS = [
  /\bcurrently\s+closed\b/i,
  /\bapplications?\s+(?:are|is)\s+now\s+closed\b/i,
  /\bclosed\s+to\s+new\s+applications\b/i,
  /\bno\s+longer\s+accepting\s+applications\b/i,
  /\bround\s+has\s+closed\b/i,
  /\ball\s+funds\s+exhausted\b/i,
  /\bfunding\s+exhausted\b/i,
];

const UPCOMING_PATTERNS = [
  /\bfuture\s+rounds?\s+will\s+open\b/i,
  /\bwill\s+open\s+for\s+applications\b/i,
  /\bwill\s+open\s+from\b/i,
  /\bopens?\s+on\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/i,
  /\bopens?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/i,
  /\bopen(?:s)?\s+in\s+[A-Za-z]+\s+\d{4}\b/i,
  /\bnext\s+round\b/i,
];

const ONGOING_PATTERNS = [
  /\brolling\s+applications\b/i,
  /\bapplications?\s+accepted\s+year[-\s]?round\b/i,
  /\bopen\s+year[-\s]?round\b/i,
  /\bon\s+an\s+ongoing\s+basis\b/i,
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
  console.log(`[reconcile-grant-semantics] ${message}`);
}

function escapeSqlLiteral(value) {
  return value.replace(/'/g, "''");
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function canonicalSourceKey(grant) {
  if (grant.discovery_method) return grant.discovery_method;
  if (grant.source === 'foundation_program') return grant.source || 'unknown';
  if (grant.source_id && !isUuidLike(grant.source_id)) return grant.source_id;
  return grant.source || 'unknown';
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseStoredDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTextDate(rawValue, fallbackYear = null) {
  if (!rawValue || typeof rawValue !== 'string') return null;

  const cleaned = rawValue
    .replace(/[,]/g, ' ')
    .replace(/\b(?:from|to|until|on)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    const year = Number(slashMatch[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTH_LOOKUP.get(match[2].toLowerCase());
  const year = match[3] ? Number(match[3]) : fallbackYear;

  if (month == null || !year) {
    return null;
  }

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

function extractRoundWindows(text) {
  const windows = [];

  for (const pattern of WINDOW_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const closeDate = parseTextDate(match[2]);
      const openDate = parseTextDate(match[1], closeDate?.getFullYear() || null);

      if (!openDate || !closeDate || openDate > closeDate) {
        continue;
      }

      windows.push({
        openDate,
        closeDate,
      });
    }
  }

  return windows;
}

function extractCloseDateHint(text) {
  const closePatterns = [
    /\bclose(?:s|d)?\s+(?:on\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})\b/i,
    /\bdeadline\s+(?:is\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})\b/i,
  ];

  for (const pattern of closePatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = parseTextDate(match[1]);
    if (parsed) {
      return toIsoDate(parsed);
    }
  }

  return null;
}

function fetchDecision(text) {
  const today = startOfToday();
  const windows = extractRoundWindows(text);

  const activeWindow = windows
    .filter((window) => window.openDate <= today && window.closeDate >= today)
    .sort((a, b) => a.closeDate - b.closeDate)[0];

  if (activeWindow) {
    return {
      status: 'open',
      applicationStatus: 'open',
      deadline: toIsoDate(activeWindow.closeDate),
      rule: 'active_window',
    };
  }

  const futureWindow = windows
    .filter((window) => window.openDate > today)
    .sort((a, b) => a.openDate - b.openDate)[0];

  if (futureWindow) {
    return {
      status: 'closed',
      applicationStatus: 'upcoming',
      deadline: toIsoDate(futureWindow.closeDate),
      rule: 'future_window',
    };
  }

  const closeDateHint = extractCloseDateHint(text);
  const closeDateHintDate = parseStoredDate(closeDateHint);
  const ongoing = ONGOING_PATTERNS.some((pattern) => pattern.test(text));
  const open = OPEN_PATTERNS.some((pattern) => pattern.test(text));
  const upcoming = UPCOMING_PATTERNS.some((pattern) => pattern.test(text));
  const closed = CLOSED_PATTERNS.some((pattern) => pattern.test(text));

  if (ongoing) {
    return {
      status: 'ongoing',
      applicationStatus: 'ongoing',
      deadline: null,
      rule: 'ongoing_phrase',
    };
  }

  if (open && !closed) {
    if (closeDateHintDate && closeDateHintDate < today) {
      return {
        status: 'closed',
        applicationStatus: 'closed',
        deadline: closeDateHint,
        rule: 'past_close_hint',
      };
    }

    return {
      status: 'open',
      applicationStatus: 'open',
      deadline: closeDateHint,
      rule: 'open_phrase',
    };
  }

  if (upcoming) {
    return {
      status: 'closed',
      applicationStatus: 'upcoming',
      deadline: closeDateHint,
      rule: 'upcoming_phrase',
    };
  }

  if (closed) {
    return {
      status: 'closed',
      applicationStatus: 'closed',
      deadline: closeDateHint,
      rule: 'closed_phrase',
    };
  }

  return null;
}

async function fetchPageText(url) {
  if (!url) return { error: 'Missing URL' };

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { error: `Non-HTML content: ${contentType.split(';')[0]}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();

    const bodyText = ($('main').text() || $('article').text() || $('body').text())
      .replace(/\s+/g, ' ')
      .trim();

    if (bodyText.length < 30) {
      return { error: 'Page too short' };
    }

    return { text: bodyText.slice(0, PAGE_CHAR_LIMIT) };
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return { error: 'Timeout' };
    }
    return { error: error.message?.slice(0, 120) || String(error) };
  }
}

function mapApplicationStatusToStatus(applicationStatus) {
  if (applicationStatus === 'open') return 'open';
  if (applicationStatus === 'ongoing') return 'ongoing';
  if (applicationStatus === 'upcoming') return 'closed';
  if (applicationStatus === 'closed') return 'closed';
  return null;
}

function isTrackerApplicationStatus(applicationStatus) {
  return typeof applicationStatus === 'string'
    && applicationStatus.length > 0
    && !LIFECYCLE_APPLICATION_STATUSES.has(applicationStatus);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error) {
  const message = error?.message || String(error || '');
  return /fetch failed|network|timeout|temporar|connection/i.test(message);
}

async function updateGrantRow(id, update) {
  let lastError = null;

  for (let attempt = 1; attempt <= DB_WRITE_RETRIES; attempt += 1) {
    const { error } = await supabase
      .from('grant_opportunities')
      .update(update)
      .eq('id', id);

    if (!error) {
      return null;
    }

    lastError = error;
    if (!isTransientError(error) || attempt === DB_WRITE_RETRIES) {
      break;
    }

    await sleep(attempt * 400);
  }

  return lastError;
}

function buildDesiredState(grant, pageDecision) {
  const today = startOfToday();
  const closesAt = parseStoredDate(grant.closes_at || grant.deadline);
  const desired = {
    status: grant.status || null,
    application_status: grant.application_status || null,
    deadline: grant.deadline || grant.closes_at || null,
    closes_at: grant.closes_at || grant.deadline || null,
  };

  if (grant.source === 'ghl_sync' && !desired.status && isTrackerApplicationStatus(desired.application_status)) {
    desired.status = 'unknown';
    return desired;
  }

  if (closesAt && closesAt < today) {
    desired.status = 'closed';
    if (!desired.application_status || desired.application_status === 'open' || desired.application_status === 'unknown') {
      desired.application_status = 'closed';
    }
  }

  if (!desired.status && desired.application_status) {
    desired.status = mapApplicationStatusToStatus(desired.application_status);
  }

  if (!desired.application_status && desired.status && desired.status !== 'unknown') {
    desired.application_status = desired.status;
  }

  if (pageDecision) {
    desired.status = pageDecision.status;
    desired.application_status = pageDecision.applicationStatus;
    if (pageDecision.deadline) {
      desired.deadline = pageDecision.deadline;
      desired.closes_at = pageDecision.deadline;
    } else if (
      closesAt
      && closesAt < today
      && ['open', 'ongoing', 'upcoming'].includes(pageDecision.applicationStatus)
    ) {
      // The page confirms the grant is still live or scheduled, so a past stored
      // deadline belongs to an older round and should not keep re-flagging it.
      desired.deadline = null;
      desired.closes_at = null;
    }
  }

  if (!desired.status && closesAt && closesAt < today) {
    desired.status = 'closed';
  }

  if (!desired.application_status && desired.status && desired.status !== 'unknown') {
    desired.application_status = desired.status;
  }

  return desired;
}

function diffGrant(grant, desired) {
  const update = {};
  const desiredDeadline = desired.deadline ?? null;
  const currentDeadline = grant.deadline ?? null;
  const desiredClosesAt = desired.closes_at ?? null;
  const currentClosesAt = grant.closes_at ?? null;

  if (desired.status && desired.status !== grant.status) {
    update.status = desired.status;
  }
  if (desired.application_status && desired.application_status !== grant.application_status) {
    update.application_status = desired.application_status;
  }
  if (desiredDeadline !== currentDeadline) {
    update.deadline = desiredDeadline;
  }
  if (desiredClosesAt !== currentClosesAt) {
    update.closes_at = desiredClosesAt;
  }

  return update;
}

async function loadCandidates() {
  const sourceFilter = SOURCES.length > 0
    ? ` AND source IN (${SOURCES.map((source) => `'${escapeSqlLiteral(source)}'`).join(', ')})`
    : '';
  const sourceIdFilter = SOURCE_IDS.length > 0
    ? ` AND source_id IN (${SOURCE_IDS.map((sourceId) => `'${escapeSqlLiteral(sourceId)}'`).join(', ')})`
    : '';

  const nonManualFilter = ` AND source NOT IN (${[...MANUAL_SOURCES].map((source) => `'${source}'`).join(', ')})`;
  const resolvableFilter = ` AND (COALESCE(url, '') <> '' OR closes_at IS NOT NULL OR deadline IS NOT NULL)`;

  const query = `
    WITH candidates AS (
      SELECT id, 'status_null' AS reason, 60 AS priority
      FROM grant_opportunities
      WHERE status IS NULL
      ${nonManualFilter}
      ${resolvableFilter}
      ${sourceFilter}
      ${sourceIdFilter}

      UNION ALL

      SELECT id, 'application_status_null' AS reason, 50 AS priority
      FROM grant_opportunities
      WHERE application_status IS NULL
      ${nonManualFilter}
      ${resolvableFilter}
      ${sourceFilter}
      ${sourceIdFilter}

      UNION ALL

      SELECT id, 'crm_status_null' AS reason, 55 AS priority
      FROM grant_opportunities
      WHERE source = 'ghl_sync'
        AND status IS NULL
      ${sourceFilter}
      ${sourceIdFilter}

      UNION ALL

      SELECT id, 'open_past_deadline' AS reason, 80 AS priority
      FROM grant_opportunities
      WHERE status = 'open'
        AND closes_at IS NOT NULL
        AND closes_at < CURRENT_DATE
      ${sourceFilter}
      ${sourceIdFilter}

      UNION ALL

      SELECT id, 'stale_verification' AS reason, 30 AS priority
      FROM grant_opportunities
      WHERE COALESCE(url, '') <> ''
        ${nonManualFilter}
        AND COALESCE(status, '') <> 'closed'
        AND (
          last_verified_at IS NULL
          OR last_verified_at < NOW() - INTERVAL '${STALE_VERIFY_DAYS} days'
        )
      ${sourceFilter}
      ${sourceIdFilter}
    )
    SELECT
      g.id,
      g.name,
      g.source,
      g.source_id,
      g.discovery_method,
      g.url,
      g.status,
      g.application_status,
      g.deadline,
      g.closes_at,
      g.last_verified_at,
      string_agg(c.reason, ',' ORDER BY c.priority DESC) AS reasons,
      MAX(c.priority) AS priority
    FROM grant_opportunities g
    JOIN candidates c ON c.id = g.id
    GROUP BY
      g.id,
      g.name,
      g.source,
      g.source_id,
      g.discovery_method,
      g.url,
      g.status,
      g.application_status,
      g.deadline,
      g.closes_at,
      g.last_verified_at,
      g.created_at,
      g.updated_at
    ORDER BY
      MAX(c.priority) DESC,
      COALESCE(g.last_verified_at, g.updated_at, g.created_at) ASC
    LIMIT ${LIMIT}
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    throw new Error(`Failed to load candidates: ${error.message}`);
  }

  return data || [];
}

async function main() {
  log(`Starting grant semantics reconciler (limit=${LIMIT}, apply=${APPLY}, sources=${SOURCES.join(',') || 'all'}, source_ids=${SOURCE_IDS.join(',') || 'all'})`);

  const candidates = await loadCandidates();
  log(`Found ${candidates.length} suspicious grants`);

  if (candidates.length === 0) {
    return;
  }

  if (!APPLY) {
    for (const candidate of candidates.slice(0, 10)) {
      log(`  ${candidate.source || 'unknown'} | ${candidate.name?.slice(0, 70)} | reasons=${candidate.reasons}`);
    }
    log('Run with --apply to write fixes.');
    return;
  }

  const run = await logStart(supabase, 'reconcile-grant-semantics', 'Reconcile Grant Semantics');
  const summaryBySource = new Map();
  const fetchWarnings = [];
  const blockingFetchErrors = [];
  const writeErrors = [];
  let fetched = 0;
  let updated = 0;
  let verifiedOnly = 0;

  async function processCandidate(candidate, index) {
    let pageDecision = null;
    let fetchResult = null;
    let fetchError = null;

    if (candidate.url) {
      fetchResult = await fetchPageText(candidate.url);
      if (fetchResult.error) {
        fetchError = fetchResult.error;
        fetchWarnings.push({ id: candidate.id, error: fetchResult.error });
      } else {
        fetched += 1;
        pageDecision = fetchDecision(fetchResult.text);
      }
    }

    const desired = buildDesiredState(candidate, pageDecision);
    const update = diffGrant(candidate, desired);

    if (fetchResult?.text) {
      update.last_verified_at = new Date().toISOString();
    }

    const source = canonicalSourceKey(candidate);
    const sourceSummary = summaryBySource.get(source) || { checked: 0, updated: 0, rules: new Map(), reasons: new Map() };
    sourceSummary.checked += 1;
    for (const reason of String(candidate.reasons || '').split(',').filter(Boolean)) {
      sourceSummary.reasons.set(reason, (sourceSummary.reasons.get(reason) || 0) + 1);
    }
    if (pageDecision?.rule) {
      sourceSummary.rules.set(pageDecision.rule, (sourceSummary.rules.get(pageDecision.rule) || 0) + 1);
    }
    summaryBySource.set(source, sourceSummary);

    if (Object.keys(update).length === 0) {
      const reason = fetchError ? `no safe fallback change (${fetchError})` : 'verified, no safe change';
      if (fetchError) {
        blockingFetchErrors.push({ id: candidate.id, error: fetchError });
      }
      log(`  [${index + 1}/${candidates.length}] SKIP ${candidate.name?.slice(0, 60)} -- ${reason}`);
      return;
    }

    const updateError = await updateGrantRow(candidate.id, update);
    if (updateError) {
      writeErrors.push({ id: candidate.id, error: updateError.message });
      log(`  [${index + 1}/${candidates.length}] DB ERROR ${candidate.name?.slice(0, 60)} -- ${updateError.message}`);
      return;
    }

    if (Object.keys(update).some((key) => key !== 'last_verified_at')) {
      updated += 1;
      sourceSummary.updated += 1;
    } else {
      verifiedOnly += 1;
    }

    const parts = [];
    if (update.status) parts.push(`status=${update.status}`);
    if (update.application_status) parts.push(`application_status=${update.application_status}`);
    if (Object.hasOwn(update, 'closes_at')) parts.push(`closes_at=${update.closes_at ?? 'null'}`);
    if (Object.hasOwn(update, 'deadline')) parts.push(`deadline=${update.deadline ?? 'null'}`);
    if (pageDecision?.rule) parts.push(`rule=${pageDecision.rule}`);
    if (fetchError) parts.push(`fallback=${fetchError}`);

    log(`  [${index + 1}/${candidates.length}] OK ${candidate.name?.slice(0, 60)} -- ${parts.join(', ') || 'last_verified_at'}`);
  }

  try {
    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      const batch = candidates.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map((candidate, offset) => processCandidate(candidate, i + offset)));
    }

    log('');
    log('Source summary:');
    for (const [source, stats] of [...summaryBySource.entries()].sort((a, b) => b[1].updated - a[1].updated || b[1].checked - a[1].checked)) {
      const reasonText = [...stats.reasons.entries()].map(([reason, count]) => `${reason}=${count}`).join(', ');
      const ruleText = [...stats.rules.entries()].map(([rule, count]) => `${rule}=${count}`).join(', ');
      log(`  ${source}: checked=${stats.checked}, updated=${stats.updated}${reasonText ? `, reasons=[${reasonText}]` : ''}${ruleText ? `, rules=[${ruleText}]` : ''}`);
    }

    await logComplete(supabase, run.id, {
      items_found: candidates.length,
      items_updated: updated + verifiedOnly,
      status: blockingFetchErrors.length > 0 || writeErrors.length > 0 ? 'partial' : 'success',
      errors: [...blockingFetchErrors, ...writeErrors],
    });

    log('');
    log(`Complete: checked=${candidates.length}, fetched=${fetched}, updated=${updated}, verified_only=${verifiedOnly}, fetch_warnings=${fetchWarnings.length}, blocking_fetch_errors=${blockingFetchErrors.length}, write_errors=${writeErrors.length}`);
  } catch (error) {
    await logFailed(supabase, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error('[reconcile-grant-semantics] Fatal:', error.message || error);
  process.exit(1);
});
