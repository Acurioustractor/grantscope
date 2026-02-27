/**
 * GrantConnect Source Plugin
 *
 * Fetches grants from grants.gov.au via their RSS feed.
 * The RSS feed contains ALL open grant opportunities with structured data.
 * GrantConnect blocks direct HTTP (403), so we use Firecrawl to fetch.
 *
 * RSS URL: https://www.grants.gov.au/public_data/rss/rss.xml
 * Contains: title (GO ID + name), link, description, pubDate per grant
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

interface GrantConnectConfig {
  firecrawlApiKey?: string;
}

const RSS_URL = 'https://www.grants.gov.au/public_data/rss/rss.xml';

export function createGrantConnectPlugin(config: GrantConnectConfig = {}): SourcePlugin {
  function getFirecrawl(): FirecrawlApp {
    const apiKey = config.firecrawlApiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY required for GrantConnect scraping');
    }
    return new FirecrawlApp({ apiKey });
  }

  /**
   * Extract agency name from description or title.
   * GrantConnect descriptions sometimes mention the funding agency.
   */
  function extractAgency(title: string, description: string): string {
    // The GO listing page shows agency, but RSS doesn't include it separately.
    // Some descriptions mention "Australian Government" or specific departments.
    const deptMatch = description.match(/Department of ([\w\s]+?)(?:\.|,|\s(?:is|has|will))/i);
    if (deptMatch) return `Department of ${deptMatch[1].trim()}`;

    return 'Australian Government';
  }

  /**
   * Infer categories from title and description.
   */
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

  return {
    id: 'grantconnect',
    name: 'GrantConnect (grants.gov.au)',
    type: 'scraper',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      let firecrawl: FirecrawlApp;
      try {
        firecrawl = getFirecrawl();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[grantconnect] ${msg}`);
        return;
      }

      console.log(`[grantconnect] Fetching RSS feed...`);

      let html: string;
      try {
        const result = await firecrawl.scrape(RSS_URL, { formats: ['html'] });
        html = result.html || '';
        if (!html) {
          console.error('[grantconnect] Empty response from Firecrawl');
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[grantconnect] Firecrawl error: ${msg}`);
        return;
      }

      // Parse RSS XML (cheerio handles XML fine)
      const $ = cheerio.load(html, { xml: true });
      const items = $('item');
      console.log(`[grantconnect] Found ${items.length} grants in RSS feed`);

      const queryCategories = new Set(query.categories?.map(c => c.toLowerCase()) || []);
      const queryKeywords = query.keywords?.map(k => k.toLowerCase()) || [];
      let yielded = 0;

      items.each((_, el) => {
        const $item = $(el);
        const rawTitle = $item.find('title').text().trim();
        const link = $item.find('link').text().trim() || $item.find('guid').text().trim();
        const description = $item.find('description').text().trim();

        if (!rawTitle) return;

        // Parse title: "GO7867: Major and Local Community Infrastructure Program"
        const titleMatch = rawTitle.match(/^GO\d+:\s*(.+)$/);
        const title = titleMatch ? titleMatch[1] : rawTitle;

        const categories = inferCategories(title, description);
        const provider = extractAgency(title, description);

        // Filter by categories if specified
        if (queryCategories.size > 0) {
          const hasMatch = categories.some(c => queryCategories.has(c));
          if (!hasMatch && categories.length > 0) return; // Skip non-matching (but keep uncategorized)
        }

        // Filter by keywords if specified
        if (queryKeywords.length > 0) {
          const text = `${title} ${description}`.toLowerCase();
          const hasMatch = queryKeywords.some(k => text.includes(k));
          if (!hasMatch) return;
        }

        yielded++;
      });

      // Reset and yield (cheerio .each can't use yield, so collect first)
      const grants: RawGrant[] = [];
      items.each((_, el) => {
        const $item = $(el);
        const rawTitle = $item.find('title').text().trim();
        const link = $item.find('link').text().trim() || $item.find('guid').text().trim();
        const description = $item.find('description').text().trim();

        if (!rawTitle) return;

        const titleMatch = rawTitle.match(/^GO\d+:\s*(.+)$/);
        const title = titleMatch ? titleMatch[1] : rawTitle;

        const categories = inferCategories(title, description);
        const provider = extractAgency(title, description);

        // Filter by categories
        if (queryCategories.size > 0) {
          const hasMatch = categories.some(c => queryCategories.has(c));
          if (!hasMatch && categories.length > 0) return;
        }

        // Filter by keywords
        if (queryKeywords.length > 0) {
          const text = `${title} ${description}`.toLowerCase();
          const hasMatch = queryKeywords.some(k => text.includes(k));
          if (!hasMatch) return;
        }

        grants.push({
          title,
          provider,
          sourceUrl: link || undefined,
          description: description.slice(0, 1000) || undefined,
          categories,
          sourceId: 'grantconnect',
          geography: ['AU'],
        });
      });

      console.log(`[grantconnect] ${grants.length} grants after filtering (of ${items.length} total)`);

      for (const grant of grants) {
        yield grant;
      }
    },
  };
}
