/**
 * South Australia Grants Source Plugin
 *
 * SA doesn't have a single open data API. Strategy:
 * 1. Scrape the SA.GOV.AU grants hub pages
 * 2. Scrape Grants SA (DHS) available grants
 * 3. Scrape individual department grants pages (PIRSA, Tourism SA, DPC, DIT)
 *
 * Note: Many SA gov sites return 403 (WAF/bot protection) as of Mar 2026.
 * GRANTassist (grantassist.sa.gov.au) DNS no longer resolves.
 * DHS grants page works but often shows "no future grants scheduled".
 * The scraper handles failures gracefully — it logs and continues.
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const SA_SOURCES = [
  { url: 'https://www.sa.gov.au/topics/care-and-support/concessions/financial-aid/grants', name: 'SA.GOV.AU' },
  { url: 'https://dhs.sa.gov.au/how-we-help/grants/available-grants', name: 'Grants SA' },
  { url: 'https://dhs.sa.gov.au/how-we-help/grants', name: 'DHS Grants' },
  { url: 'https://pir.sa.gov.au/funding', name: 'PIRSA Funding' },
  { url: 'https://tourism.sa.gov.au/support/grants-and-funding', name: 'Tourism SA' },
  { url: 'https://www.dpc.sa.gov.au/responsibilities/multicultural-affairs/grants', name: 'DPC Multicultural' },
  { url: 'https://www.dit.sa.gov.au/about-us/grants-and-funding', name: 'DIT Grants' },
  { url: 'https://www.environment.sa.gov.au/topics/grants-and-programs', name: 'Environment SA' },
  { url: 'https://www.education.sa.gov.au/schools-and-educators/programs-students-and-schools/grants-and-funding', name: 'Education SA' },
  { url: 'https://www.sahealth.sa.gov.au/wps/wcm/connect/public+content/sa+health+internet/about+us/department+for+health+and+wellbeing/office+for+research/grants+and+funding', name: 'SA Health' },
  { url: 'https://www.arts.sa.gov.au/grants', name: 'Arts SA' },
  { url: 'https://www.orsr.sa.gov.au/sport-and-recreation/grants-and-funding', name: 'Sport SA' },
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
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/tourism|visitor|hospitality/.test(text)) cats.push('enterprise');
  if (/agricult|farm|rural/.test(text)) cats.push('regenerative');
  if (/multicultural|migrant|refugee/.test(text)) cats.push('community');
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

  // Strategy 1: Find grant-like links
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const title = $el.text().trim();

    if (!title || title.length < 5 || title.length > 200) return;
    if (/privacy|contact|sitemap|login|search|menu|home|back|more|skip|about us/i.test(title)) return;
    if (seen.has(title.toLowerCase())) return;

    // Must look like a grant/funding link
    const context = $el.closest('li, div, article, tr, section').text() || '';
    const isGrantContext = /grant|fund|program|subsid|scheme|support|assist|initiative|rebate|voucher|incentive/i.test(title) ||
      /grant|fund|program|subsid|scheme/i.test(href) ||
      /grant|fund|program/i.test(context.slice(0, 200));

    if (!isGrantContext) return;
    seen.add(title.toLowerCase());

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    const amounts = extractAmounts(context);
    const deadline = extractDeadline(context);

    grants.push({
      title: title.slice(0, 200),
      provider: `South Australian Government — ${source.name}`,
      sourceUrl: fullUrl,
      amount: amounts.min || amounts.max ? amounts : undefined,
      deadline,
      description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
      categories: inferCategories(title, context),
      sourceId: 'sa-grants',
      geography: ['AU-SA'],
    });
  });

  // Strategy 2: Find structured content (cards, list items with headings)
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
      provider: `South Australian Government — ${source.name}`,
      sourceUrl: link ? (link.startsWith('http') ? link : `${baseUrl}${link}`) : source.url,
      amount: extractAmounts(context),
      deadline: extractDeadline(context),
      description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
      categories: inferCategories(title, context),
      sourceId: 'sa-grants',
      geography: ['AU-SA'],
    });
  });

  return grants;
}

export function createSAGrantsPlugin(): SourcePlugin {
  return {
    id: 'sa-grants',
    name: 'South Australia Grants',
    type: 'scraper',
    geography: ['AU-SA'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log(`[sa-grants] Scraping ${SA_SOURCES.length} SA government sources...`);

      const allGrants: RawGrant[] = [];

      for (const source of SA_SOURCES) {
        try {
          const grants = await scrapeGrantPage(source);
          allGrants.push(...grants);
          console.log(`[sa-grants] ${source.name}: ${grants.length} grants`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[sa-grants] Error scraping ${source.name}: ${msg}`);
        }
        // Polite delay between sources
        await new Promise(r => setTimeout(r, 500));
      }

      // Deduplicate by title
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

      console.log(`[sa-grants] Yielded ${yielded} grants from ${SA_SOURCES.length} sources`);
    },
  };
}
