#!/usr/bin/env node

/**
 * Scrape OpenPolitics.au — Federal Parliamentarian Interest Declarations
 *
 * Scrapes the publicly available browse page at openpolitics.au to extract
 * all current federal parliamentarians with their basic details and interest
 * category counts. Profile pages show interest category breakdowns (e.g.
 * directorships: 3, shareholdings: 5) but actual company names require a
 * paid subscription — we only capture what's publicly visible.
 *
 * Phase 1: Parse politician list from browse page (227 parliamentarians)
 * Phase 2: Fetch each profile to extract interest category counts
 * Phase 3: Store in person_roles table as officeholder records
 * Phase 4: Attempt entity matching on politician names
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-openpolitics.mjs [--apply] [--limit=N] [--skip-profiles] [--resume]
 *
 * Options:
 *   --apply          Insert into DB (default: dry run)
 *   --limit=N        Process only N politicians
 *   --skip-profiles  Skip Phase 2 (profile scraping), use browse data only
 *   --resume         Resume from checkpoint
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { writeFile, readFile, mkdir } from 'fs/promises';

const AGENT_ID = 'scrape-openpolitics';
const AGENT_NAME = 'OpenPolitics Parliamentarian Scraper';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const SKIP_PROFILES = process.argv.includes('--skip-profiles');
const RESUME = process.argv.includes('--resume');

const BASE_URL = 'https://openpolitics.au';
const BROWSE_URL = `${BASE_URL}/register/browse/48`;
const PROGRESS_FILE = 'output/openpolitics-progress.json';
const OUTPUT_FILE = 'output/openpolitics-politicians.json';

// Rate limiting: 2 requests per second (500ms between requests)
const RATE_LIMIT_MS = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHTML(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)',
        },
      });
      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 5000;
        console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        await delay(wait);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  Retry ${attempt}/${retries}: ${err.message}`);
      await delay(2000 * attempt);
    }
  }
}

// ─── Phase 1: Parse browse page ─────────────────────────────────────────

function parseBrowsePage(html) {
  const tableStart = html.indexOf('<table class="MEMBERS');
  if (tableStart === -1) {
    throw new Error('Could not find MEMBERS table in browse page. Structure may have changed.');
  }
  const tableEnd = html.indexOf('</table>', tableStart);
  const table = html.substring(tableStart, tableEnd + 8);

  // Split by <tr> to get individual rows
  const parts = table.split(/<tr[^>]*>/);
  const politicians = [];

  for (let i = 2; i < parts.length; i++) {
    const rowHtml = parts[i].split('</tr>')[0];
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    if (cells.length < 8) continue;

    // Cell 1 (Name): <a class="name" href="/48/slug">Surname, Firstname</a>
    const nameLink = cells[1]?.match(/href="\/48\/([^"]+)"/);
    const nameAnchor = cells[1]?.match(/<a class="name"[^>]*>([^<]+)<\/a>/);
    const slug = nameLink?.[1];
    if (!slug || !nameAnchor) continue;

    const displayName = nameAnchor[1].trim(); // "Surname, Firstname"
    const [surname, ...firstParts] = displayName.split(',').map(s => s.trim());
    const firstName = firstParts.join(' ').trim();
    const fullName = firstName ? `${firstName} ${surname}` : surname;

    const representation = cells[2]?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    const ministry = cells[3]?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim() || null;
    const party = cells[4]?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    const chamberRaw = cells[6]?.replace(/<[^>]+>/g, '').trim();
    const chamber = chamberRaw === 'Member' ? 'House' : chamberRaw === 'Senator' ? 'Senate' : chamberRaw;
    const state = cells[7]?.replace(/<[^>]+>/g, '').trim();
    const interestsCount = parseInt(cells[8]?.replace(/<[^>]+>/g, '').trim()) || 0;
    const lastUpdated = cells[9]?.replace(/<[^>]+>/g, '').trim() || null;

    // Parse electorate from representation ("Member for X" or "Senator for X")
    const electorateMatch = representation.match(/(?:Member|Senator) for (.+)/);
    const electorate = electorateMatch?.[1] || representation;

    // Determine ministry level
    let ministryLevel = null;
    if (ministry) {
      if (ministry.startsWith('MIN1')) ministryLevel = 'cabinet';
      else if (ministry.startsWith('MIN2')) ministryLevel = 'outer_ministry';
      else if (ministry.startsWith('MIN3')) ministryLevel = 'assistant_minister';
      else if (ministry.startsWith('SHAD')) ministryLevel = 'shadow';
      else ministryLevel = 'other';
    }

    politicians.push({
      name: fullName,
      surname,
      first_name: firstName,
      display_name: displayName,
      slug,
      electorate,
      representation,
      ministry,
      ministry_level: ministryLevel,
      party,
      chamber,
      state,
      interests_count: interestsCount,
      last_updated: lastUpdated,
      profile_url: `${BASE_URL}/48/${slug}`,
      interest_categories: null, // filled in Phase 2
    });
  }

  return politicians;
}

// ─── Phase 2: Fetch profile pages for interest category counts ──────────

const INTEREST_CATEGORIES = [
  'Shareholdings',
  'Trusts and nominee companies',
  'Real estate',
  'Directorships',
  'Partnerships',
  'Liabilities',
  'Bonds and debentures',
  'Saving or investment accounts',
  'Other assets',
  'Other income',
  'Gifts',
  'Travel or hospitality',
  'Memberships',
  'Office holder',     // Sometimes appears as "Office holder\nor donor"
  'Other interests',
];

const TAB_NAMES = ['Self', 'Partner', 'Children', 'Spouse'];

function parseProfileInterests(html) {
  const mainMatch = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/);
  if (!mainMatch) return null;

  const main = mainMatch[1];

  // Check if data is gated
  const isPaywalled = main.includes('Please login or subscribe');

  // Clean text for category extraction
  const cleanText = main
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Profile pages have multiple tab sections (Self, Partner, Children).
  // Each section has its own set of interest categories. Categories always
  // start with "Shareholdings" so we split on that to find blocks.
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < cleanText.length; i++) {
    const line = cleanText[i];

    if (line === 'Shareholdings') {
      // Start of a new category block
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {};
    }

    if (currentBlock && INTEREST_CATEGORIES.includes(line)) {
      // Look ahead for "- N" pattern
      for (let j = i + 1; j < Math.min(i + 3, cleanText.length); j++) {
        const nextLine = cleanText[j];
        const countMatch = nextLine.match(/^-\s*(\d+)$/);
        if (countMatch) {
          currentBlock[line] = parseInt(countMatch[1]);
          break;
        }
        // Skip "or donor" continuation for "Office holder"
        if (nextLine === 'or donor') continue;
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  // Identify which tabs are present
  const tabHeaders = [];
  for (const line of cleanText) {
    if (TAB_NAMES.includes(line)) tabHeaders.push(line);
  }

  // Build structured sections: first block = Self, second = Partner, etc.
  const sections = {};
  for (let i = 0; i < blocks.length; i++) {
    const tabName = tabHeaders[i] || (i === 0 ? 'Self' : `Section_${i}`);
    sections[tabName] = blocks[i];
  }

  // Primary categories = Self section (most relevant for person_roles)
  const selfCategories = sections['Self'] || blocks[0] || null;

  // Extract total interests count
  const totalMatch = cleanText.join(' ').match(/Total interests:\s*(\d+)/);
  const totalInterests = totalMatch ? parseInt(totalMatch[1]) : null;

  // Extract title/role info from profile
  const title = cleanText[0] || null;

  return {
    categories: selfCategories && Object.keys(selfCategories).length > 0 ? selfCategories : null,
    all_sections: Object.keys(sections).length > 0 ? sections : null,
    tabs: tabHeaders,
    total_interests: totalInterests,
    is_paywalled: isPaywalled,
    title,
  };
}

// ─── Phase 3: Store in person_roles ─────────────────────────────────────

function buildPersonRoles(politicians) {
  // Note: person_name_normalised is GENERATED ALWAYS — do not include it.
  // company_acn is NOT NULL so we use a synthetic identifier for parliament.
  return politicians.map(p => ({
    person_name: p.name,
    role_type: 'officeholder',
    company_acn: `PARL48-${p.slug}`,
    company_name: `Parliament of Australia — ${p.chamber === 'House' ? 'House of Representatives' : 'Senate'}`,
    source: 'openpolitics_au',
    confidence: 'verified',
    properties: {
      parliament: 48,
      slug: p.slug,
      party: p.party,
      electorate: p.electorate,
      representation: p.representation,
      chamber: p.chamber,
      state: p.state,
      ministry: p.ministry,
      ministry_level: p.ministry_level,
      total_interests: p.interests_count,
      interest_categories_self: p.interest_categories,
      interest_sections: p.interest_all_sections,
      interest_tabs: p.interest_tabs,
      profile_url: p.profile_url,
      last_updated_openpolitics: p.last_updated,
      scraped_at: new Date().toISOString(),
    },
  }));
}

// ─── Phase 4: Entity matching ───────────────────────────────────────────

async function matchEntitiesToPoliticians(politicians) {
  const matches = [];
  // Search for politician names in gs_entities — they may appear as
  // company directors, political donors, etc.
  for (const p of politicians) {
    const { data } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn, entity_type')
      .ilike('canonical_name', `%${p.surname}%`)
      .limit(5);

    if (data && data.length > 0) {
      // Look for close name match
      const exact = data.find(e =>
        e.canonical_name.toLowerCase().includes(p.name.toLowerCase()) ||
        e.canonical_name.toLowerCase().includes(`${p.surname}, ${p.first_name}`.toLowerCase())
      );
      if (exact) {
        matches.push({
          politician: p.name,
          entity_id: exact.id,
          entity_name: exact.canonical_name,
          entity_type: exact.entity_type,
          abn: exact.abn,
        });
      }
    }
    // Don't overwhelm the DB
    await delay(50);
  }
  return matches;
}

// ─── Progress management ────────────────────────────────────────────────

async function saveProgress(data) {
  await mkdir('output', { recursive: true });
  await writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

async function loadProgress() {
  try {
    const data = await readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;
  const stats = {
    politicians_found: 0,
    profiles_fetched: 0,
    profiles_paywalled: 0,
    profiles_with_interests: 0,
    roles_created: 0,
    entities_matched: 0,
    errors: 0,
  };

  try {
    // ── Phase 1: Fetch and parse browse page ──
    console.log('Phase 1: Fetching politician list from OpenPolitics browse page...');

    let politicians;
    const progress = RESUME ? await loadProgress() : null;

    if (progress?.politicians) {
      politicians = progress.politicians;
      console.log(`  Resumed: ${politicians.length} politicians from checkpoint`);
    } else {
      const browseHtml = await fetchHTML(BROWSE_URL);
      politicians = parseBrowsePage(browseHtml);
      console.log(`  Found ${politicians.length} politicians`);
      await saveProgress({ politicians, profilesCompleted: 0 });
    }

    stats.politicians_found = politicians.length;

    if (LIMIT) {
      politicians = politicians.slice(0, LIMIT);
      console.log(`  Limited to ${politicians.length} politicians`);
    }

    // Party summary
    const byParty = {};
    for (const p of politicians) {
      byParty[p.party] = (byParty[p.party] || 0) + 1;
    }
    console.log('\n  Party breakdown:');
    for (const [party, count] of Object.entries(byParty).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${party}: ${count}`);
    }

    // Chamber summary
    const byChamber = {};
    for (const p of politicians) {
      byChamber[p.chamber] = (byChamber[p.chamber] || 0) + 1;
    }
    console.log(`\n  Chamber: House=${byChamber.House || 0}, Senate=${byChamber.Senate || 0}`);

    // ── Phase 2: Fetch profile pages ──
    if (!SKIP_PROFILES) {
      console.log(`\nPhase 2: Fetching ${politicians.length} profile pages for interest counts...`);
      const startIdx = progress?.profilesCompleted || 0;

      for (let i = startIdx; i < politicians.length; i++) {
        const p = politicians[i];
        try {
          const profileHtml = await fetchHTML(p.profile_url);
          const profile = parseProfileInterests(profileHtml);

          if (profile) {
            p.interest_categories = profile.categories;
            p.interest_all_sections = profile.all_sections;
            p.interest_tabs = profile.tabs;
            if (profile.total_interests !== null) {
              p.interests_count = profile.total_interests;
            }
            stats.profiles_fetched++;
            if (profile.is_paywalled) stats.profiles_paywalled++;
            if (profile.categories && Object.keys(profile.categories).length > 0) {
              stats.profiles_with_interests++;
            }
          }
        } catch (err) {
          stats.errors++;
          if (stats.errors <= 10) {
            console.log(`  Error fetching ${p.name}: ${err.message}`);
          }
        }

        // Progress logging
        if ((i + 1) % 20 === 0 || i === politicians.length - 1) {
          console.log(`  ${i + 1}/${politicians.length} profiles fetched (${stats.profiles_with_interests} with interest data)`);
          await saveProgress({ politicians, profilesCompleted: i + 1 });
        }

        // Rate limit: 2 requests per second
        await delay(RATE_LIMIT_MS);
      }

      console.log(`\n  Phase 2 complete:`);
      console.log(`    ${stats.profiles_fetched} profiles fetched`);
      console.log(`    ${stats.profiles_paywalled} behind paywall (category counts still visible)`);
      console.log(`    ${stats.profiles_with_interests} with interest category data`);

      // Interest summary
      const interestTotals = {};
      for (const p of politicians) {
        if (!p.interest_categories) continue;
        for (const [cat, count] of Object.entries(p.interest_categories)) {
          interestTotals[cat] = (interestTotals[cat] || 0) + count;
        }
      }
      if (Object.keys(interestTotals).length > 0) {
        console.log('\n  Interest category totals (across all politicians):');
        for (const [cat, total] of Object.entries(interestTotals).sort((a, b) => b[1] - a[1])) {
          console.log(`    ${cat}: ${total}`);
        }
      }

      // Top politicians by total interests
      const sorted = [...politicians].sort((a, b) => b.interests_count - a.interests_count);
      console.log('\n  Top 10 by total interests:');
      for (const p of sorted.slice(0, 10)) {
        console.log(`    ${p.name} (${p.party}): ${p.interests_count} interests`);
      }

      // Politicians with directorships
      const withDirectorships = politicians.filter(p => p.interest_categories?.Directorships > 0);
      if (withDirectorships.length > 0) {
        console.log(`\n  Politicians with declared directorships: ${withDirectorships.length}`);
        for (const p of withDirectorships.slice(0, 15)) {
          console.log(`    ${p.name} (${p.party}): ${p.interest_categories.Directorships} directorships`);
        }
      }
    }

    // Save full dataset to JSON
    await mkdir('output', { recursive: true });
    await writeFile(OUTPUT_FILE, JSON.stringify(politicians, null, 2));
    console.log(`\nSaved ${politicians.length} politicians to ${OUTPUT_FILE}`);

    // ── Phase 3: Store in person_roles ──
    const roles = buildPersonRoles(politicians);

    if (APPLY && roles.length > 0) {
      console.log(`\nPhase 3: Inserting ${roles.length} person_roles...`);

      // Delete existing openpolitics_au records to avoid duplicates
      const { error: delError } = await db
        .from('person_roles')
        .delete()
        .eq('source', 'openpolitics_au');

      if (delError) {
        console.log(`  Warning: could not clear existing records: ${delError.message}`);
      }

      const BATCH_SIZE = 50;
      let inserted = 0;

      for (let i = 0; i < roles.length; i += BATCH_SIZE) {
        const batch = roles.slice(i, i + BATCH_SIZE);
        const { error } = await db
          .from('person_roles')
          .insert(batch);

        if (error) {
          // Fall back to individual inserts
          let batchOk = 0;
          for (const row of batch) {
            const { error: singleErr } = await db
              .from('person_roles')
              .insert(row);
            if (!singleErr) {
              batchOk++;
            } else if (stats.errors <= 10) {
              console.log(`  Insert error for ${row.person_name}: ${singleErr.message}`);
              stats.errors++;
            }
          }
          inserted += batchOk;
        } else {
          inserted += batch.length;
        }
      }

      stats.roles_created = inserted;
      console.log(`  ${inserted} person_roles inserted`);
    } else if (!APPLY) {
      console.log(`\nPhase 3: Dry run — ${roles.length} person_roles would be inserted`);
      if (roles.length > 0) {
        console.log('\n  Sample roles:');
        for (const r of roles.slice(0, 3)) {
          console.log(`    ${r.person_name} (${r.role_type}) — ${r.properties.party}, ${r.properties.chamber}`);
          if (r.properties.interest_categories) {
            const cats = Object.entries(r.properties.interest_categories)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            console.log(`      Interests: ${cats}`);
          }
        }
      }
    }

    // ── Phase 4: Entity matching ──
    if (APPLY) {
      console.log('\nPhase 4: Matching politicians to gs_entities...');
      const matches = await matchEntitiesToPoliticians(politicians);
      stats.entities_matched = matches.length;

      if (matches.length > 0) {
        console.log(`  ${matches.length} politicians matched to entities:`);
        for (const m of matches.slice(0, 10)) {
          console.log(`    ${m.politician} -> ${m.entity_name} (${m.entity_type}, ABN: ${m.abn})`);
        }

        // Update person_roles with entity_id
        for (const m of matches) {
          const { error } = await db
            .from('person_roles')
            .update({ person_entity_id: m.entity_id })
            .eq('source', 'openpolitics_au')
            .eq('person_name', m.politician);

          if (error) {
            console.log(`  Match update error for ${m.politician}: ${error.message}`);
          }
        }
      } else {
        console.log('  No entity matches found (politicians may not be in gs_entities)');
      }
    }

    // ── Summary ──
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Politicians found: ${stats.politicians_found}`);
    console.log(`  Profiles fetched: ${stats.profiles_fetched}`);
    console.log(`  Profiles with interest data: ${stats.profiles_with_interests}`);
    console.log(`  Roles ${APPLY ? 'inserted' : '(dry run)'}: ${stats.roles_created}`);
    console.log(`  Entity matches: ${stats.entities_matched}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`\n  NOTE: Directorship/shareholding DETAILS (company names) require`);
    console.log(`  an OpenPolitics subscription ($7.90/mo). Only category counts are`);
    console.log(`  publicly visible. Consider subscribing for full data.`);

    await logComplete(db, runId, {
      items_found: stats.politicians_found,
      items_new: stats.roles_created,
      items_updated: stats.entities_matched,
    });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
