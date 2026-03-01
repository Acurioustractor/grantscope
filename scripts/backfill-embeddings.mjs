#!/usr/bin/env node

/**
 * Backfill Embeddings
 *
 * Generates vector embeddings for all grants that don't have one yet.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 * Self-contained — uses fetch directly, no OpenAI SDK required.
 *
 * Requires: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node --env-file=.env scripts/backfill-embeddings.mjs [--batch-size 100] [--source foundation_program]
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
const sourceFilter = process.argv.find((_, i, a) => a[i - 1] === '--source') || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function buildEmbeddingText(grant) {
  return [
    grant.name,
    grant.provider,
    grant.program,
    grant.description,
    grant.categories?.length ? `Categories: ${grant.categories.join(', ')}` : null,
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

console.log('=== Backfill Grant Embeddings ===');
console.log(`  Batch size: ${batchSize}`);
if (sourceFilter) console.log(`  Source filter: ${sourceFilter}`);
console.log();

// Fetch grants without embeddings
const allGrants = [];
const pageSize = 1000;
let offset = 0;

while (true) {
  let query = supabase
    .from('grant_opportunities')
    .select('id, name, provider, program, description, categories, source')
    .is('embedding', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (sourceFilter) {
    query = query.eq('source', sourceFilter);
  }

  const { data: page, error } = await query;

  if (error) {
    console.error('Failed to fetch grants:', error.message);
    process.exit(1);
  }

  if (!page || page.length === 0) break;
  allGrants.push(...page);
  if (page.length < pageSize) break;
  offset += pageSize;
}

if (allGrants.length === 0) {
  console.log('All grants already have embeddings');
  process.exit(0);
}

console.log(`${allGrants.length} grants need embeddings`);

const run = await logStart(supabase, 'backfill-embeddings', 'Backfill Embeddings');

let embedded = 0;
let errors = 0;

for (let i = 0; i < allGrants.length; i += batchSize) {
  const batch = allGrants.slice(i, i + batchSize);
  const texts = batch.map(buildEmbeddingText);

  try {
    const embeddings = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await supabase
        .from('grant_opportunities')
        .update({
          embedding: JSON.stringify(embeddings[j]),
          embedding_model: 'text-embedding-3-small',
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

    console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} embedded (${embedded}/${allGrants.length})`);

    // Delay between batches
    if (i + batchSize < allGrants.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error(`Batch error: ${err.message}`);
    errors += batch.length;
  }
}

await logComplete(supabase, run.id, {
  items_found: allGrants.length,
  items_new: embedded,
  items_updated: 0,
});

console.log(`\nDone: ${embedded} embedded, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
