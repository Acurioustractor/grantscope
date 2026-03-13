#!/usr/bin/env node

/**
 * Import BuyAbility Directory — Australian Disability Enterprises
 *
 * Uses the full public BuyAbility directory and enriches each organisation from its
 * detail page. This gives us materially richer fields than the old card-level scrape:
 * website, address/state, service lines, community contribution, beneficiary context,
 * and procurement-ready descriptions.
 *
 * Usage:
 *   node scripts/import-buyability.mjs
 *   node scripts/import-buyability.mjs --dry-run
 *   node scripts/import-buyability.mjs --limit=50
 *   node scripts/import-buyability.mjs --concurrency=4
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { execFileSync } from 'node:child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 4;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, upserted: 0, errors: 0 };
const BASE_URL = 'https://buyability.org.au';
const DIRECTORY_URL = `${BASE_URL}/directory/`;
const USER_AGENT = 'GrantScope/1.0 (research; contact@act.place)';

function log(msg) {
  console.log(`[import-buyability] ${msg}`);
}

function fetchBuyAbilityHtml(url) {
  return execFileSync('curl', ['-kLs', '-A', USER_AGENT, url], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function normaliseState(text) {
  if (!text) return null;
  const s = text.trim().toUpperCase().replace(/\s+/g, ' ');
  const patterns = [
    ['WA', /\b(?:WA|WESTERN AUSTRALIA)\b/],
    ['NSW', /\b(?:NSW|NEW SOUTH WALES)\b/],
    ['QLD', /\b(?:QLD|QUEENSLAND)\b/],
    ['SA', /\b(?:SA|SOUTH AUSTRALIA)\b/],
    ['TAS', /\b(?:TAS|TASMANIA)\b/],
    ['NT', /\b(?:NT|NORTHERN TERRITORY)\b/],
    ['ACT', /\b(?:ACT|CANBERRA|AUSTRALIAN CAPITAL TERRITORY)\b/],
    ['VIC', /\b(?:VIC|VICTORIA)\b/],
  ];

  for (const [state, pattern] of patterns) {
    if (pattern.test(s)) return state;
  }
  return null;
}

function inferSectors(text) {
  const t = String(text || '').toLowerCase();
  const sectors = ['employment'];
  if (/clean|laundry|facility|maintenance|garden|grounds|weed|slashing|tree|flora|fauna/.test(t)) sectors.push('facilities');
  if (/pack|assembly|manufactur|warehouse|timber|production|industrial|pallet/.test(t)) sectors.push('manufacturing');
  if (/food|cafe|catering|kitchen|coffee|bakery/.test(t)) sectors.push('food');
  if (/art|craft|creative|theatre|design/.test(t)) sectors.push('arts');
  if (/recycle|waste|environment|sustain|remediation/.test(t)) sectors.push('environment');
  if (/tech|digital|printing|scan|software|it\b/.test(t)) sectors.push('technology');
  if (/disability|supported employee/.test(t)) sectors.push('health');
  if (/training|education|learning/.test(t)) sectors.push('education');
  if (/transport|delivery|logistics/.test(t)) sectors.push('logistics');
  return unique(sectors);
}

function deriveBusinessModel(services, description, contribution) {
  const joined = [services?.join(', '), description, contribution].filter(Boolean).join(' ').trim();
  if (!joined) return 'Supported-employment social enterprise';
  const serviceSummary = services?.length ? services.slice(0, 5).join(', ') : 'commercial services';
  return `Supported-employment social enterprise delivering ${serviceSummary}. ${joined}`.slice(0, 500);
}

function extractSectionText($, headingText) {
  const heading = $('h3').filter((_, el) => $(el).text().trim().toLowerCase() === headingText.toLowerCase()).first();
  if (!heading.length) return '';
  const parts = [];
  let cursor = heading.next();
  while (cursor.length && cursor[0].tagName !== 'h3' && !cursor.is('.row')) {
    const text = decodeHtml(cursor.text());
    if (text) parts.push(text);
    cursor = cursor.next();
  }
  return parts.join(' ').trim();
}

function extractServices($) {
  const services = [];
  $('p strong').each((_, el) => {
    const label = decodeHtml($(el).text()).toLowerCase();
    if (!label.startsWith('services')) return;
    const ul = $(el).parent().nextAll('ul').first();
    ul.find('li').each((__, li) => {
      const service = decodeHtml($(li).text());
      if (service) services.push(service);
    });
  });
  return unique(services);
}

function parseAddressFromDetail($) {
  const lines = [];
  $('.contactInfo li').each((_, el) => {
    const detailLabel = decodeHtml($(el).find('.detail').first().text()).toLowerCase();
    if (detailLabel.startsWith('website') || detailLabel.startsWith('phone')) return;
    const text = decodeHtml($(el).text().replace(/Website:\s*.*/i, '').replace(/Phone:\s*.*/i, ''));
    if (text) lines.push(text);
  });
  return unique(lines).join(' ').trim();
}

function deriveLocation(address) {
  const postcodeMatch = address.match(/\b(0\d{3}|[1-9]\d{3})\b/);
  const postcode = postcodeMatch ? postcodeMatch[1] : null;
  const state = normaliseState(address);
  let city = null;
  if (address) {
    const cityMatch = address.match(/([A-Za-z'\- ]+),?\s+(?:NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b/i);
    if (cityMatch) city = cityMatch[1].trim();
  }
  return { state, city, postcode };
}

function compareBuyabilityRows(a, b) {
  const aHasState = a.state && a.state.trim() !== '';
  const bHasState = b.state && b.state.trim() !== '';
  if (aHasState !== bHasState) return aHasState ? -1 : 1;

  const aUpdated = a.updated_at ? Date.parse(a.updated_at) : 0;
  const bUpdated = b.updated_at ? Date.parse(b.updated_at) : 0;
  if (aUpdated !== bUpdated) return bUpdated - aUpdated;

  const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
  const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
  if (aCreated !== bCreated) return bCreated - aCreated;

  return String(a.id).localeCompare(String(b.id));
}

async function collapseBuyabilityDuplicates() {
  const { data, error } = await supabase
    .from('social_enterprises')
    .select('id, name, state, updated_at, created_at')
    .eq('source_primary', 'buyability');

  if (error) throw error;

  const byName = new Map();
  for (const row of data || []) {
    if (!byName.has(row.name)) byName.set(row.name, []);
    byName.get(row.name).push(row);
  }

  const duplicateIds = [];
  for (const rows of byName.values()) {
    if (rows.length < 2) continue;
    rows.sort(compareBuyabilityRows);
    duplicateIds.push(...rows.slice(1).map((row) => row.id));
  }

  if (duplicateIds.length === 0) {
    log('No duplicate BuyAbility rows to collapse');
    return;
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
    const batch = duplicateIds.slice(i, i + BATCH_SIZE);
    const { error: deleteError } = await supabase
      .from('social_enterprises')
      .delete()
      .in('id', batch);
    if (deleteError) throw deleteError;
  }

  log(`Collapsed ${duplicateIds.length} stale BuyAbility duplicate rows`);
}

function parseDirectoryCards(html) {
  const $ = cheerio.load(html);
  const enterprises = [];
  $('.directoryItem').each((_, el) => {
    const link = $(el).find('h4 a[href*="/organisation/"]').attr('href') || $(el).find('a.directoryLogo[href*="/organisation/"]').attr('href');
    const name = decodeHtml($(el).find('h4').first().text());
    if (!name || !link) return;
    enterprises.push({
      name,
      profileUrl: link.startsWith('http') ? link : `${BASE_URL}${link}`,
    });
  });
  return enterprises;
}

async function scrapeDirectory() {
  const html = fetchBuyAbilityHtml(DIRECTORY_URL);
  const enterprises = parseDirectoryCards(html);
  if (enterprises.length === 0) throw new Error('No BuyAbility directory entries found');
  return enterprises;
}

async function scrapeEnterpriseDetails(entry) {
  const html = fetchBuyAbilityHtml(entry.profileUrl);
  const $ = cheerio.load(html);

  const title = decodeHtml(($('title').text() || '').replace(/\| BuyAbility$/i, ''));
  const name = title || entry.name;
  const website = $('a[href^="http"]').filter((_, el) => !$(el).attr('href').includes('buyability.org.au')).first().attr('href') || null;
  const address = parseAddressFromDetail($);
  const { state, city, postcode } = deriveLocation(address);
  const description = extractSectionText($, 'Brief description');
  const contribution = extractSectionText($, 'The contribution we make to the community');
  const benefits = extractSectionText($, 'How supported employees and their families benefit');
  const services = extractServices($);
  const combinedDescription = [description, contribution, benefits].filter(Boolean).join(' ').trim();

  return {
    name,
    description: combinedDescription || description || null,
    website,
    state,
    city,
    postcode,
    services,
    business_model: deriveBusinessModel(services, description, contribution),
    target_beneficiaries: ['people_with_disability'],
    certifications: [{ body: 'buyability', status: 'listed', url: entry.profileUrl }],
    source_primary: 'buyability',
    profile_confidence: combinedDescription && website ? 'high' : 'medium',
    sources: [{
      source: 'buyability',
      url: entry.profileUrl,
      directory_url: DIRECTORY_URL,
      scraped_at: new Date().toISOString(),
      services,
      contribution: contribution || null,
      employee_benefit: benefits || null,
      address: address || null,
    }],
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const slice = items.slice(i, i + limit);
    const chunk = await Promise.all(slice.map(mapper));
    results.push(...chunk);
  }
  return results;
}

async function run() {
  log('Starting BuyAbility import...');

  const enterprises = await scrapeDirectory();
  log(`Found ${enterprises.length} directory entries`);

  const selected = LIMIT ? enterprises.slice(0, LIMIT) : enterprises;
  const detailed = await mapWithConcurrency(selected, CONCURRENCY, async (entry) => {
    try {
      const result = await scrapeEnterpriseDetails(entry);
      log(`  ${result.name}${result.state ? ` (${result.state})` : ''}`);
      return result;
    } catch (err) {
      stats.errors += 1;
      log(`  Error for ${entry.name}: ${err.message}`);
      return null;
    }
  });

  const rows = detailed
    .filter(Boolean)
    .map((e) => ({
      name: e.name,
      description: e.description,
      website: e.website,
      state: e.state,
      city: e.city,
      postcode: e.postcode,
      org_type: 'disability_enterprise',
      sector: inferSectors(`${e.description || ''} ${e.services?.join(' ') || ''}`),
      geographic_focus: unique([e.state, e.city].filter(Boolean)),
      certifications: e.certifications,
      source_primary: e.source_primary,
      sources: e.sources,
      target_beneficiaries: e.target_beneficiaries,
      profile_confidence: e.profile_confidence,
      business_model: e.business_model,
    }))
    .filter((r) => r.name);

  stats.total += rows.length;

  if (DRY_RUN) {
    log(`[DRY RUN] Would upsert ${rows.length} enriched BuyAbility records`);
    for (const r of rows.slice(0, 5)) log(`  - ${r.name} (${r.state || '?'}) :: ${r.website || 'no website'}`);
    stats.upserted = rows.length;
    log(`\nDone! Total: ${stats.total}, Upserted: ${stats.upserted}, Errors: ${stats.errors}`);
    return;
  }

  const BATCH_SIZE = 25;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('social_enterprises')
      .upsert(batch, { onConflict: 'name,state', ignoreDuplicates: false });

    if (error) {
      log(`Batch error: ${error.message}`);
      stats.errors += batch.length;
    } else {
      stats.upserted += batch.length;
    }
  }

  await collapseBuyabilityDuplicates();

  log(`\nDone! Total: ${stats.total}, Upserted: ${stats.upserted}, Errors: ${stats.errors}`);
}

run().catch((err) => {
  console.error('[import-buyability] Fatal:', err);
  process.exit(1);
});
