#!/usr/bin/env node
/**
 * Backfill Foundation Embeddings
 *
 * Generates vector embeddings for all foundations that don't have one yet.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 *
 * Requires: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node --env-file=.env scripts/backfill-foundation-embeddings.mjs [--batch-size 100]
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function buildEmbeddingText(foundation) {
  return [
    foundation.name,
    foundation.description,
    foundation.thematic_focus?.length ? `Focus areas: ${foundation.thematic_focus.join(', ')}` : null,
    foundation.geographic_focus?.length ? `Geographic focus: ${foundation.geographic_focus.join(', ')}` : null,
    foundation.type ? `Type: ${foundation.type}` : null,
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

console.log('=== Backfill Foundation Embeddings ===');
console.log(`  Batch size: ${batchSize}`);
console.log();

// Fetch foundations without embeddings
const allFoundations = [];
const pageSize = 1000;
let offset = 0;

while (true) {
  const { data: page, error } = await supabase
    .from('foundations')
    .select('id, name, description, thematic_focus, geographic_focus, type')
    .is('embedding', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error('Failed to fetch foundations:', error.message);
    process.exit(1);
  }

  if (!page || page.length === 0) break;
  allFoundations.push(...page);
  if (page.length < pageSize) break;
  offset += pageSize;
}

if (allFoundations.length === 0) {
  console.log('All foundations already have embeddings');
  process.exit(0);
}

console.log(`${allFoundations.length} foundations need embeddings`);

const run = await logStart(supabase, 'backfill-foundation-embeddings', 'Backfill Foundation Embeddings');

let embedded = 0;
let errors = 0;

for (let i = 0; i < allFoundations.length; i += batchSize) {
  const batch = allFoundations.slice(i, i + batchSize);
  const texts = batch.map(buildEmbeddingText);

  try {
    const embeddings = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await supabase
        .from('foundations')
        .update({
          embedding: JSON.stringify(embeddings[j]),
          embedded_at: new Date().toISOString(),
        })
        .eq('id', batch[j].id);

      if (updateError) {
        console.error(`  Error updating ${batch[j].name}: ${updateError.message}`);
        errors++;
      } else {
        embedded++;
      }
    }

    console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} embedded (${embedded}/${allFoundations.length})`);

    if (i + batchSize < allFoundations.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error(`Batch error: ${err.message}`);
    errors += batch.length;
  }
}

await logComplete(supabase, run.id, {
  items_found: allFoundations.length,
  items_new: embedded,
  items_updated: 0,
});

console.log(`\nDone: ${embedded} embedded, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
