#!/usr/bin/env node

/**
 * Ingest Australian Parliament Members
 *
 * Downloads and ingests current parliamentarian data from multiple sources
 * into CivicGraph's person_roles table, with entity creation for parliaments
 * and political parties.
 *
 * Sources (in priority order):
 *   1. Federal — OpenAustralia API (with APH website fallback)
 *   2. NSW — parliament.nsw.gov.au CSV
 *   3. QLD — parliament.qld.gov.au Open Data CSV
 *   4. VIC — parliament.vic.gov.au CSV
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-parliament-members.mjs [options]
 *
 * Options:
 *   --live             Insert into DB (default: dry run)
 *   --source=federal   Only process one source (federal|nsw|qld|vic)
 *   --limit=N          Max members per source
 *   --skip-entities    Skip entity creation (Phase 6)
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { writeFile, mkdir } from 'fs/promises';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AGENT_ID = 'ingest-parliament-members';
const AGENT_NAME = 'Parliament Members Ingest';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAUSTRALIA_API_KEY = process.env.OPENAUSTRALIA_API_KEY || null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIVE = process.argv.includes('--live');
const SKIP_ENTITIES = process.argv.includes('--skip-entities');

const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SOURCE_ONLY = sourceArg ? sourceArg.split('=')[1] : null;

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

const CURRENT_YEAR = new Date().getFullYear();
const OUTPUT_DIR = new URL('../output', import.meta.url).pathname;
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ts() {
  return new Date().toISOString().slice(11, 19);
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function warn(msg) {
  console.warn(`[${ts()}] WARNING: ${msg}`);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Fetch with timeout and error handling. Returns null on failure.
 */
async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) {
      warn(`HTTP ${resp.status} from ${url}`);
      return null;
    }
    return resp;
  } catch (err) {
    clearTimeout(timeout);
    warn(`Fetch failed for ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Parse CSV text into array of objects. Handles quoted fields with commas/newlines.
 * Attempts to handle Windows-1252 by replacing common smart quotes/dashes.
 */
function parseCSV(text) {
  // Clean up common Windows-1252 artifacts
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--');

  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"') {
        if (inQ && lines[i][j + 1] === '"') {
          field += '"';
          j++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        fields.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(field.trim());

    if (fields.length >= headers.length) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = fields[idx] || '';
      });
      rows.push(obj);
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Phase 1: Federal Parliament
// ---------------------------------------------------------------------------

async function fetchFederalOpenAustralia() {
  if (!OPENAUSTRALIA_API_KEY) {
    log('  No OPENAUSTRALIA_API_KEY set, skipping OpenAustralia API');
    return null;
  }

  log('  Trying OpenAustralia API...');
  const members = [];

  // Fetch representatives
  const repsUrl = `https://www.openaustralia.org.au/api/getRepresentatives?output=js&key=${OPENAUSTRALIA_API_KEY}`;
  const repsResp = await safeFetch(repsUrl);
  if (repsResp) {
    const reps = await repsResp.json();
    log(`  OpenAustralia: ${reps.length} representatives`);
    for (const r of reps) {
      members.push({
        person_name: `${r.first_name} ${r.last_name}`,
        chamber: 'House of Representatives',
        party: r.party || 'Unknown',
        electorate: r.constituency || null,
        state: r.constituency ? null : null, // Not provided directly
        source_detail: 'openaustralia_api',
        properties: {
          openaustralia_person_id: r.person_id,
          openaustralia_member_id: r.member_id,
          office: r.office ? r.office.map(o => o.position) : [],
          entered_house: r.entered_house || null,
          left_house: r.left_house || null,
          full_name: r.full_name || `${r.first_name} ${r.last_name}`,
        },
      });
    }
    await delay(RATE_LIMIT_MS);
  }

  // Fetch senators
  const senUrl = `https://www.openaustralia.org.au/api/getSenators?output=js&key=${OPENAUSTRALIA_API_KEY}`;
  const senResp = await safeFetch(senUrl);
  if (senResp) {
    const sens = await senResp.json();
    log(`  OpenAustralia: ${sens.length} senators`);
    for (const s of sens) {
      members.push({
        person_name: `${s.first_name} ${s.last_name}`,
        chamber: 'Senate',
        party: s.party || 'Unknown',
        electorate: s.constituency || null,
        state: s.constituency || null, // For senators, constituency is state
        source_detail: 'openaustralia_api',
        properties: {
          openaustralia_person_id: s.person_id,
          openaustralia_member_id: s.member_id,
          office: s.office ? s.office.map(o => o.position) : [],
          entered_house: s.entered_house || null,
          left_house: s.left_house || null,
          full_name: s.full_name || `${s.first_name} ${s.last_name}`,
        },
      });
    }
  }

  return members.length > 0 ? members : null;
}

async function fetchFederalAPH() {
  log('  Falling back to APH website scrape...');
  const members = [];

  // Try the search results page for current members
  const urls = [
    'https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results?q=&mem=1&par=-1&gen=0&ps=0',
    'https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results?q=&mem=1&par=48&gen=0&ps=0',
  ];

  let html = null;
  for (const url of urls) {
    log(`  Trying: ${url}`);
    const resp = await safeFetch(url);
    if (resp) {
      html = await resp.text();
      if (html.includes('search-results') || html.includes('results-list') || html.includes('member-card')) {
        log(`  Got response from APH (${html.length} bytes)`);
        break;
      }
    }
    await delay(RATE_LIMIT_MS);
  }

  if (!html) {
    warn('Could not fetch APH website');
    return null;
  }

  // Parse the HTML for member entries
  // APH uses dl.search-filter-results > dt (name+link) + dd (details)
  // Pattern: <a href="/Senators_and_Members/Parliamentarian?MPID=...">Name</a>
  // Details include party, electorate/state, chamber

  // Extract all member blocks — APH uses <div class="medium-push-1"> or similar
  // Try multiple patterns since the HTML structure may change

  // Pattern 1: anchor tags with MPID parameter
  const mpidPattern = /href="[^"]*MPID=([^"&]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  const seen = new Set();

  while ((match = mpidPattern.exec(html)) !== null) {
    const mpid = match[1];
    const name = match[2].trim();
    if (seen.has(mpid) || !name || name.length < 3) continue;
    seen.add(mpid);

    // Try to extract details from surrounding context (200 chars after the match)
    const contextStart = match.index;
    const context = html.slice(contextStart, contextStart + 1000);

    // Extract party
    const partyMatch = context.match(/(?:party|Party)[^>]*>([^<]+)/i) ||
                       context.match(/(Australian Labor Party|Liberal Party|National Party|Australian Greens|Independent|Centre Alliance|Katter's Australian Party|United Australia Party|Lambie Network|One Nation|Jacqui Lambie Network)/i);
    const party = partyMatch ? partyMatch[1].trim() : 'Unknown';

    // Extract chamber
    const isSenator = context.match(/Senator|Senate/i);
    const chamber = isSenator ? 'Senate' : 'House of Representatives';

    // Extract electorate
    const electorateMatch = context.match(/(?:electorate|division|for)\s+(?:of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    const electorate = electorateMatch ? electorateMatch[1].trim() : null;

    // Extract state
    const stateMatch = context.match(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/);
    const state = stateMatch ? stateMatch[1] : null;

    members.push({
      person_name: name,
      chamber,
      party,
      electorate,
      state,
      source_detail: 'aph_website',
      properties: {
        aph_mpid: mpid,
        scraped_at: new Date().toISOString(),
      },
    });
  }

  // Pattern 2: If we found no MPs with MPID, try a more generic extraction
  if (members.length === 0) {
    // Look for structured list items
    const listPattern = /<(?:h[2-4]|strong|b)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)<\/(?:h[2-4]|strong|b)>/g;
    while ((match = listPattern.exec(html)) !== null) {
      const name = match[1].trim();
      if (name.length >= 5 && name.length <= 50 && !seen.has(name)) {
        seen.add(name);
        members.push({
          person_name: name,
          chamber: 'Unknown',
          party: 'Unknown',
          electorate: null,
          state: null,
          source_detail: 'aph_website_generic',
          properties: { scraped_at: new Date().toISOString() },
        });
      }
    }
  }

  log(`  Extracted ${members.length} members from APH website`);
  return members.length > 0 ? members : null;
}

async function fetchFederal() {
  log('Phase 1: Downloading federal parliament members...');

  // Try OpenAustralia API first
  let members = await fetchFederalOpenAustralia();

  // Fall back to APH scrape
  if (!members) {
    members = await fetchFederalAPH();
  }

  if (!members) {
    warn('Phase 1: Could not fetch any federal members');
    return [];
  }

  log(`Phase 1: ${members.length} federal members downloaded`);
  return members;
}

// ---------------------------------------------------------------------------
// Phase 2: NSW Parliament
// ---------------------------------------------------------------------------

async function fetchNSW() {
  log('Phase 2: Downloading NSW parliament members...');

  const csvUrls = [
    // Direct CSV download (current members)
    'https://www.parliament.nsw.gov.au/members/downloadables/Pages/downloadable-lists.aspx',
    'https://www.parliament.nsw.gov.au/hp/housepaper/csvdisclosure/Members.csv',
  ];

  // First try to get the downloadable lists page and find CSV link
  const pageResp = await safeFetch(csvUrls[0]);
  let csvText = null;

  if (pageResp) {
    const html = await pageResp.text();

    // Look for CSV links on the page
    const csvLinkMatch = html.match(/href="([^"]*\.csv[^"]*)"/i) ||
                         html.match(/href="([^"]*[Mm]embers[^"]*\.csv[^"]*)"/i) ||
                         html.match(/href="([^"]*[Cc]urrent[^"]*\.csv[^"]*)"/i);

    if (csvLinkMatch) {
      let csvUrl = csvLinkMatch[1];
      if (csvUrl.startsWith('/')) {
        csvUrl = `https://www.parliament.nsw.gov.au${csvUrl}`;
      }
      log(`  Found CSV link: ${csvUrl}`);
      const csvResp = await safeFetch(csvUrl);
      if (csvResp) {
        csvText = await csvResp.text();
      }
    }
  }

  // Fall back to scraping the all-members page
  if (!csvText) {
    log('  Trying all-members page scrape...');
    const allMembersResp = await safeFetch('https://www.parliament.nsw.gov.au/members/Pages/all-members.aspx');
    if (allMembersResp) {
      const html = await allMembersResp.text();
      return parseNSWMembersHTML(html);
    }
    warn('Phase 2: Could not fetch NSW members');
    return [];
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    warn('Phase 2: NSW CSV parsed but no rows found');
    return [];
  }

  log(`  Parsed ${rows.length} rows from NSW CSV`);
  log(`  CSV columns: ${Object.keys(rows[0]).join(', ')}`);

  const members = rows.map(r => {
    // Column names vary — try common variations
    const name = r['Name'] || r['Member'] || r['Full Name'] || r['FirstName'] ?
      `${r['FirstName'] || ''} ${r['LastName'] || ''}`.trim() :
      Object.values(r)[0] || '';

    const party = r['Party'] || r['Political Party'] || r['PartyName'] || 'Unknown';
    const electorate = r['Electorate'] || r['District'] || r['Seat'] || null;
    const chamber = r['House'] || r['Chamber'] ||
      (r['Type'] === 'LA' || r['Type'] === 'Legislative Assembly' ? 'Legislative Assembly' :
       r['Type'] === 'LC' || r['Type'] === 'Legislative Council' ? 'Legislative Council' : 'Unknown');

    return {
      person_name: name,
      chamber,
      party,
      electorate,
      state: 'NSW',
      source_detail: 'nsw_parliament_csv',
      properties: {
        raw_csv_row: r,
        scraped_at: new Date().toISOString(),
      },
    };
  }).filter(m => m.person_name && m.person_name.length > 2);

  log(`Phase 2: ${members.length} NSW members downloaded`);
  return members;
}

function parseNSWMembersHTML(html) {
  const members = [];
  const seen = new Set();

  // NSW parliament page uses:
  //   <a class="prl-name-link" href="/members/Pages/Member-details.aspx?pk=120">
  //     Aitchison,\n\n  Jenny\n</a>
  //   ...followed by <li> items with chamber, electorate, party
  const memberPattern = /href="[^"]*Member-details\.aspx\?pk=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = memberPattern.exec(html)) !== null) {
    const pk = match[1];
    let rawName = match[2].replace(/<[^>]+>/g, ' ').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

    if (!rawName || rawName.length < 3) continue;

    // Convert "Surname, FirstName" to "FirstName Surname"
    let name = rawName;
    if (rawName.includes(',')) {
      const parts = rawName.split(',').map(s => s.trim());
      if (parts.length >= 2 && parts[0].length > 1 && parts[1].length > 1) {
        name = `${parts[1]} ${parts[0]}`;
      }
    }

    if (seen.has(pk)) continue;
    seen.add(pk);

    // Look at the next ~1000 chars for member details in <li> elements
    const context = html.slice(match.index, match.index + 1200);

    // Extract party from "... Party member" or known party names
    const partyMatch = context.match(/(?:Australian\s+)?(\w[\w\s]*?)\s+(?:Party\s+)?member/i) ||
                       context.match(/(Labor|Liberal|National|Greens|Independent|Shooters|One Nation|Animal Justice)/i);
    let party = 'Unknown';
    if (partyMatch) {
      party = partyMatch[1].trim();
      // Normalise "Australian Labor" -> "Labor"
      party = party.replace(/^Australian\s+/i, '');
    }

    // Extract chamber from "MP (Legislative Assembly)" or "MLC (Legislative Council)"
    const chamberMatch = context.match(/(Legislative Assembly|Legislative Council)/i);
    const chamber = chamberMatch ? chamberMatch[1] : 'Unknown';

    // Extract electorate from "Member for X"
    const electorateMatch = context.match(/Member for ([\w\s-]+?)(?:\s*<|$)/i);
    const electorate = electorateMatch ? electorateMatch[1].trim() : null;

    members.push({
      person_name: name,
      chamber,
      party,
      electorate,
      state: 'NSW',
      source_detail: 'nsw_parliament_html',
      properties: {
        nsw_pk: pk,
        scraped_at: new Date().toISOString(),
      },
    });
  }

  if (members.length === 0) {
    warn('  Could not parse NSW members from HTML');
  } else {
    log(`  Parsed ${members.length} members from NSW HTML`);
  }

  return members;
}

// ---------------------------------------------------------------------------
// Phase 3: QLD Parliament
// ---------------------------------------------------------------------------

async function fetchQLD() {
  log('Phase 3: Downloading QLD parliament members...');

  const csvUrls = [
    'https://documents.parliament.qld.gov.au/OD/CURRENTMEMBERS.CSV',
    'https://documents.parliament.qld.gov.au/OD/CURRENTMEMBERS.csv',
    'https://documents.parliament.qld.gov.au/explore/dataset/current-members-of-the-legislative-assembly/download/?format=csv',
  ];

  let csvText = null;

  for (const url of csvUrls) {
    log(`  Trying: ${url}`);
    const resp = await safeFetch(url);
    if (resp) {
      csvText = await resp.text();
      if (csvText && csvText.includes(',')) {
        log(`  Got CSV from QLD (${csvText.length} bytes)`);
        break;
      }
      csvText = null;
    }
    await delay(RATE_LIMIT_MS);
  }

  // Fall back to Open Data portal page
  if (!csvText) {
    log('  Trying QLD Open Data portal...');
    const portalResp = await safeFetch('https://www.data.qld.gov.au/dataset/members-of-the-legislative-assembly');
    if (portalResp) {
      const html = await portalResp.text();
      const csvLinkMatch = html.match(/href="([^"]*\.csv[^"]*)"/i);
      if (csvLinkMatch) {
        let csvUrl = csvLinkMatch[1];
        if (csvUrl.startsWith('/')) csvUrl = `https://www.data.qld.gov.au${csvUrl}`;
        const csvResp = await safeFetch(csvUrl);
        if (csvResp) csvText = await csvResp.text();
      }
    }
  }

  // Last resort: scrape the members page
  if (!csvText) {
    log('  Trying QLD parliament website scrape...');
    const pageResp = await safeFetch('https://www.parliament.qld.gov.au/Members/Current-Members/Member-List');
    if (pageResp) {
      const html = await pageResp.text();
      return parseQLDMembersHTML(html);
    }
    warn('Phase 3: Could not fetch QLD members');
    return [];
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    warn('Phase 3: QLD CSV parsed but no rows found');
    return [];
  }

  log(`  Parsed ${rows.length} rows from QLD CSV`);
  log(`  CSV columns: ${Object.keys(rows[0]).join(', ')}`);

  const members = rows.map(r => {
    const firstName = r['First Name'] || r['FirstName'] || r['Given Name'] || '';
    const lastName = r['Last Name'] || r['LastName'] || r['Surname'] || r['Family Name'] || '';
    const name = r['Name'] || r['Member'] || `${firstName} ${lastName}`.trim();

    return {
      person_name: name,
      chamber: 'Legislative Assembly', // QLD is unicameral
      party: r['Party'] || r['Political Party'] || r['PartyName'] || 'Unknown',
      electorate: r['Electorate'] || r['District'] || r['Seat'] || null,
      state: 'QLD',
      source_detail: 'qld_parliament_csv',
      properties: {
        raw_csv_row: r,
        scraped_at: new Date().toISOString(),
      },
    };
  }).filter(m => m.person_name && m.person_name.length > 2);

  log(`Phase 3: ${members.length} QLD members downloaded`);
  return members;
}

function parseQLDMembersHTML(html) {
  const members = [];
  const seen = new Set();

  // QLD parliament uses structured HTML:
  //   <span class="member-listing__member-name">Hon Mark Bailey</span>
  //   ...
  //   <span class="member-listing__title">Member for Miller (ALP)</span>
  //   ...
  //   <span class="member-listing__electorate">Miller</span>
  const namePattern = /member-listing__member-name">\s*([\s\S]*?)\s*<\/span>/gi;
  let match;

  // Build an array of raw blocks: find each member-name, then grab context
  const blocks = [];
  while ((match = namePattern.exec(html)) !== null) {
    let rawName = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    // Strip honorific prefix (Hon, Mr, Mrs, Ms, Dr)
    rawName = rawName.replace(/^(?:Hon\.?\s+|Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+|Dr\.?\s+)/i, '').trim();
    if (!rawName || rawName.length < 3) continue;

    // Handle parenthetical preferred names: "Rosslyn (Ros) Bates" -> "Ros Bates"
    const preferred = rawName.match(/^(\w+)\s+\((\w+)\)\s+(.*)/);
    if (preferred) {
      rawName = `${preferred[2]} ${preferred[3]}`;
    }

    blocks.push({ name: rawName, index: match.index });
  }

  for (const block of blocks) {
    if (seen.has(block.name)) continue;
    seen.add(block.name);

    // Grab context after the name for party/electorate extraction
    const context = html.slice(block.index, block.index + 1200);

    // Extract "Member for Electorate (PARTY)" from member-listing__title
    const titleMatch = context.match(/member-listing__title">\s*Member for\s+([\w\s-]+?)\s*\((\w+)\)/i);
    const electorate = titleMatch ? titleMatch[1].trim() : null;
    const partyShort = titleMatch ? titleMatch[2].trim() : null;

    // Map QLD party abbreviations
    const QLD_PARTIES = {
      'ALP': 'Labor',
      'LNP': 'LNP',
      'KAP': "Katter's Australian Party",
      'GRN': 'Greens',
      'PHON': 'One Nation',
      'IND': 'Independent',
    };
    const party = partyShort ? (QLD_PARTIES[partyShort] || partyShort) : 'Unknown';

    members.push({
      person_name: block.name,
      chamber: 'Legislative Assembly', // QLD is unicameral
      party,
      electorate,
      state: 'QLD',
      source_detail: 'qld_parliament_html',
      properties: { scraped_at: new Date().toISOString() },
    });
  }

  if (members.length > 0) {
    log(`  Parsed ${members.length} members from QLD HTML`);
  }

  return members;
}

// ---------------------------------------------------------------------------
// Phase 4: VIC Parliament
// ---------------------------------------------------------------------------

async function fetchVIC() {
  log('Phase 4: Downloading VIC parliament members...');

  // VIC parliament has a JSON API at /api/search/members (max 100 per page)
  const PAGE_SIZE = 100;
  let allHits = [];
  let page = 1;
  let totalMatching = 0;

  while (true) {
    const apiUrl = `https://www.parliament.vic.gov.au/api/search/members?member-status=current&page=${page}&pageSize=${PAGE_SIZE}&sortType=2`;
    if (page === 1) log(`  Trying VIC API: ${apiUrl}`);

    const resp = await safeFetch(apiUrl);
    if (!resp) break;

    try {
      const json = await resp.json();
      const hits = json?.result?.hits || [];
      totalMatching = json?.result?.totalMatching || 0;
      allHits.push(...hits);
      log(`  VIC API page ${page}: ${hits.length} members (total: ${totalMatching})`);

      if (allHits.length >= totalMatching || hits.length < PAGE_SIZE) break;
      page++;
      await delay(RATE_LIMIT_MS);
    } catch (err) {
      warn(`  VIC API page ${page} parse error: ${err.message}`);
      break;
    }
  }

  if (allHits.length > 0) {
    const members = allHits.map(h => {
      const memberships = h.memberships || [];
      const getMembership = (title) => {
        const m = memberships.find(ms => ms.title === title);
        return m?.details?.[0] || null;
      };

      return {
        person_name: h.title,
        chamber: getMembership('House') || 'Unknown',
        party: getMembership('Party') || 'Unknown',
        electorate: getMembership('Member for') || null,
        state: 'VIC',
        source_detail: 'vic_parliament_api',
        properties: {
          vic_id: h.id,
          position: getMembership('Position') || null,
          url: h.url ? `https://www.parliament.vic.gov.au${h.url}` : null,
          house_code: h.house,
          scraped_at: new Date().toISOString(),
        },
      };
    }).filter(m => m.person_name && m.person_name.length > 2);

    log(`Phase 4: ${members.length} VIC members downloaded`);
    return members;
  }

  // Fallback: try CSV URLs (legacy, likely 404)
  const csvUrls = [
    'https://www.parliament.vic.gov.au/images/members/allmembers.csv',
    'https://www.parliament.vic.gov.au/images/members/councilmembers.csv',
    'https://www.parliament.vic.gov.au/images/members/assemblymembers.csv',
  ];

  for (const url of csvUrls) {
    log(`  Trying CSV: ${url}`);
    const csvResp = await safeFetch(url);
    if (csvResp) {
      const csvText = await csvResp.text();
      if (csvText && csvText.includes(',') && csvText.length > 100) {
        const rows = parseCSV(csvText);
        if (rows.length > 0) {
          log(`  Parsed ${rows.length} rows from VIC CSV`);
          const members = rows.map(r => ({
            person_name: r['Name'] || r['Member'] || `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim(),
            chamber: r['House'] || r['Chamber'] || 'Unknown',
            party: r['Party'] || 'Unknown',
            electorate: r['Electorate'] || r['District'] || r['Region'] || null,
            state: 'VIC',
            source_detail: 'vic_parliament_csv',
            properties: { scraped_at: new Date().toISOString() },
          })).filter(m => m.person_name && m.person_name.length > 2);
          return members;
        }
      }
    }
    await delay(RATE_LIMIT_MS);
  }

  warn('Phase 4: Could not fetch VIC members from any source');
  return [];
}

// ---------------------------------------------------------------------------
// Phase 5: Build and insert person_roles
// ---------------------------------------------------------------------------

const PARLIAMENT_NAMES = {
  federal: 'Parliament of Australia',
  nsw: 'Parliament of New South Wales',
  qld: 'Parliament of Queensland',
  vic: 'Parliament of Victoria',
};

const SOURCE_NAMES = {
  federal: 'openaustralia',
  nsw: 'nsw_parliament',
  qld: 'qld_parliament',
  vic: 'vic_parliament',
};

function buildPersonRoles(members, sourceKey) {
  const parliamentName = PARLIAMENT_NAMES[sourceKey];
  const source = SOURCE_NAMES[sourceKey];

  return members.map(m => {
    const chamberSuffix = m.chamber && m.chamber !== 'Unknown' ? ` - ${m.chamber}` : '';
    const companyName = `${parliamentName}${chamberSuffix}`;
    const slug = slugify(m.person_name);

    return {
      person_name: m.person_name,
      role_type: 'officeholder',
      company_acn: `PARL-${sourceKey}-${slug}`, // Synthetic — company_acn is NOT NULL
      company_name: companyName,
      source,
      confidence: m.source_detail.includes('html') || m.source_detail.includes('generic') ? 'reported' : 'verified',
      properties: {
        parliament: parliamentName,
        chamber: m.chamber,
        party: m.party,
        electorate: m.electorate,
        state: m.state,
        year: CURRENT_YEAR,
        ...m.properties,
      },
    };
  });
}

async function insertPersonRoles(roles, stats) {
  if (!LIVE) {
    log(`  DRY RUN: Would insert ${roles.length} person_roles records`);
    stats.roles_skipped = roles.length;
    return;
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < roles.length; i += BATCH_SIZE) {
    const batch = roles.slice(i, i + BATCH_SIZE);

    const { error } = await db
      .from('person_roles')
      .insert(batch);

    if (error) {
      // Fall back to individual inserts
      log(`  Batch insert failed (${error.message}), retrying individually...`);
      for (const row of batch) {
        // Check if already exists
        const { data: existing } = await db
          .from('person_roles')
          .select('id')
          .eq('company_acn', row.company_acn)
          .eq('source', row.source)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const { error: singleErr } = await db
          .from('person_roles')
          .insert(row);

        if (!singleErr) {
          inserted++;
        } else {
          errors++;
          if (errors <= 5) {
            warn(`  Insert failed for ${row.person_name}: ${singleErr.message}`);
          }
        }
      }
    } else {
      inserted += batch.length;
    }

    if (i + BATCH_SIZE < roles.length) {
      log(`  Inserted ${Math.min(i + BATCH_SIZE, roles.length)}/${roles.length}...`);
    }
  }

  stats.roles_inserted = inserted;
  stats.roles_skipped = skipped;
  stats.roles_errors = errors;
  log(`  Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
}

// ---------------------------------------------------------------------------
// Phase 6: Create entity records
// ---------------------------------------------------------------------------

async function ensureEntity(name, entityType, properties = {}) {
  // Check if entity exists
  const { data: existing } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', name)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ...existing[0], created: false };
  }

  if (!LIVE) {
    log(`  DRY RUN: Would create entity: ${name} (${entityType})`);
    return { id: null, gs_id: null, canonical_name: name, created: true };
  }

  // Generate gs_id
  const prefix = entityType === 'government_body' ? 'AU-GOV' : 'AU-PARTY';
  const hash = slugify(name).slice(0, 32);
  const gs_id = `${prefix}-${hash}`;

  const { data, error } = await db
    .from('gs_entities')
    .insert({
      gs_id,
      canonical_name: name,
      entity_type: entityType,
      sector: entityType === 'government_body' ? 'Government' : 'Political',
      confidence: 'verified',
      properties,
    })
    .select('id, gs_id, canonical_name')
    .single();

  if (error) {
    warn(`  Failed to create entity ${name}: ${error.message}`);
    return null;
  }

  return { ...data, created: true };
}

async function createEntities(allMembers, stats) {
  log('Phase 6: Creating/matching entity records...');

  // Create parliament entities
  const parliaments = {};
  for (const [key, name] of Object.entries(PARLIAMENT_NAMES)) {
    if (allMembers[key] && allMembers[key].length > 0) {
      const result = await ensureEntity(name, 'government_body', {
        jurisdiction: key === 'federal' ? 'Commonwealth' : key.toUpperCase(),
        entity_subtype: 'parliament',
      });
      if (result) {
        parliaments[key] = result;
        log(`  Parliament: ${name} — ${result.created ? 'CREATED' : 'exists'} (${result.gs_id || 'dry-run'})`);
      }
    }
    await delay(100);
  }

  // Collect unique parties across all sources
  const partiesSeen = new Set();
  for (const members of Object.values(allMembers)) {
    for (const m of members) {
      if (m.party && m.party !== 'Unknown') {
        partiesSeen.add(m.party);
      }
    }
  }

  // Normalise common party short names to canonical entity names
  const PARTY_FULL_NAMES = {
    'Labor': 'Australian Labor Party',
    'ALP': 'Australian Labor Party',
    'Australian Labor Party': 'Australian Labor Party',
    'Liberal': 'Liberal Party of Australia',
    'Liberal Party': 'Liberal Party of Australia',
    'Liberal Party of Australia': 'Liberal Party of Australia',
    'LNP': 'Liberal National Party of Queensland',
    'Liberal National Party of Queensland': 'Liberal National Party of Queensland',
    'National': 'National Party of Australia',
    'Nationals': 'National Party of Australia',
    'The Nationals': 'National Party of Australia',
    'National Party of Australia': 'National Party of Australia',
    'Greens': 'Australian Greens',
    'The Greens': 'Australian Greens',
    'Australian Greens': 'Australian Greens',
    'The Australian Greens - Victoria': 'Australian Greens',
    'One Nation': "Pauline Hanson's One Nation",
    "Pauline Hanson's One Nation": "Pauline Hanson's One Nation",
    'KAP': "Katter's Australian Party",
    'Katter': "Katter's Australian Party",
    "Katter's Australian Party": "Katter's Australian Party",
    'Shooters': 'Shooters, Fishers and Farmers Party',
    'Shooters, Fishers and Farmers Party Victoria': 'Shooters, Fishers and Farmers Party',
    'Fishers and Farmers': 'Shooters, Fishers and Farmers Party',
    'Animal Justice': 'Animal Justice Party',
    'Animal Justice Party': 'Animal Justice Party',
    'Legalise Cannabis': 'Legalise Cannabis Australia',
    'Legalise Cannabis Victoria': 'Legalise Cannabis Australia',
    'Legalise Cannabis Australia': 'Legalise Cannabis Australia',
    'Reason': 'Reason Party',
    'Reason Party': 'Reason Party',
    'Libertarian': 'Libertarian Party',
    'Libertarian Party': 'Libertarian Party',
    'Independent': null, // Don't create entity for independents
    'Unknown': null,
  };

  // Deduplicate after normalization (e.g. "Labor" and "Australian Labor Party" -> same entity)
  const canonicalParties = new Set();
  for (const party of partiesSeen) {
    const fullName = PARTY_FULL_NAMES[party] !== undefined ? PARTY_FULL_NAMES[party] : party;
    if (fullName) canonicalParties.add(fullName);
  }

  const partiesCreated = [];
  for (const fullName of canonicalParties) {
    const result = await ensureEntity(fullName, 'political_party', {
      country: 'Australia',
    });
    if (result) {
      partiesCreated.push(result);
      log(`  Party: ${fullName} — ${result.created ? 'CREATED' : 'exists'} (${result.gs_id || 'dry-run'})`);
    }
    await delay(100);
  }

  stats.parliaments_processed = Object.keys(parliaments).length;
  stats.parties_processed = partiesCreated.length;
  stats.entities_created = [...Object.values(parliaments), ...partiesCreated].filter(e => e?.created).length;

  return { parliaments, parties: partiesCreated };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  const stats = {
    federal_members: 0,
    nsw_members: 0,
    qld_members: 0,
    vic_members: 0,
    total_members: 0,
    roles_inserted: 0,
    roles_skipped: 0,
    roles_errors: 0,
    entities_created: 0,
    parliaments_processed: 0,
    parties_processed: 0,
    source_errors: [],
  };

  log(`=== Parliament Members Ingest ===`);
  log(`Mode: ${LIVE ? 'LIVE' : 'DRY RUN (use --live to insert)'}`);
  if (SOURCE_ONLY) log(`Source filter: ${SOURCE_ONLY}`);
  if (LIMIT) log(`Limit: ${LIMIT} per source`);
  log('');

  try {
    // ── Download phases ──
    const allMembers = { federal: [], nsw: [], qld: [], vic: [] };

    const sources = SOURCE_ONLY ? [SOURCE_ONLY] : ['federal', 'nsw', 'qld', 'vic'];

    for (const src of sources) {
      try {
        let members;
        switch (src) {
          case 'federal': members = await fetchFederal(); break;
          case 'nsw': members = await fetchNSW(); break;
          case 'qld': members = await fetchQLD(); break;
          case 'vic': members = await fetchVIC(); break;
          default: warn(`Unknown source: ${src}`); continue;
        }

        if (LIMIT && members.length > LIMIT) {
          members = members.slice(0, LIMIT);
          log(`  Limited to ${LIMIT} members`);
        }

        allMembers[src] = members;
        stats[`${src}_members`] = members.length;
      } catch (err) {
        warn(`Phase failed for ${src}: ${err.message}`);
        stats.source_errors.push({ source: src, error: err.message });
      }
      log('');
    }

    stats.total_members = Object.values(allMembers).reduce((sum, m) => sum + m.length, 0);
    log(`Total members downloaded: ${stats.total_members}`);
    log('');

    // Save raw data
    await mkdir(OUTPUT_DIR, { recursive: true });
    const outputData = {};
    for (const [key, members] of Object.entries(allMembers)) {
      if (members.length > 0) {
        outputData[key] = members;
      }
    }
    await writeFile(
      `${OUTPUT_DIR}/parliament-members-raw.json`,
      JSON.stringify(outputData, null, 2)
    );
    log(`Raw data saved to output/parliament-members-raw.json`);
    log('');

    // ── Phase 5: Insert person_roles ──
    log('Phase 5: Building and inserting person_roles...');
    const allRoles = [];
    for (const [key, members] of Object.entries(allMembers)) {
      if (members.length > 0) {
        const roles = buildPersonRoles(members, key);
        allRoles.push(...roles);
        log(`  ${key}: ${roles.length} roles built`);
      }
    }

    // Party breakdown
    const partyCount = {};
    for (const r of allRoles) {
      const party = r.properties?.party || 'Unknown';
      partyCount[party] = (partyCount[party] || 0) + 1;
    }
    log('\n  Party breakdown (all sources):');
    for (const [party, count] of Object.entries(partyCount).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      log(`    ${party}: ${count}`);
    }
    log('');

    await insertPersonRoles(allRoles, stats);
    log('');

    // ── Phase 6: Entity records ──
    if (!SKIP_ENTITIES) {
      await createEntities(allMembers, stats);
    } else {
      log('Phase 6: Skipped (--skip-entities)');
    }
    log('');

    // ── Phase 7: Summary ──
    log('=== Summary ===');
    log(`  Federal: ${stats.federal_members} members`);
    log(`  NSW:     ${stats.nsw_members} members`);
    log(`  QLD:     ${stats.qld_members} members`);
    log(`  VIC:     ${stats.vic_members} members`);
    log(`  Total:   ${stats.total_members} members`);
    log('');
    log(`  Roles inserted:  ${stats.roles_inserted}`);
    log(`  Roles skipped:   ${stats.roles_skipped}`);
    log(`  Roles errors:    ${stats.roles_errors}`);
    log(`  Entities created: ${stats.entities_created}`);
    log(`  Parliaments:     ${stats.parliaments_processed}`);
    log(`  Parties:         ${stats.parties_processed}`);
    if (stats.source_errors.length > 0) {
      log(`  Source errors: ${stats.source_errors.map(e => e.source).join(', ')}`);
    }
    if (!LIVE) {
      log('');
      log('  >>> DRY RUN — no database changes made. Use --live to insert. <<<');
    }

    await logComplete(db, runId, {
      items_found: stats.total_members,
      items_new: stats.roles_inserted,
      items_updated: 0,
      duration_ms: Date.now() - (run?._startTime || Date.now()),
    });
  } catch (err) {
    console.error(`\nFATAL: ${err.message}`);
    console.error(err.stack);
    await logFailed(db, runId, err);
    process.exit(1);
  }
}

main();
