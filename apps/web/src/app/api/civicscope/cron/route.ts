import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * CivicScope cron endpoint — runs civic intelligence scrapers and cross-linker.
 *
 * Modes:
 *   ?mode=statements  — Scrape QLD ministerial statements
 *   ?mode=hansard     — Scrape QLD Hansard transcripts
 *   ?mode=spending    — Scrape QLD consultancy spending via CKAN
 *   ?mode=crosslink   — Run the cross-linking engine
 *   ?mode=commitments — Track charter commitment status
 *   ?mode=all         — Run all in sequence
 *
 * Auth: Vercel Cron (CRON_SECRET) or API_SECRET_KEY
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'all';
  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
  const db = getServiceSupabase();

  const results: Record<string, unknown> = { mode, started_at: new Date().toISOString() };

  try {
    const modes = mode === 'all'
      ? ['statements', 'hansard', 'spending', 'crosslink', 'commitments']
      : [mode];

    for (const m of modes) {
      switch (m) {
        case 'statements':
          results.statements = await runStatementsScraper(db, dryRun);
          break;
        case 'hansard':
          results.hansard = await runHansardScraper(db, dryRun);
          break;
        case 'spending':
          results.spending = await runSpendingScraper(db, dryRun);
          break;
        case 'crosslink':
          results.crosslink = await runCrossLinker(db, dryRun);
          break;
        case 'commitments':
          results.commitments = await runCommitmentTracker(db, dryRun);
          break;
        default:
          results[m] = { error: `Unknown mode: ${m}` };
      }
    }

    results.completed_at = new Date().toISOString();
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', ...results },
      { status: 500 }
    );
  }
}

// ── Inline scrapers (lightweight versions for Vercel serverless) ──

const JINA_PREFIX = 'https://r.jina.ai/';
const STATEMENTS_BASE = 'https://statements.qld.gov.au';

type SupabaseClient = ReturnType<typeof getServiceSupabase>;

async function runStatementsScraper(db: SupabaseClient, dryRun: boolean) {
  // Fetch latest 2 pages of statements
  const existingIds = new Set<string>();
  const { data: existing } = await db
    .from('civic_ministerial_statements')
    .select('source_id');
  if (existing) existing.forEach(r => existingIds.add(r.source_id));

  let inserted = 0;
  const errors: string[] = [];

  for (let page = 1; page <= 2; page++) {
    try {
      const res = await fetch(`${STATEMENTS_BASE}/?pageIndex=${page}`, {
        headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const linkRegex = /href="\/statements\/(\d+)"/g;
      let match;
      const pageIds: string[] = [];

      while ((match = linkRegex.exec(html)) !== null) {
        if (!existingIds.has(match[1]) && !pageIds.includes(match[1])) {
          pageIds.push(match[1]);
        }
      }

      // Fetch up to 5 new statements per run (serverless time limit)
      for (const id of pageIds.slice(0, 5)) {
        try {
          const detailRes = await fetch(`${STATEMENTS_BASE}/statements/${id}`, {
            headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
          });
          if (!detailRes.ok) continue;

          const detailHtml = await detailRes.text();

          // Extract JSON-LD
          const jsonLdMatch = detailHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
          let jsonLd: Record<string, string> | null = null;
          try { if (jsonLdMatch) jsonLd = JSON.parse(jsonLdMatch[1]); } catch { /* skip */ }

          const headline = jsonLd?.headline
            || detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]*>/g, '').trim()
            || `Statement ${id}`;

          const ministerMatch = detailHtml.match(/The Honourable ([A-Z][a-zA-Z'-]+ [A-Z][a-zA-Z'-]+(?:\s[A-Z][a-zA-Z'-]+)?)/);
          const portfolioMatch = detailHtml.match(/(?:Minister for|Treasurer|Premier|Attorney-General)[^<\n]*/i);

          const record = {
            source_id: id,
            source_url: `${STATEMENTS_BASE}/statements/${id}`,
            headline: headline.slice(0, 500),
            minister_name: ministerMatch ? `The Honourable ${ministerMatch[1].trim()}` : null,
            portfolio: portfolioMatch?.[0]?.trim()?.slice(0, 300) || null,
            published_at: jsonLd?.datePublished || null,
            body_text: extractBodyText(detailHtml),
            jurisdiction: 'QLD',
          };

          if (!dryRun) {
            const { error } = await db
              .from('civic_ministerial_statements')
              .upsert(record, { onConflict: 'source_id' });
            if (error) errors.push(error.message);
            else inserted++;
          } else {
            inserted++;
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { inserted, errors: errors.slice(0, 5), dry_run: dryRun };
}

async function runHansardScraper(db: SupabaseClient, dryRun: boolean) {
  const PDF_BASE = 'https://documents.parliament.qld.gov.au/events/han';
  const JUSTICE_KW = [
    'youth justice', 'juvenile', 'detention', 'watch house', 'child safety',
    'corrective services', 'prison', 'indigenous', 'first nations', 'aboriginal',
    'crime', 'criminal', 'sentencing', 'bail', 'police', 'domestic violence',
    'recidivism', 'rehabilitation', 'justice reinvestment', 'closing the gap',
    'funding', 'budget', 'million', 'program', 'reform',
    'housing', 'homelessness', 'mental health', 'education', 'employment',
  ];

  // Generate Tue-Thu dates for last 14 days (typical sitting days)
  const today = new Date();
  const candidates: string[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow >= 2 && dow <= 4) { // Tue, Wed, Thu
      candidates.push(d.toISOString().slice(0, 10));
    }
  }

  // Check which dates we already have
  const { data: existing } = await db
    .from('civic_hansard')
    .select('sitting_date')
    .in('sitting_date', candidates);
  const existingDates = new Set((existing || []).map((r: { sitting_date: string }) => r.sitting_date));
  const newDates = candidates.filter(d => !existingDates.has(d)).slice(0, 3); // max 3 per run

  if (newDates.length === 0) {
    return { message: 'No new sitting dates to check', checked: candidates.length, existing: existingDates.size, dry_run: dryRun };
  }

  let totalInserted = 0;
  const errors: string[] = [];

  for (const dateStr of newDates) {
    const [year, month, day] = dateStr.split('-');
    const pdfUrl = `${PDF_BASE}/${year}/${year}_${month}_${day}_WEEKLY.pdf`;

    // HEAD check
    try {
      const headRes = await fetch(pdfUrl, { method: 'HEAD' });
      if (!headRes.ok) continue;
    } catch { continue; }

    // Fetch via Jina Reader
    try {
      const res = await fetch(`${JINA_PREFIX}${pdfUrl}`, {
        headers: { 'Accept': 'text/plain', 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
      });
      if (!res.ok) continue;

      const text = await res.text();
      if (text.length < 100) continue;

      // Parse speeches
      const speeches = parseHansardSpeeches(text, pdfUrl, dateStr, JUSTICE_KW);

      for (const speech of speeches) {
        if (dryRun) { totalInserted++; continue; }
        const { error } = await db.from('civic_hansard').insert(speech);
        if (error && error.code !== '23505') errors.push(error.message);
        else if (!error) totalInserted++;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { dates_checked: newDates.length, inserted: totalInserted, errors: errors.slice(0, 5), dry_run: dryRun };
}

function parseHansardSpeeches(text: string, url: string, date: string, keywords: string[]) {
  const speeches: Record<string, unknown>[] = [];
  const speakerRegex = /(?:^|\n)(?:(?:Hon\.?\s+)?(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+)?([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+)*)\s*\(([^)]+)\)(?:\s*\(([^)]+)\))?\s*:/gm;

  let match;
  const segments: { name: string; meta1: string; meta2: string | null; start: number; end: number }[] = [];

  while ((match = speakerRegex.exec(text)) !== null) {
    if (segments.length > 0) segments[segments.length - 1].end = match.index;
    segments.push({ name: toTitleCase(match[1]), meta1: match[2], meta2: match[3] || null, start: match.index + match[0].length, end: text.length });
  }

  // Simpler fallback pattern
  if (segments.length === 0) {
    const simpleRegex = /(?:^|\n)\s*([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+)*)\s*(?:\(([^)]+)\))?\s*:/gm;
    const skipWords = new Set(['THE', 'AND', 'FOR', 'BUT', 'NOT', 'THIS', 'THAT']);
    while ((match = simpleRegex.exec(text)) !== null) {
      if (match[1].length > 2 && !skipWords.has(match[1])) {
        if (segments.length > 0) segments[segments.length - 1].end = match.index;
        segments.push({ name: toTitleCase(match[1]), meta1: match[2] || '', meta2: null, start: match.index + match[0].length, end: text.length });
      }
    }
  }

  for (const seg of segments) {
    const bodyText = text.slice(seg.start, seg.end).trim();
    if (bodyText.length < 30) continue;

    const fullText = `${seg.name} ${bodyText}`.toLowerCase();
    if (!keywords.some(kw => fullText.includes(kw))) continue;

    const metaParts = (seg.meta1 || '').split('—');
    const lowerBody = bodyText.toLowerCase().slice(0, 200);
    let speechType = 'speech';
    if (lowerBody.includes('i ask the minister') || lowerBody.includes('my question is')) speechType = 'question';
    else if (lowerBody.includes('i table') || lowerBody.includes('i thank the member for')) speechType = 'answer';
    else if (bodyText.length < 100) speechType = 'interjection';

    const firstLine = bodyText.split('\n')[0].trim();

    speeches.push({
      sitting_date: date,
      speaker_name: seg.name,
      speaker_party: metaParts[1]?.trim() || null,
      speaker_electorate: metaParts[0]?.trim() || null,
      speaker_role: seg.meta2,
      speech_type: speechType,
      subject: firstLine.length < 120 && firstLine.length > 5 ? firstLine : null,
      body_text: bodyText.slice(0, 50000),
      source_url: url,
      source_format: 'pdf',
      jurisdiction: 'QLD',
      scraped_at: new Date().toISOString(),
    });
  }

  return speeches;
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function runSpendingScraper(db: SupabaseClient, dryRun: boolean) {
  // Lightweight: check CKAN for new resources
  // Full parsing done by the CLI script
  const CKAN_BASE = 'https://data.qld.gov.au/api/3/action';
  let newResources = 0;

  try {
    const res = await fetch(
      `${CKAN_BASE}/package_search?q=consultancy+spending+justice&rows=5&sort=metadata_modified+desc`,
      { headers: { 'User-Agent': 'CivicGraph/1.0' } }
    );
    if (res.ok) {
      const data = await res.json();
      newResources = data.result?.count || 0;
    }
  } catch { /* skip */ }

  return { message: 'Full spending scrape runs via CLI script', datasets_available: newResources, dry_run: dryRun };
}

async function runCrossLinker(db: SupabaseClient, dryRun: boolean) {
  // Lightweight cross-linking: link recent un-enriched statements
  const { data: statements } = await db
    .from('civic_ministerial_statements')
    .select('id, headline, body_text')
    .is('enriched_at', null)
    .order('published_at', { ascending: false })
    .limit(10);

  if (!statements?.length) return { linked: 0, message: 'No un-enriched statements' };

  let linked = 0;
  for (const stmt of statements) {
    const text = `${stmt.headline} ${stmt.body_text || ''}`;

    // Extract search terms from headline
    const terms = stmt.headline
      .split(/\s+/)
      .filter((w: string) => w.length > 4 && w[0] === w[0].toUpperCase())
      .slice(0, 3);

    const fundingIds: string[] = [];
    for (const term of terms) {
      const { data: funding } = await db
        .from('justice_funding')
        .select('id')
        .ilike('program_name', `%${term}%`)
        .limit(3);
      if (funding) funding.forEach(f => fundingIds.push(f.id));
    }

    if (fundingIds.length > 0 && !dryRun) {
      await db
        .from('civic_ministerial_statements')
        .update({
          linked_funding_ids: [...new Set(fundingIds)],
          enriched_at: new Date().toISOString(),
        })
        .eq('id', stmt.id);
      linked++;
    }
  }

  return { linked, processed: statements.length, dry_run: dryRun };
}

async function runCommitmentTracker(db: SupabaseClient, dryRun: boolean) {
  const STOPS = new Set(['that', 'this', 'with', 'from', 'will', 'have', 'been',
    'their', 'they', 'them', 'than', 'more', 'each', 'also', 'into', 'over',
    'ensure', 'support', 'including', 'implement', 'deliver', 'provide', 'work']);

  function extractKw(text: string) {
    return [...new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3 && !STOPS.has(w)))];
  }

  const [{ data: commitments }, { data: statements }, { data: funding }, { data: interventions }] = await Promise.all([
    db.from('civic_charter_commitments').select('*'),
    db.from('civic_ministerial_statements').select('id, headline, body_text, minister_name, mentioned_amounts, published_at'),
    db.from('justice_funding').select('id, program_name, recipient_name, amount_dollars').eq('state', 'QLD').limit(200),
    db.from('alma_interventions').select('id, name').neq('verification_status', 'ai_generated').not('gs_entity_id', 'is', null).limit(200),
  ]);

  if (!commitments?.length || !statements?.length) return { updated: 0, message: 'No data' };

  let updated = 0;
  const statusCounts: Record<string, number> = {};

  for (const c of commitments) {
    const kws = extractKw(c.commitment_text);
    if (!kws.length) continue;

    const matchedStmts = statements.filter(s => {
      const text = `${s.headline} ${s.body_text || ''}`.toLowerCase();
      const hits = kws.filter(kw => text.includes(kw)).length;
      const ministerMatch = c.minister_name && s.minister_name?.includes(c.minister_name.split(' ').pop() || '');
      return (hits / kws.length) >= 0.3 || (hits >= 2 && ministerMatch);
    }).slice(0, 10);

    const matchedFunding = (funding || []).filter(f => {
      const text = `${f.program_name || ''} ${f.recipient_name || ''}`.toLowerCase();
      return kws.filter(kw => text.includes(kw)).length >= 2;
    }).slice(0, 10);

    const matchedInts = (interventions || []).filter(i =>
      kws.filter(kw => i.name.toLowerCase().includes(kw)).length >= 2
    ).slice(0, 10);

    const hasFunding = matchedFunding.length > 0;
    const hasPrograms = matchedInts.length > 0;
    const hasStatements = matchedStmts.length > 0;

    const newStatus = (hasFunding && hasPrograms) ? 'delivered'
      : (hasFunding || hasPrograms || hasStatements) ? 'in_progress'
      : 'not_started';

    statusCounts[newStatus] = (statusCounts[newStatus] || 0) + 1;

    if (!hasStatements && !hasFunding && !hasPrograms) continue;
    if (dryRun) continue;

    const { error } = await db.from('civic_charter_commitments').update({
      status: newStatus,
      status_evidence: [
        matchedStmts.length ? `${matchedStmts.length} statement(s)` : '',
        matchedFunding.length ? `${matchedFunding.length} funding` : '',
        matchedInts.length ? `${matchedInts.length} program(s)` : '',
      ].filter(Boolean).join(' | '),
      linked_statement_ids: matchedStmts.map(s => s.id),
      linked_funding_ids: matchedFunding.map(f => f.id),
      linked_intervention_ids: matchedInts.map(i => i.id),
      updated_at: new Date().toISOString(),
    }).eq('id', c.id);

    if (!error) updated++;
  }

  return { updated, status_breakdown: statusCounts, dry_run: dryRun };
}

function extractBodyText(html: string): string {
  const contentMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<div class="[^"]*content[^"]*">([\s\S]*?)<\/div>/i);
  if (!contentMatch) return '';
  return contentMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
