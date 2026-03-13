import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { embedQuery } from '@grant-engine/embeddings';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

const CHUNK_SIZE = 500; // words
const CHUNK_OVERLAP = 100; // words
const MAX_CHUNKS = 50;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= CHUNK_SIZE) return [text.trim()];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 Knowledge Ingestion' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer, header elements
  $('script, style, nav, footer, header, aside, [role="navigation"]').remove();

  // Try to get main content, fall back to body
  const mainContent = $('main, article, [role="main"]').first();
  const text = (mainContent.length ? mainContent : $('body')).text();
  return text.replace(/\s+/g, ' ').trim();
}

async function getAiMetadata(text: string): Promise<{
  summary: string;
  topics: string[];
  entities: string[];
  quality_score: number;
  suggested_title: string;
}> {
  const truncated = text.slice(0, 4000);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analyse this document text and return JSON only (no markdown):
{"summary": "2-3 sentence summary", "topics": ["topic1", "topic2"], "entities": ["org/person mentioned"], "quality_score": 0.0-1.0, "suggested_title": "short title"}

Text:
${truncated}`,
      }],
    }),
  });

  const data = await response.json();
  const content = data.content?.[0]?.text || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return {
      summary: text.slice(0, 200),
      topics: [],
      entities: [],
      quality_score: 0.5,
      suggested_title: 'Untitled Document',
    };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  const db = getServiceSupabase();

  // Get next pending queue item
  const { data: queueItem, error: fetchError } = await db
    .from('knowledge_extraction_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !queueItem) {
    return NextResponse.json({ message: 'No pending items' }, { status: 200 });
  }

  // Mark as processing
  await db
    .from('knowledge_extraction_queue')
    .update({ status: 'processing' })
    .eq('id', queueItem.id);

  const orgProfileId = queueItem.source_metadata?.org_profile_id;

  try {
    // 1. Extract text
    let text = '';
    const sourceType = queueItem.source_type;

    if (sourceType === 'url') {
      text = await extractTextFromUrl(queueItem.source_url!);
    } else {
      // Download from Supabase Storage
      const storagePath = queueItem.source_url; // We stored storage_path in source_url
      if (!storagePath) throw new Error('No storage path for file source');

      const { data: fileData, error: downloadError } = await db.storage
        .from('org-knowledge')
        .download(storagePath);

      if (downloadError || !fileData) throw new Error(`Download failed: ${downloadError?.message}`);

      const buffer = Buffer.from(await fileData.arrayBuffer());

      if (sourceType === 'pdf') {
        text = await extractTextFromPdf(buffer);
      } else if (sourceType === 'docx') {
        text = await extractTextFromDocx(buffer);
      } else {
        text = buffer.toString('utf-8');
      }
    }

    if (!text || text.trim().length < 10) {
      throw new Error('No meaningful text extracted');
    }

    // 2. AI metadata extraction
    const metadata = await getAiMetadata(text);

    // 3. Chunk text
    const chunks = chunkText(text);

    // 4. Embed and insert chunks
    const openaiKey = process.env.OPENAI_API_KEY;
    let embeddedCount = 0;

    for (const chunk of chunks) {
      let embedding = null;
      if (openaiKey) {
        try {
          embedding = await embedQuery(chunk, openaiKey);
        } catch (err) {
          console.error('[knowledge-process] Embedding failed for chunk:', err);
        }
      }

      const { error: insertError } = await db
        .from('knowledge_chunks')
        .insert({
          content: chunk,
          source_type: sourceType,
          source_id: queueItem.source_id,
          org_profile_id: orgProfileId,
          summary: embeddedCount === 0 ? metadata.summary : null, // Only first chunk gets summary
          topics: metadata.topics,
          entities: metadata.entities,
          quality_score: metadata.quality_score,
          embedding: embedding ? JSON.stringify(embedding) : null,
          content_hash: Buffer.from(chunk).toString('base64').slice(0, 32),
        });

      if (insertError) {
        console.error('[knowledge-process] Chunk insert error:', insertError);
      } else {
        embeddedCount++;
      }
    }

    // 5. Create wiki page
    const slug = metadata.suggested_title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

    await db
      .from('wiki_pages')
      .insert({
        title: metadata.suggested_title,
        slug: `${slug}-${Date.now()}`,
        content: text.slice(0, 50000), // Cap at 50K chars
        excerpt: metadata.summary,
        page_type: 'document',
        tags: metadata.topics,
        source_types: [sourceType],
        org_profile_id: orgProfileId,
        status: metadata.quality_score > 0.8 ? 'published' : 'review',
        quality_score: Math.round(metadata.quality_score * 10),
        version: 1,
      });

    // 6. Update queue item as completed
    await db
      .from('knowledge_extraction_queue')
      .update({
        status: 'completed',
        raw_content: text.slice(0, 10000),
        extracted_knowledge: metadata.summary,
        suggested_title: metadata.suggested_title,
        suggested_tags: metadata.topics,
        confidence_score: metadata.quality_score,
        extracted_at: new Date().toISOString(),
        extraction_model: 'claude-haiku-4-5-20251001',
      })
      .eq('id', queueItem.id);

    return NextResponse.json({
      processed: true,
      source_id: queueItem.source_id,
      chunks: embeddedCount,
      title: metadata.suggested_title,
      quality_score: metadata.quality_score,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[knowledge-process] Error:', message);

    await db
      .from('knowledge_extraction_queue')
      .update({ status: 'failed', review_notes: message })
      .eq('id', queueItem.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
