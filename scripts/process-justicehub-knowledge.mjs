#!/usr/bin/env node
/**
 * Process JusticeHub knowledge docs that are already in Supabase Storage.
 * Reads markdown from storage → chunks text → embeds (384-dim) → inserts knowledge_chunks + wiki_pages.
 *
 * Usage: node --env-file=.env scripts/process-justicehub-knowledge.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHUNK_SIZE = 500; // words
const CHUNK_OVERLAP = 100;
const MAX_CHUNKS = 50;

function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= CHUNK_SIZE) return [text.trim()];
  const chunks = [];
  let start = 0;
  while (start < words.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

/** Extract a summary from the first ~200 words of markdown */
function extractSummary(text) {
  // Skip title lines and get first paragraph
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
  const para = lines.slice(0, 5).join(' ').trim();
  return para.slice(0, 500);
}

/** Extract topics from markdown headings */
function extractTopics(text) {
  const headings = text.match(/^##?\s+(.+)/gm) || [];
  const topics = headings
    .map(h => h.replace(/^#+\s+/, '').toLowerCase().trim())
    .filter(t => t.length < 50)
    .slice(0, 8);
  return topics;
}

async function embedText(text) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 384,  // Match DB column: vector(384)
      }),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

// Valid page_type values: principle, method, practice, procedure, guide, template
const SOURCE_TYPE_TO_PAGE_TYPE = {
  foundational: 'principle',
  strategic: 'guide',
  tactical: 'method',
  dynamic: 'practice',
  experimental: 'method',
};

async function processSource(source, orgId) {
  // Download from storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('org-knowledge')
    .download(source.storage_path);
  if (dlErr || !fileData) {
    console.log(`  DL ERR: ${source.source_name} — ${dlErr?.message}`);
    return false;
  }
  const text = await fileData.text();
  if (!text || text.trim().length < 10) {
    console.log(`  EMPTY: ${source.source_name}`);
    return false;
  }

  const summary = extractSummary(text);
  const topics = extractTopics(text);

  // Chunk and embed
  const chunks = chunkText(text);
  let embeddedCount = 0;
  for (const chunk of chunks) {
    const embedding = await embedText(chunk);
    const { error: insertErr } = await supabase
      .from('knowledge_chunks')
      .insert({
        content: chunk,
        source_type: 'manual',  // uploaded docs = manual knowledge
        source_id: source.id,
        org_profile_id: orgId,
        summary: embeddedCount === 0 ? summary : null,
        topics,
        entities: [],
        quality_score: 0.8,
        embedding: embedding ? JSON.stringify(embedding) : null,
        content_hash: Buffer.from(chunk).toString('base64').slice(0, 32),
      });
    if (insertErr) {
      console.log(`  CHUNK ERR: ${insertErr.message}`);
    } else {
      embeddedCount++;
    }
  }

  // Create wiki page
  const slug = source.source_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const pageType = SOURCE_TYPE_TO_PAGE_TYPE[source.source_type] || 'guide';

  const { error: wikiErr } = await supabase
    .from('wiki_pages')
    .insert({
      title: source.source_name,
      slug: `${slug}-${Date.now()}`,
      content: text.slice(0, 50000),
      excerpt: summary,
      page_type: pageType,
      tags: topics,
      source_types: [source.source_type],
      org_profile_id: orgId,
      status: 'active',
      quality_score: 4,
      version: 1,
    });

  if (wikiErr) {
    console.log(`  WIKI ERR: ${wikiErr.message}`);
  }

  console.log(`  OK: ${source.source_name} → ${embeddedCount}/${chunks.length} chunks, wiki: ${pageType}`);
  return true;
}

async function main() {
  // Get JusticeHub org
  const { data: org } = await supabase
    .from('org_profiles')
    .select('id')
    .eq('slug', 'justicehub')
    .single();
  if (!org) throw new Error('JusticeHub org not found');
  const orgId = org.id;
  console.log(`JusticeHub org: ${orgId}\n`);

  // Get all sources
  const { data: sources } = await supabase
    .from('knowledge_sources')
    .select('id, source_name, source_type, storage_path')
    .eq('org_profile_id', orgId)
    .order('created_at');

  if (!sources?.length) {
    console.log('No sources to process.');
    return;
  }

  // Check which already have chunks
  const { data: existingChunks } = await supabase
    .from('knowledge_chunks')
    .select('source_id')
    .eq('org_profile_id', orgId);
  const processedIds = new Set((existingChunks || []).map(c => c.source_id));

  const unprocessed = sources.filter(s => !processedIds.has(s.id));
  console.log(`${unprocessed.length} of ${sources.length} sources need processing.\n`);

  let ok = 0;
  for (const source of unprocessed) {
    console.log(`Processing: ${source.source_name}`);
    const success = await processSource(source, orgId);
    if (success) ok++;
  }

  console.log(`\nDone: ${ok}/${unprocessed.length} processed.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
