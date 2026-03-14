#!/usr/bin/env node
/**
 * Backfill Entity Embeddings
 *
 * Generates vector embeddings for all gs_entities that don't have one yet.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 *
 * Requires: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node --env-file=.env scripts/backfill-entity-embeddings.mjs [--batch-size 100] [--limit 5000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const batchSize = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--batch-size') || '100', 10);
const maxLimit = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--limit') || '0', 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function buildEmbeddingText(entity) {
  return [
    entity.canonical_name,
    entity.entity_type ? `Type: ${entity.entity_type}` : null,
    entity.sector ? `Sector: ${entity.sector}` : null,
    entity.description,
    entity.lga_name ? `LGA: ${entity.lga_name}` : null,
    entity.state ? `State: ${entity.state}` : null,
    entity.remoteness ? `Remoteness: ${entity.remoteness}` : null,
    entity.is_community_controlled ? 'Community controlled organisation' : null,
  ].filter(Boolean).join('\n').slice(0, 8000);
}

async function generateEmbeddings(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 1536,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.data.map(d => d.embedding);
}

console.log('=== Backfill Entity Embeddings ===');
console.log(`  Batch size: ${batchSize}`);
if (maxLimit) console.log(`  Limit: ${maxLimit}`);
console.log();

// Fetch entities without embeddings
const allEntities = [];
const pageSize = 1000;
let offset = 0;

while (true) {
  const query = supabase
    .from('gs_entities')
    .select('id, canonical_name, entity_type, sector, description, lga_name, state, remoteness, is_community_controlled')
    .is('embedding', null)
    .order('source_count', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data: page, error } = await query;

  if (error) {
    console.error('Failed to fetch entities:', error.message);
    process.exit(1);
  }

  if (!page || page.length === 0) break;
  allEntities.push(...page);
  if (page.length < pageSize) break;
  if (maxLimit && allEntities.length >= maxLimit) break;
  offset += pageSize;
}

const entities = maxLimit ? allEntities.slice(0, maxLimit) : allEntities;

if (entities.length === 0) {
  console.log('All entities already have embeddings');
  process.exit(0);
}

console.log(`${entities.length} entities need embeddings`);

const run = await logStart(supabase, 'backfill-entity-embeddings', 'Backfill Entity Embeddings');

let embedded = 0;
let errors = 0;

for (let i = 0; i < entities.length; i += batchSize) {
  const batch = entities.slice(i, i + batchSize);
  const texts = batch.map(buildEmbeddingText);

  try {
    const embeddings = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await supabase
        .from('gs_entities')
        .update({
          embedding: JSON.stringify(embeddings[j]),
          embedded_at: new Date().toISOString(),
        })
        .eq('id', batch[j].id);

      if (updateError) {
        console.error(`  Error updating ${batch[j].canonical_name}: ${updateError.message}`);
        errors++;
      } else {
        embedded++;
      }
    }

    console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} embedded (${embedded}/${entities.length})`);

    // Delay between batches
    if (i + batchSize < entities.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error(`Batch error: ${err.message}`);
    errors += batch.length;
  }
}

await logComplete(supabase, run.id, {
  items_found: entities.length,
  items_new: embedded,
  items_updated: 0,
});

console.log(`\nDone: ${embedded} embedded, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
