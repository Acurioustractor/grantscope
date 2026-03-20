#!/usr/bin/env node

/**
 * scrape-foundation-grantees-all.mjs
 *
 * Unified foundation grantee mapping pipeline for Australia's top foundations.
 * Combines API scraping, HTML scraping, and curated grantee lists to build
 * grant relationship edges in gs_relationships.
 *
 * Strategies per foundation:
 *   - API: Lotterywest (JSON API), Paul Ramsay (Webflow CMS)
 *   - HTML: Gandel (Elementor), Snow Foundation (WordPress)
 *   - Curated: Minderoo, Tim Fairfax, Sidney Myer, VFFF, LMCF, Perpetual
 *   - PDF: Some foundations publish in annual reports (noted for manual extraction)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-foundation-grantees-all.mjs [--dry-run] [--foundation=lotterywest] [--verbose]
 *
 * Flags:
 *   --dry-run         Report matches without inserting (default)
 *   --apply           Actually insert relationships
 *   --foundation=X    Process only foundation X (by key)
 *   --verbose         Show per-grantee match details
 *   --list            List available foundations and exit
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = !process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const FILTER = process.argv.find(a => a.startsWith('--foundation='))?.split('=')[1];
const LIST = process.argv.includes('--list');

const USER_AGENT = 'CivicGraph/1.0 (research; civicgraph.au)';
const CACHE_DIR = 'tmp';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function curl(url, timeout = 20) {
  try {
    const escaped = url.replace(/'/g, "'\\''");
    return execSync(
      `curl -sL --max-time ${timeout} --max-redirs 3 -H 'User-Agent: ${USER_AGENT}' '${escaped}'`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: (timeout + 5) * 1000 }
    );
  } catch { return null; }
}

function curlJson(url, timeout = 20) {
  try {
    const escaped = url.replace(/'/g, "'\\''");
    const raw = execSync(
      `curl -sL --max-time ${timeout} --max-redirs 3 -H 'User-Agent: ${USER_AGENT}' -H 'Accept: application/json' '${escaped}'`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: (timeout + 5) * 1000 }
    );
    return JSON.parse(raw);
  } catch { return null; }
}

function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

// ─── Foundation Configurations ─────────────────────────────────────────────────

const FOUNDATIONS = {
  lotterywest: {
    name: 'Lotterywest',
    abn: '75964258835',
    strategy: 'api',
    description: 'WA lottery grants — JSON API at /api/grants/approved (512+ grants)',
    apiUrl: 'https://www.lotterywest.wa.gov.au/api/grants/approved',
    pageSize: 100,
    year: null, // varies per grant
    dataset: 'lotterywest_grants',
  },

  'paul-ramsay': {
    name: 'Paul Ramsay Foundation',
    abn: '32623132472',
    strategy: 'curated',
    description: '~$200M/year. Webflow site. Grantees curated from who-we-fund page and annual reports.',
    year: 2025,
    dataset: 'paul_ramsay_grantees',
    grantees: [
      // Justice & Safety
      { name: 'Aboriginal Family Legal Service WA', focus: 'justice' },
      { name: 'Anglicare WA', focus: 'justice' },
      { name: 'Anglicare Victoria', focus: 'justice' },
      { name: 'Australian Muslim Women\'s Centre for Human Rights', focus: 'justice' },
      { name: 'Ballarat and District Aboriginal Cooperative', focus: 'justice' },
      { name: 'Berry Street Victoria', focus: 'justice' },
      { name: 'Blacktown Youth Services Association', focus: 'justice' },
      { name: 'Central Australian Aboriginal Family Legal Unit', focus: 'justice' },
      { name: 'Centre for Non-Violence', focus: 'justice' },
      { name: 'Dardi Munwurro', focus: 'justice' },
      { name: 'Deadly Connections Community and Justice Services', focus: 'justice' },
      { name: 'Djirra', focus: 'justice' },
      { name: 'Ebenezer Aboriginal Corporation', focus: 'justice' },
      { name: 'Elizabeth Morgan House Aboriginal Women\'s Services', focus: 'justice' },
      { name: 'Engender Equality', focus: 'justice' },
      { name: 'Family Access Network', focus: 'justice' },
      { name: 'Health Justice Australia', focus: 'justice' },
      { name: 'Illawarra Koori Men\'s Support Group', focus: 'justice' },
      { name: 'inTouch Multicultural Centre Against Family Violence', focus: 'justice' },
      { name: 'Just Reinvest NSW', focus: 'justice' },
      { name: 'Justice and Equity Centre', focus: 'justice' },
      { name: 'Katungul Aboriginal Corporation Regional Health & Community Services', focus: 'justice' },
      { name: 'KRED Enterprises Charitable Trust', focus: 'justice' },
      { name: 'Kura Yerlo', focus: 'justice' },
      { name: 'KWY Aboriginal Corporation', focus: 'justice' },
      { name: 'Liberty Domestic & Family Violence Specialist Services', focus: 'justice' },
      { name: 'Micah Projects', focus: 'justice' },
      { name: 'Multicultural Families Organisation', focus: 'justice' },
      { name: 'Multicultural Youth South Australia', focus: 'justice' },
      { name: 'Northern Rivers Women and Children\'s Services', focus: 'justice' },
      { name: 'NPY Women\'s Council', focus: 'justice' },
      { name: 'Parkerville Children and Youth Care', focus: 'justice' },
      // First Nations
      { name: 'Aboriginal Biodiversity Conservation Foundation', focus: 'indigenous' },
      { name: 'Aurora Education Foundation', focus: 'indigenous' },
      { name: 'First Australians Capital', focus: 'indigenous' },
      { name: 'Gujaga Foundation', focus: 'indigenous' },
      { name: 'Karrkad Kanjdji Trust', focus: 'indigenous' },
      { name: 'National Indigenous Youth Education Coalition', focus: 'indigenous' },
      { name: 'NSW Aboriginal Land Council', focus: 'indigenous' },
      { name: 'NSW Aboriginal Education Consultative Group', focus: 'indigenous' },
      { name: 'Original Power', focus: 'indigenous' },
      // Employment
      { name: 'Beacon Foundation', focus: 'employment' },
      { name: 'Brotherhood of St. Laurence', focus: 'employment' },
      { name: 'Clontarf Foundation', focus: 'employment' },
      { name: 'Foyer Foundation', focus: 'employment' },
      { name: 'Generation Australia', focus: 'employment' },
      { name: 'National Disability Services', focus: 'employment' },
      // Community / NFP sector
      { name: 'Australian Communities Foundation', focus: 'community' },
      { name: 'Australian Democracy Network', focus: 'community' },
      { name: 'Australian Research Alliance for Children and Youth', focus: 'community' },
      { name: 'Centre for Social Impact', focus: 'community' },
      { name: 'Documentary Australia', focus: 'community' },
      { name: 'Foundation for Rural and Regional Renewal', focus: 'community' },
      // Housing
      { name: 'Launch Housing', focus: 'housing' },
      // Mental Health
      { name: 'Beyond Blue', focus: 'health' },
      { name: 'Black Dog Institute', focus: 'health' },
      // Emergency
      { name: 'Australian Red Cross', focus: 'emergency' },
      // Education
      { name: 'The Smith Family', focus: 'education' },
      // Social Enterprise
      { name: 'Two Good', focus: 'social_enterprise' },
      // Research
      { name: 'E61 Institute', focus: 'research' },
      { name: 'Murdoch Children\'s Research Institute', focus: 'research' },
    ],
  },

  minderoo: {
    name: 'Minderoo Foundation',
    abn: '24819440618',
    strategy: 'curated',
    description: 'Andrew Forrest\'s foundation. Astro-based site, no public grantee API. Curated from annual reports.',
    year: 2025,
    dataset: 'minderoo_grantees',
    grantees: [
      { name: 'Telethon Kids Institute', focus: 'research' },
      { name: 'University of Western Australia', focus: 'research' },
      { name: 'Curtin University', focus: 'education' },
      { name: 'Edith Cowan University', focus: 'education' },
      { name: 'CoderDojo', focus: 'education' },
      { name: 'Teach for Australia', focus: 'education' },
      { name: 'Australian Institute of Marine Science', focus: 'environment' },
      { name: 'Australian Red Cross', focus: 'emergency' },
      { name: 'Scitech', focus: 'education' },
      { name: 'Thrive by Five', focus: 'early_childhood' },
      // Flourishing Oceans partners
      { name: 'CSIRO', focus: 'research' },
      { name: 'Global Fishing Watch', focus: 'environment' },
      // Walk Free partners
      { name: 'Anti-Slavery Australia', focus: 'justice' },
      // Generate partners
      { name: 'Cancer Council Western Australia', focus: 'health' },
      { name: 'Fiona Stanley Hospital', focus: 'health' },
      { name: 'Harry Perkins Institute of Medical Research', focus: 'research' },
      { name: 'Lions Eye Institute', focus: 'health' },
      { name: 'Perth Children\'s Hospital Foundation', focus: 'health' },
    ],
  },

  gandel: {
    name: 'Gandel Foundation',
    abn: '51393866453',
    strategy: 'curated',
    description: 'Melbourne philanthropic foundation. Has /past-grant-recipients page (Elementor, JS-rendered). Curated from impact reports.',
    year: 2024,
    dataset: 'gandel_grantees',
    // NOTE: past-grant-recipients page at gandelfoundation.org.au/grant-information/past-grant-recipients/
    //       is Elementor/JS-rendered — org names not in raw HTML. Would need headless browser.
    grantees: [
      // Arts & Culture
      { name: 'Hellenic Museum', focus: 'arts' },
      { name: 'Jewish Museum of Australia', focus: 'arts' },
      { name: 'Melbourne Youth Orchestras', focus: 'arts' },
      { name: 'Musica Viva', focus: 'arts' },
      { name: 'National Gallery of Victoria', focus: 'arts' },
      { name: 'Melbourne Symphony Orchestra', focus: 'arts' },
      // Community
      { name: 'Australians Investing in Women', focus: 'community' },
      { name: 'Thread Together', focus: 'community' },
      { name: 'SecondBite', focus: 'community' },
      { name: 'State Schools Relief', focus: 'education' },
      { name: 'Flying Fox', focus: 'community' },
      { name: 'Project Rockit Foundation', focus: 'community' },
      // Major / Flagship
      { name: 'Melbourne City Mission', focus: 'community' },
      { name: 'FareShare', focus: 'community' },
      { name: 'Jesuit Social Services', focus: 'community' },
      { name: 'Children\'s Ground', focus: 'indigenous' },
      { name: 'Smiling Mind', focus: 'health' },
      { name: 'Social Traders', focus: 'social_enterprise' },
      { name: 'Cancer Council Victoria', focus: 'health' },
      { name: 'The Butterfly Foundation', focus: 'health' },
      { name: 'Centre for Multicultural Youth', focus: 'community' },
      { name: 'Courage to Care', focus: 'community' },
      { name: 'Karrkad Kanjdji Trust', focus: 'indigenous' },
      { name: 'Australian Sports Foundation', focus: 'community' },
      // Food security
      { name: 'Foodbank Victoria', focus: 'community' },
      { name: 'Food Ladder', focus: 'community' },
    ],
  },

  'tim-fairfax': {
    name: 'Tim Fairfax Family Foundation',
    abn: '62124526760',
    strategy: 'curated',
    description: 'Queensland-focused philanthropy. Grantees from annual reports.',
    year: 2024,
    dataset: 'tfff_grantees',
    grantees: [
      { name: 'Foundation for Rural and Regional Renewal', focus: 'community' },
      { name: 'Murdoch Children\'s Research Institute', focus: 'research' },
      { name: 'Cairns Indigenous Art Fair', focus: 'arts' },
      { name: 'AEIOU Foundation', focus: 'health' },
      { name: 'Umbrella Studio', focus: 'arts' },
      { name: 'Dancenorth', focus: 'arts' },
      { name: 'Camerata', focus: 'arts' },
      { name: 'Crossroad Arts', focus: 'arts' },
      { name: 'Aurora Education Foundation', focus: 'indigenous' },
      { name: 'Beacon Foundation', focus: 'employment' },
      { name: 'Black Dog Institute', focus: 'health' },
      { name: 'Clontarf Foundation', focus: 'employment' },
      { name: 'Queensland Art Gallery', focus: 'arts' },
      { name: 'Museum of Contemporary Art', focus: 'arts' },
      { name: 'Australian Chamber Orchestra', focus: 'arts' },
    ],
  },

  snow: {
    name: 'The Snow Foundation',
    abn: '49411415493',
    strategy: 'curated',
    description: 'Canberra/ACT focus. WordPress site is JS-rendered — org names not in raw HTML. Curated from various sources.',
    year: 2025,
    dataset: 'snow_foundation_grantees',
    // NOTE: snowfoundation.org.au/grants/organisations and /Canberra/organisations
    //       are JS-rendered (400KB HTML but orgs loaded via client-side JS). Need headless browser.
    grantees: [
      { name: 'Marymead', focus: 'community' },
      { name: 'Communities at Work', focus: 'community' },
      { name: 'Menslink', focus: 'community' },
      { name: 'Lifeline Canberra', focus: 'health' },
      { name: 'The Smith Family', focus: 'education' },
      { name: 'Salvation Army', focus: 'community' },
      { name: 'St Vincent de Paul Society', focus: 'community' },
      { name: 'Hands Across Canberra', focus: 'community' },
      { name: 'Barnardos', focus: 'community' },
      { name: 'Ted Noffs Foundation', focus: 'justice' },
      { name: 'Youth Coalition of the ACT', focus: 'community' },
      { name: 'ACT Council of Social Service', focus: 'community' },
      { name: 'Roundabout Canberra', focus: 'community' },
      { name: 'Women\'s Legal Centre ACT', focus: 'justice' },
      { name: 'Canberra Rape Crisis Centre', focus: 'justice' },
      { name: 'Domestic Violence Crisis Service', focus: 'justice' },
      { name: 'OzHarvest', focus: 'community' },
      { name: 'Care Financial Counselling', focus: 'community' },
      { name: 'Woden Community Service', focus: 'community' },
      { name: 'Belconnen Community Service', focus: 'community' },
      { name: 'Canberra Hospital Foundation', focus: 'health' },
      { name: 'National Museum of Australia', focus: 'arts' },
      { name: 'National Gallery of Australia', focus: 'arts' },
    ],
  },

  'sidney-myer': {
    name: 'Sidney Myer Fund',
    abn: '85951563811',
    strategy: 'curated',
    description: 'Related to Myer Foundation. PDF-only annual reports. Key grantees from public sources.',
    year: 2024,
    dataset: 'sidney_myer_fund_grantees',
    // PDF annual report: https://myerfoundation.org.au/annual-reports/
    pdfUrl: 'https://myerfoundation.org.au/annual-reports/',
    grantees: [
      { name: 'Melbourne Symphony Orchestra', focus: 'arts' },
      { name: 'Malthouse Theatre', focus: 'arts' },
      { name: 'Melbourne International Film Festival', focus: 'arts' },
      { name: 'Melbourne Writers Festival', focus: 'arts' },
      { name: 'Australian Ballet', focus: 'arts' },
      { name: 'Bell Shakespeare', focus: 'arts' },
      { name: 'Bangarra Dance Theatre', focus: 'arts' },
      { name: 'Melbourne Recital Centre', focus: 'arts' },
      { name: 'Heide Museum of Modern Art', focus: 'arts' },
      { name: 'Arts Centre Melbourne', focus: 'arts' },
    ],
  },

  lmcf: {
    name: 'Lord Mayor\'s Charitable Foundation',
    abn: '63635798473',
    strategy: 'curated',
    description: 'Now "Greater Melbourne Foundation" (greatermelbournefoundation.org.au). No public grant list. Curated from press releases.',
    year: 2025,
    dataset: 'lmcf_grantees',
    grantees: [
      { name: 'Brotherhood of St. Laurence', focus: 'community' },
      { name: 'Melbourne City Mission', focus: 'community' },
      { name: 'Asylum Seeker Resource Centre', focus: 'community' },
      { name: 'Royal Children\'s Hospital Foundation', focus: 'health' },
      { name: 'Launch Housing', focus: 'housing' },
      { name: 'Sacred Heart Mission', focus: 'community' },
      { name: 'Berry Street Victoria', focus: 'justice' },
      { name: 'FareShare', focus: 'community' },
      { name: 'Emerge Women and Children\'s Support Network', focus: 'justice' },
      { name: 'Climate Council', focus: 'environment' },
    ],
  },

  'vfff': {
    name: 'Vincent Fairfax Family Foundation',
    abn: '80058657592',
    strategy: 'curated',
    description: 'reports.vfff.org.au is JS-rendered. Curated from known grants.',
    year: 2024,
    dataset: 'vfff_grantees',
    // NOTE: reports.vfff.org.au — JS-rendered, needs headless browser.
    grantees: [
      { name: 'The Ethics Centre', focus: 'community' },
      { name: 'Centre for Policy Development', focus: 'research' },
      { name: 'Grattan Institute', focus: 'research' },
      { name: 'Social Ventures Australia', focus: 'community' },
      { name: 'Mission Australia', focus: 'community' },
      { name: 'Macquarie University', focus: 'education' },
      { name: 'University of Sydney', focus: 'education' },
    ],
  },

  perpetual: {
    name: 'Perpetual Foundation',
    abn: '71003208361',
    strategy: 'curated',
    description: 'Distributes through 1,000+ trusts ($125M/yr). No aggregated public data. Key known recipients.',
    year: 2024,
    dataset: 'perpetual_foundation_grantees',
    // NOTE: perpetual.com.au — no public grantee list. Perpetual manages trusts like
    //       Ramaciotti Foundation, Thomas Foundation, etc. Individual trust data is not aggregated.
    grantees: [
      // Known Ramaciotti grants
      { name: 'Walter and Eliza Hall Institute', focus: 'research' },
      { name: 'Garvan Institute of Medical Research', focus: 'research' },
      { name: 'Victor Chang Cardiac Research Institute', focus: 'research' },
    ],
  },
};

// ─── Scraper Strategies ──────────────────────────────────────────────────────

/**
 * Lotterywest JSON API scraper
 * Endpoint: /api/grants/approved?page=N&pageSize=100
 */
async function scrapeLotterywest(config) {
  const cacheFile = `${CACHE_DIR}/lotterywest-grants-all.json`;
  let allGrants = [];

  if (existsSync(cacheFile)) {
    log('  Loading cached Lotterywest data...');
    allGrants = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    log(`  Loaded ${allGrants.length} grants from cache`);
  } else {
    log('  Fetching from Lotterywest API...');
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const url = `${config.apiUrl}?page=${page}&pageSize=${config.pageSize}`;
      const json = curlJson(url);

      if (!json || !json.data?.length) {
        log(`  Page ${page}: no data, stopping`);
        break;
      }

      allGrants.push(...json.data);
      hasNext = json.hasNextPage;
      log(`  Page ${page}: ${json.data.length} grants (total: ${allGrants.length}/${json.totalCount})`);
      page++;

      await sleep(1000); // Rate limit
    }

    writeFileSync(cacheFile, JSON.stringify(allGrants, null, 2));
    log(`  Cached ${allGrants.length} grants to ${cacheFile}`);
  }

  // Transform to standard format
  return allGrants
    .filter(g => g.organisation && g.state === 'Granted')
    .map(g => ({
      name: g.organisation.trim(),
      amount: parseAmount(g.amount),
      purpose: g.purpose?.trim(),
      location: g.location,
      year: g.date ? parseInt(g.date.split('-').pop()) : null,
    }));
}

// ─── Entity Matching ─────────────────────────────────────────────────────────

/**
 * Normalize an org name for comparison: strip legal suffixes, lowercase, remove punctuation.
 */
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/\b(inc\.?|incorporated|ltd\.?|limited|pty|co-operative|cooperative|association|assoc\.?)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if candidate is a plausible match for the search name.
 * Uses containment logic: the search name (normalized) should be substantially
 * contained within the candidate, or vice versa.
 */
function isPlausibleMatch(searchName, candidateName) {
  const normSearch = normalizeName(searchName);
  const normCandidate = normalizeName(candidateName);

  // Exact normalized match
  if (normSearch === normCandidate) return true;

  // One contains the other — but only if they're very similar length
  // (prevents "Mission Australia" matching "Jesuit Mission Australia Limited")
  const lenRatio = Math.min(normSearch.length, normCandidate.length) / Math.max(normSearch.length, normCandidate.length);
  if ((normCandidate.includes(normSearch) || normSearch.includes(normCandidate)) && lenRatio >= 0.75) return true;

  // Compute word-level overlap excluding very common words
  const stopWords = new Set([
    'the', 'of', 'and', 'for', 'in', 'at', 'to', 'inc', 'ltd',
    'australia', 'australian', 'western', 'south', 'north', 'east', 'west',
    'new', 'national', 'state', 'community', 'communities', 'services', 'service',
    'city', 'shire', 'council', 'church', 'rotary', 'lions', 'club',
    'centre', 'center', 'foundation', 'trust', 'fund', 'festival',
    'branch', 'chapter', 'perth', 'melbourne', 'sydney', 'brisbane',
    'welfare', 'volunteer', 'seniors', 'regional',
  ]);
  const wordsA = normSearch.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const wordsB = normCandidate.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  // Count how many search words appear in the candidate
  const setB = new Set(wordsB);
  const matchedWords = wordsA.filter(w => setB.has(w));

  // Require at least 70% of meaningful search words to appear in candidate
  const ratio = matchedWords.length / wordsA.length;

  // If search has only 1 meaningful word, candidate must ALSO have only 1 meaningful word
  // (prevents "Mission Australia" matching "Jesuit Mission Australia Limited")
  if (wordsA.length === 1) {
    return matchedWords.length === 1 && wordsB.length === 1;
  }

  // For multi-word searches, require at least 2 matched words and 70% overlap
  return matchedWords.length >= 2 && ratio >= 0.7;
}

async function matchGrantee(name) {
  if (!name || name.length < 3) return null;
  const clean = name.replace(/[()[\]\\\/]/g, '').trim();
  if (clean.length < 4) return null;

  // Strategy 1: Direct entity ILIKE + plausibility check
  try {
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn')
      .ilike('canonical_name', `%${clean}%`)
      .limit(5);

    if (entities?.length) {
      // Exact case-insensitive match first
      const exact = entities.find(e =>
        e.canonical_name.toLowerCase() === name.toLowerCase() ||
        normalizeName(e.canonical_name) === normalizeName(name)
      );
      if (exact) return { ...exact, _method: 'entity_exact' };

      // Filter to plausible matches, prefer shortest name (most specific)
      const plausible = entities
        .filter(e => isPlausibleMatch(name, e.canonical_name))
        .sort((a, b) => a.canonical_name.length - b.canonical_name.length);
      if (plausible.length) return { ...plausible[0], _method: 'entity_ilike' };
    }
  } catch {}

  // Strategy 2: ACNC lookup + plausibility check
  try {
    const { data: acnc } = await db
      .from('acnc_charities')
      .select('abn, name')
      .ilike('name', `%${clean}%`)
      .limit(5);

    if (acnc?.length) {
      const plausible = acnc
        .filter(a => isPlausibleMatch(name, a.name))
        .sort((a, b) => a.name.length - b.name.length);

      for (const a of plausible) {
        const { data: entity } = await db
          .from('gs_entities')
          .select('id, canonical_name, abn')
          .eq('abn', a.abn)
          .limit(1);
        if (entity?.length) return { ...entity[0], _method: 'acnc' };
      }
    }
  } catch {}

  // Strategy 3: pg_trgm fuzzy (for misspellings, abbreviations) — high threshold
  // Also requires plausibility check to filter false positives
  try {
    const escaped = name.replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, canonical_name, abn, similarity(canonical_name, '${escaped}') as sim
              FROM gs_entities WHERE canonical_name % '${escaped}'
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length && trgm[0].sim >= 0.7 && isPlausibleMatch(name, trgm[0].canonical_name)) {
      return { id: trgm[0].id, canonical_name: trgm[0].canonical_name, abn: trgm[0].abn, _method: `trgm(${trgm[0].sim.toFixed(2)})` };
    }
  } catch {}

  return null;
}

// ─── Process a Single Foundation ─────────────────────────────────────────────

async function processFoundation(key, config) {
  log(`\n${'='.repeat(60)}`);
  log(`  ${config.name} (${config.strategy} strategy)`);
  log(`  ${config.description}`);
  log(`${'='.repeat(60)}`);

  // Step 1: Get grantee data (API, HTML, or curated)
  let grantees = [];

  if (config.strategy === 'api') {
    if (key === 'lotterywest') {
      const apiGrants = await scrapeLotterywest(config);
      // Dedupe by org name, aggregate amounts
      const byOrg = new Map();
      for (const g of apiGrants) {
        if (!byOrg.has(g.name)) {
          byOrg.set(g.name, { name: g.name, totalAmount: 0, grants: [] });
        }
        const org = byOrg.get(g.name);
        org.totalAmount += g.amount || 0;
        org.grants.push(g);
      }
      grantees = [...byOrg.values()].map(o => ({
        name: o.name,
        amount: o.totalAmount,
        grantCount: o.grants.length,
      }));
      log(`  API returned ${apiGrants.length} grants from ${grantees.length} unique organisations`);
    }
  } else if (config.strategy === 'curated') {
    grantees = config.grantees.map(g => ({
      name: typeof g === 'string' ? g : g.name,
      focus: typeof g === 'string' ? null : g.focus,
      amount: typeof g === 'string' ? null : g.amount,
    }));
    log(`  ${grantees.length} curated grantees`);
  }

  if (!grantees.length) {
    log('  No grantees to process');
    return { matched: 0, created: 0, skipped: 0, notFound: 0, total: 0 };
  }

  // Step 2: Find foundation entity
  const { data: fEntity } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', config.abn)
    .limit(1);

  if (!fEntity?.length) {
    log(`  WARNING: Foundation entity not found for ABN ${config.abn}`);
    // Try foundations table
    const { data: foundation } = await db
      .from('foundations')
      .select('name, acnc_abn')
      .eq('acnc_abn', config.abn)
      .limit(1);

    if (foundation?.length) {
      log(`  Found in foundations table but no gs_entity. Skipping.`);
    } else {
      log(`  Not found in foundations table either. Skipping.`);
    }
    return { matched: 0, created: 0, skipped: 0, notFound: 0, total: grantees.length };
  }

  const foundationId = fEntity[0].id;
  log(`  Foundation entity: ${fEntity[0].canonical_name} (${foundationId.substring(0, 8)}...)`);

  // Step 3: Check existing grant edges
  const { data: existing } = await db
    .from('gs_relationships')
    .select('target_entity_id, dataset')
    .eq('source_entity_id', foundationId)
    .eq('relationship_type', 'grant');

  const existingTargets = new Set((existing || []).map(r => r.target_entity_id));
  log(`  Existing grant edges: ${existingTargets.size}`);

  // Step 4: Match and create edges
  let matched = 0, created = 0, skipped = 0, notFound = 0;
  const unmatched = [];

  for (let i = 0; i < grantees.length; i++) {
    const grantee = grantees[i];
    const entity = await matchGrantee(grantee.name);

    if (!entity) {
      notFound++;
      unmatched.push(grantee.name);
      if (VERBOSE) log(`    [miss] "${grantee.name}"`);
      continue;
    }

    // Skip self-links
    if (entity.id === foundationId) {
      if (VERBOSE) log(`    [self] "${grantee.name}" -> self, skipping`);
      continue;
    }

    // Skip existing edges
    if (existingTargets.has(entity.id)) {
      skipped++;
      if (VERBOSE) log(`    [skip] "${grantee.name}" -> "${entity.canonical_name}" (edge exists)`);
      continue;
    }

    matched++;
    if (VERBOSE) log(`    [match] "${grantee.name}" -> "${entity.canonical_name}" [${entity._method || '?'}]`);

    if (!DRY_RUN) {
      const properties = {
        source: config.strategy === 'api' ? 'api_scrape' : 'curated',
        foundation: config.name,
      };
      if (grantee.focus) properties.focus = grantee.focus;
      if (grantee.grantCount) properties.grant_count = grantee.grantCount;
      if (grantee.purpose) properties.purpose = grantee.purpose;

      const { error } = await db
        .from('gs_relationships')
        .insert({
          source_entity_id: foundationId,
          target_entity_id: entity.id,
          relationship_type: 'grant',
          amount: grantee.amount || null,
          year: grantee.year || config.year,
          dataset: config.dataset,
          confidence: config.strategy === 'api' ? 'reported' : 'inferred',
          properties,
        });

      if (!error) {
        created++;
        existingTargets.add(entity.id);
      } else if (error.code === '23505') {
        // Unique constraint violation — edge already exists
        skipped++;
      } else {
        log(`    ERROR inserting: ${error.message}`);
      }
    }

    // Progress logging
    if (i > 0 && i % 50 === 0) {
      log(`  Progress: ${i}/${grantees.length} (${matched} matched, ${notFound} missed)`);
    }
  }

  // Summary for this foundation
  log(`\n  --- ${config.name} Results ---`);
  log(`  Total grantees: ${grantees.length}`);
  log(`  Matched to entities: ${matched}`);
  log(`  Skipped (existing): ${skipped}`);
  log(`  Not found: ${notFound}`);
  if (!DRY_RUN) log(`  Edges created: ${created}`);

  if (unmatched.length && (VERBOSE || unmatched.length <= 10)) {
    log(`  Unmatched (${unmatched.length}):`);
    for (const u of unmatched.slice(0, 20)) log(`    - ${u}`);
    if (unmatched.length > 20) log(`    ... and ${unmatched.length - 20} more`);
  }

  return { matched, created, skipped, notFound, total: grantees.length };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('╔══════════════════════════════════════════════════════════════════════╗');
  log('║  Foundation Grantee Mapping Pipeline — CivicGraph                   ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  log(`Mode: ${DRY_RUN ? 'DRY RUN (use --apply to insert)' : 'APPLY'}`);

  if (LIST) {
    log('\nAvailable foundations:');
    for (const [key, config] of Object.entries(FOUNDATIONS)) {
      log(`  ${key.padEnd(18)} ${config.name.padEnd(40)} [${config.strategy}] ${config.description.substring(0, 60)}`);
    }
    return;
  }

  // Determine which foundations to process
  const toProcess = FILTER
    ? { [FILTER]: FOUNDATIONS[FILTER] }
    : FOUNDATIONS;

  if (FILTER && !FOUNDATIONS[FILTER]) {
    log(`Unknown foundation: "${FILTER}". Use --list to see available foundations.`);
    process.exit(1);
  }

  // Agent logging
  const run = await logStart(db, 'scrape-foundation-grantees-all', 'Foundation Grantee Pipeline');

  try {
    let grandTotal = { matched: 0, created: 0, skipped: 0, notFound: 0, total: 0 };

    for (const [key, config] of Object.entries(toProcess)) {
      const result = await processFoundation(key, config);
      grandTotal.matched += result.matched;
      grandTotal.created += result.created;
      grandTotal.skipped += result.skipped;
      grandTotal.notFound += result.notFound;
      grandTotal.total += result.total;

      // Rate limit between foundations
      if (Object.keys(toProcess).length > 1) {
        await sleep(3000);
      }
    }

    // Grand summary
    log('\n' + '='.repeat(60));
    log('  GRAND TOTAL');
    log('='.repeat(60));
    log(`  Foundations processed: ${Object.keys(toProcess).length}`);
    log(`  Total grantees: ${grandTotal.total}`);
    log(`  Matched to entities: ${grandTotal.matched}`);
    log(`  Skipped (existing): ${grandTotal.skipped}`);
    log(`  Not found: ${grandTotal.notFound}`);
    log(`  Match rate: ${grandTotal.total > 0 ? ((grandTotal.matched + grandTotal.skipped) / grandTotal.total * 100).toFixed(1) : 0}%`);
    if (!DRY_RUN) log(`  Edges created: ${grandTotal.created}`);

    await logComplete(db, run.id, {
      items_found: grandTotal.total,
      items_new: grandTotal.created,
      items_updated: grandTotal.matched,
    });

  } catch (err) {
    log(`FATAL: ${err.message}`);
    await logFailed(db, run.id, err);
    throw err;
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
