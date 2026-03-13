/**
 * GrantConnect Source Plugin
 *
 * Two-phase discovery:
 *   1. Fetch RSS feed (direct HTTP with browser UA — no Firecrawl needed)
 *      → ~130 grants with title, link, description
 *   2. Scrape /Go/List with Playwright for the full open opportunity list
 *      → all open GOs with close date, agency, category
 *
 * RSS URL: https://www.grants.gov.au/public_data/rss/rss.xml
 * List URL: https://www.grants.gov.au/Go/List
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const RSS_URL = 'https://www.grants.gov.au/public_data/rss/rss.xml';
const LIST_URL = 'https://www.grants.gov.au/Go/List';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface GrantConnectConfig {
  /** Skip Playwright scraping (RSS only) — useful for quick runs or CI */
  rssOnly?: boolean;
  /** Max pages to scrape from /Go/List (default: 20, ~500 grants) */
  maxListPages?: number;
}

export function createGrantConnectPlugin(config: GrantConnectConfig = {}): SourcePlugin {

  function extractAgency(title: string, description: string): string {
    const deptMatch = description.match(/Department of ([\w\s]+?)(?:\.|,|\s(?:is|has|will))/i);
    if (deptMatch) return `Department of ${deptMatch[1].trim()}`;
    return 'Australian Government';
  }

  function inferCategories(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const cats: string[] = [];

    if (/indigenous|first nations|aboriginal|torres strait|atsi/.test(text)) cats.push('indigenous');
    if (/arts?|cultur|creative|music|film|heritage/.test(text)) cats.push('arts');
    if (/justice|youth diversion|legal|corrective/.test(text)) cats.push('justice');
    if (/health|palliative|mental|wellbeing|medical|aged care/.test(text)) cats.push('health');
    if (/communit/.test(text)) cats.push('community');
    if (/environment|climate|land management|regenerat|water|biodiversity/.test(text)) cats.push('regenerative');
    if (/enterprise|business|economic|employment|workforce/.test(text)) cats.push('enterprise');
    if (/education|training|school|research|university|scholarship/.test(text)) cats.push('education');
    if (/technolog|digital|cyber|innovat/.test(text)) cats.push('technology');
    if (/story|stories|narrative|media/.test(text)) cats.push('stories');

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
    return {};
  }

  /** Phase 1: Fetch RSS feed via direct HTTP */
  async function fetchRSSGrants(): Promise<RawGrant[]> {
    console.log('[grantconnect] Phase 1: Fetching RSS feed...');

    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/xml,text/xml,*/*' },
    });

    if (!res.ok) {
      console.error(`[grantconnect] RSS fetch failed: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const $ = cheerio.load(xml, { xml: true });
    const items = $('item');
    console.log(`[grantconnect] RSS: ${items.length} items`);

    const grants: RawGrant[] = [];
    items.each((_, el) => {
      const $item = $(el);
      const rawTitle = $item.find('title').text().trim();
      const link = $item.find('link').text().trim() || $item.find('guid').text().trim();
      const description = $item.find('description').text().trim();

      if (!rawTitle) return;

      const titleMatch = rawTitle.match(/^GO\d+:\s*(.+)$/);
      const title = titleMatch ? titleMatch[1] : rawTitle;
      const goId = rawTitle.match(/^(GO\d+)/)?.[1];

      grants.push({
        title,
        provider: extractAgency(title, description),
        sourceUrl: link || undefined,
        description: description.slice(0, 1000) || undefined,
        categories: inferCategories(title, description),
        sourceId: 'grantconnect',
        geography: ['AU'],
        program: goId,
      });
    });

    return grants;
  }

  interface ListGrant {
    title: string;
    url: string;
    agency: string;
    closeDate: string;
    goId: string;
    category: string;
    description: string;
  }

  /**
   * Phase 2: Scrape /Go/List with Playwright for full listing + metadata.
   *
   * GrantConnect is a JS SPA behind CloudFront bot protection.
   * Requires non-headless Playwright with stealth settings to bypass.
   * Each page has ~15 grant cards in `.row.boxEQH` divs with
   * `.list-desc` label/value pairs for close date, agency, category.
   */
  async function scrapeFullList(maxPages: number): Promise<RawGrant[]> {
    console.log('[grantconnect] Phase 2: Scraping /Go/List with Playwright...');

    // Dynamic import — Playwright may not be installed in all environments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chromium: any;
    try {
      chromium = (await import('playwright')).chromium;
    } catch {
      console.error('[grantconnect] Playwright not available — skipping full list scrape');
      return [];
    }

    // Non-headless + stealth to bypass CloudFront bot detection
    const browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      userAgent: BROWSER_UA,
      locale: 'en-AU',
      timezoneId: 'Australia/Brisbane',
    });
    const page = await context.newPage();
    await page.addInitScript('Object.defineProperty(navigator, "webdriver", { get: () => false })');

    const grants: RawGrant[] = [];

    try {
      await page.goto(LIST_URL, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForSelector('.row.boxEQH', { timeout: 15000 });

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        // Extract grants from current page (runs in browser context)
        const pageGrants: ListGrant[] = await page.evaluate(`
          (() => {
            const results = [];
            const articles = document.querySelectorAll('.row.boxEQH');
            for (const article of articles) {
              const title = (article.querySelector('.font20') || {}).textContent?.trim() || '';
              const goLink = article.querySelector('a[href*="/Go/Show"]');
              const goId = goLink?.textContent?.trim() || '';
              const url = goLink?.getAttribute('href') || '';

              const fields = {};
              const descs = article.querySelectorAll('.list-desc');
              for (const desc of descs) {
                const label = (desc.querySelector('span') || {}).textContent?.trim()?.replace(':', '') || '';
                const value = (desc.querySelector('.list-desc-inner') || {}).textContent?.trim() || '';
                if (label) fields[label] = value;
              }

              if (!title) continue;
              results.push({
                title,
                goId,
                url: url.startsWith('http') ? url : 'https://www.grants.gov.au' + url,
                agency: fields['Agency'] || '',
                closeDate: fields['Close Date & Time'] || fields['Close Date'] || '',
                category: fields['Primary Category'] || fields['Category'] || '',
                description: (fields['Description'] || '').slice(0, 1000),
              });
            }
            return results;
          })()
        `);

        if (pageGrants.length === 0) {
          console.log(`[grantconnect] Page ${pageNum}: no grants found, stopping`);
          break;
        }

        console.log(`[grantconnect] Page ${pageNum}: ${pageGrants.length} grants`);

        for (const g of pageGrants) {
          // Parse close date — format: "1-Mar-2026 5:00 pm (ACT Local Time)"
          let deadline: string | undefined;
          if (g.closeDate) {
            const cleaned = g.closeDate.replace(/\s*\(.*\)\s*$/, '').trim();
            const parsed = new Date(cleaned);
            if (!isNaN(parsed.getTime())) {
              deadline = parsed.toISOString();
            }
          }

          const fullDesc = [g.description, g.category].filter(Boolean).join('. ');

          grants.push({
            title: g.title,
            provider: g.agency || 'Australian Government',
            sourceUrl: g.url,
            description: fullDesc || undefined,
            deadline,
            categories: inferCategories(g.title, fullDesc),
            sourceId: 'grantconnect',
            geography: ['AU'],
            program: g.goId || undefined,
          });
        }

        // Navigate to next page
        const hasNext: boolean = await page.evaluate(`
          (() => {
            const links = document.querySelectorAll('.pagination a, [class*=pager] a');
            for (const link of links) {
              if (link.textContent.trim() === 'Next') { link.click(); return true; }
            }
            return false;
          })()
        `);

        if (!hasNext) {
          console.log(`[grantconnect] No more pages after page ${pageNum}`);
          break;
        }

        await page.waitForTimeout(2000);
        await page.waitForLoadState('networkidle').catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[grantconnect] Playwright error: ${msg}`);
    } finally {
      await browser.close();
    }

    return grants;
  }

  return {
    id: 'grantconnect',
    name: 'GrantConnect (grants.gov.au)',
    type: 'scraper',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      // Phase 1: RSS (always — fast, free)
      const rssGrants = await fetchRSSGrants();

      // Phase 2: Full list via Playwright (unless rssOnly)
      let listGrants: RawGrant[] = [];
      if (!config.rssOnly) {
        listGrants = await scrapeFullList(config.maxListPages ?? 20);
      }

      // Merge: prefer Playwright data (has deadlines), use RSS to fill gaps
      const seen = new Set<string>();
      const allGrants: RawGrant[] = [];

      // Playwright grants first (richer data)
      for (const g of listGrants) {
        const key = g.title.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allGrants.push(g);
        }
      }

      // Then RSS grants to fill gaps
      for (const g of rssGrants) {
        const key = g.title.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allGrants.push(g);
        }
      }

      console.log(`[grantconnect] Total: ${allGrants.length} unique grants (${listGrants.length} from list, ${rssGrants.length} from RSS)`);

      // Apply query filters
      const queryCategories = new Set(query.categories?.map(c => c.toLowerCase()) || []);
      const queryKeywords = query.keywords?.map(k => k.toLowerCase()) || [];

      for (const grant of allGrants) {
        // Filter by categories
        if (queryCategories.size > 0) {
          const hasMatch = grant.categories?.some(c => queryCategories.has(c));
          if (!hasMatch && (grant.categories?.length ?? 0) > 0) continue;
        }

        // Filter by keywords
        if (queryKeywords.length > 0) {
          const text = `${grant.title} ${grant.description || ''}`.toLowerCase();
          const hasMatch = queryKeywords.some(k => text.includes(k));
          if (!hasMatch) continue;
        }

        yield grant;
      }
    },
  };
}
