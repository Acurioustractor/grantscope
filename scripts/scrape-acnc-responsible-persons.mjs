#!/usr/bin/env node

/**
 * Scrape ACNC Responsible Persons
 *
 * Uses the ACNC Dynamics API to fetch responsible persons (board members,
 * directors, etc.) for all registered charities and stores them in person_roles.
 *
 * Phase 1: Paginate through ACNC search API to get UUIDs for all charities
 * Phase 2: For each charity, fetch entity detail including ResponsiblePersons
 * Phase 3: For each person, fetch cross-charity memberships via person endpoint
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-acnc-responsible-persons.mjs [--apply] [--limit=100] [--priority-only] [--resume]
 *
 * Options:
 *   --apply          Actually insert into DB (default: dry run)
 *   --limit=N        Process only N charities
 *   --priority-only  Only process charities that match gs_entities with ABN
 *   --resume         Resume from last checkpoint (reads progress file)
 *   --concurrency=N  Concurrent requests (default: 3, be gentle)
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { writeFile, readFile } from 'fs/promises';

const AGENT_ID = 'scrape-acnc-persons';
const AGENT_NAME = 'ACNC Responsible Persons Scraper';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const PRIORITY_ONLY = process.argv.includes('--priority-only');
const RESUME = process.argv.includes('--resume');
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3');
const PROGRESS_FILE = 'output/acnc-persons-progress.json';
const ACNC_BASE = 'https://www.acnc.gov.au/api/dynamics';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Rate limiter — be respectful to ACNC
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJSON(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
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
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await delay(2000 * attempt);
    }
  }
}

async function loadPriorityAbns() {
  // Get ABNs that are in our entity universe (charities that donate, receive contracts, etc.)
  // Paginate to get ALL ABNs
  const allAbns = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await db
      .from('gs_entities')
      .select('abn')
      .not('abn', 'is', null)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    allAbns.push(...data.map(r => r.abn));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return new Set(allAbns);
}

async function loadExistingPersonRoles() {
  const { data } = await db
    .from('person_roles')
    .select('company_abn, person_name')
    .eq('source', 'acnc');
  const seen = new Set();
  for (const r of data || []) {
    seen.add(`${r.company_abn}::${r.person_name}`);
  }
  return seen;
}

async function getAllCharityUuids() {
  console.log('Phase 1: Fetching all charity UUIDs from ACNC search API...');
  const charities = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const data = await fetchJSON(
      `${ACNC_BASE}/search/charity?size=${pageSize}&page=${page}`
    );
    if (!data.results || data.results.length === 0) break;

    for (const r of data.results) {
      charities.push({
        uuid: r.uuid,
        name: r.data?.Name,
        abn: r.data?.Abn,
        size: r.data?.CharitySize,
      });
    }

    const totalPages = data.pager?.total_pages || 0;
    if (page % 50 === 0) {
      console.log(`  Page ${page + 1}/${totalPages} — ${charities.length} charities`);
    }
    page++;

    if (page >= totalPages) break;
    await delay(500); // 2 requests/sec
  }

  console.log(`  Total: ${charities.length} charities found`);
  return charities;
}

async function fetchResponsiblePersons(charity) {
  const data = await fetchJSON(`${ACNC_BASE}/entity/${charity.uuid}`);
  const persons = data?.data?.ResponsiblePersons || [];
  return persons.map(p => ({
    name: p.Name,
    role: p.Role,
    person_uuid: p.uuid,
  }));
}

async function processInBatches(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    await delay(1000); // pace ourselves
  }
  return results;
}

async function saveProgress(progress) {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function loadProgress() {
  try {
    const data = await readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function normalizePersonName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchCharityByAbn(abn) {
  const data = await fetchJSON(`${ACNC_BASE}/search/charity?search=${abn}&size=5`);
  if (!data.results || data.results.length === 0) return null;
  // Find exact ABN match
  const match = data.results.find(r => r.data?.Abn === abn);
  if (!match) return null;
  return {
    uuid: match.uuid,
    name: match.data?.Name,
    abn: match.data?.Abn,
    size: match.data?.CharitySize,
  };
}

async function getPriorityCharities(priorityAbns) {
  console.log('Phase 1 (priority): Looking up charities by ABN from gs_entities...');
  // Get charity ABNs from acnc_charities that are also in gs_entities
  const { data: acncAbns } = await db
    .from('acnc_charities')
    .select('abn, name')
    .not('abn', 'is', null);

  const matchingAbns = (acncAbns || []).filter(r => priorityAbns.has(r.abn));
  console.log(`  ${matchingAbns.length} ACNC charities match gs_entities ABNs`);

  // Look up UUIDs via search API (in batches)
  const charities = [];
  for (let i = 0; i < matchingAbns.length; i += CONCURRENCY) {
    const batch = matchingAbns.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (r) => {
        try {
          return await searchCharityByAbn(r.abn);
        } catch {
          return null;
        }
      })
    );
    charities.push(...results.filter(Boolean));
    if (i % 30 === 0 && i > 0) {
      console.log(`  ${i}/${matchingAbns.length} looked up, ${charities.length} found`);
    }
    await delay(1000);
  }
  console.log(`  Total: ${charities.length} charities with UUIDs`);
  return charities;
}

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;
  const stats = { charities_scanned: 0, persons_found: 0, roles_created: 0, multi_board: 0, errors: 0 };

  try {
    // Load priority ABNs if filtering
    let priorityAbns = null;
    if (PRIORITY_ONLY) {
      priorityAbns = await loadPriorityAbns();
      console.log(`Priority mode: ${priorityAbns.size} ABNs in gs_entities universe`);
    }

    // Load existing to avoid duplicates
    const existing = await loadExistingPersonRoles();
    console.log(`${existing.size} existing person_roles from ACNC`);

    // Phase 1: Get charity UUIDs
    let charities;
    const progress = RESUME ? await loadProgress() : null;

    if (progress?.charities) {
      charities = progress.charities;
      console.log(`Resumed: ${charities.length} charities from checkpoint`);
    } else if (PRIORITY_ONLY && priorityAbns) {
      charities = await getPriorityCharities(priorityAbns);
      await saveProgress({ charities, lastProcessed: 0 });
    } else {
      charities = await getAllCharityUuids();
      await saveProgress({ charities, lastProcessed: 0 });
    }

    if (LIMIT) {
      charities = charities.slice(0, LIMIT);
      console.log(`Limited to ${charities.length} charities`);
    }

    // Phase 2: Fetch responsible persons for each charity
    console.log(`\nPhase 2: Fetching responsible persons for ${charities.length} charities...`);
    const startIdx = progress?.lastProcessed || 0;
    const allRoles = [];
    const personCharities = new Map(); // person_uuid -> Set of ABNs

    for (let i = startIdx; i < charities.length; i += CONCURRENCY) {
      const batch = charities.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.all(
        batch.map(async (charity) => {
          try {
            const persons = await fetchResponsiblePersons(charity);
            return { charity, persons };
          } catch (err) {
            stats.errors++;
            return { charity, persons: [], error: err.message };
          }
        })
      );

      for (const { charity, persons, error } of batchResults) {
        stats.charities_scanned++;

        if (error) {
          if (stats.errors <= 5) console.log(`  Error for ${charity.name}: ${error}`);
          continue;
        }

        for (const person of persons) {
          stats.persons_found++;

          const key = `${charity.abn}::${person.name}`;
          if (existing.has(key)) continue;

          // Track multi-board membership
          if (person.person_uuid) {
            if (!personCharities.has(person.person_uuid)) {
              personCharities.set(person.person_uuid, new Set());
            }
            personCharities.get(person.person_uuid).add(charity.abn);
          }

          // company_acn is NOT NULL — derive ACN from ABN (last 9 digits)
          const acn = charity.abn ? charity.abn.slice(-9) : charity.abn;

          // Map ACNC role names to person_roles_role_type_check values
          const roleMap = {
            'Board Member': 'board_member',
            'Chairperson': 'chair',
            'Chair': 'chair',
            'Director': 'director',
            'Secretary': 'secretary',
            'CEO': 'ceo',
            'CFO': 'cfo',
            'Treasurer': 'officeholder',
            'Public Officer': 'public_officer',
            'Trustee': 'trustee',
            'Responsible Person': 'other',
          };
          const mappedRole = roleMap[person.role] || 'other';

          allRoles.push({
            person_name: person.name,
            role_type: mappedRole,
            company_acn: acn,
            company_abn: charity.abn,
            company_name: charity.name,
            source: 'acnc',
            confidence: 'registry',
            properties: {
              person_uuid: person.person_uuid,
              charity_uuid: charity.uuid,
              charity_size: charity.size,
              original_role: person.role,
            },
          });
        }
      }

      if (i % 30 === 0) {
        console.log(`  ${stats.charities_scanned}/${charities.length} scanned, ${stats.persons_found} persons, ${allRoles.length} new roles`);
        await saveProgress({ charities, lastProcessed: i });
      }

      await delay(1000); // ~3 req/sec with concurrency=3
    }

    // Count multi-board
    for (const [uuid, abns] of personCharities) {
      if (abns.size > 1) stats.multi_board++;
    }

    console.log(`\nPhase 2 complete:`);
    console.log(`  ${stats.charities_scanned} charities scanned`);
    console.log(`  ${stats.persons_found} responsible persons found`);
    console.log(`  ${allRoles.length} new roles to insert`);
    console.log(`  ${stats.multi_board} persons on multiple boards`);

    // Always save raw data to JSON first
    const jsonPath = 'output/acnc-persons-data.json';
    await writeFile(jsonPath, JSON.stringify(allRoles, null, 2));
    console.log(`\nSaved ${allRoles.length} roles to ${jsonPath}`);

    // Phase 3: Insert into DB
    if (APPLY && allRoles.length > 0) {
      console.log(`\nPhase 3: Inserting ${allRoles.length} person_roles...`);
      const BATCH_SIZE = 50;

      for (let i = 0; i < allRoles.length; i += BATCH_SIZE) {
        const batch = allRoles.slice(i, i + BATCH_SIZE);
        const { error } = await db
          .from('person_roles')
          .upsert(batch, {
            onConflict: 'person_name_normalised,role_type,company_acn,appointment_date',
            ignoreDuplicates: true,
          });

        if (error) {
          // Fall back to individual inserts on upsert failure
          let batchInserted = 0;
          for (const row of batch) {
            const { error: singleErr } = await db
              .from('person_roles')
              .insert(row);
            if (!singleErr) batchInserted++;
          }
          stats.roles_created += batchInserted;
          if (batchInserted === 0) {
            console.error(`  Batch error at ${i}: ${error.message}`);
            stats.errors++;
          }
        } else {
          stats.roles_created += batch.length;
        }
      }
      console.log(`  ${stats.roles_created} roles inserted`);
    } else if (!APPLY) {
      console.log(`\nDry run — ${allRoles.length} roles would be inserted`);
      // Show sample
      if (allRoles.length > 0) {
        console.log('\nSample roles:');
        for (const role of allRoles.slice(0, 5)) {
          console.log(`  ${role.person_name} (${role.role_type}) at ${role.company_name}`);
        }
      }

      // Show multi-board persons
      if (stats.multi_board > 0) {
        console.log(`\nMulti-board persons (${stats.multi_board}):`);
        let shown = 0;
        for (const [uuid, abns] of personCharities) {
          if (abns.size > 1 && shown < 10) {
            const person = allRoles.find(r => r.properties?.person_uuid === uuid);
            if (person) {
              console.log(`  ${person.person_name}: ${abns.size} boards`);
              shown++;
            }
          }
        }
      }
    }

    console.log(`\nDone. ${stats.charities_scanned} charities, ${stats.persons_found} persons, ${stats.roles_created} ${APPLY ? 'inserted' : '(dry run)'}, ${stats.errors} errors`);
    await logComplete(db, runId, {
      items_found: stats.persons_found,
      items_new: stats.roles_created,
      charities_scanned: stats.charities_scanned,
      multi_board_persons: stats.multi_board,
    });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
