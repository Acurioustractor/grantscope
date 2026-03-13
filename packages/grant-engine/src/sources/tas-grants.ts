/**
 * Tasmania Grants Source Plugin
 *
 * Scrapes grants from the Tasmanian Government grants portal.
 * Direct HTTP with Cheerio — no JS rendering needed.
 *
 * URL: https://www.stategrowth.tas.gov.au/grants_and_funding_opportunities/grants_list
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const TAS_GRANTS_URL = 'https://www.stategrowth.tas.gov.au/grants_and_funding_opportunities/grants_list';
const TAS_BASE = 'https://www.stategrowth.tas.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation|natural/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|trade|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|skill/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/tourism|visitor|hospitality/.test(text)) cats.push('enterprise');
  if (/agricult|farm|rural/.test(text)) cats.push('regenerative');

  return cats;
}

function extractAmounts(text: string): { min?: number; max?: number } {
  const rangeMatch = text.match(/\$([0-9,]+)\s*(?:to|–|-)\s*\$([0-9,]+)/i);
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
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
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
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function createTASGrantsPlugin(): SourcePlugin {
  return {
    id: 'tas-grants',
    name: 'Tasmania Grants & Funding',
    type: 'scraper',
    geography: ['AU-TAS'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[tas-grants] Scraping Tasmanian grants portal...');

      try {
        const html = await fetchPage(TAS_GRANTS_URL);
        const $ = cheerio.load(html);

        // Find grant links — they're typically in list items or cards
        const grantLinks = new Map<string, { title: string; url: string; context: string }>();

        // Look for grant links in content area
        $('a[href*="grants"], a[href*="funding"], a[href*="program"]').each((_, el) => {
          const $el = $(el);
          const href = $el.attr('href') || '';
          const title = $el.text().trim();

          if (!title || title.length < 5) return;
          if (/privacy|contact|sitemap|login|search/i.test(title)) return;

          const fullUrl = href.startsWith('http') ? href : `${TAS_BASE}${href}`;

          // Get surrounding context for amount/deadline extraction
          const parentText = $el.parent().text() || '';
          const siblingText = $el.parent().parent().text() || '';
          const context = `${parentText} ${siblingText}`.slice(0, 1000);

          grantLinks.set(fullUrl, { title, url: fullUrl, context });
        });

        // Also look for grant entries in structured lists/tables
        $('li, tr, .grant, .listing-item, .card').each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          const link = $el.find('a').first();
          const href = link.attr('href') || '';
          const title = link.text().trim() || text.split('\n')[0]?.trim() || '';

          if (!title || title.length < 5) return;
          if (/privacy|contact|sitemap|login|search|menu/i.test(title)) return;
          if (!/grant|fund|program|assist|support/i.test(text)) return;

          const fullUrl = href
            ? (href.startsWith('http') ? href : `${TAS_BASE}${href}`)
            : undefined;

          if (fullUrl && !grantLinks.has(fullUrl)) {
            grantLinks.set(fullUrl, { title, url: fullUrl, context: text });
          }
        });

        console.log(`[tas-grants] Found ${grantLinks.size} potential grant links`);

        let yielded = 0;
        for (const [, entry] of grantLinks) {
          const { title, url, context } = entry;
          const categories = inferCategories(title, context);
          const amounts = extractAmounts(context);
          const deadline = extractDeadline(context);

          // Apply query filters
          if (query.categories?.length) {
            const queryLower = query.categories.map(c => c.toLowerCase());
            if (categories.length > 0 && !categories.some(c => queryLower.includes(c))) continue;
          }

          if (query.keywords?.length) {
            const text = `${title} ${context}`.toLowerCase();
            if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
          }

          yield {
            title: title.slice(0, 200),
            provider: 'Tasmanian Government',
            sourceUrl: url,
            amount: amounts.min || amounts.max ? amounts : undefined,
            deadline,
            description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
            categories,
            sourceId: 'tas-grants',
            geography: ['AU-TAS'],
          };
          yielded++;
        }

        console.log(`[tas-grants] Yielded ${yielded} grants`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tas-grants] Scrape error: ${msg}`);
      }
    },
  };
}
