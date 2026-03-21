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
      ? ['statements', 'hansard', 'spending', 'crosslink']
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
            || detailHtml.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]?.replace(/<[^>]*>/g, '').trim()
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
  // Lightweight: search for recent Hansard and insert summaries
  // Full scraping done by the CLI script
  return { message: 'Hansard scraping runs via CLI script (scrape-qld-hansard.mjs)', dry_run: dryRun };
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
