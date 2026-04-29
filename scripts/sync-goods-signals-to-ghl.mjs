#!/usr/bin/env node
/**
 * Sync Goods procurement signals into GoHighLevel.
 *
 * GrantScope/Civic Scope remains the source of truth:
 * - goods_procurement_signals drive demand/procurement state.
 * - GHL records the relationship/action layer.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-goods-signals-to-ghl.mjs --dry-run --limit 20
 *   node --env-file=.env scripts/sync-goods-signals-to-ghl.mjs --push --limit 20
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GOODS_DEMAND_PIPELINE_NAME = process.env.GHL_GOODS_DEMAND_PIPELINE_NAME || 'Goods — Demand Register';
const GOODS_BUYER_PIPELINE_NAME = process.env.GHL_GOODS_BUYER_PIPELINE_NAME || 'Goods — Buyer Pipeline';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || !args.includes('--push');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] || '50', 10) : 50;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}\nQuery: ${query.slice(0, 400)}`);
  return data || [];
}

async function ghlFetch(endpoint, options = {}) {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    throw new Error('Missing GHL_API_KEY or GHL_LOCATION_ID');
  }

  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status}: ${text}`);
  }
  return res.json();
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function findPipeline(pipelines, name) {
  return pipelines.find((pipeline) => normalize(pipeline.name) === normalize(name));
}

function stageMap(pipeline) {
  return Object.fromEntries((pipeline.stages || []).map((stage) => [normalize(stage.name), stage.id]));
}

function stageId(stages, names) {
  for (const name of names) {
    const id = stages[normalize(name)];
    if (id) return id;
  }
  return Object.values(stages)[0];
}

function demandStageNames(signal) {
  if (signal.status === 'new') return ['Signal'];
  if (['lost', 'expired', 'dismissed'].includes(signal.status)) return ['Dormant'];
  if (['actioned', 'won'].includes(signal.status)) return ['Converted'];
  if (signal.status === 'reviewing' || signal.buyer_entity_id) return ['Buyer Matched'];
  return ['Signal'];
}

function buyerStageNames(signal) {
  if (signal.status === 'won') return ['Paid', 'Delivered', 'Committed'];
  if (signal.status === 'actioned') return ['In Conversation', 'Qualified', 'First Contact'];
  if (signal.status === 'reviewing') return ['First Contact', 'Outreach Queued'];
  return ['Outreach Queued'];
}

function opportunityName(signal, lane) {
  const community = signal.community_name || 'Unknown community';
  const value = Number(signal.estimated_value || 0);
  const suffix = value > 0 ? ` — $${Math.round(value).toLocaleString('en-AU')}` : '';
  return `Goods ${lane}: ${community} — ${signal.title}${suffix}`;
}

function contactEmail(signal) {
  const base = `${signal.community_name || signal.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || signal.id}@goods.civicgraph.io`;
}

async function loadExistingOpportunities(pipelineId) {
  const data = await ghlFetch(`/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`);
  const opportunities = data.opportunities || [];
  return new Map(opportunities.map((opportunity) => [opportunity.name, opportunity]));
}

async function ensureContact(signal) {
  if (signal.ghl_contact_id) return signal.ghl_contact_id;

  const email = contactEmail(signal);
  if (DRY_RUN) return `dry-contact:${email}`;

  try {
    const created = await ghlFetch('/contacts/', {
      method: 'POST',
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        firstName: signal.community_name || 'Goods',
        lastName: signal.state || 'Signal',
        email,
        companyName: signal.community_name ? `${signal.community_name}, ${signal.state || 'Australia'}` : signal.title,
        tags: ['goods-signal', `goods-${signal.status}`, signal.priority ? `priority-${signal.priority}` : null].filter(Boolean),
        source: 'Civic Scope Goods Signals',
      }),
    });
    return created?.contact?.id;
  } catch {
    const duplicate = await ghlFetch(
      `/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`,
    );
    return duplicate?.contact?.id;
  }
}

async function upsertOpportunity({ pipeline, stages, existing, signal, lane, stageNames, contactId }) {
  const name = opportunityName(signal, lane);
  const current = existing.get(name);
  const targetStageId = stageId(stages, stageNames);
  const payload = {
    locationId: GHL_LOCATION_ID,
    name,
    pipelineId: pipeline.id,
    pipelineStageId: targetStageId,
    status: ['lost', 'expired', 'dismissed'].includes(signal.status) ? 'lost' : signal.status === 'won' ? 'won' : 'open',
    monetaryValue: Math.round(Number(signal.estimated_value || 0)),
    ...(contactId && !String(contactId).startsWith('dry-contact:') ? { contactId } : {}),
  };

  if (DRY_RUN) {
    return { action: current ? 'would-update' : 'would-create', name, stageNames };
  }

  if (current?.id) {
    await ghlFetch(`/opportunities/${current.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        pipelineStageId: payload.pipelineStageId,
        status: payload.status,
        monetaryValue: payload.monetaryValue,
      }),
    });
    return { action: 'updated', name, stageNames };
  }

  await ghlFetch('/opportunities/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { action: 'created', name, stageNames };
}

async function main() {
  console.log(`=== Sync Goods Signals to GHL ===${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`Limit: ${LIMIT}`);

  const pipelinesData = await ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`);
  const pipelines = pipelinesData.pipelines || [];
  const demandPipeline = findPipeline(pipelines, GOODS_DEMAND_PIPELINE_NAME);
  const buyerPipeline = findPipeline(pipelines, GOODS_BUYER_PIPELINE_NAME);

  if (!demandPipeline) throw new Error(`Missing GHL pipeline: ${GOODS_DEMAND_PIPELINE_NAME}`);
  if (!buyerPipeline) throw new Error(`Missing GHL pipeline: ${GOODS_BUYER_PIPELINE_NAME}`);

  const demandStages = stageMap(demandPipeline);
  const buyerStages = stageMap(buyerPipeline);
  const existingDemand = await loadExistingOpportunities(demandPipeline.id);
  const existingBuyer = await loadExistingOpportunities(buyerPipeline.id);

  const signals = await sql(`
    SELECT
      gps.id, gps.signal_type, gps.priority, gps.title, gps.description, gps.estimated_value,
      gps.estimated_units, gps.products_needed, gps.status, gps.buyer_entity_id,
      gps.ghl_contact_id, gps.ghl_synced_at, gps.updated_at,
      gc.community_name, gc.state, gc.postcode,
      gpe.entity_name AS buyer_name
    FROM goods_procurement_signals gps
    LEFT JOIN goods_communities gc ON gc.id = gps.community_id
    LEFT JOIN goods_procurement_entities gpe ON gpe.id = gps.buyer_entity_id
    WHERE gps.status IN ('new', 'reviewing', 'actioned', 'won', 'lost', 'expired', 'dismissed')
      AND (
        gps.ghl_synced_at IS NULL
        OR gps.updated_at > gps.ghl_synced_at
      )
    ORDER BY
      CASE gps.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      gps.updated_at DESC
    LIMIT ${Number.isFinite(LIMIT) ? LIMIT : 50}
  `);

  console.log(`Signals to sync: ${signals.length}`);

  const results = [];
  for (const signal of signals) {
    const contactId = await ensureContact(signal);
    const demandResult = await upsertOpportunity({
      pipeline: demandPipeline,
      stages: demandStages,
      existing: existingDemand,
      signal,
      lane: 'Demand',
      stageNames: demandStageNames(signal),
      contactId,
    });
    results.push(demandResult);

    if (signal.buyer_entity_id || ['reviewing', 'actioned', 'won'].includes(signal.status)) {
      const buyerResult = await upsertOpportunity({
        pipeline: buyerPipeline,
        stages: buyerStages,
        existing: existingBuyer,
        signal,
        lane: 'Buyer',
        stageNames: buyerStageNames(signal),
        contactId,
      });
      results.push(buyerResult);
    }

    if (!DRY_RUN) {
      await supabase
        .from('goods_procurement_signals')
        .update({
          ghl_contact_id: contactId || signal.ghl_contact_id,
          ghl_synced_at: new Date().toISOString(),
        })
        .eq('id', signal.id);
    }
  }

  const counts = results.reduce((acc, result) => {
    acc[result.action] = (acc[result.action] || 0) + 1;
    return acc;
  }, {});

  console.log('\nActions:');
  for (const [action, count] of Object.entries(counts)) {
    console.log(`  ${action}: ${count}`);
  }

  console.log('\nSample:');
  for (const result of results.slice(0, 12)) {
    console.log(`  ${result.action}: ${result.name} -> ${result.stageNames.join(' / ')}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete — no GHL or Supabase writes made. Use --push to sync.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
