#!/usr/bin/env node
/**
 * link-ato-entities.mjs
 *
 * Cross-matches ATO tax transparency records against gs_entities by ABN.
 * Creates 'tax_transparency' relationships so the power index can detect
 * entities that receive government money AND pay minimal tax.
 *
 * Usage:
 *   node --env-file=.env scripts/link-ato-entities.mjs [--dry-run] [--apply]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'link-ato-entities';
const AGENT_NAME = 'ATO Tax Transparency Linker';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = !process.argv.includes('--apply');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

async function main() {
  log('╔══════════════════════════════════════════════════╗');
  log('║  ATO Tax Transparency Linker                      ║');
  log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                    ║`);
  log('╚══════════════════════════════════════════════════╝');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Phase 1: Get all unique ABNs from ATO data
    log('\nPhase 1: Fetching ATO records...');
    // Paginate to get all records (Supabase default limit is 1000)
    const atoRecords = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error: atoErr } = await db
        .from('ato_tax_transparency')
        .select('abn, entity_name, total_income, taxable_income, tax_payable, effective_tax_rate, report_year')
        .order('report_year', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (atoErr) throw new Error(`ATO fetch failed: ${atoErr.message}`);
      if (!data || data.length === 0) break;
      atoRecords.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    log(`  ${atoRecords.length} ATO records loaded`);

    // Aggregate by ABN (latest year, totals across years)
    const byAbn = new Map();
    for (const r of atoRecords) {
      if (!r.abn) continue;
      const cleaned = r.abn.replace(/\s/g, '');
      if (!byAbn.has(cleaned)) {
        byAbn.set(cleaned, {
          abn: cleaned,
          entity_name: r.entity_name,
          latest_year: r.report_year,
          total_income_latest: Number(r.total_income) || 0,
          taxable_income_latest: Number(r.taxable_income) || 0,
          tax_payable_latest: Number(r.tax_payable) || 0,
          effective_tax_rate: Number(r.effective_tax_rate) || 0,
          years_reported: [],
          total_income_all_years: 0,
          tax_payable_all_years: 0,
        });
      }
      const entry = byAbn.get(cleaned);
      entry.years_reported.push(r.report_year);
      entry.total_income_all_years += Number(r.total_income) || 0;
      entry.tax_payable_all_years += Number(r.tax_payable) || 0;
    }
    log(`  ${byAbn.size} unique ABNs`);

    // Phase 2: Match ABNs against gs_entities
    log('\nPhase 2: Matching against gs_entities...');
    const abns = [...byAbn.keys()];
    let matched = 0;
    let unmatched = 0;
    const relationships = [];

    const BATCH = 100;
    for (let i = 0; i < abns.length; i += BATCH) {
      const batch = abns.slice(i, i + BATCH);
      const { data: entities } = await db
        .from('gs_entities')
        .select('id, gs_id, canonical_name, abn')
        .in('abn', batch);

      if (entities) {
        for (const entity of entities) {
          const ato = byAbn.get(entity.abn);
          if (!ato) continue;
          matched++;
          relationships.push({
            entity_id: entity.id,
            gs_id: entity.gs_id,
            entity_name: entity.canonical_name,
            ato_name: ato.entity_name,
            abn: entity.abn,
            total_income: ato.total_income_latest,
            taxable_income: ato.taxable_income_latest,
            tax_payable: ato.tax_payable_latest,
            effective_tax_rate: ato.effective_tax_rate,
            years_reported: ato.years_reported.length,
            latest_year: ato.latest_year,
            total_income_all_years: ato.total_income_all_years,
            tax_payable_all_years: ato.tax_payable_all_years,
          });
        }
      }

      unmatched += batch.length - (entities?.length || 0);
      if ((i + BATCH) % 500 === 0 || i + BATCH >= abns.length) {
        log(`  ${Math.min(i + BATCH, abns.length)}/${abns.length} ABNs checked | ${matched} matched`);
      }
    }

    log(`\n  Matched: ${matched}/${byAbn.size} (${(matched/byAbn.size*100).toFixed(1)}%)`);
    log(`  Unmatched: ${unmatched}`);

    // Phase 3: Find the juicy stories — entities that get gov money AND pay low tax
    log('\nPhase 3: Finding cross-system stories...');

    // Get contract values for matched entities
    const matchedIds = relationships.map(r => r.entity_id);
    const contractStories = [];

    for (let i = 0; i < matchedIds.length; i += BATCH) {
      const batch = matchedIds.slice(i, i + BATCH);
      const { data: contracts } = await db
        .from('gs_relationships')
        .select('target_entity_id, amount')
        .in('target_entity_id', batch)
        .eq('relationship_type', 'contract');

      if (contracts) {
        const contractTotals = new Map();
        for (const c of contracts) {
          const prev = contractTotals.get(c.target_entity_id) || 0;
          contractTotals.set(c.target_entity_id, prev + (Number(c.amount) || 0));
        }
        for (const [entityId, totalContracts] of contractTotals) {
          const rel = relationships.find(r => r.entity_id === entityId);
          if (rel) {
            rel.total_contracts = totalContracts;
          }
        }
      }
    }

    // Identify stories: high contracts, low tax
    const stories = relationships
      .filter(r => r.total_contracts > 1000000 && r.effective_tax_rate < 5)
      .sort((a, b) => (b.total_contracts || 0) - (a.total_contracts || 0));

    if (stories.length > 0) {
      log(`\n  Top entities: high gov contracts + low effective tax rate:`);
      for (const s of stories.slice(0, 15)) {
        const contracts = (s.total_contracts / 1e6).toFixed(1);
        const income = (s.total_income / 1e6).toFixed(1);
        log(`    ${s.entity_name}: $${contracts}M contracts, $${income}M income, ${s.effective_tax_rate.toFixed(1)}% tax rate`);
      }
    }

    // Phase 4: Insert entity_identifier records to link ATO data
    if (!DRY_RUN) {
      log('\nPhase 4: Inserting entity identifiers...');

      const UPSERT_BATCH = 50;
      let inserted = 0;

      for (let i = 0; i < relationships.length; i += UPSERT_BATCH) {
        const batch = relationships.slice(i, i + UPSERT_BATCH).map(r => ({
          entity_id: r.entity_id,
          identifier_type: 'ato_tax_transparency',
          identifier_value: r.abn,
          source: 'ato_tax_transparency',
          properties: {
            total_income: r.total_income,
            taxable_income: r.taxable_income,
            tax_payable: r.tax_payable,
            effective_tax_rate: r.effective_tax_rate,
            years_reported: r.years_reported,
            latest_year: r.latest_year,
          },
        }));

        const { error } = await db
          .from('entity_identifiers')
          .upsert(batch, {
            onConflict: 'entity_id,identifier_type,identifier_value',
            ignoreDuplicates: true,
          });

        if (error) {
          // Individual fallback
          for (const row of batch) {
            const { error: e2 } = await db.from('entity_identifiers').insert(row);
            if (!e2) inserted++;
          }
        } else {
          inserted += batch.length;
        }
      }

      log(`  ${inserted} entity identifiers inserted`);
    }

    // Summary
    log('\n═══ Summary ═══');
    log(`  ATO records: ${atoRecords.length} (${byAbn.size} unique ABNs)`);
    log(`  Matched to entities: ${matched} (${(matched/byAbn.size*100).toFixed(1)}%)`);
    log(`  Cross-system stories (>$1M contracts, <5% tax): ${stories.length}`);
    if (DRY_RUN) log('  [DRY RUN — no changes made]');

    await logComplete(db, runId, {
      items_found: byAbn.size,
      items_new: matched,
    });

  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
