#!/usr/bin/env node
/**
 * Task 2: push the top-25 (by fit_score) scored buyers into the GHL "Goods — Demand Register"
 * at the "Buyer Matched" stage. Approved by Ben 2026-05-27.
 *
 * Per the Goods CRM operating model: scored-but-uncontacted entities = Demand-Register signal
 * (NOT the Buyer Pipeline, which is contacted commercial deals).
 *
 *   node --env-file=.env scripts/push-goods-top25-to-demand-register.mjs            # dry-run
 *   node --env-file=.env scripts/push-goods-top25-to-demand-register.mjs --apply    # writes
 *   ... --limit 25
 *
 * Idempotent: dedups distinct entities (table has dup rows), skips entities already pushed
 * (ghl_opportunity_id set), upserts contacts by deterministic email, writes ghl_* link back.
 * Mirrors apps/web/src/lib/services/goods-buyer-ghl.ts patterns.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const li = process.argv.indexOf('--limit');
const LIMIT = li >= 0 ? parseInt(process.argv[li + 1], 10) : 25;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const GHL = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOC = process.env.GHL_LOCATION_ID;
const DEMAND_PIPELINE = 'UQsrmuqzxMSdCTklxEcG';
const BUYER_MATCHED_STAGE = '02502aa3-9a0d-4ddd-b1f0-c1e836838426';

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data || [];
}
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Version: '2021-07-28' };
const slug = (s, n) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);
// Deterministic email for idempotent contact upsert. Reproduces the original
// slug(entity,60)-slug(community,40) EXACTLY for local parts <=64 (so run-1 contacts
// match), and only truncates the long ones (which failed RFC 64-char limit first time).
const buildEmail = (entity, community) => {
  let local = `${slug(entity, 60)}-${slug(community, 40)}`;
  if (local.length > 64) local = local.slice(0, 64).replace(/-+$/, '');
  return `${local}@goods.civicgraph.io`;
};

async function main() {
  if (!KEY || !LOC) throw new Error('Missing GHL_API_KEY / GHL_LOCATION_ID');

  // Top-N distinct entities by fit_score (dedup the table's duplicate rows), with community.
  const rows = await sql(`
    SELECT * FROM (
      SELECT DISTINCT ON (lower(e.entity_name))
        e.id, e.entity_name, e.buyer_role, e.abn, e.website, e.fit_score,
        e.is_community_controlled, COALESCE(e.relationship_status,'prospect') relationship_status,
        e.govt_contract_value, e.ghl_opportunity_id,
        c.community_name, c.state
      FROM goods_procurement_entities e
      LEFT JOIN goods_communities c ON c.id = e.community_id
      ORDER BY lower(e.entity_name), e.fit_score DESC NULLS LAST
    ) d
    ORDER BY d.fit_score DESC NULLS LAST, d.govt_contract_value DESC NULLS LAST
    LIMIT ${LIMIT}`);

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} · target: Goods — Demand Register / Buyer Matched · ${rows.length} entities\n`);

  let created = 0, skipped = 0, fail = 0;
  for (const r of rows) {
    const community = r.community_name || 'Unmatched';
    const tag = (s) => s;
    const tags = [
      'CivicGraph', 'Goods', 'act-gd', 'project:act-gd',
      `Goods-Community-${community.replace(/\s+/g, '-')}`,
      r.state ? `Goods-State-${r.state}` : null,
      r.buyer_role ? `Goods-Role-${r.buyer_role}` : null,
      r.is_community_controlled ? 'Goods-CommunityControlled' : null,
      `Goods-Stage-${r.relationship_status}`,
    ].filter(Boolean).map(tag);
    const oppName = `${r.entity_name} — ${community}`;
    const label = `${oppName}  fit:${r.fit_score} role:${r.buyer_role}`;

    if (r.ghl_opportunity_id) { console.log(`= SKIP (already pushed)  ${label}`); skipped++; continue; }
    if (!APPLY) { console.log(`+ WOULD PUSH  ${label}`); continue; }

    try {
      const email = buildEmail(r.entity_name, community);
      const up = await fetch(`${GHL}/contacts/upsert`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ locationId: LOC, email, companyName: r.entity_name, firstName: r.entity_name.slice(0, 80), website: r.website || undefined, tags, source: `CivicGraph Goods top-25 (${community})` }),
      });
      if (!up.ok) throw new Error(`contact upsert ${up.status}: ${(await up.text()).slice(0, 150)}`);
      const contactId = (await up.json())?.contact?.id;
      if (!contactId) throw new Error('no contactId');

      // Dedup: reuse an existing opp on this contact in the Demand Register (self-heals
      // partial runs where the opp was created but writeback failed).
      let oppId = null;
      const srch = await fetch(`${GHL}/opportunities/search?location_id=${LOC}&pipeline_id=${DEMAND_PIPELINE}&contact_id=${contactId}&limit=5`, { headers: H });
      if (srch.ok) {
        const opps = (await srch.json()).opportunities || [];
        oppId = (opps.find((o) => o.name === oppName) || opps[0])?.id || null;
      }
      let reused = !!oppId;
      if (!oppId) {
        const op = await fetch(`${GHL}/opportunities/`, {
          method: 'POST', headers: H,
          body: JSON.stringify({ locationId: LOC, name: oppName, pipelineId: DEMAND_PIPELINE, pipelineStageId: BUYER_MATCHED_STAGE, status: 'open', contactId, monetaryValue: 0, source: 'Goods top-25 activation' }),
        });
        if (!op.ok) throw new Error(`opp create ${op.status}: ${(await op.text()).slice(0, 150)}`);
        oppId = (await op.json())?.opportunity?.id;
      }

      const { error: upErr } = await supabase.from('goods_procurement_entities').update({
        ghl_contact_id: contactId, ghl_opportunity_id: oppId,
        ghl_pipeline_id: DEMAND_PIPELINE, ghl_stage_id: BUYER_MATCHED_STAGE,
        ghl_stage_name: 'Buyer Matched', ghl_last_pushed_at: new Date().toISOString(),
      }).eq('id', r.id);
      if (upErr) throw new Error(`writeback: ${upErr.message}`);

      console.log(`+ ${reused ? 'LINKED (existing opp)' : 'PUSHED'}  ${label}  (opp ${oppId})`);
      created++;
    } catch (e) {
      console.error(`✗ ${label}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n── ${APPLY ? 'Done' : 'Dry-run'} ── created:${created} skipped:${skipped} fail:${fail}`);
  if (!APPLY) console.log('(Re-run with --apply to write.)');
}
main().catch((e) => { console.error(e); process.exit(1); });
