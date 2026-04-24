/**
 * Fraser Coast Regional Council Grants Source Plugin
 *
 * Scrapes the official Fraser Coast grants page and extracts only current or
 * upcoming opportunities from the live grants table plus the evergreen
 * discretionary program section.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const FRASER_MAIN_URL = 'https://www.frasercoast.qld.gov.au/Community/Grants-and-Sponsorships';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const MONTHS = new Map([
  ['january', 0],
  ['february', 1],
  ['march', 2],
  ['april', 3],
  ['may', 4],
  ['june', 5],
  ['july', 6],
  ['august', 7],
  ['september', 8],
  ['october', 9],
  ['november', 10],
  ['december', 11],
]);

type ExtractedRow = { text: string; links: Array<{ text: string; href: string }> };
type ExtractedSection = { text: string; links: Array<{ text: string; href: string }> };

type TableProgramDefinition = {
  title: string;
  matcher: RegExp;
  description: string;
  categories: string[];
  getSourceUrl: (row: ExtractedRow) => string;
  getAmount?: (row: ExtractedRow) => { min?: number; max?: number } | undefined;
};

type SectionProgramDefinition = {
  title: string;
  heading: RegExp;
  description: string;
  categories: string[];
  sourceUrl: string;
  requireUpcomingDeadline?: boolean;
  getAmount?: (section: ExtractedSection) => { min?: number; max?: number } | undefined;
};

const TABLE_PROGRAMS: TableProgramDefinition[] = [
  {
    title: 'Community Grants',
    matcher: /^Community Grants\b/i,
    description: 'Supports projects and activities that benefit the Fraser Coast community through the council community grants program.',
    categories: ['community'],
    getSourceUrl: row => findAbsoluteUrl(row, /guidelines/i, `${FRASER_MAIN_URL}#community-grants`),
  },
  {
    title: 'Individual Excellence and Development Grants',
    matcher: /^Individual Excellence and Development Grants/i,
    description: 'Supports individuals participating in sport and STEAM opportunities at state, national, and international levels.',
    categories: ['education', 'sport', 'arts'],
    getSourceUrl: row => findAbsoluteUrl(row, /smartygrants|individual excellence/i, `${FRASER_MAIN_URL}#individual-excellence-and-development-grants`),
    getAmount: row => {
      const values = extractCurrencyValues(row.text);
      if (values.length === 0) return undefined;
      return { min: Math.min(...values), max: Math.max(...values) };
    },
  },
  {
    title: 'RADF Grants',
    matcher: /^RADF\b/i,
    description: 'Regional Arts Development Fund support for arts, culture, and heritage projects across the Fraser Coast.',
    categories: ['arts'],
    getSourceUrl: row => findAbsoluteUrl(row, /regional-arts-development-fund|radf/i, `${FRASER_MAIN_URL}#radf-grants`),
  },
  {
    title: 'Australia Day Events',
    matcher: /^Australia Day\b/i,
    description: 'Supports community organisations delivering Australia Day events across the Fraser Coast.',
    categories: ['community'],
    getSourceUrl: row => findAbsoluteUrl(row, /guidelines/i, `${FRASER_MAIN_URL}#australia-day-events`),
  },
  {
    title: 'Community Grants - Festive Events',
    matcher: /^Community Grants - Festive Events\b/i,
    description: 'Supports festive season community events delivered in the Fraser Coast region.',
    categories: ['community', 'enterprise'],
    getSourceUrl: row => findAbsoluteUrl(row, /guidelines/i, `${FRASER_MAIN_URL}#community-grants-festive-events`),
  },
];

const SECTION_PROGRAMS: SectionProgramDefinition[] = [
  {
    title: "Councillor's Discretionary Fund",
    heading: /^Councillor's Discretionary Fund$/i,
    description: 'Supports community-purpose initiatives that provide services to the Fraser Coast region through councillor discretionary funding.',
    categories: ['community'],
    sourceUrl: `${FRASER_MAIN_URL}#councillors-discretionary-fund`,
  },
  {
    title: 'Major Regional Events Sponsorships',
    heading: /^Major Regional Events Sponsorships$/i,
    description: 'Supports major regional events that deliver visitation and economic outcomes for the Fraser Coast.',
    categories: ['enterprise', 'community'],
    sourceUrl: `${FRASER_MAIN_URL}#major-regional-events-sponsorships`,
    requireUpcomingDeadline: true,
    getAmount: section => {
      const match = section.text.match(/upwards of \$([0-9,]+)/i);
      if (!match) return undefined;
      return { min: parseInt(match[1].replace(/,/g, ''), 10) };
    },
  },
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(href: string): string {
  return new URL(href, FRASER_MAIN_URL).toString();
}

function extractCurrencyValues(text: string): number[] {
  return [...text.matchAll(/\$([0-9][0-9,]*)/g)].map(match => parseInt(match[1].replace(/,/g, ''), 10));
}

function parseDateParts(day: string, month: string, year: string): Date | null {
  const monthIndex = MONTHS.get(month.toLowerCase());
  if (monthIndex == null) return null;

  const date = new Date(Date.UTC(parseInt(year, 10), monthIndex, parseInt(day, 10)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function extractNextClosingDate(text: string): string | undefined {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const matches: Date[] = [];

  const closingBlock = text.match(/closing dates are:\s*(.*?)(?:total funding|$)/i);
  if (closingBlock) {
    for (const match of closingBlock[1].matchAll(/(\d{1,2})\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi)) {
      const parsed = parseDateParts(match[1], match[2], match[3]);
      if (parsed) matches.push(parsed);
    }
  }

  for (const match of text.matchAll(/(?:Closed:|Applications close:|Applications close|closes?:|closing)\s*(?:\w+,\s*)?(\d{1,2})\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi)) {
    const parsed = parseDateParts(match[1], match[2], match[3]);
    if (parsed) matches.push(parsed);
  }

  matches.sort((a, b) => a.getTime() - b.getTime());
  const next = matches.find(date => date.getTime() >= todayUtc);
  return next ? toIsoDate(next) : undefined;
}

function findAbsoluteUrl(row: ExtractedRow, matcher: RegExp, fallback: string): string {
  const link = row.links.find(item => matcher.test(`${item.text} ${item.href}`));
  return link ? toAbsoluteUrl(link.href) : fallback;
}

function extractTableRows($: cheerio.CheerioAPI): ExtractedRow[] {
  return $('table')
    .first()
    .find('tr')
    .toArray()
    .map(tr => {
      const text = compressWhitespace($(tr).text());
      const links = $(tr)
        .find('a[href]')
        .toArray()
        .map(a => ({
          text: compressWhitespace($(a).text()),
          href: $(a).attr('href') || '',
        }))
        .filter(link => Boolean(link.href));
      return { text, links };
    })
    .filter(row => row.text.length > 0);
}

function extractSection($: cheerio.CheerioAPI, headingMatcher: RegExp): ExtractedSection | null {
  const heading = $('h2, h3, h4')
    .toArray()
    .find(node => headingMatcher.test(compressWhitespace($(node).text())));

  if (!heading) return null;

  const chunks: string[] = [];
  const links: Array<{ text: string; href: string }> = [];
  const startLevel = parseInt((heading.tagName || 'h4').slice(1), 10);
  let current = $(heading).next();

  while (current.length) {
    const tag = (current.get(0)?.tagName || '').toLowerCase();
    if (/^h[2-4]$/.test(tag)) {
      const level = parseInt(tag.slice(1), 10);
      if (level <= startLevel) break;
    }

    const text = compressWhitespace(current.text());
    if (text) chunks.push(text);

    current.find('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      links.push({
        text: compressWhitespace($(el).text()),
        href,
      });
    });

    current = current.next();
  }

  const text = compressWhitespace(chunks.join(' '));
  return text ? { text, links } : null;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export function createFraserCoastGrantsPlugin(): SourcePlugin {
  return {
    id: 'frasercoast-grants',
    name: 'Fraser Coast Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[frasercoast-grants] Scraping Fraser Coast Regional Council grants...');

      const html = await fetchPage(FRASER_MAIN_URL);
      if (!html) {
        console.log('[frasercoast-grants] Failed to fetch grants page');
        return;
      }

      const $ = cheerio.load(html);
      const tableRows = extractTableRows($);
      const seen = new Set<string>();
      let yielded = 0;

      for (const definition of TABLE_PROGRAMS) {
        const row = tableRows.find(item => definition.matcher.test(item.text));
        if (!row) continue;

        const deadline = extractNextClosingDate(row.text);
        if (!deadline) continue;

        const text = `${definition.title} ${definition.description} ${row.text}`.toLowerCase();
        if (query.keywords?.length && !query.keywords.some(keyword => text.includes(keyword.toLowerCase()))) continue;
        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (!definition.categories.some(cat => queryLower.includes(cat))) continue;
        }

        const sourceUrl = definition.getSourceUrl(row);
        if (seen.has(sourceUrl)) continue;
        seen.add(sourceUrl);

        yield {
          title: definition.title,
          provider: 'Fraser Coast Regional Council',
          sourceUrl,
          amount: definition.getAmount?.(row),
          deadline,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'frasercoast-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      for (const definition of SECTION_PROGRAMS) {
        const section = extractSection($, definition.heading);
        if (!section) continue;

        const deadline = extractNextClosingDate(section.text);
        if (definition.requireUpcomingDeadline && !deadline) continue;

        const text = `${definition.title} ${definition.description} ${section.text}`.toLowerCase();
        if (query.keywords?.length && !query.keywords.some(keyword => text.includes(keyword.toLowerCase()))) continue;
        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (!definition.categories.some(cat => queryLower.includes(cat))) continue;
        }

        if (seen.has(definition.sourceUrl)) continue;
        seen.add(definition.sourceUrl);

        yield {
          title: definition.title,
          provider: 'Fraser Coast Regional Council',
          sourceUrl: definition.sourceUrl,
          amount: definition.getAmount?.(section),
          deadline,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'frasercoast-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[frasercoast-grants] Yielded ${yielded} grants`);
    },
  };
}
