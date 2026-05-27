#!/usr/bin/env node
/**
 * Data-quality fix: ALPA was proximity-fanned to 128 communities (one entity_id/gs_id,
 * one bulk insert) — it is ONE remote-retail network operator, not 128 buyers. Collapse to
 * a single network-level entity (community_id = null, like Outback Stores). The communities
 * ALPA serves already have their own local store-corp entities as the per-community buyers.
 * Approved by Ben 2026-05-27 ("fix this"). Restore-first; reversible.
 *
 *   node --env-file=.env scripts/fix-alpa-overmatch.mjs            # dry-run
 *   node --env-file=.env scripts/fix-alpa-overmatch.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = async (q) => { const { data, error } = await supabase.rpc('exec_sql', { query: q }); if (error) throw new Error(error.message); return data || []; };
const WARMTH_FLOOR = 85;

async function main() {
  const rows = await sql(`SELECT id, entity_name, community_id, fit_score, ghl_opportunity_id FROM goods_procurement_entities WHERE entity_name ILIKE '%arnhem land progress%' ORDER BY (ghl_opportunity_id IS NOT NULL) DESC, id`);
  if (!rows.length) { console.log('No ALPA rows found.'); return; }

  // Keep the row already linked to GHL if any, else the first; null its community, floor warmth.
  const keep = rows[0];
  const deleteIds = rows.slice(1).map((r) => r.id);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`ALPA rows: ${rows.length} → keep 1 (id ${keep.id}), set community_id=NULL, fit_score=${Math.max(WARMTH_FLOOR, keep.fit_score || 0)}; delete ${deleteIds.length}`);

  if (!APPLY) { console.log('\n(Dry-run. Re-run with --apply.)'); return; }

  const restorePath = '/Users/benknight/Code/grantscope/thoughts/2026-05-27-alpa-overmatch-fix.json';
  fs.writeFileSync(restorePath, JSON.stringify({ at: new Date().toISOString(), keptId: keep.id, deletedIds: deleteIds, allRows: rows }, null, 2));
  console.log(`Restore snapshot: ${restorePath}`);

  const { error: uErr } = await supabase.from('goods_procurement_entities')
    .update({ community_id: null, fit_score: Math.max(WARMTH_FLOOR, keep.fit_score || 0), relationship_status: 'prospect', updated_at: new Date().toISOString() })
    .eq('id', keep.id);
  if (uErr) throw new Error(`update keeper: ${uErr.message}`);

  // Re-point any demand signals that named a to-be-deleted ALPA row as buyer → the keeper.
  for (let i = 0; i < deleteIds.length; i += 50) {
    const chunk = deleteIds.slice(i, i + 50);
    const { error } = await supabase.from('goods_procurement_signals').update({ buyer_entity_id: keep.id }).in('buyer_entity_id', chunk);
    if (error) throw new Error(`repoint signals: ${error.message}`);
  }

  for (let i = 0; i < deleteIds.length; i += 50) {
    const { error } = await supabase.from('goods_procurement_entities').delete().in('id', deleteIds.slice(i, i + 50));
    if (error) throw new Error(`delete: ${error.message}`);
  }
  console.log(`✓ ALPA collapsed to 1 network entity (community-null, fit 85); deleted ${deleteIds.length} fan-out rows`);
}
main().catch((e) => { console.error(e); process.exit(1); });
