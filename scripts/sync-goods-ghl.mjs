#!/usr/bin/env node
/**
 * sync-goods-ghl.mjs — Pull live "current partners" from GoHighLevel (GHL) into
 * grantscope's `goods_relationships` table.
 *
 * Run:    node --env-file=.env scripts/sync-goods-ghl.mjs
 * Apply:  node --env-file=.env scripts/sync-goods-ghl.mjs --apply
 *
 * Pages through 3 Goods pipelines, normalizes each opportunity's stage onto the
 * goods_relationships engagement ladder, and emits an idempotent SQL file that
 * upserts one row per opportunity (ON CONFLICT (dedupe_key) DO UPDATE).
 *
 * Warmth is computed INLINE in the generated SELECT via goods_compute_warmth(...)
 * so it picks up the function's now()-based recency decay at apply time.
 *
 * NEVER fabricates rows. If GHL auth/pagination fails it dumps the raw response
 * to scripts/.ghl-last-response.json and exits non-zero.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const BASE_URL = 'https://services.leadconnectorhq.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_SQL = resolve(__dirname, 'seed-goods-ghl.generated.sql');
const DUMP_FILE = resolve(__dirname, '.ghl-last-response.json');

// --apply: after generating the reviewable SQL artifact, upsert through the
// Supabase service API and log the run. This works in the scheduled runtime,
// which intentionally does not ship a local psql binary.
const APPLY = process.argv.includes('--apply');
const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY) {
  console.error('FATAL: GHL_API_KEY not set (run with `node --env-file=.env`)');
  process.exit(1);
}
if (!LOCATION_ID) {
  console.error('FATAL: GHL_LOCATION_ID not set (run with `node --env-file=.env`)');
  process.exit(1);
}

// 3 Goods pipelines -> relationship_type (must satisfy table CHECK: funder/buyer are valid)
const PIPELINES = [
  { id: 'JvBFYpVpyKsw899lkFgj', name: 'Goods Supporter Journey', relationship_type: 'funder' },
  { id: 'FjMyJM3YzWQFmKqR9fur', name: 'Goods — Buyer Pipeline', relationship_type: 'buyer' },
  { id: 'UQsrmuqzxMSdCTklxEcG', name: 'Goods — Demand Register', relationship_type: 'buyer' },
];

// stageId PREFIX -> normalized stage (engagement ladder).
// We match by prefix because the brief gave truncated IDs; full IDs come from
// opportunity.pipelineStageId. Unmapped -> 'identified'.
// All target stages satisfy the table CHECK:
//   identified|researching|contacted|in_conversation|proposal|committed|repeat|dormant|declined
const STAGE_PREFIX_MAP = [
  // Supporter Journey
  ['cf8d31d2', 'identified'],
  ['a84114da', 'researching'],
  ['524aca71', 'contacted'],
  ['a23b26b4', 'proposal'],
  ['c6369cf9', 'committed'],
  ['15b7b876', 'committed'],
  ['3e38f65b', 'repeat'],
  ['ff90ea45', 'repeat'],
  ['0c86ee48', 'dormant'],
  ['fcf23a69', 'declined'],
  // Buyer Pipeline
  ['e5220eb2', 'identified'],
  ['1fd317ec', 'contacted'],
  ['8da22920', 'in_conversation'],
  ['c3e5e7c5', 'in_conversation'],
  ['27085dfa', 'proposal'],
  ['e23847c3', 'proposal'],
  ['a5222f0c', 'proposal'],
  ['809f1a7a', 'committed'],
  ['dc6cf017', 'committed'],
  ['80be941e', 'committed'],
  ['835065e8', 'committed'],
  ['0100d504', 'repeat'],
  // Demand Register
  ['0c5ed787', 'identified'],
  ['02502aa3', 'researching'],
  ['13958a71', 'committed'],
  ['a0cb12c7', 'dormant'],
];

function mapStage(pipelineStageId) {
  if (!pipelineStageId) return { stage: 'identified', mapped: false };
  const id = String(pipelineStageId).toLowerCase();
  for (const [prefix, stage] of STAGE_PREFIX_MAP) {
    if (id.startsWith(prefix)) return { stage, mapped: true };
  }
  return { stage: 'identified', mapped: false };
}

async function ghlFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      writeFileSync(DUMP_FILE, text);
    } catch { /* ignore */ }
    throw new Error(`GHL API ${res.status} on ${url}\n${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    writeFileSync(DUMP_FILE, text);
    throw new Error(`GHL returned non-JSON on ${url}: ${e.message}`);
  }
}

/**
 * Page through one pipeline's opportunities. GHL /opportunities/search returns
 * { opportunities: [...], meta: { nextPageUrl, startAfter, startAfterId, ... } }.
 * Prefer meta.nextPageUrl; fall back to startAfter/startAfterId cursors.
 */
async function fetchPipelineOpportunities(pipelineId) {
  const all = [];
  let url =
    `${BASE_URL}/opportunities/search?location_id=${encodeURIComponent(LOCATION_ID)}` +
    `&pipeline_id=${encodeURIComponent(pipelineId)}&limit=100`;
  let guard = 0;
  const MAX_PAGES = 200; // 100/page * 200 = 20k opps ceiling — generous safety stop

  while (url && guard < MAX_PAGES) {
    guard += 1;
    const data = await ghlFetch(url);
    const opps = data.opportunities || [];
    all.push(...opps);

    const meta = data.meta || {};
    // Stop if this page wasn't full (no more rows) — avoids relying solely on meta.
    if (opps.length < 100) break;

    if (meta.nextPageUrl) {
      url = meta.nextPageUrl;
    } else if (meta.startAfter && meta.startAfterId) {
      url =
        `${BASE_URL}/opportunities/search?location_id=${encodeURIComponent(LOCATION_ID)}` +
        `&pipeline_id=${encodeURIComponent(pipelineId)}&limit=100` +
        `&startAfter=${encodeURIComponent(meta.startAfter)}` +
        `&startAfterId=${encodeURIComponent(meta.startAfterId)}`;
    } else {
      break;
    }
  }
  return all;
}

/**
 * Best-effort: fetch all pipelines for the location and build a
 * pipelineStageId -> human stage name map (e.g. "Stewarding / Reporting").
 * Used purely for display enrichment in ghl_signal; failure is non-fatal
 * (names just stay null — the engagement-ladder stage is unaffected).
 */
async function fetchStageNames() {
  const map = new Map();
  try {
    const data = await ghlFetch(
      `${BASE_URL}/opportunities/pipelines?locationId=${encodeURIComponent(LOCATION_ID)}`
    );
    for (const p of data.pipelines || []) {
      for (const s of p.stages || []) {
        if (s.id && s.name) map.set(s.id, s.name);
      }
    }
  } catch (e) {
    console.error(`WARN: could not fetch pipeline stage names (non-fatal): ${e.message}`);
  }
  return map;
}

// Double single quotes for safe SQL literal embedding (handles "O'Brien").
function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlTs(v) {
  if (!v) return 'NULL';
  // GHL sends ISO timestamps or epoch ms. Pass ISO through as a timestamptz literal.
  let iso;
  if (typeof v === 'number') {
    iso = new Date(v).toISOString();
  } else {
    const d = new Date(v);
    iso = Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (!iso) return 'NULL';
  return `${sqlStr(iso)}::timestamptz`;
}

function sqlNum(v) {
  if (v === null || v === undefined || v === '') return '0';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '0';
}

function computeWarmth(stage, lastTouch, totalReceived, hasPriorSupport) {
  const stageScore = {
    identified: 10,
    researching: 25,
    contacted: 40,
    in_conversation: 60,
    proposal: 75,
    committed: 90,
    repeat: 100,
    dormant: 20,
    declined: 0,
  }[stage] ?? 0;
  const touchedAt = lastTouch ? new Date(lastTouch).getTime() : Number.NaN;
  const days = Number.isNaN(touchedAt) ? null : Math.max(0, (Date.now() - touchedAt) / 86_400_000);
  const recency = days === null ? 0 : Math.max(0, 100 * Math.exp(-days / 60));
  const history = hasPriorSupport
    ? Math.min(100, 50 + 12 * Math.log(Math.max(1, totalReceived) / 1000 + 1))
    : 0;
  return Math.round(stageScore * 0.4 + recency * 0.2 + history * 0.2);
}

function contactName(opp) {
  const c = opp.contact || {};
  const name =
    c.name ||
    [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
    c.companyName ||
    c.email ||
    null;
  return name || null;
}

async function main() {
  const rows = [];
  const perPipeline = [];
  let unmappedCount = 0;
  let skippedNoName = 0;
  let withTags = 0;
  const syncedAt = new Date().toISOString();
  const stageNames = await fetchStageNames(); // pipelineStageId -> human name (best-effort)
  const seenDedupe = new Set(); // relationship_type + ':' + lower(name) — pre-dedupe within run

  for (const p of PIPELINES) {
    let opps;
    try {
      opps = await fetchPipelineOpportunities(p.id);
    } catch (e) {
      console.error(`\nFATAL: GHL fetch failed for pipeline ${p.name} (${p.id})`);
      console.error(e.message);
      console.error(`Raw response (if any) dumped to: ${DUMP_FILE}`);
      process.exit(2);
    }
    perPipeline.push({ name: p.name, id: p.id, type: p.relationship_type, count: opps.length });

    for (const opp of opps) {
      const { stage, mapped } = mapStage(opp.pipelineStageId);
      if (!mapped) unmappedCount += 1;

      const displayName = (opp.name && String(opp.name).trim()) || contactName(opp);
      if (!displayName) {
        skippedNoName += 1;
        continue;
      }

      const dedupe = `${p.relationship_type}:${displayName.toLowerCase()}`;
      if (seenDedupe.has(dedupe)) {
        // Same dedupe_key would collide within one INSERT (ON CONFLICT can't fire
        // twice on the same key in one statement). Keep first; skip dupes.
        continue;
      }
      seenDedupe.add(dedupe);

      const ghlOppId = opp.id || opp._id || null;
      const ghlContactId = opp.contactId || opp.contact?.id || null;
      const lastTouch = opp.updatedAt || opp.lastStatusChangeAt || null;
      const hasPrior = stage === 'committed' || stage === 'repeat';
      const totalReceived = hasPrior ? Number(sqlNum(opp.monetaryValue)) : 0;

      // Structured GHL signal — contact tags (temperature, ring, briefs, roles,
      // place, campaign stage) + opportunity status/stage. Decoded into funder
      // insight by goods-funder-insight-shared.ts. Full tag set is embedded in
      // opp.contact.tags (verified complete vs the contacts endpoint).
      const tags = Array.isArray(opp.contact?.tags)
        ? opp.contact.tags.filter((t) => typeof t === 'string')
        : [];
      if (tags.length) withTags += 1;
      const ghlSignal = {
        tags,
        opportunity_status: opp.status || null,
        opportunity_stage_name: stageNames.get(opp.pipelineStageId) || null,
        last_stage_change_at: opp.lastStageChangeAt || null,
        synced_at: syncedAt,
      };

      rows.push({
        relationship_type: p.relationship_type,
        display_name: displayName,
        ghl_opportunity_id: ghlOppId,
        ghl_contact_id: ghlContactId,
        stage,
        last_touch_at: lastTouch,
        total_received_aud: totalReceived,
        has_prior_support: hasPrior,
        pipeline: p.name,
        ghl_signal: ghlSignal,
      });
    }
  }

  // --- Emit SQL ---
  const lines = [];
  lines.push('-- GENERATED by scripts/sync-goods-ghl.mjs — do not edit by hand.');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Source: GoHighLevel live opportunities for 3 Goods pipelines.');
  lines.push('-- Idempotent: ON CONFLICT (dedupe_key) DO UPDATE. Re-runnable.');
  lines.push('-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \\');
  lines.push('--   "host=aws-0-ap-southeast-2.pooler.supabase.com port=6543 user=postgres.tednluwflfhxyucgwigh dbname=postgres connect_timeout=10" \\');
  lines.push('--   -f scripts/seed-goods-ghl.generated.sql');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  for (const r of rows) {
    const src = {
      source: 'ghl',
      pipeline: r.pipeline,
      opportunity_id: r.ghl_opportunity_id,
      contact_id: r.ghl_contact_id,
    };
    const srcJson = sqlStr(JSON.stringify(src)) + '::jsonb';
    const signalJson = sqlStr(JSON.stringify(r.ghl_signal)) + '::jsonb';
    const stageLit = sqlStr(r.stage);
    const lastTouchLit = sqlTs(r.last_touch_at);
    const totalLit = r.total_received_aud; // already numeric-safe string
    const priorLit = r.has_prior_support ? 'true' : 'false';

    lines.push(
      `INSERT INTO goods_relationships (relationship_type, display_name, ghl_opportunity_id, ghl_contact_id, stage, last_touch_at, total_received_aud, has_prior_support, warmth_computed, source_refs, ghl_signal)`
    );
    lines.push(
      `SELECT ${sqlStr(r.relationship_type)}, ${sqlStr(r.display_name)}, ${sqlStr(r.ghl_opportunity_id)}, ${sqlStr(r.ghl_contact_id)}, ${stageLit}, ${lastTouchLit}, ${totalLit}::numeric, ${priorLit},`
    );
    lines.push(
      `       goods_compute_warmth(${stageLit}, ${lastTouchLit}, ${totalLit}::numeric, NULL, ${priorLit}, 0), ${srcJson}, ${signalJson}`
    );
    lines.push(
      `ON CONFLICT (dedupe_key) DO UPDATE SET`
    );
    lines.push(
      `  stage = EXCLUDED.stage,`
    );
    lines.push(
      `  ghl_opportunity_id = COALESCE(EXCLUDED.ghl_opportunity_id, goods_relationships.ghl_opportunity_id),`
    );
    lines.push(
      `  ghl_contact_id = COALESCE(EXCLUDED.ghl_contact_id, goods_relationships.ghl_contact_id),`
    );
    lines.push(
      `  last_touch_at = EXCLUDED.last_touch_at,`
    );
    lines.push(
      `  total_received_aud = GREATEST(goods_relationships.total_received_aud, EXCLUDED.total_received_aud),`
    );
    lines.push(
      `  has_prior_support = goods_relationships.has_prior_support OR EXCLUDED.has_prior_support,`
    );
    lines.push(
      `  warmth_computed = EXCLUDED.warmth_computed,`
    );
    lines.push(
      `  source_refs = goods_relationships.source_refs || EXCLUDED.source_refs,`
    );
    lines.push(
      `  ghl_signal = EXCLUDED.ghl_signal,`
    );
    lines.push(
      `  updated_at = now();`
    );
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');

  writeFileSync(OUT_SQL, lines.join('\n'));

  // --- Summary to stdout (NO raw GHL JSON) ---
  console.log(`GHL → goods_relationships sync (${APPLY ? 'Supabase apply' : 'SQL review only'})`);
  console.log('Opportunities pulled per pipeline:');
  for (const pp of perPipeline) {
    console.log(`  ${pp.name} [${pp.type}]: ${pp.count}`);
  }
  const totalOpps = perPipeline.reduce((a, b) => a + b.count, 0);
  console.log(`  TOTAL opportunities: ${totalOpps}`);
  console.log(`Rows emitted (after in-run dedupe): ${rows.length}`);
  console.log(`Rows with GHL signal tags: ${withTags}`);
  console.log(`Stage names resolved: ${stageNames.size}`);
  console.log(`Unmapped stageIds (defaulted to 'identified'): ${unmappedCount}`);
  console.log(`Skipped (empty name): ${skippedNoName}`);
  console.log(`SQL written: ${OUT_SQL}`);

  // --- Optional self-apply (scheduled/agent runs) ---
  if (!APPLY) {
    console.log('\nDry-run (SQL only). Re-run with --apply to upsert into goods_relationships.');
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('FATAL: --apply needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for agent_runs logging).');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const run = await logStart(supabase, 'sync-goods-ghl', 'Sync Goods GHL Warmth');
  try {
    const dedupeKeys = rows.map((row) => `${row.relationship_type}:${row.display_name.trim().toLowerCase()}`);
    const existingByKey = new Map();
    for (let offset = 0; offset < dedupeKeys.length; offset += 200) {
      const { data: existing, error: existingError } = await supabase
        .from('goods_relationships')
        .select('dedupe_key, total_received_aud, has_prior_support, source_refs')
        .in('dedupe_key', dedupeKeys.slice(offset, offset + 200));
      if (existingError) throw new Error(`existing relationship lookup failed: ${existingError.message}`);
      for (const relationship of existing ?? []) existingByKey.set(relationship.dedupe_key, relationship);
    }

    const payload = rows.map((row) => {
      const dedupeKey = `${row.relationship_type}:${row.display_name.trim().toLowerCase()}`;
      const existing = existingByKey.get(dedupeKey);
      const totalReceived = Math.max(Number(existing?.total_received_aud ?? 0), Number(row.total_received_aud ?? 0));
      const hasPriorSupport = Boolean(existing?.has_prior_support) || row.has_prior_support;
      const sourceRefs = {
        ...(existing?.source_refs && typeof existing.source_refs === 'object' ? existing.source_refs : {}),
        source: 'ghl',
        pipeline: row.pipeline,
        opportunity_id: row.ghl_opportunity_id,
        contact_id: row.ghl_contact_id,
      };
      return {
        relationship_type: row.relationship_type,
        display_name: row.display_name,
        ghl_opportunity_id: row.ghl_opportunity_id,
        ghl_contact_id: row.ghl_contact_id,
        stage: row.stage,
        last_touch_at: row.last_touch_at ? new Date(row.last_touch_at).toISOString() : null,
        total_received_aud: totalReceived,
        has_prior_support: hasPriorSupport,
        warmth_computed: computeWarmth(row.stage, row.last_touch_at, totalReceived, hasPriorSupport),
        source_refs: sourceRefs,
        ghl_signal: row.ghl_signal,
        updated_at: new Date().toISOString(),
      };
    });

    for (let offset = 0; offset < payload.length; offset += 200) {
      const { error } = await supabase
        .from('goods_relationships')
        .upsert(payload.slice(offset, offset + 200), { onConflict: 'dedupe_key' });
      if (error) throw new Error(`goods relationship upsert failed: ${error.message}`);
    }

    await logComplete(supabase, run.id, { items_found: totalOpps, items_updated: rows.length });
    console.log(`\nApplied: ${rows.length} rows upserted into goods_relationships.`);
  } catch (e) {
    await logFailed(supabase, run.id, e);
    console.error('FATAL (apply): Supabase upsert failed:', e.message);
    process.exit(4);
  }
}

main().catch((e) => {
  console.error('FATAL (unexpected):', e.message);
  process.exit(3);
});
