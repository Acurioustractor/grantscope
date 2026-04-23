#!/usr/bin/env node

/**
 * Foundation Grantee PDF Extractor
 *
 * Downloads annual report PDFs from foundation websites, extracts text,
 * then uses Claude API to identify grantee organizations and amounts.
 *
 * Foundations covered:
 *   - Myer Foundation (PDF annual reports)
 *   - Gandel Foundation (PDF annual reports)
 *   - Tim Fairfax Family Foundation (digital annual report)
 *   - Snow Foundation (annual report)
 *   - Origin Foundation (digital annual review)
 *   - ECSTRA Foundation (completed grants page)
 *
 * Usage:
 *   node --env-file=.env scripts/extract-foundation-grantees-pdf.mjs [--apply] [--verbose] [--foundation=myer]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const FOUNDATION_FILTER = process.argv.find(a => a.startsWith('--foundation='))?.split('=')[1];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Foundation Configs ──────────────────────────────────────────────────────

const FOUNDATIONS = {
  myer: {
    name: 'The Myer Foundation',
    abn: '46100632395',
    pdfs: [
      {
        url: 'https://uploads.prod01.sydney.platformos.com/instances/338/assets/documents/Publications/TMF%20Annual%20Report%20FY24.pdf',
        year: 2024,
        label: 'FY24 Annual Report',
      },
    ],
  },
  gandel: {
    name: 'Gandel Foundation',
    abn: '51393866453',
    pdfs: [
      {
        // Gandel publishes annual reviews — we'll discover the URL
        discover_from: 'https://gandelfoundation.org.au/news/annual-reports/',
        year: 2024,
        label: '2023-2024 Impact Report',
      },
    ],
  },
  'tim-fairfax': {
    name: 'Tim Fairfax Family Foundation',
    abn: '62124526760',
    pages: [
      {
        url: 'https://www.tfff.org.au/annualreport/2023-2024/',
        year: 2024,
        label: '2023-2024 Annual Report',
      },
    ],
  },
  snow: {
    name: 'The Snow Foundation',
    abn: '49411415493',
    pdfs: [
      {
        url: 'https://www.snowfoundation.org.au/wp-content/uploads/2025/03/Snow-Foundation-Annual-Report-2024-medium-res.pdf',
        year: 2024,
        label: '2024 Annual Report',
      },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function curl(url, timeout = 30) {
  try {
    const escaped = url.replace(/'/g, "\\'");
    return execSync(
      `curl -sL --max-time ${timeout} --max-redirs 5 -H 'User-Agent: CivicGraph/1.0 (research)' '${escaped}'`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: (timeout + 10) * 1000 }
    );
  } catch { return null; }
}

function downloadPdf(url, outPath, timeout = 60) {
  try {
    execSync(
      `curl -sL --max-time ${timeout} -o '${outPath}' '${url}'`,
      { timeout: (timeout + 10) * 1000 }
    );
    return existsSync(outPath);
  } catch { return false; }
}

function pdfToText(pdfPath) {
  try {
    return execSync(`pdftotext -layout '${pdfPath}' -`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
  } catch { return null; }
}

// ─── Claude API for grantee extraction ───────────────────────────────────────

async function extractGranteesWithClaude(text, foundationName, year) {
  // Truncate to ~100K chars to stay within limits
  const truncated = text.slice(0, 100000);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are analyzing the annual report of ${foundationName} (financial year ${year}).

Extract ALL grant recipients (organizations that received funding) from this document.

For each grantee, extract:
- name: The organization name (exactly as written)
- amount: The dollar amount (if mentioned), as a number without $ or commas
- program: The program/category the grant falls under (if mentioned)
- state: The Australian state (if mentioned)
- multi_year: true if it's a multi-year grant

Return ONLY a JSON array. No explanation, no markdown fences. Example:
[{"name":"Organisation Name","amount":100000,"program":"Health","state":"VIC","multi_year":false}]

If you find NO grantees, return [].

Document text:
${truncated}`
      }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    log(`  Claude API error: ${response.status} ${errText.slice(0, 200)}`);
    return [];
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || '[]';

  try {
    // Try to parse JSON, handling possible markdown fences
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    log(`  Failed to parse Claude response: ${e.message}`);
    if (VERBOSE) log(`  Response: ${content.slice(0, 500)}`);
    return [];
  }
}

// ─── Match grantee to entity ─────────────────────────────────────────────────

async function matchGrantee(name) {
  if (!name || name.length < 3) return null;
  const clean = name.replace(/[()[\]\\\/]/g, '').trim();
  if (clean.length < 4) return null;

  // Strategy 1: Direct entity ILIKE
  try {
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn')
      .ilike('canonical_name', `%${clean}%`)
      .limit(5);

    if (entities?.length === 1) return entities[0];
    if (entities?.length > 1) {
      const exact = entities.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
      return entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
    }
  } catch {}

  // Strategy 2: ACNC lookup
  try {
    const { data: acnc } = await db
      .from('acnc_charities')
      .select('abn, name')
      .ilike('name', `%${clean}%`)
      .limit(3);

    if (acnc?.length) {
      for (const a of acnc) {
        const { data: entity } = await db
          .from('gs_entities')
          .select('id, canonical_name, abn')
          .eq('abn', a.abn)
          .limit(1);
        if (entity?.length) return entity[0];
      }
    }
  } catch {}

  // Strategy 3: pg_trgm fuzzy
  try {
    const escaped = name.replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, canonical_name, abn, similarity(canonical_name, '${escaped}') as sim
              FROM gs_entities WHERE canonical_name % '${escaped}'
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length && trgm[0].sim >= 0.55) {
      return { id: trgm[0].id, canonical_name: trgm[0].canonical_name, abn: trgm[0].abn };
    }
  } catch {}

  return null;
}

// ─── Process a single foundation ─────────────────────────────────────────────

async function processFoundation(key, config) {
  log(`\n═══ ${config.name} ═══`);

  // Get foundation entity
  const { data: fEntity } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', config.abn)
    .limit(1);

  if (!fEntity?.length) {
    log(`  ERROR: Entity not found for ABN ${config.abn}`);
    return { matched: 0, created: 0, notFound: 0 };
  }

  const foundationId = fEntity[0].id;
  log(`  Entity: ${fEntity[0].canonical_name} (${foundationId})`);

  // Check existing edges
  const { data: existing } = await db
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', foundationId)
    .eq('relationship_type', 'grant');

  const existingTargets = new Set((existing || []).map(r => r.target_entity_id));
  log(`  Existing grant edges: ${existingTargets.size}`);

  const cacheDir = 'tmp/foundation-pdfs';
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

  let allGrantees = [];

  // Process PDFs
  if (config.pdfs) {
    for (const pdf of config.pdfs) {
      const pdfPath = `${cacheDir}/${key}-${pdf.year}.pdf`;
      const cachePath = `${cacheDir}/${key}-${pdf.year}-grantees.json`;

      // Check cache
      if (existsSync(cachePath)) {
        log(`  Loading cached grantees for ${pdf.label}...`);
        allGrantees.push(...JSON.parse(readFileSync(cachePath, 'utf-8')));
        continue;
      }

      let pdfUrl = pdf.url;

      // Discover PDF URL if needed
      if (pdf.discover_from) {
        log(`  Discovering PDF URL from ${pdf.discover_from}...`);
        const html = curl(pdf.discover_from);
        if (html) {
          const pdfLinks = [...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)];
          if (pdfLinks.length) {
            pdfUrl = pdfLinks[0][1];
            if (!pdfUrl.startsWith('http')) {
              pdfUrl = new URL(pdfUrl, pdf.discover_from).href;
            }
            log(`  Found PDF: ${pdfUrl}`);
          } else {
            log(`  No PDF found on page`);
            continue;
          }
        }
      }

      if (!pdfUrl) continue;

      // Download PDF
      if (!existsSync(pdfPath)) {
        log(`  Downloading ${pdf.label}...`);
        if (!downloadPdf(pdfUrl, pdfPath)) {
          log(`  Failed to download PDF`);
          continue;
        }
      }

      // Extract text
      log(`  Extracting text from PDF...`);
      const text = pdfToText(pdfPath);
      if (!text) {
        log(`  Failed to extract text`);
        continue;
      }
      log(`  Extracted ${text.length} chars`);

      // Use Claude to extract grantees
      log(`  Extracting grantees with Claude API...`);
      const grantees = await extractGranteesWithClaude(text, config.name, pdf.year);
      log(`  Found ${grantees.length} grantees`);

      // Cache results
      writeFileSync(cachePath, JSON.stringify(grantees, null, 2));
      allGrantees.push(...grantees);
    }
  }

  // Process web pages (for foundations with digital reports)
  if (config.pages) {
    for (const page of config.pages) {
      const cachePath = `${cacheDir}/${key}-${page.year}-grantees.json`;

      if (existsSync(cachePath)) {
        log(`  Loading cached grantees for ${page.label}...`);
        allGrantees.push(...JSON.parse(readFileSync(cachePath, 'utf-8')));
        continue;
      }

      log(`  Fetching ${page.label}...`);
      const html = curl(page.url);
      if (!html) {
        log(`  Failed to fetch page`);
        continue;
      }

      // Strip HTML tags for Claude
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      log(`  Extracted ${text.length} chars of text`);

      log(`  Extracting grantees with Claude API...`);
      const grantees = await extractGranteesWithClaude(text, config.name, page.year);
      log(`  Found ${grantees.length} grantees`);

      writeFileSync(cachePath, JSON.stringify(grantees, null, 2));
      allGrantees.push(...grantees);
    }
  }

  // Dedup by name
  const seen = new Set();
  const uniqueGrantees = allGrantees.filter(g => {
    const key = g.name?.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  log(`\n  Total unique grantees: ${uniqueGrantees.length}`);

  // Match and create edges
  let matched = 0, created = 0, notFound = 0;
  const unmatched = [];

  for (let i = 0; i < uniqueGrantees.length; i++) {
    const grantee = uniqueGrantees[i];
    const entity = await matchGrantee(grantee.name);

    if (!entity) {
      notFound++;
      unmatched.push(grantee.name);
      if (VERBOSE) log(`    ✗ "${grantee.name}" — no match`);
      continue;
    }

    if (existingTargets.has(entity.id) || entity.id === foundationId) {
      if (VERBOSE) log(`    ⊘ "${grantee.name}" → "${entity.canonical_name}" — exists`);
      continue;
    }

    matched++;
    if (VERBOSE) {
      log(`    ✓ "${grantee.name}" → "${entity.canonical_name}" ($${grantee.amount || '?'})`);
    }

    if (APPLY) {
      const { error } = await db
        .from('gs_relationships')
        .insert({
          source_entity_id: foundationId,
          target_entity_id: entity.id,
          relationship_type: 'grant',
          amount: grantee.amount || null,
          year: grantee.multi_year ? null : 2024,
          dataset: 'foundation_annual_reports',
          confidence: 'reported',
          properties: {
            source: 'annual_report_pdf',
            program: grantee.program,
            state: grantee.state,
            foundation: config.name,
          },
        });

      if (!error) {
        created++;
        existingTargets.add(entity.id);
      }
    }
  }

  log(`\n  ═══ ${config.name} Summary ═══`);
  log(`    Grantees found: ${uniqueGrantees.length}`);
  log(`    Matched: ${matched}`);
  log(`    Created: ${APPLY ? created : matched} edges`);
  log(`    Not found: ${notFound}`);

  if (unmatched.length && VERBOSE) {
    log(`    Unmatched:`);
    for (const u of unmatched) log(`      • ${u}`);
  }

  return { matched, created: APPLY ? created : matched, notFound };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('═══ Foundation Grantee PDF Extractor ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const foundations = FOUNDATION_FILTER
    ? { [FOUNDATION_FILTER]: FOUNDATIONS[FOUNDATION_FILTER] }
    : FOUNDATIONS;

  if (FOUNDATION_FILTER && !FOUNDATIONS[FOUNDATION_FILTER]) {
    log(`Unknown foundation: ${FOUNDATION_FILTER}`);
    log(`Available: ${Object.keys(FOUNDATIONS).join(', ')}`);
    return;
  }

  let totalMatched = 0, totalCreated = 0, totalNotFound = 0;

  for (const [key, config] of Object.entries(foundations)) {
    const result = await processFoundation(key, config);
    totalMatched += result.matched;
    totalCreated += result.created;
    totalNotFound += result.notFound;
  }

  log('\n═══ GRAND TOTAL ═══');
  log(`  Matched: ${totalMatched}`);
  log(`  Edges created: ${totalCreated}`);
  log(`  Not found: ${totalNotFound}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
