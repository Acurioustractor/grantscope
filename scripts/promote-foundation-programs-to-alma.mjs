#!/usr/bin/env node
/**
 * Promote rows from foundation_programs → alma_funding_opportunities.
 *
 * Phase 1 of the rebuild roadmap. There are ~1,029 status='open' programs in
 * foundation_programs that have never been bridged into alma. This script
 * lands them as `unverified` so the LLM auto-classifier can sort them next.
 *
 * Gate:
 *   - foundation_programs.status = 'open'
 *   - foundation_programs.program_type IN ('grant','fellowship','award','program')
 *   - dedup against existing alma rows by lower(name)|lower(funder)
 *
 * Usage:
 *   node --env-file=.env scripts/promote-foundation-programs-to-alma.mjs [--dry-run] [--limit=2000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 2000;

const AGENT_ID = 'promote-foundation-programs-to-alma';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalise(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\bpty\.?\s*ltd\.?\b/g, '')
    .replace(/\blimited\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadAlmaIndex() {
  const { data } = await supabase
    .from('alma_funding_opportunities')
    .select('id, name, funder_name');
  const idx = new Map();
  for (const row of data ?? []) {
    const k = `${normalise(row.name)}|${normalise(row.funder_name)}`;
    idx.set(k, row.id);
  }
  return idx;
}

async function loadOpenPrograms() {
  // Paginate because PostgREST caps at 1000
  const programs = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; offset < 10000; offset += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('foundation_programs')
      .select('id, foundation_id, name, url, description, amount_min, amount_max, deadline, categories, thematic_focus, place_focus, eligibility, program_type, application_mode, application_process, source_urls')
      .eq('status', 'open')
      .in('program_type', ['grant', 'fellowship', 'award', 'program'])
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!page?.length) break;
    programs.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return programs;
}

async function loadFoundationsByIds(ids) {
  const map = new Map();
  // Paginate over the union of foundation_ids
  const unique = [...new Set(ids)];
  const PAGE = 200;
  for (let i = 0; i < unique.length; i += PAGE) {
    const batch = unique.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from('foundations')
      .select('id, name, website, thematic_focus, geographic_focus, total_giving_annual')
      .in('id', batch);
    if (error) throw error;
    for (const f of data ?? []) map.set(f.id, f);
  }
  return map;
}

function programTypeToOpportunityType(programType, applicationMode) {
  // Bridge into the alma opportunity_type taxonomy
  if (applicationMode === 'invitation_only') return 'invitation_only';
  if (programType === 'award') return 'award';
  if (programType === 'fellowship') return 'open_grant'; // most fellowships are open competitive
  return 'open_grant';
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'Promote foundation_programs → alma');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  try {
    const [programs, almaIndex] = await Promise.all([
      loadOpenPrograms(),
      loadAlmaIndex(),
    ]);
    console.log(`Open foundation programs: ${programs.length}`);
    console.log(`Existing alma rows: ${almaIndex.size}`);

    const foundationIds = programs.map((p) => p.foundation_id).filter(Boolean);
    const foundationsById = await loadFoundationsByIds(foundationIds);
    console.log(`Loaded ${foundationsById.size} foundations`);

    let skippedNoFunder = 0,
      skippedExisting = 0,
      skippedNoName = 0;
    const toInsert = [];

    for (const p of programs) {
      const f = foundationsById.get(p.foundation_id);
      if (!f) {
        skippedNoFunder++;
        continue;
      }
      const funderName = f.name;
      if (!p.name || !funderName) {
        skippedNoName++;
        continue;
      }
      const dedupKey = `${normalise(p.name)}|${normalise(funderName)}`;
      if (almaIndex.has(dedupKey)) {
        skippedExisting++;
        continue;
      }
      almaIndex.set(dedupKey, true); // prevent same-batch duplicates

      const deadline = p.deadline ? new Date(p.deadline).toISOString() : null;
      // Foundation programs sometimes have nonsensical amounts (e.g. 88 above). Sanity gate.
      let minAmt = p.amount_min;
      let maxAmt = p.amount_max;
      if (minAmt != null && minAmt < 100) minAmt = null;
      if (maxAmt != null && maxAmt < 100) maxAmt = null;
      if (minAmt != null && maxAmt != null && minAmt > maxAmt) {
        minAmt = null;
        maxAmt = null;
      }

      toInsert.push({
        name: p.name.slice(0, 500),
        description: p.description ? String(p.description).slice(0, 2000) : null,
        funder_name: funderName,
        source_type: 'philanthropy',
        status: 'open',
        deadline,
        min_grant_amount: minAmt,
        max_grant_amount: maxAmt,
        focus_areas: [...(p.thematic_focus ?? []), ...(p.categories ?? [])].slice(0, 12),
        keywords: p.categories ?? [],
        source_url: p.url || f.website,
        application_url: p.url || null,
        scrape_source: 'promotion-from-foundation-programs',
        opportunity_type: 'unverified',
        verification_status: 'unverified',
        verification_notes: JSON.stringify({
          promoted_from: 'foundation_programs',
          foundation_program_id: p.id,
          foundation_id: p.foundation_id,
          program_type: p.program_type,
          application_mode: p.application_mode ?? null,
        }),
        raw_data: {
          foundation_program_id: p.id,
          foundation_id: p.foundation_id,
          eligibility: p.eligibility,
          application_process: p.application_process,
          place_focus: p.place_focus,
          source_urls: p.source_urls,
          foundation_website: f.website,
          foundation_thematic_focus: f.thematic_focus,
          foundation_geographic_focus: f.geographic_focus,
          foundation_total_giving_annual: f.total_giving_annual,
        },
      });

      if (toInsert.length >= LIMIT) break;
    }

    console.log(`\nTo promote: ${toInsert.length} (skipped ${skippedExisting} existing, ${skippedNoFunder} no funder, ${skippedNoName} no name)`);

    let promoted = 0,
      failedBatches = 0;
    if (!DRY_RUN && toInsert.length) {
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error } = await supabase
          .from('alma_funding_opportunities')
          .insert(batch);
        if (error) {
          console.error(`Insert batch ${i / 50} failed:`, error.message.slice(0, 200));
          failedBatches++;
        } else {
          promoted += batch.length;
        }
      }
    } else if (DRY_RUN) {
      console.log('\nFirst 10 candidates:');
      for (const t of toInsert.slice(0, 10)) {
        console.log(`  ${(t.funder_name ?? '').slice(0, 30).padEnd(30)} ${t.name.slice(0, 70)}`);
      }
    }

    const summary = {
      promoted: DRY_RUN ? toInsert.length : promoted,
      skippedExisting,
      skippedNoFunder,
      skippedNoName,
      failedBatches,
      candidates: programs.length,
    };
    console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s:`, summary);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: programs.length,
        items_new: summary.promoted,
        items_updated: 0,
      });
    }
  } catch (err) {
    console.error('promote-foundation-programs-to-alma failed:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

run();
