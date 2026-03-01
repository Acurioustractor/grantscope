/**
 * ACT Grants Source Plugin
 *
 * Scrapes grants from the ACT Government grants portal.
 * Direct HTTP with Cheerio — no JS rendering needed.
 *
 * URL: https://www.act.gov.au/grants
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const ACT_GRANTS_URL = 'https://www.act.gov.au/grants';
const ACT_BASE = 'https://www.act.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation|energy/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|trade/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|skill/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/sport|recreation|active/.test(text)) cats.push('sport');
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/housing|homelessness|accommodation/.test(text)) cats.push('community');
  if (/multicultural|diversity|inclusion/.test(text)) cats.push('community');

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

export function createACTGrantsPlugin(): SourcePlugin {
  return {
    id: 'act-grants',
    name: 'ACT Grants',
    type: 'scraper',
    geography: ['AU-ACT'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[act-grants] Scraping ACT Government grants portal...');

      try {
        const html = await fetchPage(ACT_GRANTS_URL);
        const $ = cheerio.load(html);

        const grantEntries = new Map<string, { title: string; url: string; description: string }>();

        // Find grant links in the page content
        $('a[href]').each((_, el) => {
          const $el = $(el);
          const href = $el.attr('href') || '';
          const title = $el.text().trim();

          if (!title || title.length < 5) return;
          if (/privacy|contact|sitemap|login|search|menu|skip|back to top/i.test(title)) return;

          // Only include links that look like grant pages
          const isGrantLink = /grant|fund|program|subsid|rebate|assist|support/i.test(title) ||
            /grant|fund|program/i.test(href);
          if (!isGrantLink) return;

          const fullUrl = href.startsWith('http') ? href : `${ACT_BASE}${href}`;

          // Avoid duplicates and navigation links
          if (grantEntries.has(fullUrl)) return;
          if (fullUrl === `${ACT_BASE}/grants` || fullUrl === ACT_GRANTS_URL) return;

          // Get surrounding context
          const parentText = $el.closest('li, div, article, section').text() || '';
          const description = parentText.replace(/\s+/g, ' ').trim();

          grantEntries.set(fullUrl, { title, url: fullUrl, description });
        });

        // Also check for structured listings (cards, list items)
        $('.card, .listing-item, .views-row, article').each((_, el) => {
          const $el = $(el);
          const link = $el.find('a').first();
          const href = link.attr('href') || '';
          const title = link.text().trim() || $el.find('h2, h3, h4').first().text().trim();
          const description = $el.text().replace(/\s+/g, ' ').trim();

          if (!title || title.length < 5) return;
          if (!/grant|fund|program|assist|support/i.test(description)) return;

          const fullUrl = href
            ? (href.startsWith('http') ? href : `${ACT_BASE}${href}`)
            : undefined;

          if (fullUrl && !grantEntries.has(fullUrl)) {
            grantEntries.set(fullUrl, { title, url: fullUrl, description });
          }
        });

        console.log(`[act-grants] Found ${grantEntries.size} grant entries`);

        let yielded = 0;
        for (const [, entry] of grantEntries) {
          const categories = inferCategories(entry.title, entry.description);
          const amounts = extractAmounts(entry.description);
          const deadline = extractDeadline(entry.description);

          // Apply query filters
          if (query.categories?.length) {
            const queryLower = query.categories.map(c => c.toLowerCase());
            if (categories.length > 0 && !categories.some(c => queryLower.includes(c))) continue;
          }

          if (query.keywords?.length) {
            const text = `${entry.title} ${entry.description}`.toLowerCase();
            if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
          }

          yield {
            title: entry.title.slice(0, 200),
            provider: 'ACT Government',
            sourceUrl: entry.url,
            amount: amounts.min || amounts.max ? amounts : undefined,
            deadline,
            description: entry.description.slice(0, 500) || undefined,
            categories,
            sourceId: 'act-grants',
            geography: ['AU-ACT'],
          };
          yielded++;
        }

        console.log(`[act-grants] Yielded ${yielded} grants`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[act-grants] Scrape error: ${msg}`);
      }
    },
  };
}
