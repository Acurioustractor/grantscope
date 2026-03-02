/**
 * VIC Grants Source Plugin
 *
 * Victoria's grants portal at vic.gov.au/grants is a JS-rendered SPA.
 * Strategy:
 * 1. Try Firecrawl to crawl multiple pages (handles JS rendering)
 * 2. Also scrape individual department portals for additional coverage
 * 3. Fall back to direct HTTP if Firecrawl unavailable
 *
 * Victorian departments with grants:
 * - vic.gov.au/grants (main portal)
 * - Creative Victoria, VicHealth, Sport & Rec Victoria
 * - DJCS, DEECA, DTP, etc.
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const VIC_MAIN_URL = 'https://www.vic.gov.au/grants';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const VIC_DEPARTMENT_URLS = [
  { url: 'https://www.vic.gov.au/grants', name: 'VIC Gov Main' },
  { url: 'https://creative.vic.gov.au/funding', name: 'Creative Victoria' },
  { url: 'https://www.vichealth.vic.gov.au/funding', name: 'VicHealth' },
  { url: 'https://sport.vic.gov.au/grants-and-funding', name: 'Sport & Rec VIC' },
  { url: 'https://www.environment.vic.gov.au/grants', name: 'DEECA Grants' },
  { url: 'https://www.rdv.vic.gov.au/grants-and-programs', name: 'Regional Development VIC' },
  { url: 'https://www.business.vic.gov.au/grants-and-programs', name: 'Business VIC' },
  { url: 'https://www.aboriginalvictoria.vic.gov.au/grants-and-funding', name: 'Aboriginal Victoria' },
  { url: 'https://www.localgovernment.vic.gov.au/grants', name: 'Local Gov VIC' },
  { url: 'https://www.health.vic.gov.au/funding-and-grants', name: 'Health VIC' },
];

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];
  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical|hospital/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/agricult|farm|rural|regional/.test(text)) cats.push('regenerative');
  if (/screen|film|media/.test(text)) cats.push('arts');
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

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function getBaseUrl(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

/** Try Firecrawl for the main VIC portal (JS SPA) */
async function tryFirecrawl(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  try {
    const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return grants;

    console.log('[vic-grants] Crawling vic.gov.au/grants with Firecrawl...');
    const firecrawl = new FirecrawlApp({ apiKey });

    // Use map to discover all grant URLs, then scrape individually
    const mapResult = await firecrawl.map(VIC_MAIN_URL);
    const rawLinks: unknown[] = mapResult.links || [];
    const grantUrls = rawLinks
      .map((link: unknown) => typeof link === 'string' ? link : (link as { url?: string })?.url || '')
      .filter((url: string) =>
        url.includes('/grants') && !url.endsWith('/grants') && url.includes('vic.gov.au')
      ).slice(0, 200);

    console.log(`[vic-grants] Firecrawl map found ${grantUrls.length} grant URLs`);

    // Scrape each grant page
    for (const url of grantUrls.slice(0, 100)) {
      try {
        const result = await firecrawl.scrape(url, { formats: ['markdown'] });
        const md = result.markdown || '';
        if (!md) continue;

        // Extract title from first heading
        const titleMatch = md.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : '';
        if (!title || title.length < 5) continue;

        const amounts = extractAmounts(md);
        const deadline = extractDeadline(md);

        grants.push({
          title: title.slice(0, 200),
          provider: 'Victorian Government',
          sourceUrl: url,
          amount: amounts.min || amounts.max ? amounts : undefined,
          deadline,
          description: md.replace(/^#.+$/gm, '').replace(/\n+/g, ' ').trim().slice(0, 500) || undefined,
          categories: inferCategories(title, md),
          sourceId: 'vic-grants',
          geography: ['AU-VIC'],
        });
      } catch {
        continue;
      }

      // Polite delay
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[vic-grants] Firecrawl error: ${msg}`);
  }

  return grants;
}

/** Scrape department portals via direct HTTP */
async function scrapeDepartments(): Promise<RawGrant[]> {
  const allGrants: RawGrant[] = [];

  for (const source of VIC_DEPARTMENT_URLS) {
    try {
      const html = await fetchPage(source.url);
      if (!html) continue;

      const $ = cheerio.load(html);
      const baseUrl = getBaseUrl(source.url);
      const seen = new Set<string>();

      $('a[href]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const title = $el.text().trim();

        if (!title || title.length < 5 || title.length > 200) return;
        if (seen.has(title.toLowerCase())) return;
        if (/privacy|contact|sitemap|login|search|menu|home|back|skip/i.test(title)) return;

        const context = $el.closest('li, div, article, tr').text() || '';
        const isGrantContext = /grant|fund|program|subsid|scheme|support|initiative/i.test(title) ||
          /grant|fund|program|subsid/i.test(href);

        if (!isGrantContext) return;
        seen.add(title.toLowerCase());

        const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

        allGrants.push({
          title: title.slice(0, 200),
          provider: `Victorian Government — ${source.name}`,
          sourceUrl: fullUrl,
          amount: extractAmounts(context),
          deadline: extractDeadline(context),
          description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
          categories: inferCategories(title, context),
          sourceId: 'vic-grants',
          geography: ['AU-VIC'],
        });
      });

      console.log(`[vic-grants] ${source.name}: found ${seen.size} grant links`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[vic-grants] Error scraping ${source.name}: ${msg}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return allGrants;
}

export function createVICGrantsPlugin(): SourcePlugin {
  return {
    id: 'vic-grants',
    name: 'VIC Grants & Programs',
    type: 'scraper',
    geography: ['AU-VIC'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[vic-grants] Fetching Victorian grants...');

      // Combine Firecrawl (main SPA portal) + department scraping
      const [firecrawlGrants, deptGrants] = await Promise.all([
        tryFirecrawl(),
        scrapeDepartments(),
      ]);

      const allGrants = [...firecrawlGrants, ...deptGrants];
      console.log(`[vic-grants] Total: ${allGrants.length} (Firecrawl: ${firecrawlGrants.length}, Depts: ${deptGrants.length})`);

      const seen = new Set<string>();
      let yielded = 0;

      for (const grant of allGrants) {
        const key = grant.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        if (query.categories?.length) {
          const queryLower = query.categories.map(c => c.toLowerCase());
          if (grant.categories?.length && !grant.categories.some(c => queryLower.includes(c))) continue;
        }

        if (query.keywords?.length) {
          const text = `${grant.title} ${grant.description || ''}`.toLowerCase();
          if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
        }

        yield grant;
        yielded++;
      }

      console.log(`[vic-grants] Yielded ${yielded} grants`);
    },
  };
}
