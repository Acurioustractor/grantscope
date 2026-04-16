#!/usr/bin/env node
/**
 * sync-tracker-evidence.mjs
 *
 * Config-driven sync for accountability tracker evidence chains.
 * Current production slice:
 *   - QLD crime prevention schools tracker
 *   - QLD watchhouse support tracker
 *   - QLD detention expansion tracker
 *
 * Usage:
 *   node --env-file=.env scripts/sync-tracker-evidence.mjs
 *   node --env-file=.env scripts/sync-tracker-evidence.mjs --dry-run
 *   node --env-file=.env scripts/sync-tracker-evidence.mjs --tracker=crime-prevention-schools
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[sync-tracker-evidence] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const TRACKER_FILTER = process.argv.find((arg) => arg.startsWith('--tracker='))?.split('=')[1] || null;
const CONFIG_DIR = path.resolve('data/tracker-evidence');
const AGENT_ID = 'sync-tracker-evidence';
const AGENT_NAME = 'Sync Tracker Evidence';

function log(msg) {
  console.log(`[sync-tracker-evidence] ${msg}`);
}

const AUD_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function formatAud(value) {
  return AUD_FORMATTER.format(Number(value || 0));
}

function normaliseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtmlToText(html) {
  return normaliseWhitespace(
    decodeHtmlEntities(
      String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

function htmlMetaContent(html, names) {
  for (const name of names) {
    const propertyMatch = html.match(new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)`, 'i'));
    if (propertyMatch?.[1]) return decodeHtmlEntities(propertyMatch[1]).trim();
    const nameMatch = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)`, 'i'));
    if (nameMatch?.[1]) return decodeHtmlEntities(nameMatch[1]).trim();
  }
  return null;
}

async function fetchWithCurl(url) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'tracker-source-'));
  const headerPath = path.join(tmpDir, 'headers.txt');
  const bodyPath = path.join(tmpDir, 'body.bin');
  try {
    const result = spawnSync(
      'curl',
      [
        '-L',
        '--silent',
        '--show-error',
        '--dump-header',
        headerPath,
        '--output',
        bodyPath,
        '--write-out',
        '%{http_code}\n%{content_type}\n%{url_effective}\n',
        url,
      ],
      {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || `curl failed with exit ${result.status}`);
    }

    const [statusLine = '0', contentTypeLine = '', effectiveUrlLine = url] = String(result.stdout || '').trim().split('\n');
    const headersText = await readFile(headerPath, 'utf8').catch(() => '');
    const bodyBuffer = await readFile(bodyPath);
    const headers = Object.fromEntries(
      headersText
        .split(/\r?\n/)
        .filter((line) => line.includes(':'))
        .map((line) => {
          const idx = line.indexOf(':');
          return [line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim()];
        }),
    );

    return {
      status: Number.parseInt(statusLine, 10) || 0,
      contentType: contentTypeLine || headers['content-type'] || '',
      contentLength: Number.parseInt(headers['content-length'] || '0', 10) || null,
      finalUrl: effectiveUrlLine || url,
      bodyBuffer,
      via: 'curl',
      headers,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function fetchSource(url) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      contentLength: Number.parseInt(response.headers.get('content-length') || '0', 10) || null,
      finalUrl: response.url,
      bodyBuffer,
      via: 'fetch',
      headers: {
        'cf-mitigated': response.headers.get('cf-mitigated') || '',
      },
    };
  } catch (error) {
    const curlResult = await fetchWithCurl(url);
    return {
      ...curlResult,
      fetchFallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildSearchTerms(event) {
  const explicit = Array.isArray(event.metadata?.extract_terms) ? event.metadata.extract_terms : [];
  const provider = event.provider_name ? [event.provider_name] : [];
  const sites = Array.isArray(event.site_names) ? event.site_names.filter((site) => site && site !== 'Queensland') : [];
  const titleTerms = String(event.title || '')
    .split(/[:,-]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8)
    .slice(0, 2);
  return [...new Set([...explicit, ...provider, ...sites, ...titleTerms])];
}

function extractSnippet(text, event) {
  const clean = normaliseWhitespace(text);
  const lower = clean.toLowerCase();
  const terms = buildSearchTerms(event);
  for (const term of terms) {
    const idx = lower.indexOf(String(term).toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 180);
      const end = Math.min(clean.length, idx + 420);
      return clean.slice(start, end);
    }
  }
  return clean.slice(0, 420);
}

function pdfTitle(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => normaliseWhitespace(line))
    .filter(Boolean);
  return lines.slice(0, 3).join(' ').slice(0, 240);
}

async function fetchSourceMetadata(event) {
  if (!event.source_url) return {};

  try {
    const source = await fetchSource(event.source_url);
    const contentType = source.contentType || '';
    const contentLength = source.contentLength;
    const base = {
      fetch_status: source.status,
      content_type: contentType,
      content_length: contentLength,
      final_url: source.finalUrl,
      fetched_at: new Date().toISOString(),
      fetch_via: source.via,
      fetch_fallback_reason: source.fetchFallbackReason || null,
      cf_mitigated: source.headers?.['cf-mitigated'] || null,
    };

    if (contentType.includes('pdf') || event.source_url.toLowerCase().endsWith('.pdf')) {
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'tracker-evidence-'));
      const pdfPath = path.join(tmpDir, 'source.pdf');
      try {
        await writeFile(pdfPath, source.bodyBuffer);
        const converted = spawnSync('pdftotext', [pdfPath, '-'], {
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
        });
        if (converted.status === 0) {
          const text = converted.stdout || '';
          return {
            ...base,
            doc_title: pdfTitle(text),
            doc_excerpt: extractSnippet(text, event),
            doc_text_length: text.length,
          };
        }
        return {
          ...base,
          fetch_warning: `pdftotext failed with exit ${converted.status}`,
        };
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    }

    const html = source.bodyBuffer.toString('utf8');
    const clean = normaliseWhitespace(html);
    const text = stripHtmlToText(html);
    const htmlTitle =
      html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() ||
      htmlMetaContent(html, ['og:title', 'DCTERMS.title', 'twitter:title']) ||
      null;
    const pageExcerpt =
      extractSnippet(text, event) ||
      htmlMetaContent(html, ['description', 'DCTERMS.description', 'og:description']) ||
      clean.slice(0, 320);
    const meta = {
      ...base,
      html_title: htmlTitle,
      page_excerpt: pageExcerpt || null,
    };

    if (event.source_kind === 'qtenders_trace') {
      return {
        ...meta,
        page_shell_only: clean.includes('loading-progress'),
        render_hint: clean.includes('loading-progress') ? 'client_rendered_page_shell' : 'server_rendered',
      };
    }

    return meta;
  } catch (error) {
    return {
      fetch_error: error instanceof Error ? error.message : String(error),
      fetched_at: new Date().toISOString(),
    };
  }
}

async function selectOne(query) {
  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) throw new Error(error.message);
  return data?.[0] ?? {};
}

async function selectRows(query) {
  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadConfigs() {
  const files = (await readdir(CONFIG_DIR)).filter((file) => file.endsWith('.json'));
  const configs = [];
  for (const file of files) {
    const fullPath = path.join(CONFIG_DIR, file);
    const parsed = JSON.parse(await readFile(fullPath, 'utf8'));
    if (TRACKER_FILTER && parsed.tracker_key !== TRACKER_FILTER) continue;
    configs.push({ ...parsed, _file: fullPath });
  }
  return configs;
}

async function augmentQldCrimePreventionSchools(baseEvents) {
  const gap = await selectOne(`
    SELECT
      COUNT(*) FILTER (
        WHERE title ILIKE '%Crime Prevention Schools%'
           OR description ILIKE '%Crime Prevention Schools%'
           OR source_id ILIKE '%VP476087%'
      )::int AS direct_cps_rows,
      COUNT(*) FILTER (
        WHERE supplier_name ILIKE '%Men of Business%'
      )::int AS men_of_business_rows,
      COUNT(*) FILTER (
        WHERE supplier_name ILIKE '%OHANA EDUCATION%'
      )::int AS ohana_rows
    FROM state_tenders
    WHERE state = 'QLD'
  `);

  const ohanaAward = await selectOne(`
    SELECT
      COUNT(*)::int AS rows,
      COALESCE(SUM(contract_value), 0)::numeric AS total,
      MIN(source_url) AS source_url
    FROM state_tenders
    WHERE state = 'QLD'
      AND supplier_name ILIKE '%OHANA EDUCATION%'
  `);

  const menMirror = await selectOne(`
    SELECT COUNT(*)::int AS rows
    FROM state_tenders
    WHERE state = 'QLD'
      AND supplier_name ILIKE '%Men of Business%'
  `);

  const tenderTraceStatus = Number(gap.direct_cps_rows || 0) > 0 ? 'mirrored' : 'missing_from_mirror';
  const tenderTraceStrength = Number(gap.direct_cps_rows || 0) > 0 ? 'mirror' : 'public_trace';
  const tenderTraceSummary = Number(gap.direct_cps_rows || 0) > 0
    ? `The Crime Prevention Schools tender trace is now mirrored locally with ${gap.direct_cps_rows} matching row(s) in state_tenders.`
    : 'Public EOI trace for VP476087 shows an open provider process signal, even though that row is not yet mirrored in CivicGraph state tenders.';

  const ohanaMirrored = Number(ohanaAward.rows || 0) > 0;
  const ohanaTotal = Number(ohanaAward.total || 0);
  const awardSummary = ohanaMirrored
    ? `The local tender mirror carries ${ohanaAward.rows} OHANA EDUCATION LTD row(s) worth ${formatAud(ohanaTotal)} from the Department of Youth Justice and Victim Services.`
    : 'No OHANA EDUCATION LTD supplier award trace is currently visible in the local tender mirror.';

  const menMirrored = Number(menMirror.rows || 0) > 0;
  const mirrorGapSummary = menMirrored
    ? `Men of Business now has ${menMirror.rows} supplier row(s) visible in the local tender mirror.`
    : 'CivicGraph currently has no state_tenders supplier row for Men of Business against the Crime Prevention Schools chain, even though the organisation is publicly named.';

  return baseEvents.map((event) => {
    if (event.stage === 'tender_trace') {
      return {
        ...event,
        summary: tenderTraceSummary,
        evidence_strength: tenderTraceStrength,
        mirror_status: tenderTraceStatus,
        metadata: {
          ...(event.metadata || {}),
          direct_cps_rows: Number(gap.direct_cps_rows || 0),
        },
      };
    }

    if (event.stage === 'award_trace') {
      return {
        ...event,
        summary: awardSummary,
        mirror_status: ohanaMirrored ? 'mirrored' : 'missing_from_mirror',
        evidence_strength: ohanaMirrored ? 'mirror' : 'partial',
        source_url: ohanaAward.source_url || event.source_url || null,
        metadata: {
          ...(event.metadata || {}),
          rows: Number(ohanaAward.rows || 0),
          contract_value: ohanaTotal,
        },
      };
    }

    if (event.stage === 'mirror_gap') {
      return {
        ...event,
        summary: mirrorGapSummary,
        mirror_status: menMirrored ? 'mirrored' : 'missing_from_mirror',
        evidence_strength: menMirrored ? 'mirror' : 'mirror_gap',
        metadata: {
          ...(event.metadata || {}),
          rows: Number(menMirror.rows || 0),
        },
      };
    }

    return event;
  });
}

async function augmentQldWatchhouseSupport(baseEvents) {
  const departmentMirror = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total
    FROM justice_funding
    WHERE state = 'QLD'
      AND recipient_name = 'Department of Youth Justice'
      AND program_name = 'Watchhouse Youth Support'
      AND financial_year = '2024-25'
  `);

  const murriMirror = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total
    FROM justice_funding
    WHERE state = 'QLD'
      AND (
        (recipient_name = 'Murri Watch - Caboolture Watchhouse Support' AND program_name IN ('Watchhouse Support', 'YJ - WATCHHOUSE'))
        OR (recipient_name = 'Murri Watch Youth Cultural Support Program' AND program_name = 'YJ - WATCHHOUSE')
      )
  `);

  const yacMirror = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total
    FROM justice_funding
    WHERE state = 'QLD'
      AND recipient_name IN ('YAC - Caboolture Watchhouse Support', 'YAC - Caboolture Watchhouse Support;')
      AND program_name = 'Watchhouse Support'
  `);

  const directHubTrace = await selectRows(`
    SELECT title
    FROM state_tenders
    WHERE state = 'QLD'
      AND title ILIKE '%Caboolture Watchhouse Education Support Hub%'
    LIMIT 1
  `);

  const departmentRows = Number(departmentMirror.rows || 0);
  const murriRows = Number(murriMirror.rows || 0);
  const yacRows = Number(yacMirror.rows || 0);
  const hubMirrored = directHubTrace.length > 0;

  return baseEvents.map((event) => {
    if (event.stage === 'mirror') {
      return {
        ...event,
        summary:
          departmentRows > 0
            ? `The local justice_funding mirror carries ${departmentRows} Department of Youth Justice Watchhouse Youth Support row worth ${formatAud(departmentMirror.total)} in 2024-25.`
            : 'No Department of Youth Justice Watchhouse Youth Support row is currently visible in the local justice_funding mirror.',
        evidence_strength: departmentRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: departmentRows > 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          rows: departmentRows,
          amount_dollars: Number(departmentMirror.total || 0),
          financial_year: '2024-25',
        },
      };
    }

    if (event.stage === 'murri_provider_trace') {
      return {
        ...event,
        summary:
          murriRows > 0
            ? `Murri Watch appears in ${murriRows} mirrored watchhouse-related justice_funding row(s) totalling ${formatAud(murriMirror.total)} across Caboolture watchhouse support and YJ - WATCHHOUSE lines.`
            : 'Murri Watch is not currently visible in the local watchhouse-support funding mirror.',
        evidence_strength: murriRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: murriRows > 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          rows: murriRows,
          amount_dollars: Number(murriMirror.total || 0),
        },
      };
    }

    if (event.stage === 'yac_provider_trace') {
      return {
        ...event,
        summary:
          yacRows > 0
            ? `Youth Advocacy Centre appears in ${yacRows} mirrored Caboolture watchhouse-support row(s) totalling ${formatAud(yacMirror.total)}.`
            : 'Youth Advocacy Centre does not currently have a mirrored Caboolture watchhouse-support row in justice_funding.',
        evidence_strength: yacRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: yacRows > 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          rows: yacRows,
          amount_dollars: Number(yacMirror.total || 0),
        },
      };
    }

    if (event.stage === 'mirror_gap') {
      return {
        ...event,
        summary: hubMirrored
          ? 'A direct Caboolture Watchhouse Education Support Hub row is now visible in the local tender mirror.'
          : 'No direct Caboolture Watchhouse Education Support Hub tender row is currently visible in the local state_tenders mirror, even though the official QON and budget trail is public.',
        evidence_strength: hubMirrored ? 'mirror' : 'mirror_gap',
        mirror_status: hubMirrored ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          direct_hub_rows: hubMirrored ? 1 : 0,
        },
      };
    }

    return event;
  });
}

async function augmentQldDetentionExpansion(baseEvents) {
  const woodfordFunding = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total
    FROM justice_funding
    WHERE state = 'QLD'
      AND recipient_name = 'Department of Youth Justice'
      AND program_name = 'Woodford Youth Detention Centre'
      AND financial_year = '2024-25'
  `);

  const wacolFunding = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total
    FROM justice_funding
    WHERE state = 'QLD'
      AND recipient_name = 'Department of Youth Justice'
      AND program_name = 'Wacol Youth Remand Centre'
      AND financial_year = '2024-25'
  `);

  const rpsTrace = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(contract_value), 0)::numeric AS total, MIN(source_url) AS source_url
    FROM state_tenders
    WHERE state = 'QLD'
      AND buyer_name = 'Department of Youth Justice'
      AND title = 'Woodford YDC Contruction'
  `);

  const jinibaraTrace = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(contract_value), 0)::numeric AS total, MIN(source_url) AS source_url
    FROM state_tenders
    WHERE state = 'QLD'
      AND buyer_name = 'Department of Youth Justice'
      AND supplier_name = 'JINIBARA PEOPLE ABORIGINAL'
      AND title = 'CULTURAL BROKERAGE WOODFORD'
  `);

  const besixTrace = await selectRows(`
    SELECT supplier_name
    FROM state_tenders
    WHERE state = 'QLD'
      AND supplier_name ILIKE '%BESIX%'
    LIMIT 1
  `);

  const cairnsTrace = await selectRows(`
    SELECT title
    FROM state_tenders
    WHERE state = 'QLD'
      AND title ILIKE '%Cairns Youth Detention%'
    LIMIT 1
  `);

  const woodfordRows = Number(woodfordFunding.rows || 0);
  const wacolRows = Number(wacolFunding.rows || 0);
  const rpsRows = Number(rpsTrace.rows || 0);
  const jinibaraRows = Number(jinibaraTrace.rows || 0);
  const besixMirrored = besixTrace.length > 0;
  const cairnsMirrored = cairnsTrace.length > 0;

  return baseEvents.map((event) => {
    if (event.stage === 'mirror') {
      const totals = [];
      if (woodfordRows > 0) totals.push(`Woodford ${formatAud(woodfordFunding.total)}`);
      if (wacolRows > 0) totals.push(`Wacol ${formatAud(wacolFunding.total)}`);
      return {
        ...event,
        summary:
          totals.length > 0
            ? `The local justice_funding mirror carries 2024-25 detention-expansion operating lines for ${totals.join(' and ')}.`
            : 'No direct 2024-25 Woodford or Wacol detention-expansion line is currently visible in the local justice_funding mirror.',
        evidence_strength: totals.length > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: totals.length > 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          woodford_rows: woodfordRows,
          woodford_total: Number(woodfordFunding.total || 0),
          wacol_rows: wacolRows,
          wacol_total: Number(wacolFunding.total || 0),
          financial_year: '2024-25',
        },
      };
    }

    if (event.stage === 'procurement_trace') {
      return {
        ...event,
        summary:
          rpsRows > 0
            ? `The local tender mirror includes ${rpsRows} Department of Youth Justice row(s) for 'Woodford YDC Contruction', worth ${formatAud(rpsTrace.total)}.`
            : 'No direct Department of Youth Justice procurement row is currently visible for Woodford YDC construction in the local tender mirror.',
        evidence_strength: rpsRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: rpsRows > 0 ? 'mirrored' : 'missing_from_mirror',
        source_url: rpsTrace.source_url || event.source_url || null,
        metadata: {
          ...(event.metadata || {}),
          rows: rpsRows,
          contract_value: Number(rpsTrace.total || 0),
        },
      };
    }

    if (event.stage === 'community_partner_trace') {
      return {
        ...event,
        summary:
          jinibaraRows > 0
            ? `The local tender mirror includes ${jinibaraRows} Woodford cultural brokerage row(s) for Jinibara People Aboriginal, totalling ${formatAud(jinibaraTrace.total)}.`
            : 'No Jinibara People Aboriginal Woodford cultural brokerage row is currently visible in the local tender mirror.',
        evidence_strength: jinibaraRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: jinibaraRows > 0 ? 'mirrored' : 'missing_from_mirror',
        source_url: jinibaraTrace.source_url || event.source_url || null,
        metadata: {
          ...(event.metadata || {}),
          rows: jinibaraRows,
          contract_value: Number(jinibaraTrace.total || 0),
        },
      };
    }

    if (event.stage === 'mirror_gap') {
      const notes = [];
      if (!besixMirrored) notes.push('no BESIX supplier row');
      if (!cairnsMirrored) notes.push('no Cairns Youth Detention title row');
      return {
        ...event,
        summary:
          notes.length === 0
            ? 'The named BESIX / Cairns detention-expansion gap has now been closed in the local tender mirror.'
            : `The local tender mirror still has ${notes.join(' and ')} for the detention-expansion chain, even though the public statement trail names those projects.`,
        evidence_strength: notes.length === 0 ? 'mirror' : 'mirror_gap',
        mirror_status: notes.length === 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          besix_rows: besixMirrored ? 1 : 0,
          cairns_rows: cairnsMirrored ? 1 : 0,
        },
      };
    }

    return event;
  });
}

async function augmentNswCobhamUpgrade(baseEvents) {
  const cobhamMirror = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total, MIN(source_url) AS source_url
    FROM justice_funding
    WHERE state = 'NSW'
      AND recipient_name = 'Department of Communities and Justice'
      AND program_name = 'Cobham Youth Justice Centre Upgrade'
      AND financial_year = '2024-25'
  `);

  const cobhamTenderGap = await selectOne(`
    SELECT COUNT(*)::int AS rows
    FROM state_tenders
    WHERE state = 'NSW'
      AND (title ILIKE '%Cobham%' OR description ILIKE '%Cobham%')
  `);

  const cobhamRows = Number(cobhamMirror.rows || 0);
  const tenderRows = Number(cobhamTenderGap.rows || 0);

  return baseEvents.map((event) => {
    if (event.stage === 'mirror') {
      return {
        ...event,
        summary:
          cobhamRows > 0
            ? `The local justice_funding mirror carries ${cobhamRows} Cobham Youth Justice Centre Upgrade row worth ${formatAud(cobhamMirror.total)} in 2024-25.`
            : 'No Cobham Youth Justice Centre Upgrade row is currently visible in the local justice_funding mirror.',
        evidence_strength: cobhamRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: cobhamRows > 0 ? 'mirrored' : 'missing_from_mirror',
        source_url: cobhamMirror.source_url || event.source_url || null,
        metadata: {
          ...(event.metadata || {}),
          rows: cobhamRows,
          amount_dollars: Number(cobhamMirror.total || 0),
          financial_year: '2024-25',
        },
      };
    }

    if (event.stage === 'mirror_gap') {
      return {
        ...event,
        summary:
          tenderRows > 0
            ? `The local state_tenders mirror now has ${tenderRows} Cobham-linked procurement row(s).`
            : 'The local state_tenders mirror still has no direct Cobham procurement row, so the upgrade is only visible through budget and oversight sources right now.',
        evidence_strength: tenderRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: tenderRows > 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          rows: tenderRows,
        },
      };
    }

    return event;
  });
}

async function augmentNtDonDaleReplacement(baseEvents) {
  const replacementMirror = await selectOne(`
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount_dollars), 0)::numeric AS total, MIN(source_url) AS source_url
    FROM justice_funding
    WHERE state = 'NT'
      AND recipient_name = 'Territory Families, Housing and Communities'
      AND program_name = 'Don Dale Replacement Youth Detention Facility'
      AND financial_year = '2024-25'
  `);

  const tenderGap = await selectOne(`
    SELECT COUNT(*)::int AS rows
    FROM state_tenders
    WHERE state = 'NT'
      AND (
        title = 'Don Dale Replacement Youth Detention Facility'
        OR title = 'Don Dale Youth Detention Centre'
      )
  `);

  const mirrorRows = Number(replacementMirror.rows || 0);
  const tenderRows = Number(tenderGap.rows || 0);

  return baseEvents.map((event) => {
    if (event.stage === 'mirror') {
      return {
        ...event,
        summary:
          mirrorRows > 0
            ? `The local justice_funding mirror carries ${mirrorRows} Don Dale Replacement Youth Detention Facility row worth ${formatAud(replacementMirror.total)} in 2024-25.`
            : 'No Don Dale Replacement Youth Detention Facility row is currently visible in the local justice_funding mirror.',
        evidence_strength: mirrorRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: mirrorRows > 0 ? 'mirrored' : 'missing_from_mirror',
        source_url: replacementMirror.source_url || event.source_url || null,
        metadata: {
          ...(event.metadata || {}),
          rows: mirrorRows,
          amount_dollars: Number(replacementMirror.total || 0),
          financial_year: '2024-25',
        },
      };
    }

    if (event.stage === 'mirror_gap') {
      return {
        ...event,
        summary:
          tenderRows > 0
            ? `The local state_tenders mirror now has ${tenderRows} Don Dale replacement procurement row(s).`
            : 'The local state_tenders mirror still has no direct Don Dale replacement procurement row, so the infrastructure chain is currently visible through budget, media release, and estimates sources rather than tender disclosure.',
        evidence_strength: tenderRows > 0 ? 'mirror' : 'mirror_gap',
        mirror_status: tenderRows > 0 ? 'mirrored' : 'missing_from_mirror',
        metadata: {
          ...(event.metadata || {}),
          rows: tenderRows,
        },
      };
    }

    return event;
  });
}

async function augmentEvents(config) {
  if (config.domain === 'youth-justice' && config.jurisdiction === 'QLD' && config.tracker_key === 'crime-prevention-schools') {
    return augmentQldCrimePreventionSchools(config.events);
  }
  if (config.domain === 'youth-justice' && config.jurisdiction === 'QLD' && config.tracker_key === 'watchhouse-support') {
    return augmentQldWatchhouseSupport(config.events);
  }
  if (config.domain === 'youth-justice' && config.jurisdiction === 'QLD' && config.tracker_key === 'detention-expansion') {
    return augmentQldDetentionExpansion(config.events);
  }
  if (config.domain === 'youth-justice' && config.jurisdiction === 'NSW' && config.tracker_key === 'cobham-upgrade') {
    return augmentNswCobhamUpgrade(config.events);
  }
  if (config.domain === 'youth-justice' && config.jurisdiction === 'NT' && config.tracker_key === 'don-dale-replacement') {
    return augmentNtDonDaleReplacement(config.events);
  }
  return config.events;
}

function normaliseEvent(config, event) {
  return {
    domain: config.domain,
    jurisdiction: config.jurisdiction,
    tracker_key: config.tracker_key,
    stage: event.stage,
    event_date: event.event_date,
    title: event.title,
    summary: event.summary || null,
    source_kind: event.source_kind,
    source_name: event.source_name || null,
    source_url: event.source_url || null,
    provider_name: event.provider_name || null,
    site_names: event.site_names || [],
    evidence_strength: event.evidence_strength || 'official',
    mirror_status: event.mirror_status || 'not_applicable',
    metadata: {
      ...(event.metadata || {}),
      managed_by: 'sync-tracker-evidence',
      synced_at: new Date().toISOString(),
      config_tracker: config.tracker_key,
    },
  };
}

async function syncConfig(config) {
  const augmentedEvents = await augmentEvents(config);
  const payload = [];
  for (const event of augmentedEvents) {
    const sourceMeta = await fetchSourceMetadata(event);
    payload.push({
      ...normaliseEvent(config, event),
      metadata: {
        ...(normaliseEvent(config, event).metadata || {}),
        source_fetch: sourceMeta,
      },
    });
  }
  if (DRY_RUN) {
    return { tracker: config.tracker_key, rows: payload.length, inserted: 0, updated: 0, payload };
  }

  const { data: beforeRows } = await db
    .from('tracker_evidence_events')
    .select('id')
    .eq('domain', config.domain)
    .eq('jurisdiction', config.jurisdiction)
    .eq('tracker_key', config.tracker_key);
  const before = beforeRows?.length || 0;

  const { error } = await db
    .from('tracker_evidence_events')
    .upsert(payload, {
      onConflict: 'domain,jurisdiction,tracker_key,stage,event_date,title',
    });

  if (error) throw new Error(error.message);

  const afterRows = await selectRows(`
    SELECT id
    FROM tracker_evidence_events
    WHERE domain = '${config.domain.replace(/'/g, "''")}'
      AND jurisdiction = '${config.jurisdiction.replace(/'/g, "''")}'
      AND tracker_key = '${config.tracker_key.replace(/'/g, "''")}'
  `);
  const after = afterRows.length;
  const inserted = Math.max(0, after - before);
  const updated = Math.max(0, payload.length - inserted);
  return { tracker: config.tracker_key, rows: payload.length, inserted, updated };
}

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    const configs = await loadConfigs();
    if (configs.length === 0) {
      log('No tracker configs found.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0, items_updated: 0 });
      return;
    }

    log(`Loaded ${configs.length} tracker config(s)${TRACKER_FILTER ? ` for ${TRACKER_FILTER}` : ''}`);
    let totalRows = 0;
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const config of configs) {
      const result = await syncConfig(config);
      totalRows += result.rows;
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      log(`${result.tracker}: ${result.rows} row(s) processed${DRY_RUN ? ' [dry-run]' : ` (${result.inserted} inserted, ${result.updated} updated)`}`);
    }

    await logComplete(db, run.id, {
      items_found: totalRows,
      items_new: totalInserted,
      items_updated: totalUpdated,
      status: 'success',
    });
  } catch (error) {
    console.error(error);
    await logFailed(db, run.id, error);
    process.exit(1);
  }
}

main();
