#!/usr/bin/env node
/**
 * build-entity-graph.mjs
 *
 * Populates gs_entities + gs_relationships from all source tables.
 * Uses bulk SQL operations for performance (minutes not hours).
 *
 * Usage:
 *   node scripts/build-entity-graph.mjs                    # full build
 *   node scripts/build-entity-graph.mjs --phase=entities   # entities only
 *   node scripts/build-entity-graph.mjs --phase=donations  # donations only
 *   node scripts/build-entity-graph.mjs --phase=contracts  # contracts only
 *   node scripts/build-entity-graph.mjs --phase=links      # cross-registry links
 *   node scripts/build-entity-graph.mjs --phase=refresh    # refresh materialized views
 *   node scripts/build-entity-graph.mjs --dry-run          # count only, no writes
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const phase = args.find(a => a.startsWith('--phase='))?.split('=')[1] || 'all';
const dryRun = args.includes('--dry-run');

function log(msg) {
  console.log(`[entity-graph] ${msg}`);
}

/** Execute raw SQL via Supabase REST API */
async function execSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  // If exec_sql RPC doesn't exist, fall back to pg_net or just report
  if (!res.ok) {
    const text = await res.text();
    // Try the /sql endpoint (Supabase management API)
    throw new Error(`SQL exec failed: ${text}`);
  }
  return res.json();
}

/** Execute raw SQL via Supabase SQL endpoint (management API) */
async function execSqlDirect(sql) {
  // Use the PostgREST /rpc endpoint or fall back
  try {
    return await execSql(sql);
  } catch {
    // Fall back: execute via pg functions
    log('  (exec_sql RPC not available — using client workaround)');
    return null;
  }
}

function makeGsId({ abn, acn, icn, asx_code, buyer_id, name }) {
  if (abn) return 'AU-ABN-' + abn.replace(/\s/g, '');
  if (acn) return 'AU-ACN-' + acn.replace(/\s/g, '');
  if (icn) return 'AU-ORIC-' + icn;
  if (asx_code) return 'AU-ASX-' + asx_code.toUpperCase();
  if (buyer_id) return 'AU-GOV-' + buyer_id;
  if (name) {
    let hash = 0;
    const upper = name.toUpperCase().trim();
    for (let i = 0; i < upper.length; i++) {
      hash = ((hash << 5) - hash) + upper.charCodeAt(i);
      hash |= 0;
    }
    return 'AU-NAME-' + Math.abs(hash).toString(36);
  }
  return 'AU-UNK-' + Date.now().toString(36);
}

/** Load all gs_id → UUID mappings into memory. Advances by actual row count to handle Supabase max_rows. */
async function loadEntityIndex() {
  const map = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('id, gs_id')
      .range(offset, offset + 999);
    if (error) { log(`  ERROR loading index: ${error.message}`); break; }
    if (!data?.length) break;
    for (const e of data) map.set(e.gs_id, e.id);
    offset += data.length;
    if (data.length < 1000) break; // last page
  }
  return map;
}

// ─── Phase 1: Build entity registry ──────────────────────────────────────────

async function buildEntities() {
  log('Phase 1: Building entity registry...');
  const stats = { charities: 0, foundations: 0, oric: 0, govt: 0, suppliers: 0, donors: 0, parties: 0, ato: 0, asx: 0, social: 0, skipped: 0 };
  const batchSize = 1000;

  // 1a. ACNC Charities (64K) — the backbone
  log('  Loading ACNC charities...');
  let offset = 0;
  while (true) {
    const { data: charities, error } = await supabase
      .from('acnc_charities')
      .select('abn, name, is_foundation, state, postcode')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!charities?.length) break;

    const entities = charities
      .filter(c => c.abn)
      .map(c => ({
        entity_type: c.is_foundation ? 'foundation' : 'charity',
        canonical_name: c.name,
        abn: c.abn,
        gs_id: makeGsId({ abn: c.abn }),
        state: c.state,
        postcode: c.postcode,
        source_datasets: ['acnc'],
        source_count: 1,
        confidence: 'registry',
      }));

    if (!dryRun && entities.length) {
      const { error: upsertErr } = await supabase
        .from('gs_entities')
        .upsert(entities, { onConflict: 'gs_id', ignoreDuplicates: false });
      if (upsertErr) log(`  Upsert error: ${upsertErr.message || JSON.stringify(upsertErr)}`);
    }
    stats.charities += entities.length;
    offset += batchSize;
    if (offset % 10000 === 0) log(`  ACNC progress: ${offset} processed`);
  }
  log(`  ACNC charities: ${stats.charities} entities`);

  // 1b. Foundations — BULK UPDATE via batched upsert (not per-row!)
  log('  Enriching foundations (bulk)...');
  offset = 0;
  while (true) {
    const { data: foundations, error } = await supabase
      .from('foundations')
      .select('acnc_abn, name, website, description, thematic_focus, geographic_focus')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!foundations?.length) break;

    if (!dryRun) {
      // Batch: build upsert array with foundation-enriched data
      const updates = foundations
        .filter(f => f.acnc_abn)
        .map(f => ({
          gs_id: makeGsId({ abn: f.acnc_abn }),
          canonical_name: f.name,
          abn: f.acnc_abn,
          entity_type: 'foundation',
          description: f.description || undefined,
          website: f.website || undefined,
          sector: f.thematic_focus?.[0] || null,
          source_datasets: ['acnc', 'foundations'],
          source_count: 2,
          confidence: 'registry',
        }));

      // Upsert merges with existing ACNC records via gs_id conflict
      for (let i = 0; i < updates.length; i += 500) {
        const chunk = updates.slice(i, i + 500);
        const { error: uErr } = await supabase
          .from('gs_entities')
          .upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: false });
        if (uErr) log(`  Foundation upsert error: ${uErr.message}`);
      }
    }
    stats.foundations += foundations.length;
    offset += batchSize;
    if (offset % 5000 === 0) log(`  Foundation progress: ${offset} processed`);
  }
  log(`  Foundations enriched: ${stats.foundations}`);

  // 1c. ORIC Corporations — batch upsert
  log('  Loading ORIC corporations...');
  offset = 0;
  while (true) {
    const { data: corps, error } = await supabase
      .from('oric_corporations')
      .select('icn, abn, name, state, postcode, enriched_description, status')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!corps?.length) break;

    if (!dryRun) {
      // Deduplicate within batch — multiple ORIC corps can share ABN
      const deduped = new Map();
      for (const c of corps) {
        if (!c.abn && !c.icn) continue;
        const gsId = makeGsId({ abn: c.abn, icn: c.icn });
        if (!deduped.has(gsId)) {
          deduped.set(gsId, {
            entity_type: 'indigenous_corp',
            canonical_name: c.name,
            abn: c.abn || null,
            gs_id: gsId,
            state: c.state,
            postcode: c.postcode,
            description: c.enriched_description || null,
            source_datasets: c.abn ? ['acnc', 'oric'] : ['oric'],
            source_count: c.abn ? 2 : 1,
            confidence: 'registry',
          });
        }
      }
      const entities = Array.from(deduped.values());

      for (let i = 0; i < entities.length; i += 500) {
        const chunk = entities.slice(i, i + 500);
        const { error: uErr } = await supabase
          .from('gs_entities')
          .upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: false });
        if (uErr) log(`  ORIC upsert error: ${uErr.message}`);
      }
    }
    stats.oric += corps.length;
    offset += batchSize;
  }
  log(`  ORIC corporations: ${stats.oric}`);

  // 1d. Government bodies (from AusTender buyers) — batch upsert
  log('  Loading government bodies...');
  const { data: buyers } = await supabase
    .from('austender_contracts')
    .select('buyer_name, buyer_id')
    .not('buyer_name', 'is', null);

  const uniqueBuyers = new Map();
  for (const b of (buyers || [])) {
    if (b.buyer_id && !uniqueBuyers.has(b.buyer_id)) {
      uniqueBuyers.set(b.buyer_id, b.buyer_name);
    }
  }

  if (!dryRun) {
    const govEntities = Array.from(uniqueBuyers.entries()).map(([buyerId, name]) => ({
      entity_type: 'government_body',
      canonical_name: name,
      gs_id: makeGsId({ buyer_id: buyerId }),
      source_datasets: ['austender'],
      source_count: 1,
      confidence: 'registry',
    }));

    for (let i = 0; i < govEntities.length; i += 500) {
      const chunk = govEntities.slice(i, i + 500);
      await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
  }
  stats.govt = uniqueBuyers.size;
  log(`  Government bodies: ${stats.govt}`);

  // 1e. AusTender suppliers (by ABN) — batch upsert
  log('  Loading AusTender suppliers...');
  const { data: suppliers } = await supabase
    .from('austender_contracts')
    .select('supplier_name, supplier_abn, supplier_entity_type')
    .not('supplier_abn', 'is', null);

  const uniqueSuppliers = new Map();
  for (const s of (suppliers || [])) {
    if (s.supplier_abn && !uniqueSuppliers.has(s.supplier_abn)) {
      uniqueSuppliers.set(s.supplier_abn, { name: s.supplier_name, type: s.supplier_entity_type });
    }
  }

  if (!dryRun) {
    const supplierEntities = Array.from(uniqueSuppliers.entries()).map(([abn, info]) => ({
      entity_type: info.type === 'Charity' ? 'charity' : (info.type === 'Indigenous Corp' ? 'indigenous_corp' : 'company'),
      canonical_name: info.name,
      abn,
      gs_id: makeGsId({ abn }),
      source_datasets: ['austender'],
      source_count: 1,
      confidence: 'registry',
    }));

    for (let i = 0; i < supplierEntities.length; i += 500) {
      const chunk = supplierEntities.slice(i, i + 500);
      await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
  }
  stats.suppliers = uniqueSuppliers.size;
  log(`  AusTender suppliers (unique ABNs): ${stats.suppliers}`);

  // 1f. Political parties — batch upsert
  log('  Loading political parties...');
  const { data: parties } = await supabase
    .from('political_donations')
    .select('donation_to')
    .not('donation_to', 'is', null);

  const uniqueParties = new Set();
  for (const p of (parties || [])) {
    if (p.donation_to) uniqueParties.add(p.donation_to);
  }

  if (!dryRun) {
    const partyEntities = Array.from(uniqueParties).map(name => ({
      entity_type: 'political_party',
      canonical_name: name,
      gs_id: makeGsId({ name }),
      source_datasets: ['aec_donations'],
      source_count: 1,
      confidence: 'registry',
    }));

    for (let i = 0; i < partyEntities.length; i += 500) {
      const chunk = partyEntities.slice(i, i + 500);
      await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
  }
  stats.parties = uniqueParties.size;
  log(`  Political parties: ${stats.parties}`);

  // 1g. Donors (from donor_entity_matches) — batch upsert
  log('  Loading matched donors...');
  offset = 0;
  while (true) {
    const { data: donors, error } = await supabase
      .from('donor_entity_matches')
      .select('donor_name, matched_abn, matched_entity_type, match_confidence')
      .not('matched_abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!donors?.length) break;

    if (!dryRun) {
      const donorEntities = donors.map(d => ({
        entity_type: d.matched_entity_type === 'acnc' ? 'charity' : 'company',
        canonical_name: d.donor_name,
        abn: d.matched_abn,
        gs_id: makeGsId({ abn: d.matched_abn }),
        source_datasets: ['aec_donations'],
        source_count: 1,
        confidence: d.match_confidence >= 0.9 ? 'verified' : 'reported',
      }));

      for (let i = 0; i < donorEntities.length; i += 500) {
        const chunk = donorEntities.slice(i, i + 500);
        await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }
    }
    stats.donors += donors.length;
    offset += batchSize;
  }
  log(`  Matched donors: ${stats.donors}`);

  // 1h. ATO Tax Transparency — batch upsert with financial data
  log('  Linking ATO tax data...');
  offset = 0;
  while (true) {
    const { data: taxRecords, error } = await supabase
      .from('ato_tax_transparency')
      .select('abn, entity_name, industry, total_income, taxable_income, tax_payable, report_year')
      .not('abn', 'is', null)
      .order('report_year', { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!taxRecords?.length) break;

    // Deduplicate by ABN (keep latest year)
    const byAbn = new Map();
    for (const t of taxRecords) {
      if (!byAbn.has(t.abn)) byAbn.set(t.abn, t);
    }

    if (!dryRun) {
      const atoEntities = Array.from(byAbn.values()).map(t => ({
        entity_type: 'company',
        canonical_name: t.entity_name,
        abn: t.abn,
        gs_id: makeGsId({ abn: t.abn }),
        sector: t.industry || null,
        latest_revenue: t.total_income,
        latest_tax_payable: t.tax_payable,
        financial_year: t.report_year?.toString(),
        source_datasets: ['ato_tax'],
        source_count: 1,
        confidence: 'registry',
      }));

      for (let i = 0; i < atoEntities.length; i += 500) {
        const chunk = atoEntities.slice(i, i + 500);
        // ignoreDuplicates: true — don't overwrite entities already created from ACNC/foundations
        // We'll do a separate bulk update for financial data on existing entities
        await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }

      // Bulk update financial data for ALL ATO records (even pre-existing entities)
      // Build a VALUES list for a single UPDATE ... FROM
      const atoUpdates = Array.from(byAbn.values()).map(t => ({
        gs_id: makeGsId({ abn: t.abn }),
        latest_revenue: t.total_income,
        latest_tax_payable: t.tax_payable,
        financial_year: t.report_year?.toString(),
        sector: t.industry || null,
      }));

      // Batch update: for each ATO entity, update financial fields
      for (let i = 0; i < atoUpdates.length; i += 100) {
        const chunk = atoUpdates.slice(i, i + 100);
        const promises = chunk.map(u =>
          supabase.from('gs_entities').update({
            latest_revenue: u.latest_revenue,
            latest_tax_payable: u.latest_tax_payable,
            financial_year: u.financial_year,
          }).eq('gs_id', u.gs_id)
        );
        await Promise.all(promises);
      }
    }
    stats.ato += byAbn.size;
    offset += batchSize;
    if (offset % 5000 === 0) log(`  ATO progress: ${offset} processed`);
  }
  log(`  ATO tax records linked: ${stats.ato}`);

  // 1i. ASX Companies — batch upsert
  log('  Loading ASX companies...');
  const { data: asxCompanies } = await supabase
    .from('asx_companies')
    .select('asx_code, company_name, abn, gics_industry_group');

  if (!dryRun && asxCompanies) {
    const asxEntities = asxCompanies
      .filter(c => c.abn)
      .map(c => ({
        entity_type: 'company',
        canonical_name: c.company_name,
        abn: c.abn,
        gs_id: makeGsId({ abn: c.abn }),
        sector: c.gics_industry_group || null,
        source_datasets: ['asx'],
        source_count: 1,
        confidence: 'registry',
      }));

    for (let i = 0; i < asxEntities.length; i += 500) {
      const chunk = asxEntities.slice(i, i + 500);
      await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
    stats.asx = asxEntities.length;
  }
  log(`  ASX companies: ${stats.asx}`);

  // 1j. Social Enterprises — batch upsert
  log('  Loading social enterprises...');
  offset = 0;
  while (true) {
    const { data: ses, error } = await supabase
      .from('social_enterprises')
      .select('abn, name, state, sector, website, description')
      .not('abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!ses?.length) break;

    if (!dryRun) {
      const seEntities = ses.map(s => ({
        entity_type: 'social_enterprise',
        canonical_name: s.name,
        abn: s.abn,
        gs_id: makeGsId({ abn: s.abn }),
        state: s.state,
        website: s.website,
        description: s.description,
        source_datasets: ['social_enterprises'],
        source_count: 1,
        confidence: 'registry',
      }));

      for (let i = 0; i < seEntities.length; i += 500) {
        const chunk = seEntities.slice(i, i + 500);
        await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }
    }
    stats.social += ses.length;
    offset += batchSize;
  }
  log(`  Social enterprises: ${stats.social}`);

  // 1k. JusticeHub Organizations — batch upsert (cross-system bridge)
  log('  Loading JusticeHub organizations...');
  let jhCount = 0;
  offset = 0;
  while (true) {
    const { data: jhOrgs, error } = await supabase
      .from('organizations')
      .select('id, name, abn, type, state, postcode')
      .not('abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!jhOrgs?.length) break;

    if (!dryRun) {
      const jhEntities = jhOrgs.map(o => ({
        entity_type: o.type === 'government' ? 'government_body' : (o.type === 'indigenous' ? 'indigenous_corp' : 'charity'),
        canonical_name: o.name,
        abn: o.abn,
        gs_id: makeGsId({ abn: o.abn }),
        state: o.state,
        postcode: o.postcode,
        source_datasets: ['justicehub'],
        source_count: 1,
        confidence: 'registry',
      }));

      for (let i = 0; i < jhEntities.length; i += 500) {
        const chunk = jhEntities.slice(i, i + 500);
        await supabase.from('gs_entities').upsert(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }

      // Auto-link: set gs_entity_id on JH organizations
      for (const o of jhOrgs) {
        const gsId = makeGsId({ abn: o.abn });
        const { data: entity } = await supabase
          .from('gs_entities')
          .select('id')
          .eq('gs_id', gsId)
          .single();
        if (entity) {
          await supabase
            .from('organizations')
            .update({ gs_entity_id: entity.id })
            .eq('id', o.id);
        }
      }
    }
    jhCount += jhOrgs.length;
    offset += batchSize;
  }
  log(`  JusticeHub organizations: ${jhCount}`);

  log(`\nEntity registry complete:`);
  log(`  ACNC charities: ${stats.charities}`);
  log(`  Foundations enriched: ${stats.foundations}`);
  log(`  ORIC corporations: ${stats.oric}`);
  log(`  Government bodies: ${stats.govt}`);
  log(`  AusTender suppliers: ${stats.suppliers}`);
  log(`  Political parties: ${stats.parties}`);
  log(`  Matched donors: ${stats.donors}`);
  log(`  ATO tax records: ${stats.ato}`);
  log(`  ASX companies: ${stats.asx}`);
  log(`  Social enterprises: ${stats.social}`);
  log(`  JusticeHub orgs: ${jhCount}`);
  log(`  Skipped: ${stats.skipped}`);
  return stats;
}

// ─── Phase 2a: Political donations → relationships ──────────────────────────

async function buildDonationRelationships() {
  log('\nPhase 2a: Political donation relationships...');
  let created = 0, skipped = 0;

  // Pre-load ALL entity gs_id → id mappings into memory (faster than per-row lookups)
  log('  Loading entity ID index...');
  const entityIdMap = await loadEntityIndex();
  log(`  Entity index loaded: ${entityIdMap.size} entries`);

  // Get all matched donors with ABNs
  const { data: matches } = await supabase
    .from('donor_entity_matches')
    .select('donor_name, donor_name_normalized, matched_abn')
    .not('matched_abn', 'is', null);

  if (!matches?.length) { log('  No donor matches found'); return; }

  // Build lookup: normalized donor name → ABN
  const donorAbnMap = new Map();
  for (const m of matches) {
    donorAbnMap.set(m.donor_name.toUpperCase().trim(), m.matched_abn);
    if (m.donor_name_normalized) {
      donorAbnMap.set(m.donor_name_normalized.toUpperCase().trim(), m.matched_abn);
    }
  }
  log(`  ${donorAbnMap.size} donor name→ABN mappings loaded`);

  // Process donations in batches
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data: donations, error } = await supabase
      .from('political_donations')
      .select('id, donor_name, donor_abn, donation_to, amount, financial_year, donation_date, return_type, receipt_type')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!donations?.length) break;

    const relationships = [];
    for (const d of donations) {
      // Find donor entity via in-memory index
      const donorAbn = d.donor_abn || donorAbnMap.get(d.donor_name?.toUpperCase()?.trim());
      if (!donorAbn) { skipped++; continue; }

      const donorGsId = makeGsId({ abn: donorAbn });
      const donorEntityId = entityIdMap.get(donorGsId);
      if (!donorEntityId) { skipped++; continue; }

      // Find party entity via in-memory index
      const partyGsId = makeGsId({ name: d.donation_to });
      const partyEntityId = entityIdMap.get(partyGsId);
      if (!partyEntityId) { skipped++; continue; }

      const year = d.financial_year ? parseInt(d.financial_year.split('-')[0]) : null;

      relationships.push({
        source_entity_id: donorEntityId,
        target_entity_id: partyEntityId,
        relationship_type: 'donation',
        amount: d.amount,
        year,
        dataset: 'aec_donations',
        source_record_id: d.id?.toString(),
        confidence: 'registry',
        properties: {
          financial_year: d.financial_year,
          return_type: d.return_type,
          receipt_type: d.receipt_type,
          donation_date: d.donation_date,
        },
      });
    }

    if (!dryRun && relationships.length) {
      for (let i = 0; i < relationships.length; i += 200) {
        const chunk = relationships.slice(i, i + 200);
        const { error: insertErr } = await supabase
          .from('gs_relationships')
          .insert(chunk);
        if (insertErr && !insertErr.message?.includes('duplicate')) {
          log(`  Insert error: ${insertErr.message}`);
        }
      }
    }
    created += relationships.length;
    offset += batchSize;
    if (offset % 10000 === 0) log(`  Donations progress: ${offset} processed, ${created} relationships, ${skipped} skipped`);
  }

  log(`  Donation relationships: ${created} created, ${skipped} skipped (no ABN match)`);
}

// ─── Phase 2b: AusTender contracts → relationships ──────────────────────────

async function buildContractRelationships() {
  log('\nPhase 2b: Contract relationships...');
  let created = 0, skipped = 0;

  // Pre-load entity index
  log('  Loading entity ID index...');
  const entityIdMap = await loadEntityIndex();
  log(`  Entity index loaded: ${entityIdMap.size} entries`);

  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data: contracts, error } = await supabase
      .from('austender_contracts')
      .select('id, ocid, buyer_name, buyer_id, supplier_name, supplier_abn, contract_value, category, procurement_method, contract_start, contract_end, date_published')
      .not('supplier_abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!contracts?.length) break;

    const relationships = [];
    for (const c of contracts) {
      const buyerGsId = makeGsId({ buyer_id: c.buyer_id || c.buyer_name });
      const supplierGsId = makeGsId({ abn: c.supplier_abn });

      const buyerId = entityIdMap.get(buyerGsId);
      const supplierId = entityIdMap.get(supplierGsId);
      if (!buyerId || !supplierId) { skipped++; continue; }

      const year = c.contract_start ? new Date(c.contract_start).getFullYear()
        : c.date_published ? new Date(c.date_published).getFullYear()
        : null;

      relationships.push({
        source_entity_id: buyerId,
        target_entity_id: supplierId,
        relationship_type: 'contract',
        amount: c.contract_value,
        year,
        start_date: c.contract_start,
        end_date: c.contract_end,
        dataset: 'austender',
        source_record_id: c.ocid || c.id?.toString(),
        confidence: 'registry',
        properties: {
          category: c.category,
          procurement_method: c.procurement_method,
          buyer_name: c.buyer_name,
          supplier_name: c.supplier_name,
        },
      });
    }

    if (!dryRun && relationships.length) {
      for (let i = 0; i < relationships.length; i += 200) {
        const chunk = relationships.slice(i, i + 200);
        const { error: insertErr } = await supabase
          .from('gs_relationships')
          .insert(chunk);
        if (insertErr && !insertErr.message?.includes('duplicate')) {
          log(`  Insert error: ${insertErr.message}`);
        }
      }
    }
    created += relationships.length;
    offset += batchSize;
    if (offset % 10000 === 0) log(`  Contracts progress: ${offset} processed, ${created} relationships`);
  }

  log(`  Contract relationships: ${created} created, ${skipped} skipped`);
}

// ─── Phase 2b2: Grant opportunities → relationships ─────────────────────────

async function buildGrantRelationships() {
  log('\nPhase 2b2: Grant relationships...');
  let created = 0, skipped = 0;

  // Pre-load entity index
  log('  Loading entity ID index...');
  const entityIdMap = await loadEntityIndex();
  log(`  Entity index loaded: ${entityIdMap.size} entries`);

  // Get grants that have a foundation_id, join to get foundation ABN
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data: grants, error } = await supabase
      .from('grant_opportunities')
      .select('id, name, foundation_id, amount_min, amount_max, closes_at, categories, provider')
      .not('foundation_id', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!grants?.length) break;

    // Get foundation ABNs for this batch
    const foundationIds = [...new Set(grants.map(g => g.foundation_id))];
    const { data: foundations } = await supabase
      .from('foundations')
      .select('id, acnc_abn')
      .in('id', foundationIds);

    const foundationAbnMap = new Map();
    for (const f of (foundations || [])) {
      if (f.acnc_abn) foundationAbnMap.set(f.id, f.acnc_abn);
    }

    const relationships = [];
    for (const g of grants) {
      const foundationAbn = foundationAbnMap.get(g.foundation_id);
      if (!foundationAbn) { skipped++; continue; }

      const foundationGsId = makeGsId({ abn: foundationAbn });
      const foundationEntityId = entityIdMap.get(foundationGsId);
      if (!foundationEntityId) { skipped++; continue; }

      relationships.push({
        source_entity_id: foundationEntityId,
        target_entity_id: foundationEntityId, // self-ref for now (foundation offers grant)
        relationship_type: 'grant',
        amount: g.amount_max || g.amount_min || null,
        dataset: 'grant_opportunities',
        source_record_id: g.id,
        confidence: 'registry',
        properties: {
          grant_name: g.name,
          categories: g.categories?.join(', '),
          closes_at: g.closes_at,
          provider: g.provider,
        },
      });
    }

    if (!dryRun && relationships.length) {
      for (let i = 0; i < relationships.length; i += 200) {
        const chunk = relationships.slice(i, i + 200);
        const { error: insertErr } = await supabase
          .from('gs_relationships')
          .insert(chunk);
        if (insertErr && !insertErr.message?.includes('duplicate')) {
          log(`  Insert error: ${insertErr.message}`);
        }
      }
    }
    created += relationships.length;
    offset += batchSize;
  }

  log(`  Grant relationships: ${created} created, ${skipped} skipped`);
}

// ─── Phase 2c: Cross-registry links ──────────────────────────────────────────

async function buildCrossRegistryLinks() {
  log('\nPhase 2c: Cross-registry links...');
  let created = 0;

  // Pre-load entity index
  const entityIdMap = await loadEntityIndex();

  // Foundation → parent company links
  log('  Building foundation → parent company links...');
  const { data: foundationsWithParent } = await supabase
    .from('foundations')
    .select('acnc_abn, name, parent_company, asx_code')
    .not('parent_company', 'is', null);

  if (foundationsWithParent) {
    // Build name→id lookup for parent matching
    const nameIdMap = new Map();
    let off2 = 0;
    while (true) {
      const { data } = await supabase
        .from('gs_entities')
        .select('id, canonical_name')
        .range(off2, off2 + 999);
      if (!data?.length) break;
      for (const e of data) nameIdMap.set(e.canonical_name.toUpperCase(), e.id);
      off2 += data.length;
      if (data.length < 1000) break;
    }

    const linkBatch = [];
    for (const f of foundationsWithParent) {
      if (!f.acnc_abn || !f.parent_company) continue;

      const foundationGsId = makeGsId({ abn: f.acnc_abn });
      const foundationEntityId = entityIdMap.get(foundationGsId);
      if (!foundationEntityId) continue;

      // Try exact name match first, then partial
      const parentId = nameIdMap.get(f.parent_company.toUpperCase());
      if (parentId) {
        linkBatch.push({
          source_entity_id: parentId,
          target_entity_id: foundationEntityId,
          relationship_type: 'subsidiary_of',
          dataset: 'foundations',
          source_record_id: f.acnc_abn,
          confidence: 'reported',
          properties: { parent_company: f.parent_company },
        });
      }
    }

    if (!dryRun && linkBatch.length) {
      for (let i = 0; i < linkBatch.length; i += 200) {
        const chunk = linkBatch.slice(i, i + 200);
        await supabase.from('gs_relationships').insert(chunk);
      }
      created += linkBatch.length;
    }
  }

  log(`  Cross-registry links: ${created} created`);
}

// ─── Phase 3: Refresh materialised views ─────────────────────────────────────

async function refreshViews() {
  log('\nPhase 3: Refreshing materialised views...');

  const views = ['mv_gs_donor_contractors', 'mv_gs_entity_stats'];

  for (const view of views) {
    log(`  Refreshing ${view}...`);
    try {
      await execSql(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      log(`  ${view} refreshed`);
    } catch {
      try {
        await execSql(`REFRESH MATERIALIZED VIEW ${view}`);
        log(`  ${view} refreshed (non-concurrent)`);
      } catch (e) {
        log(`  Warning: ${view} refresh failed — ${e.message}`);
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting entity graph build (phase=${phase}, dry-run=${dryRun})`);
  const startTime = Date.now();

  if (phase === 'all' || phase === 'entities') {
    await buildEntities();
  }

  if (phase === 'all' || phase === 'donations') {
    await buildDonationRelationships();
  }

  if (phase === 'all' || phase === 'contracts') {
    await buildContractRelationships();
  }

  if (phase === 'all' || phase === 'grants') {
    await buildGrantRelationships();
  }

  if (phase === 'all' || phase === 'links') {
    await buildCrossRegistryLinks();
  }

  if (phase === 'all' || phase === 'refresh') {
    await refreshViews();
  }

  // Final stats
  const { count: entityCount } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true });
  const { count: relCount } = await supabase.from('gs_relationships').select('*', { count: 'exact', head: true });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\n════════════════════════════════════════`);
  log(`Entity graph build complete in ${elapsed}s`);
  log(`  Entities: ${entityCount ?? '?'}`);
  log(`  Relationships: ${relCount ?? '?'}`);
  log(`════════════════════════════════════════`);
}

main().catch(err => {
  console.error('[entity-graph] Fatal error:', err);
  process.exit(1);
});
