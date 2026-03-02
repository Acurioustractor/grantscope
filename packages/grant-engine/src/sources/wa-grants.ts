/**
 * Western Australia Grants Source Plugin
 *
 * Strategy:
 * 1. Scrape wa.gov.au grants and subsidies pages
 * 2. Scrape Lotterywest grant opportunities (~$200M/yr biggest WA funder)
 * 3. Scrape Healthway grants
 * 4. Scrape department-specific portals (GSDC, DPIRD, DLGSC)
 *
 * Combined: should yield 100+ grants across WA government + Lotterywest.
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const WA_SOURCES = [
  { url: 'https://www.wa.gov.au/organisation/department-of-local-government-sport-and-cultural-industries/grants-and-subsidies', name: 'DLGSC Grants' },
  { url: 'https://www.wa.gov.au/service/community-services/grants-and-subsidies', name: 'WA Community Grants' },
  { url: 'https://www.lotterywest.wa.gov.au/grants/grant-opportunities', name: 'Lotterywest' },
  { url: 'https://www.healthway.wa.gov.au/funding/', name: 'Healthway' },
  { url: 'https://gsdc.wa.gov.au/our-support/grants-register-and-resources', name: 'GSDC Grants' },
  { url: 'https://communityimpacthub.wa.gov.au/apply/', name: 'Community Impact Hub' },
  { url: 'https://www.dlgsc.wa.gov.au/funding', name: 'DLGSC Funding' },
  { url: 'https://www.commerce.wa.gov.au/consumer-protection/grants-and-funding', name: 'Commerce WA' },
  { url: 'https://www.dplh.wa.gov.au/information-and-services/grants-and-funding', name: 'Planning WA' },
  { url: 'https://www.dbca.wa.gov.au/parks-and-wildlife-service/grants-and-partnerships', name: 'DBCA Grants' },
  { url: 'https://www.smallbusiness.wa.gov.au/business-advice/grants-tenders', name: 'Small Business WA' },
];

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
  if (/disaster|recovery|flood|bushfire|cyclone/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/tourism|visitor|hospitality/.test(text)) cats.push('enterprise');
  if (/agricult|farm|rural|pastoral/.test(text)) cats.push('regenerative');
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
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
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

async function scrapeGrantPage(source: { url: string; name: string }): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];
  const html = await fetchPage(source.url);
  if (!html) return grants;

  const $ = cheerio.load(html);
  const baseUrl = getBaseUrl(source.url);
  const seen = new Set<string>();

  // Find grant-like links and headings
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const title = $el.text().trim();

    if (!title || title.length < 5 || title.length > 200) return;
    if (/privacy|contact|sitemap|login|search|menu|home|back|more|skip/i.test(title)) return;
    if (seen.has(title.toLowerCase())) return;

    const context = $el.closest('li, div, article, tr, section, dd').text() || '';
    const isGrantContext = /grant|fund|program|subsid|scheme|support|assist|initiative|rebate|voucher/i.test(title) ||
      /grant|fund|program|subsid|scheme/i.test(href);

    if (!isGrantContext) return;
    seen.add(title.toLowerCase());

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    const amounts = extractAmounts(context);
    const deadline = extractDeadline(context);

    grants.push({
      title: title.slice(0, 200),
      provider: source.name.includes('Lotterywest') ? 'Lotterywest' : `Western Australian Government — ${source.name}`,
      sourceUrl: fullUrl,
      amount: amounts.min || amounts.max ? amounts : undefined,
      deadline,
      description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
      categories: inferCategories(title, context),
      sourceId: 'wa-grants',
      geography: ['AU-WA'],
    });
  });

  // Also find structured headings
  $('h2, h3, h4').each((_, el) => {
    const $el = $(el);
    const title = $el.text().trim();
    if (!title || title.length < 5 || seen.has(title.toLowerCase())) return;
    if (!/grant|fund|program|scheme|initiative/i.test(title)) return;

    seen.add(title.toLowerCase());
    const link = $el.find('a').attr('href') || $el.next('a').attr('href') || $el.parent().find('a').first().attr('href');
    const context = $el.parent().text() || '';

    grants.push({
      title: title.slice(0, 200),
      provider: source.name.includes('Lotterywest') ? 'Lotterywest' : `Western Australian Government — ${source.name}`,
      sourceUrl: link ? (link.startsWith('http') ? link : `${baseUrl}${link}`) : source.url,
      amount: extractAmounts(context),
      deadline: extractDeadline(context),
      description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
      categories: inferCategories(title, context),
      sourceId: 'wa-grants',
      geography: ['AU-WA'],
    });
  });

  return grants;
}

export function createWAGrantsPlugin(): SourcePlugin {
  return {
    id: 'wa-grants',
    name: 'Western Australia Grants',
    type: 'scraper',
    geography: ['AU-WA'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log(`[wa-grants] Scraping ${WA_SOURCES.length} WA government sources...`);

      const allGrants: RawGrant[] = [];

      for (const source of WA_SOURCES) {
        try {
          const grants = await scrapeGrantPage(source);
          allGrants.push(...grants);
          console.log(`[wa-grants] ${source.name}: ${grants.length} grants`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[wa-grants] Error scraping ${source.name}: ${msg}`);
        }
        await new Promise(r => setTimeout(r, 500));
      }

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

      console.log(`[wa-grants] Yielded ${yielded} grants from ${WA_SOURCES.length} sources`);
    },
  };
}
