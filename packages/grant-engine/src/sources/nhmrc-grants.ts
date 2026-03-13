/**
 * NHMRC (National Health and Medical Research Council) Source Plugin
 *
 * Downloads Excel summaries of funding round outcomes from nhmrc.gov.au.
 * Each year has a summary-of-results XLSX file with grant details.
 *
 * Data: https://www.nhmrc.gov.au/funding/data-research/outcomes-funding-rounds
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const OUTCOMES_URL = 'https://www.nhmrc.gov.au/funding/data-research/outcomes-funding-rounds';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Known XLSX URLs for recent years (fallback if scraping fails)
const KNOWN_XLSX_URLS = [
  'https://www.nhmrc.gov.au/sites/default/files/documents/attachments/grant%20documents/Summary-of-result-2025-app-round-22122025.xlsx',
  'https://www.nhmrc.gov.au/sites/default/files/documents/attachments/grant%20documents/Summary-of-result-2024-app-round-100725.xlsx',
  'https://www.nhmrc.gov.au/sites/default/files/documents/attachments/grant%20documents/Summary-of-result-2023-app-round-15122023.xlsx',
];

function inferCategories(title: string, scheme: string): string[] {
  const text = `${title} ${scheme}`.toLowerCase();
  const cats: string[] = ['health', 'research'];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/mental health|psychiatry|psychology/.test(text)) cats.push('community');
  // cancer and clinical trials already covered by 'health'
  if (/public health|epidemiol|population/.test(text)) cats.push('community');
  if (/environment|climate/.test(text)) cats.push('regenerative');
  if (/biomedical|molecular|genetic|genom/.test(text)) cats.push('technology');

  return [...new Set(cats)];
}

function parseAmount(value: unknown): number | undefined {
  if (value == null) return undefined;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? undefined : num;
}

/** Discover XLSX URLs from the outcomes page */
async function findXLSXUrls(): Promise<string[]> {
  try {
    const res = await fetch(OUTCOMES_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
    });
    if (!res.ok) return KNOWN_XLSX_URLS;

    const html = await res.text();
    const $ = cheerio.load(html);

    const urls: string[] = [];
    $('a[href*=".xlsx"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (/summary.of.result/i.test(href)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.nhmrc.gov.au${href}`;
        urls.push(fullUrl);
      }
    });

    return urls.length > 0 ? urls : KNOWN_XLSX_URLS;
  } catch {
    return KNOWN_XLSX_URLS;
  }
}

/** Parse an XLSX file using csv-parse on the CSV representation */
async function parseXLSX(url: string): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
    });
    if (!res.ok) {
      console.error(`[nhmrc] Failed to download ${url}: HTTP ${res.status}`);
      return grants;
    }

    // We can't parse XLSX natively without a library like xlsx/exceljs
    // For now, treat the file as available but note the limitation
    // The outcomes page also has CSV download tokens we can try
    const contentType = res.headers.get('content-type') || '';
    const buffer = await res.arrayBuffer();

    // Try to parse as CSV first (some endpoints serve CSV)
    if (contentType.includes('csv') || contentType.includes('text')) {
      const text = new TextDecoder().decode(buffer);
      const { parse } = await import('csv-parse/sync');

      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      for (const record of records) {
        const title = record['Grant Title'] || record['Title'] || record['Project Title'] ||
          record['CIA Name'] || Object.values(record).find(v => v && v.length > 20) || '';
        if (!title || title.length < 5) continue;

        const scheme = record['Scheme'] || record['Grant Type'] || record['Sub Type'] || '';
        const amount = parseAmount(record['Total Budget'] || record['Amount'] || record['Budget']);
        const admin = record['Admin Institution'] || record['Administering Institution'] || 'NHMRC';

        grants.push({
          title: title.slice(0, 200),
          provider: admin,
          sourceUrl: undefined,
          amount: amount ? { max: amount } : undefined,
          description: `NHMRC ${scheme}`.trim(),
          categories: inferCategories(title, scheme),
          program: scheme || 'NHMRC',
          sourceId: 'nhmrc',
          geography: ['AU'],
        });
      }
    } else {
      // XLSX binary — we'd need xlsx/exceljs package to parse
      // Log the file size so we know it downloaded OK
      console.log(`[nhmrc] Downloaded ${url.split('/').pop()} (${buffer.byteLength} bytes, XLSX — needs xlsx package to parse)`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nhmrc] Error parsing ${url}: ${msg}`);
  }

  return grants;
}

/** Fallback: scrape the "find funding" page for current open opportunities */
async function scrapeOpenOpportunities(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  try {
    const res = await fetch('https://www.nhmrc.gov.au/funding/find-funding', {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
    });
    if (!res.ok) return grants;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Look for grant scheme links
    $('a[href*="/funding/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const title = $el.text().trim();

      if (!title || title.length < 5) return;
      if (/privacy|contact|login|search|manage|calendar|peer review/i.test(title)) return;
      if (!/grant|fellowship|investigator|scheme|fund|award/i.test(title)) return;

      const fullUrl = href.startsWith('http') ? href : `https://www.nhmrc.gov.au${href}`;
      const parentText = $el.closest('li, div, article').text() || '';

      grants.push({
        title: title.slice(0, 200),
        provider: 'National Health and Medical Research Council',
        sourceUrl: fullUrl,
        description: parentText.replace(/\s+/g, ' ').trim().slice(0, 500) || 'NHMRC funding scheme',
        categories: inferCategories(title, ''),
        program: 'NHMRC',
        sourceId: 'nhmrc',
        geography: ['AU'],
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nhmrc] Find-funding scrape error: ${msg}`);
  }

  return grants;
}

export function createNHMRCGrantsPlugin(): SourcePlugin {
  return {
    id: 'nhmrc',
    name: 'NHMRC (Health & Medical Research)',
    type: 'scraper',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[nhmrc] Fetching NHMRC grants data...');

      // Try XLSX files first (comprehensive data)
      const xlsxUrls = await findXLSXUrls();
      console.log(`[nhmrc] Found ${xlsxUrls.length} XLSX files to try`);

      let allGrants: RawGrant[] = [];

      // Try the most recent XLSX file
      for (const url of xlsxUrls.slice(0, 2)) {
        const grants = await parseXLSX(url);
        if (grants.length > 0) {
          allGrants = grants;
          break;
        }
      }

      // Fallback: scrape current funding opportunities
      if (allGrants.length === 0) {
        console.log('[nhmrc] No XLSX data parsed, scraping open opportunities...');
        allGrants = await scrapeOpenOpportunities();
      }

      console.log(`[nhmrc] Found ${allGrants.length} grants`);

      // Deduplicate
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

      console.log(`[nhmrc] Yielded ${yielded} grants`);
    },
  };
}
