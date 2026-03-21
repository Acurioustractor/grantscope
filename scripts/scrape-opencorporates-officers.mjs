#!/usr/bin/env node

/**
 * Scrape OpenCorporates Officers/Directors
 *
 * Queries the OpenCorporates API for Australian company officers/directors
 * and stores them in the person_roles table.
 *
 * Phase 1: Load priority entities from mv_entity_power_index (system_count >= 3)
 * Phase 2: Search OpenCorporates for matching companies, extract officers
 * Phase 3: Insert new officers into person_roles
 * Phase 4: Generate API application instructions
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-opencorporates-officers.mjs [--apply] [--limit=5] [--demo]
 *
 * Options:
 *   --apply    Actually insert into DB (default: dry run)
 *   --limit=N  Process only N entities (default: 2000, or 5 in demo mode)
 *   --demo     Run in demo mode with 5 test queries (no API key required — but OC now requires a key for all access)
 *
 * Environment:
 *   OPENCORPORATES_API_KEY  API token (required — apply at https://opencorporates.atlassian.net/servicedesk/customer/portal/4/group/16/create/36)
 *   SUPABASE_URL            Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { writeFile, mkdir } from 'fs/promises';

const AGENT_ID = 'scrape-opencorporates-officers';
const AGENT_NAME = 'OpenCorporates Officers Scraper';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.OPENCORPORATES_API_KEY;

const APPLY = process.argv.includes('--apply');
const DEMO = process.argv.includes('--demo') || !API_KEY;
const LIMIT = parseInt(
  process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ||
  (DEMO ? '5' : '2000')
);

const OC_BASE = 'https://api.opencorporates.com/v0.4';
const RATE_LIMIT_MS = 1000; // 1 request per second

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalisePersonName(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map OpenCorporates position titles to person_roles role_type enum values.
 * Valid: director, secretary, alternate_director, public_officer, chair, ceo,
 *        cfo, board_member, trustee, officeholder, other
 */
function mapRoleType(position) {
  if (!position) return 'other';
  const p = position.toLowerCase().trim();

  if (p.includes('director') && p.includes('alternate')) return 'alternate_director';
  if (p.includes('director')) return 'director';
  if (p.includes('secretary')) return 'secretary';
  if (p.includes('chair')) return 'chair';
  if (p === 'ceo' || p.includes('chief executive')) return 'ceo';
  if (p === 'cfo' || p.includes('chief financial')) return 'cfo';
  if (p.includes('trustee')) return 'trustee';
  if (p.includes('public officer')) return 'public_officer';
  if (p.includes('board') || p.includes('member')) return 'board_member';
  if (p.includes('treasurer') || p.includes('officer')) return 'officeholder';
  return 'other';
}

/**
 * Parse a date string from OpenCorporates (YYYY-MM-DD) into a Date or null.
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return dateStr; // Return the ISO string directly for DB insertion
}

async function fetchJSON(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)',
        },
      });

      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`401 Unauthorized: ${body?.error?.message || 'Invalid API token'}`);
      }
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
      if (err.message.includes('401')) throw err; // Don't retry auth errors
      if (attempt === retries) throw err;
      console.log(`  Attempt ${attempt} failed: ${err.message}, retrying...`);
      await delay(2000 * attempt);
    }
  }
}

// ── Phase 1: Load priority entities ─────────────────────

async function loadPriorityEntities(limit) {
  console.log(`Phase 1: Loading top ${limit} entities from mv_entity_power_index...`);

  // Paginate to get entities with system_count >= 3
  const allEntities = [];
  let from = 0;
  const PAGE = 1000;

  while (allEntities.length < limit) {
    const { data, error } = await db
      .from('mv_entity_power_index')
      .select('id, gs_id, canonical_name, abn, entity_type, system_count, power_score')
      .gte('system_count', 3)
      .not('abn', 'is', null)
      .order('power_score', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error(`  Query error: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    allEntities.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const entities = allEntities.slice(0, limit);
  console.log(`  Loaded ${entities.length} entities (power_score range: ${entities[entities.length - 1]?.power_score} - ${entities[0]?.power_score})`);
  return entities;
}

// ── Phase 2: Query OpenCorporates ───────────────────────

async function searchOfficersByName(entityName) {
  // Clean entity name for search — remove common suffixes
  const cleaned = entityName
    .replace(/\b(pty|ltd|limited|incorporated|inc|corporation|corp)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const url = `${OC_BASE}/officers/search?q=${encodeURIComponent(cleaned)}&jurisdiction_code=au&api_token=${API_KEY}`;
  const data = await fetchJSON(url);

  if (!data?.results?.officers) return [];

  return data.results.officers.map(o => {
    const officer = o.officer;
    return {
      name: officer.name,
      position: officer.position,
      start_date: officer.start_date,
      end_date: officer.end_date,
      company_name: officer.company?.name,
      company_number: officer.company?.company_number,
      opencorporates_url: officer.opencorporates_url,
    };
  });
}

async function getCompanyOfficers(companyNumber) {
  const url = `${OC_BASE}/companies/au/${companyNumber}/officers?api_token=${API_KEY}`;
  const data = await fetchJSON(url);

  if (!data?.results?.officers) return [];

  return data.results.officers.map(o => {
    const officer = o.officer;
    return {
      name: officer.name,
      position: officer.position,
      start_date: officer.start_date,
      end_date: officer.end_date,
      uid: officer.uid,
      opencorporates_url: officer.opencorporates_url,
    };
  });
}

async function searchCompanyByName(entityName) {
  const cleaned = entityName
    .replace(/\b(pty|ltd|limited|incorporated|inc|corporation|corp)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const url = `${OC_BASE}/companies/search?q=${encodeURIComponent(cleaned)}&jurisdiction_code=au&api_token=${API_KEY}&per_page=5`;
  const data = await fetchJSON(url);

  if (!data?.results?.companies) return [];

  return data.results.companies.map(c => ({
    name: c.company.name,
    company_number: c.company.company_number,
    jurisdiction_code: c.company.jurisdiction_code,
    opencorporates_url: c.company.opencorporates_url,
    inactive: c.company.inactive,
  }));
}

// ── Phase 3: Load existing and prepare inserts ──────────

async function loadExistingPersonRoles() {
  // Load existing opencorporates person_roles to avoid duplicates
  const existing = new Set();
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data } = await db
      .from('person_roles')
      .select('person_name_normalised, role_type, company_acn')
      .eq('source', 'opencorporates')
      .range(from, from + PAGE - 1);

    if (!data || data.length === 0) break;
    for (const r of data) {
      existing.add(`${r.person_name_normalised}::${r.role_type}::${r.company_acn}`);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return existing;
}

// ── Phase 4: Application instructions ───────────────────

async function writeApplicationInstructions() {
  await mkdir('output', { recursive: true });

  const content = `# OpenCorporates API Access — Application Instructions

## Overview

OpenCorporates provides the world's largest open database of company information.
Their API gives access to company officers/directors for Australian companies,
which CivicGraph uses to build board connection networks.

As of 2026, OpenCorporates requires an API token for ALL access (including search).
Public benefit projects qualify for free API access.

## How to Apply

1. **Go to:** https://opencorporates.atlassian.net/servicedesk/customer/portal/4/group/16/create/36

2. **Fill in the application form:**

   - **Organisation name:** CivicGraph (by Knight Digital Pty Ltd)
   - **Website:** https://civicgraph.au
   - **What does your organisation do?**
     CivicGraph is an open civic intelligence platform that maps funding flows,
     governance networks, and evidence of impact across Australian government,
     philanthropic, and social sector organisations. We serve First Nations
     community organisations, nonprofits, and government agencies.

   - **How will you use the data?**
     We will use OpenCorporates officer/director data to:
     - Map board connections between Australian organisations (charities, foundations, corporations)
     - Identify governance networks relevant to public funding decisions
     - Enrich our open person_roles database with company directorship data
     - Cross-reference with ACNC charity responsible persons data
     All data will be attributed to OpenCorporates per your terms.

   - **Will you attribute OpenCorporates?**
     Yes. All pages displaying OpenCorporates data will include attribution
     and a link to the relevant OpenCorporates page.

   - **Is your project public benefit?**
     Yes. CivicGraph is decision infrastructure for the social sector.
     Our data helps First Nations organisations, disability service providers,
     and community groups understand and navigate the funding landscape.

   - **Expected API usage:**
     Initial bulk load: ~2,000 company officer lookups (one-time)
     Ongoing: ~100 lookups/week for new entities entering our system

3. **Wait for approval** — typically 1-2 weeks.

## Once You Receive the API Key

1. Add to your \`.env\` file:
   \`\`\`
   OPENCORPORATES_API_KEY=your_token_here
   \`\`\`

2. Test the connection:
   \`\`\`bash
   curl "https://api.opencorporates.com/v0.4/companies/search?q=BHP&jurisdiction_code=au&api_token=YOUR_TOKEN"
   \`\`\`

3. Run the scraper in dry-run mode first:
   \`\`\`bash
   node --env-file=.env scripts/scrape-opencorporates-officers.mjs --limit=10
   \`\`\`

4. If results look good, run with \`--apply\`:
   \`\`\`bash
   node --env-file=.env scripts/scrape-opencorporates-officers.mjs --apply --limit=100
   \`\`\`

5. For the full batch (top 2000 entities by power score):
   \`\`\`bash
   node --env-file=.env scripts/scrape-opencorporates-officers.mjs --apply
   \`\`\`

## API Reference

- **Officer search:** \`GET /v0.4/officers/search?q={name}&jurisdiction_code=au&api_token={TOKEN}\`
- **Company officers:** \`GET /v0.4/companies/au/{company_number}/officers?api_token={TOKEN}\`
- **Company search:** \`GET /v0.4/companies/search?q={name}&jurisdiction_code=au&api_token={TOKEN}\`
- **Rate limit:** 1 request/second (the script enforces this)
- **Docs:** https://api.opencorporates.com/documentation/API-Reference

## Data Flow

\`\`\`
mv_entity_power_index (top entities)
  --> OpenCorporates company search (match by name)
    --> OpenCorporates company officers
      --> person_roles table (source='opencorporates')
        --> mv_director_network, mv_multi_board_persons (materialized views)
\`\`\`
`;

  await writeFile('output/opencorporates-application.md', content);
  console.log('\nApplication instructions written to output/opencorporates-application.md');
}

// ── Demo Mode ───────────────────────────────────────────

async function runDemo(entities) {
  console.log('\n========================================');
  console.log('DEMO MODE (no API key detected)');
  console.log('========================================');
  console.log('OpenCorporates now requires an API token for ALL requests.');
  console.log('Showing what the pipeline WOULD do with your top entities.\n');

  const demoEntities = entities.slice(0, 5);
  const simulatedRoles = [];

  for (const entity of demoEntities) {
    console.log(`  [DEMO] Would search OpenCorporates for: "${entity.canonical_name}"`);
    console.log(`         ABN: ${entity.abn} | Power Score: ${entity.power_score} | Systems: ${entity.system_count}`);
    console.log(`         Step 1: Search /companies/search?q=${encodeURIComponent(entity.canonical_name.replace(/\b(pty|ltd|limited)\b/gi, '').trim())}&jurisdiction_code=au`);
    console.log(`         Step 2: For each matching company, fetch /companies/au/{number}/officers`);
    console.log(`         Step 3: Insert officers into person_roles with source='opencorporates'\n`);
  }

  console.log('--- Simulated Output (based on typical Australian company data) ---\n');

  // Show the data structure that WOULD be inserted
  const sampleRow = {
    person_name: 'JANE SMITH',
    person_name_normalised: 'JANE SMITH',
    role_type: 'director',
    company_acn: demoEntities[0]?.abn?.slice(-9) || '000000000',
    company_abn: demoEntities[0]?.abn || '00000000000',
    company_name: demoEntities[0]?.canonical_name || 'Example Org',
    entity_id: demoEntities[0]?.id || null,
    source: 'opencorporates',
    confidence: 'registry',
    appointment_date: '2020-01-15',
    cessation_date: null,
    properties: {
      company_number: '123456789',
      opencorporates_url: 'https://opencorporates.com/officers/12345',
      original_position: 'Director',
    },
  };

  console.log('Sample person_roles row that would be inserted:');
  console.log(JSON.stringify(sampleRow, null, 2));

  console.log(`\nTo proceed:`);
  console.log(`  1. Apply for a free API key (see output/opencorporates-application.md)`);
  console.log(`  2. Add OPENCORPORATES_API_KEY to .env`);
  console.log(`  3. Run: node --env-file=.env scripts/scrape-opencorporates-officers.mjs --limit=10`);

  return { found: 0, inserted: 0, demo: true };
}

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log(`OpenCorporates Officers Scraper`);
  console.log(`Mode: ${DEMO ? 'DEMO (no API key)' : 'LIVE'} | Apply: ${APPLY} | Limit: ${LIMIT}`);
  console.log('');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;
  const stats = {
    entities_queried: 0,
    companies_matched: 0,
    officers_found: 0,
    roles_created: 0,
    skipped_existing: 0,
    errors: 0,
  };

  try {
    // Phase 1: Load priority entities
    const entities = await loadPriorityEntities(LIMIT);

    if (entities.length === 0) {
      console.log('No entities found. Check mv_entity_power_index.');
      await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    // Phase 4 (early): Write application instructions regardless of mode
    await writeApplicationInstructions();

    // Demo mode — simulate the pipeline
    if (DEMO) {
      const result = await runDemo(entities);
      await logComplete(db, runId, {
        items_found: result.found,
        items_new: result.inserted,
        status: 'success',
      });
      return;
    }

    // ── Live mode with API key ──────────────────────────

    // Load existing to skip duplicates
    const existing = await loadExistingPersonRoles();
    console.log(`\n${existing.size} existing person_roles from opencorporates`);

    const allRoles = [];

    console.log(`\nPhase 2: Querying OpenCorporates for ${entities.length} entities...\n`);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      stats.entities_queried++;

      try {
        // Step 1: Search for matching company
        const companies = await searchCompanyByName(entity.canonical_name);
        await delay(RATE_LIMIT_MS);

        if (companies.length === 0) {
          if (i < 20 || i % 100 === 0) {
            console.log(`  [${i + 1}/${entities.length}] ${entity.canonical_name} — no company match`);
          }
          continue;
        }

        // Take the top match (first result, active preferred)
        const activeCompanies = companies.filter(c => !c.inactive);
        const bestMatch = activeCompanies[0] || companies[0];
        stats.companies_matched++;

        // Step 2: Get officers for the matched company
        const officers = await getCompanyOfficers(bestMatch.company_number);
        await delay(RATE_LIMIT_MS);

        if (officers.length === 0) {
          if (i < 20 || i % 100 === 0) {
            console.log(`  [${i + 1}/${entities.length}] ${entity.canonical_name} -> ${bestMatch.name} — no officers`);
          }
          continue;
        }

        stats.officers_found += officers.length;

        // ACN from ABN (last 9 digits) or from company_number
        const acn = bestMatch.company_number || entity.abn?.slice(-9) || '';

        for (const officer of officers) {
          const normName = normalisePersonName(officer.name);
          const roleType = mapRoleType(officer.position);
          const dedupKey = `${normName}::${roleType}::${acn}`;

          if (existing.has(dedupKey)) {
            stats.skipped_existing++;
            continue;
          }

          // Mark as seen to avoid within-run duplicates
          existing.add(dedupKey);

          allRoles.push({
            person_name: officer.name,
            person_name_normalised: normName,
            role_type: roleType,
            company_acn: acn,
            company_abn: entity.abn,
            company_name: bestMatch.name,
            entity_id: entity.id,
            source: 'opencorporates',
            confidence: 'registry',
            appointment_date: parseDate(officer.start_date),
            cessation_date: parseDate(officer.end_date),
            properties: {
              company_number: bestMatch.company_number,
              opencorporates_url: officer.opencorporates_url,
              original_position: officer.position,
              oc_uid: officer.uid,
              oc_company_url: bestMatch.opencorporates_url,
            },
          });
        }

        if (i < 20 || i % 50 === 0) {
          console.log(`  [${i + 1}/${entities.length}] ${entity.canonical_name} -> ${bestMatch.name}: ${officers.length} officers`);
        }

      } catch (err) {
        stats.errors++;
        if (err.message.includes('401')) {
          console.error(`\nAPI authentication failed. Check your OPENCORPORATES_API_KEY.`);
          console.error(`Error: ${err.message}`);
          break; // Stop on auth errors
        }
        if (stats.errors <= 10) {
          console.error(`  [${i + 1}] Error for ${entity.canonical_name}: ${err.message}`);
        }
      }

      // Progress checkpoint every 100 entities
      if (i > 0 && i % 100 === 0) {
        console.log(`\n--- Progress: ${i}/${entities.length} entities, ${stats.officers_found} officers found, ${allRoles.length} new roles ---\n`);
      }
    }

    console.log(`\nPhase 2 complete:`);
    console.log(`  ${stats.entities_queried} entities queried`);
    console.log(`  ${stats.companies_matched} companies matched`);
    console.log(`  ${stats.officers_found} officers found`);
    console.log(`  ${allRoles.length} new roles (${stats.skipped_existing} skipped as existing)`);
    console.log(`  ${stats.errors} errors`);

    // Save raw data to JSON
    await mkdir('output', { recursive: true });
    const jsonPath = 'output/opencorporates-officers-data.json';
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
            if (!singleErr) {
              batchInserted++;
            } else if (batchInserted === 0 && i === 0) {
              // Log first error for debugging
              console.error(`  Insert error: ${singleErr.message}`);
            }
          }
          stats.roles_created += batchInserted;
        } else {
          stats.roles_created += batch.length;
        }

        if (i % 200 === 0 && i > 0) {
          console.log(`  ${i}/${allRoles.length} processed, ${stats.roles_created} inserted`);
        }
      }
      console.log(`  ${stats.roles_created} roles inserted`);
    } else if (!APPLY) {
      console.log(`\nDry run — ${allRoles.length} roles would be inserted`);
      if (allRoles.length > 0) {
        console.log('\nSample roles:');
        for (const role of allRoles.slice(0, 10)) {
          console.log(`  ${role.person_name} (${role.role_type}) at ${role.company_name} [${role.appointment_date || 'no date'}]`);
        }
      }
    }

    console.log(`\nDone. ${stats.entities_queried} entities, ${stats.officers_found} officers, ${stats.roles_created} ${APPLY ? 'inserted' : '(dry run)'}, ${stats.errors} errors`);
    await logComplete(db, runId, {
      items_found: stats.officers_found,
      items_new: stats.roles_created,
      items_updated: 0,
      entities_queried: stats.entities_queried,
      companies_matched: stats.companies_matched,
    });

  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
