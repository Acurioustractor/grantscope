/**
 * NT (GrantsNT) Source Plugin
 *
 * Fetches Northern Territory grants from the GrantsNT portal.
 * Tries REST API first, falls back to Playwright scrape if needed.
 *
 * Portal: https://grantsnt.nt.gov.au/grants
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const GRANTS_NT_URL = 'https://grantsnt.nt.gov.au/grants';
const API_URL = 'https://grantsnt.nt.gov.au/api/v1/grants';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

interface NTGrantAPI {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  organisation?: string;
  agency?: string;
  department?: string;
  amount_min?: number;
  amount_max?: number;
  funding_amount?: string | number;
  close_date?: string;
  closing_date?: string;
  status?: string;
  category?: string;
  url?: string;
  link?: string;
  [key: string]: unknown;
}

function inferCategories(title: string, description: string, category?: string): string[] {
  const text = `${title} ${description} ${category || ''}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation|land/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|trade|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|skill/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/disaster|recovery|cyclone/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/remote|outback|regional/.test(text)) cats.push('community');
  if (/housing|infrastructure/.test(text)) cats.push('community');

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
    /(?:closes?|closing|deadline|due)[\s:]*(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

/** Try the REST API first — structured data, no scraping needed */
async function tryAPIFetch(): Promise<RawGrant[] | null> {
  try {
    const response = await fetch(API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': BROWSER_UA,
      },
    });

    if (!response.ok) {
      console.log(`[nt-grants] API returned ${response.status}, falling back to scrape`);
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const grants: NTGrantAPI[] = Array.isArray(data)
      ? data
      : ((data.data || data.grants || data.results || []) as NTGrantAPI[]);

    if (!Array.isArray(grants) || grants.length === 0) {
      console.log('[nt-grants] API returned empty/invalid data, falling back to scrape');
      return null;
    }

    console.log(`[nt-grants] API returned ${grants.length} grants`);

    return grants.map(g => {
      const title = g.title || g.name || '';
      const description = g.description || g.summary || '';
      const amount = g.amount_max || g.amount_min || (typeof g.funding_amount === 'number' ? g.funding_amount : undefined);

      return {
        title: title.slice(0, 200),
        provider: g.organisation || g.agency || g.department || 'Northern Territory Government',
        sourceUrl: g.url || g.link || undefined,
        amount: amount ? { min: g.amount_min, max: g.amount_max || amount } : undefined,
        deadline: g.close_date || g.closing_date || undefined,
        description: description.slice(0, 1000) || undefined,
        categories: inferCategories(title, description, g.category),
        sourceId: 'nt-grants',
        geography: ['AU-NT'],
      } satisfies RawGrant;
    }).filter(g => g.title.length > 0);
  } catch {
    return null;
  }
}

/** Try Firecrawl (handles JS-rendered SPAs) */
async function tryFirecrawl(): Promise<RawGrant[]> {
  try {
    const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return [];

    console.log('[nt-grants] Trying Firecrawl for JS-rendered content...');
    const firecrawl = new FirecrawlApp({ apiKey });
    const result = await firecrawl.scrape(GRANTS_NT_URL, { formats: ['markdown', 'html'] });
    const html = result.html || '';
    const markdown = result.markdown || '';

    if (!html && !markdown) return [];

    const grants: RawGrant[] = [];

    if (html) {
      const $ = cheerio.load(html);
      $('a[href]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const title = $el.text().trim();
        if (!title || title.length < 5) return;
        if (!/grant|fund|program/i.test(title) && !/grant/i.test(href)) return;

        const fullUrl = href.startsWith('http') ? href : `https://grantsnt.nt.gov.au${href}`;
        const parentText = $el.closest('li, div, article').text() || '';

        grants.push({
          title: title.slice(0, 200),
          provider: 'Northern Territory Government',
          sourceUrl: fullUrl,
          amount: extractAmounts(parentText),
          deadline: extractDeadline(parentText),
          description: parentText.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
          categories: inferCategories(title, parentText),
          sourceId: 'nt-grants',
          geography: ['AU-NT'],
        });
      });
    }

    if (grants.length === 0 && markdown) {
      const lines = markdown.split('\n');
      for (const line of lines) {
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (!linkMatch) continue;
        const title = linkMatch[1].trim();
        const url = linkMatch[2].trim();
        if (title.length < 5) continue;

        grants.push({
          title: title.slice(0, 200),
          provider: 'Northern Territory Government',
          sourceUrl: url.startsWith('http') ? url : `https://grantsnt.nt.gov.au${url}`,
          categories: inferCategories(title, line),
          sourceId: 'nt-grants',
          geography: ['AU-NT'],
        });
      }
    }

    return grants;
  } catch {
    return [];
  }
}

/** Fallback: scrape the HTML portal */
async function scrapeFallback(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  // Try Firecrawl first (handles JS SPA)
  const firecrawlGrants = await tryFirecrawl();
  if (firecrawlGrants.length > 0) return firecrawlGrants;

  try {
    // Try direct HTML fetch
    const response = await fetch(GRANTS_NT_URL, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.error(`[nt-grants] HTML fetch failed: HTTP ${response.status}`);
      return await playwrightFallback();
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for grant listings
    $('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const title = $el.text().trim();

      if (!title || title.length < 5) return;
      if (/privacy|contact|sitemap|login|search|menu/i.test(title)) return;

      const isGrantLink = /grant|fund|program/i.test(title) || /grant/i.test(href);
      if (!isGrantLink) return;

      const fullUrl = href.startsWith('http') ? href : `https://grantsnt.nt.gov.au${href}`;
      if (fullUrl === GRANTS_NT_URL) return;

      const parentText = $el.closest('li, div, article, tr').text() || '';
      const description = parentText.replace(/\s+/g, ' ').trim();
      const amounts = extractAmounts(description);
      const deadline = extractDeadline(description);

      grants.push({
        title: title.slice(0, 200),
        provider: 'Northern Territory Government',
        sourceUrl: fullUrl,
        amount: amounts.min || amounts.max ? amounts : undefined,
        deadline,
        description: description.slice(0, 500) || undefined,
        categories: inferCategories(title, description),
        sourceId: 'nt-grants',
        geography: ['AU-NT'],
      });
    });

    // Also check for structured content
    $('.grant-item, .card, .listing-item, article, .views-row').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const title = link.text().trim() || $el.find('h2, h3, h4').first().text().trim();
      const href = link.attr('href') || '';
      const description = $el.text().replace(/\s+/g, ' ').trim();

      if (!title || title.length < 5) return;

      const fullUrl = href
        ? (href.startsWith('http') ? href : `https://grantsnt.nt.gov.au${href}`)
        : undefined;
      const amounts = extractAmounts(description);
      const deadline = extractDeadline(description);

      grants.push({
        title: title.slice(0, 200),
        provider: 'Northern Territory Government',
        sourceUrl: fullUrl,
        amount: amounts.min || amounts.max ? amounts : undefined,
        deadline,
        description: description.slice(0, 500) || undefined,
        categories: inferCategories(title, description),
        sourceId: 'nt-grants',
        geography: ['AU-NT'],
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nt-grants] Scrape error: ${msg}`);
  }

  return grants;
}

/** Last resort: use Playwright for JS-rendered content */
async function playwrightFallback(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chromium: any;
    try {
      chromium = (await import('playwright')).chromium;
    } catch {
      console.error('[nt-grants] Playwright not available — skipping');
      return grants;
    }

    console.log('[nt-grants] Using Playwright fallback...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'User-Agent': BROWSER_UA });

    await page.goto(GRANTS_NT_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);

    $('a[href*="grant"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const title = $el.text().trim();

      if (!title || title.length < 5) return;

      const fullUrl = href.startsWith('http') ? href : `https://grantsnt.nt.gov.au${href}`;
      const parentText = $el.closest('li, div, article').text() || '';
      const description = parentText.replace(/\s+/g, ' ').trim();

      grants.push({
        title: title.slice(0, 200),
        provider: 'Northern Territory Government',
        sourceUrl: fullUrl,
        description: description.slice(0, 500) || undefined,
        categories: inferCategories(title, description),
        sourceId: 'nt-grants',
        geography: ['AU-NT'],
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nt-grants] Playwright error: ${msg}`);
  }

  return grants;
}

export function createNTGrantsPlugin(): SourcePlugin {
  return {
    id: 'nt-grants',
    name: 'GrantsNT (Northern Territory)',
    type: 'api',
    geography: ['AU-NT'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[nt-grants] Fetching NT grants...');

      // Try API first, fall back to scraping
      let grants = await tryAPIFetch();
      if (!grants) {
        grants = await scrapeFallback();
      }

      console.log(`[nt-grants] Found ${grants.length} grants`);

      // Deduplicate by title
      const seen = new Set<string>();
      let yielded = 0;

      for (const grant of grants) {
        const key = grant.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // Apply query filters
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

      console.log(`[nt-grants] Yielded ${yielded} grants`);
    },
  };
}
