/**
 * NSW Grants Source Plugin
 *
 * Scrapes grants from nsw.gov.au/grants-and-funding using direct HTTP.
 * No Firecrawl required — NSW portal returns standard HTML.
 */

import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const NSW_GRANTS_URL = 'https://www.nsw.gov.au/grants-and-funding';

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];
  if (/indigenous|first nations|aboriginal/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/research|science|stem/.test(text)) cats.push('research');
  if (/safety|safework|work/.test(text)) cats.push('safety');
  return cats;
}

function extractAmounts(text: string): { min?: number; max?: number } {
  const rangeMatch = text.match(/\$([0-9,]+)\s*(?:to|-)\s*\$([0-9,]+)/i);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1].replace(/,/g, ''), 10),
      max: parseInt(rangeMatch[2].replace(/,/g, ''), 10),
    };
  }
  const upToMatch = text.match(/up to \$([0-9,]+)/i);
  if (upToMatch) return { max: parseInt(upToMatch[1].replace(/,/g, ''), 10) };
  const singleMatch = text.match(/\$([0-9,]{4,})/);
  if (singleMatch) return { max: parseInt(singleMatch[1].replace(/,/g, ''), 10) };
  return {};
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /(?:closes?|closing|deadline|due|applications?\s+close)[\s:]*(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GrantScope/1.0 (research; contact@act.place)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractTextContent(html: string): string {
  // Simple HTML-to-text: strip tags, decode entities
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createNSWGrantsPlugin(): SourcePlugin {
  return {
    id: 'nsw-grants',
    name: 'NSW Grants & Funding',
    type: 'scraper',
    geography: ['AU-NSW'],

    async *discover(_query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[nsw-grants] Scraping nsw.gov.au/grants-and-funding...');

      // Collect grant URLs from all pages
      const grantPaths = new Set<string>();
      const skipPaths = new Set([
        '/grants-and-funding',
        '/grants-and-funding/personalisation-pilot',
        '/grants-and-funding/grants-administration-guide',
        '/grants-and-funding/regional-growth-fund',
      ]);

      for (let page = 0; page < 50; page++) {
        try {
          const html = await fetchPage(`${NSW_GRANTS_URL}?page=${page}`);
          const matches = html.matchAll(/href="(\/grants-and-funding\/[a-z0-9][a-z0-9-]+)"/g);
          let found = 0;
          for (const m of matches) {
            const path = m[1];
            if (!skipPaths.has(path) && !grantPaths.has(path)) {
              grantPaths.add(path);
              found++;
            }
          }
          if (found === 0) break;
        } catch {
          break;
        }
        // Polite delay
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`[nsw-grants] Found ${grantPaths.size} grant URLs`);

      let yielded = 0;
      for (const path of grantPaths) {
        const url = `https://www.nsw.gov.au${path}`;
        try {
          const html = await fetchPage(url);

          // Extract title from <h1>
          const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          const title = titleMatch
            ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
            : path.split('/').pop()?.replace(/-/g, ' ') || '';
          if (!title || title.length < 5) continue;

          // Extract meta description
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
          const metaDesc = descMatch ? descMatch[1] : '';

          // Get full text for amount/deadline extraction
          const fullText = extractTextContent(html);

          const categories = inferCategories(title, fullText);
          const amounts = extractAmounts(fullText);
          const deadline = extractDeadline(fullText);

          // Use first 500 chars of meta description or page text as summary
          const description = metaDesc || fullText.slice(0, 500);

          yield {
            title,
            provider: 'NSW Government',
            sourceUrl: url,
            amount: amounts.min || amounts.max ? amounts : undefined,
            deadline,
            description,
            categories,
            sourceId: 'nsw-grants',
            geography: ['AU-NSW'],
          };
          yielded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[nsw-grants] Error scraping ${url}: ${msg}`);
        }

        // Polite delay between page fetches
        await new Promise(r => setTimeout(r, 300));
      }

      console.log(`[nsw-grants] Yielded ${yielded} grants`);
    },
  };
}
