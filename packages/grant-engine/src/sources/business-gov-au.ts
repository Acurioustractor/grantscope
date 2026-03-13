/**
 * business.gov.au Source Plugin
 *
 * Scrapes business.gov.au/grants-and-programs for aggregated
 * federal + state + local grants. Uses Firecrawl for scraping.
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const GRANTS_URL = 'https://business.gov.au/grants-and-programs';

interface BusinessGovConfig {
  firecrawlApiKey?: string;
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|energy|sustainab/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|export|trade/.test(text)) cats.push('enterprise');
  if (/education|training|research|apprentice/.test(text)) cats.push('education');
  if (/technolog|digital|innovat|cyber/.test(text)) cats.push('technology');
  if (/justice|youth/.test(text)) cats.push('justice');

  return cats;
}

function extractAmounts(text: string): { min?: number; max?: number } {
  // Match patterns like "$5,000 to $50,000" or "up to $100,000"
  const rangeMatch = text.match(/\$([0-9,]+)\s*(?:to|-)\s*\$([0-9,]+)/i);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1].replace(/,/g, ''), 10),
      max: parseInt(rangeMatch[2].replace(/,/g, ''), 10),
    };
  }

  const upToMatch = text.match(/up to \$([0-9,]+)/i);
  if (upToMatch) {
    return { max: parseInt(upToMatch[1].replace(/,/g, ''), 10) };
  }

  const singleMatch = text.match(/\$([0-9,]+)/);
  if (singleMatch) {
    const amt = parseInt(singleMatch[1].replace(/,/g, ''), 10);
    return { max: amt };
  }

  return {};
}

export function createBusinessGovAuPlugin(config: BusinessGovConfig = {}): SourcePlugin {
  function getFirecrawl(): FirecrawlApp {
    const apiKey = config.firecrawlApiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY required for business.gov.au scraping');
    }
    return new FirecrawlApp({ apiKey });
  }

  return {
    id: 'business-gov-au',
    name: 'business.gov.au Grants',
    type: 'scraper',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      let firecrawl: FirecrawlApp;
      try {
        firecrawl = getFirecrawl();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[business-gov-au] ${msg}`);
        return;
      }

      console.log('[business-gov-au] Scraping grants listing...');

      try {
        const result = await firecrawl.scrape(GRANTS_URL, { formats: ['markdown', 'html'] });
        const markdown = result.markdown || '';
        const html = result.html || '';

        if (!markdown && !html) {
          console.error('[business-gov-au] Empty response');
          return;
        }

        // Try HTML parsing first for structured data
        if (html) {
          const $ = cheerio.load(html);

          // business.gov.au lists grants as cards/items
          const grantElements = $('a[href*="/grants-and-programs/"]').toArray();
          console.log(`[business-gov-au] Found ${grantElements.length} grant links`);

          const seen = new Set<string>();

          for (const el of grantElements) {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const title = $el.text().trim();

            if (!title || title.length < 5) continue;
            if (seen.has(title.toLowerCase())) continue;
            seen.add(title.toLowerCase());

            // Skip navigation/category links
            if (href === '/grants-and-programs' || href.endsWith('/grants-and-programs/')) continue;

            const fullUrl = href.startsWith('http') ? href : `https://business.gov.au${href}`;
            const parentText = $el.parent().text() || '';
            const categories = inferCategories(title, parentText);
            const amounts = extractAmounts(parentText);

            yield {
              title,
              provider: 'Australian Government',
              sourceUrl: fullUrl,
              amount: amounts,
              description: parentText.slice(0, 500) || undefined,
              categories,
              sourceId: 'business-gov-au',
              geography: ['AU'],
            };
          }
        }

        // Fallback: parse markdown for grant listings
        if (!html) {
          const lines = markdown.split('\n');
          for (const line of lines) {
            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (!linkMatch) continue;

            const title = linkMatch[1].trim();
            const url = linkMatch[2].trim();

            if (!url.includes('grants-and-programs/') || title.length < 5) continue;

            const fullUrl = url.startsWith('http') ? url : `https://business.gov.au${url}`;
            const categories = inferCategories(title, line);
            const amounts = extractAmounts(line);

            yield {
              title,
              provider: 'Australian Government',
              sourceUrl: fullUrl,
              amount: amounts,
              description: undefined,
              categories,
              sourceId: 'business-gov-au',
              geography: ['AU'],
            };
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[business-gov-au] Scrape error: ${msg}`);
      }
    },
  };
}
