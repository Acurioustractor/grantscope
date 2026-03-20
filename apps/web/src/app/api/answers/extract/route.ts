import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { embedQuery } from '@grant-engine/embeddings';
import { getEffectiveOrgId } from '@/lib/org-profile';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

async function extractText(file: File | null, url: string | null): Promise<{ text: string; sourceName: string }> {
  if (url) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CivicGraph/1.0 Knowledge Ingestion' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside').remove();
    const mainContent = $('main, article, [role="main"]').first();
    const text = (mainContent.length ? mainContent : $('body')).text().replace(/\s+/g, ' ').trim();
    return { text, sourceName: url };
  }

  if (!file) throw new Error('No file or URL provided');

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    text = result.text;
  } else if (file.type.includes('wordprocessingml') || file.name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    text = buffer.toString('utf-8');
  }

  return { text, sourceName: file.name };
}

interface ExtractedQA {
  question: string;
  answer: string;
  category: string | null;
}

async function extractQAPairs(text: string): Promise<ExtractedQA[]> {
  const truncated = text.slice(0, 12000);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Extract question-and-answer pairs from this grant application or organisational document.

Look for:
- Explicit Q&A sections (common in grant applications)
- Sections that answer implicit questions (e.g. "About Us" answers "What is your organisation's mission?")
- Key organisational information that could be reused in future applications

For each pair, categorise as one of: mission, capacity, impact, budget, governance, partners

Return JSON array only (no markdown):
[{"question": "...", "answer": "...", "category": "mission|capacity|impact|budget|governance|partners"}]

Extract up to 20 Q&A pairs. Each answer should be complete and self-contained.

Document text:
${truncated}`,
      }],
    }),
  });

  const data = await response.json();
  const content = data.content?.[0]?.text || '[]';

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    // Try to find JSON array in response
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();
  const orgId = await getEffectiveOrgId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const url = formData.get('url') as string | null;

  if (!file && !url) {
    return NextResponse.json({ error: 'Provide a file or URL' }, { status: 400 });
  }

  try {
    // 1. Extract text
    const { text, sourceName } = await extractText(file, url);

    if (text.length < 50) {
      return NextResponse.json({ error: 'Not enough text extracted from document' }, { status: 400 });
    }

    // 2. AI extraction of Q&A pairs
    const pairs = await extractQAPairs(text);

    if (pairs.length === 0) {
      return NextResponse.json({ error: 'No Q&A pairs could be extracted' }, { status: 400 });
    }

    // 3. Insert each pair into answer bank with embeddings
    const inserted: Array<{ id: string; question: string; answer: string; category: string | null }> = [];

    for (const pair of pairs) {
      if (!pair.question || !pair.answer) continue;

      let embedding = null;
      if (process.env.OPENAI_API_KEY) {
        try {
          embedding = await embedQuery(`${pair.question}\n${pair.answer}`, process.env.OPENAI_API_KEY);
        } catch {
          // continue without embedding
        }
      }

      const validCategories = ['mission', 'capacity', 'impact', 'budget', 'governance', 'partners'];
      const category = pair.category && validCategories.includes(pair.category) ? pair.category : null;

      const { data, error } = await db
        .from('grant_answer_bank')
        .insert({
          org_profile_id: orgId,
          question: pair.question,
          answer: pair.answer,
          category,
          tags: [],
          source_application: sourceName,
          embedding: embedding ? JSON.stringify(embedding) : null,
        })
        .select('id, question, answer, category')
        .single();

      if (!error && data) {
        inserted.push(data);
      }
    }

    return NextResponse.json({
      extracted: pairs.length,
      inserted: inserted.length,
      answers: inserted,
      source: sourceName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
