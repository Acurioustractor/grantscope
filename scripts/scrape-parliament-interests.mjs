#!/usr/bin/env node

/**
 * Federal Parliament — Register of Members' Interests scraper
 *
 * Source: https://www.aph.gov.au/Senators_and_Members/Members/Register
 *   Each MP has a PDF at:
 *   /-/media/03_Senators_and_Members/32_Members/Register/48p/{AB|CF|GJ|KN|OR|SZ}/{LastName}_48P.pdf
 *
 * Extracts:
 *   - Shareholdings in named companies
 *   - Directorships on named boards
 *   - Paid positions (advisor/consultant)
 *   - Gifts over threshold
 *   - Sponsored travel
 *
 * Writes:
 *   - person_roles rows linking MP to declared companies/boards
 *   - gs_relationships (source: MP entity, target: declared-org entity,
 *     relationship_type: 'director_of' | 'shareholder_of' | 'advisor_to')
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-parliament-interests.mjs [--dry-run] [--limit=N]
 *
 * Dependencies: pdf-parse (installed in apps/web workspace; resolved via path).
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

// pdf-parse v2.x lives in the pnpm store — import via absolute file:// URL
// because the root package.json doesn't declare it as a dependency.
const pdfParseUrl = pathToFileURL(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'node_modules',
    '.pnpm',
    'pdf-parse@2.4.5',
    'node_modules',
    'pdf-parse',
    'dist',
    'pdf-parse',
    'esm',
    'index.js',
  ),
).href;
const { PDFParse } = await import(pdfParseUrl);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null;
const REGISTER_INDEX = 'https://www.aph.gov.au/Senators_and_Members/Members/Register';
const BASE = 'https://www.aph.gov.au';

function log(msg) { console.log(`[${new Date().toISOString()}] [parl-interests] ${msg}`); }

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research; ben@benjamink.com.au)' },
  });
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return r.text();
}

async function fetchBuffer(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research; ben@benjamink.com.au)' },
  });
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

// ─── PDF parsing ─────────────────────────────────────────────────────────

const SECTION_HEADERS = [
  'shareholdings',
  'real estate',
  'directorships',
  'trusts',
  'office',
  'liabilities',
  'memberships',
  'gifts',
  'travel',
];

/**
 * Crude section splitter. The register PDFs use "1. Shareholdings", "2. Real estate", etc.
 * We chunk by those headings and hold whatever follows as raw text.
 */
function splitSections(text) {
  const sections = {};
  const lines = text.split(/\r?\n/).map(l => l.trim());
  let currentSection = null;
  let buffer = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const matched = SECTION_HEADERS.find(h => lower.startsWith(h) || lower.match(new RegExp(`^\\d+\\.?\\s*${h}`)));
    if (matched) {
      if (currentSection) sections[currentSection] = buffer.join('\n').trim();
      currentSection = matched;
      buffer = [];
      continue;
    }
    if (currentSection) buffer.push(line);
  }
  if (currentSection) sections[currentSection] = buffer.join('\n').trim();
  return sections;
}

/**
 * Rough entity-name extraction from declared-interest text.
 * Looks for lines containing common company suffixes and returns them.
 */
function extractOrgMentions(section) {
  if (!section) return [];
  const orgs = new Set();
  const suffixPatterns = /\b([A-Z][A-Za-z0-9&'.\-\s]{2,60}?\s+(Pty\s*Ltd|Limited|Ltd|Inc|Incorporated|Corporation|Corp|Foundation|Trust|Partnership|Society|Association|Council|Institute|University|Company|Plc|AG|SA|NV|GmbH))\b/g;
  let m;
  while ((m = suffixPatterns.exec(section)) !== null) {
    const raw = m[1].replace(/\s+/g, ' ').trim();
    if (raw.length > 6 && raw.length < 120) orgs.add(raw);
  }
  return Array.from(orgs);
}

// ─── MP list from register index ────────────────────────────────────────

async function getMpPdfLinks() {
  const html = await fetchText(REGISTER_INDEX);
  const hrefs = Array.from(html.matchAll(/href="(\/-\/media\/[^"]*48P\.pdf)"/g));
  const unique = new Set(hrefs.map(h => h[1]));
  const list = Array.from(unique).map(path => {
    const filename = path.split('/').pop();
    const lastNameFromFile = filename.replace('_48P.pdf', '').replace(/[_-]/g, ' ').trim();
    return { url: BASE + path, lastName: lastNameFromFile };
  });
  return list;
}

// ─── Entity + role persistence ──────────────────────────────────────────

async function findOrCreateMpEntity(lastName) {
  // Look for existing entity matching MP by name. Parliament members are
  // typically already ingested via ingest-parliament-members.mjs with
  // entity_type='person' and relationship to 'Parliament of Australia'.
  const { data } = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name')
    .eq('entity_type', 'person')
    .ilike('canonical_name', `%${lastName}%`)
    .limit(5);
  if (data && data.length === 1) return data[0]; // high confidence single match
  return null;
}

async function findOrgByName(name) {
  const norm = name.toLowerCase().trim();
  const { data } = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', `%${norm.slice(0, 50)}%`)
    .limit(3);
  return (data && data.length > 0) ? data[0] : null;
}

async function createInterestRelationship(mpEntity, orgEntity, relType, context) {
  if (DRY_RUN) return;
  await supabase.from('gs_relationships').insert({
    source_entity_id: mpEntity.id,
    target_entity_id: orgEntity.id,
    relationship_type: relType,
    dataset: 'parliament-interests',
    properties: { section: context, source: 'register-of-members-interests-48p' },
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  log(`starting ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);

  const mps = await getMpPdfLinks();
  log(`${mps.length} MP PDFs found in register`);
  const targets = LIMIT ? mps.slice(0, LIMIT) : mps;

  let processed = 0;
  let parseErrors = 0;
  let orgsExtracted = 0;
  let relationshipsCreated = 0;
  const noMpMatch = [];
  const noOrgMatch = new Set();

  for (const mp of targets) {
    processed++;
    try {
      const pdfBytes = await fetchBuffer(mp.url);
      const parser = new PDFParse({ data: pdfBytes });
      const result = await parser.getText();
      await parser.destroy();
      const fullText = result.text || (result.pages?.map(p => p.text).join('\n') ?? '');
      const sections = splitSections(fullText);

      // Find MP entity
      const mpEntity = await findOrCreateMpEntity(mp.lastName);
      if (!mpEntity) {
        noMpMatch.push(mp.lastName);
        continue;
      }

      // Shareholdings → shareholder_of
      const shareholdings = extractOrgMentions(sections['shareholdings']);
      for (const orgName of shareholdings) {
        orgsExtracted++;
        const org = await findOrgByName(orgName);
        if (!org) { noOrgMatch.add(orgName); continue; }
        await createInterestRelationship(mpEntity, org, 'shareholder_of', 'shareholdings');
        relationshipsCreated++;
      }

      // Directorships → director_of
      const directorships = extractOrgMentions(sections['directorships']);
      for (const orgName of directorships) {
        orgsExtracted++;
        const org = await findOrgByName(orgName);
        if (!org) { noOrgMatch.add(orgName); continue; }
        await createInterestRelationship(mpEntity, org, 'director_of', 'directorships');
        relationshipsCreated++;
      }

      // Office-bearer positions → member_of / advisor_to
      const memberships = extractOrgMentions(sections['memberships']);
      for (const orgName of memberships) {
        orgsExtracted++;
        const org = await findOrgByName(orgName);
        if (!org) { noOrgMatch.add(orgName); continue; }
        await createInterestRelationship(mpEntity, org, 'member_of', 'memberships');
        relationshipsCreated++;
      }

      if (processed % 10 === 0) {
        log(`  ${processed}/${targets.length} MPs processed — ${orgsExtracted} org mentions, ${relationshipsCreated} relationships`);
      }
    } catch (err) {
      parseErrors++;
      log(`  PDF error for ${mp.lastName}: ${err.message}`);
    }
  }

  log(`=== DONE ===`);
  log(`  MPs processed: ${processed} of ${targets.length}`);
  log(`  Parse errors: ${parseErrors}`);
  log(`  Org mentions extracted: ${orgsExtracted}`);
  log(`  Relationships created: ${relationshipsCreated}`);
  log(`  MPs not matched to entities: ${noMpMatch.length} — first 5: ${noMpMatch.slice(0, 5).join(', ')}`);
  log(`  Orgs mentioned but not in graph: ${noOrgMatch.size} — first 10: ${Array.from(noOrgMatch).slice(0, 10).join(' | ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
