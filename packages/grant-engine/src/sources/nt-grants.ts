/**
 * NT (Northern Territory) Grants Source Plugin
 *
 * Strategy:
 * 1. Scrape the NT Government Grants Directory (100+ grants across 24 categories)
 *    URL: https://nt.gov.au/community/grants-and-volunteers/grants/grants-directory
 * 2. Also try the GrantsNT search portal for additional results
 *    URL: https://grantsnt.nt.gov.au/grants
 *
 * The grants directory is a structured accordion page with categories,
 * each containing links to individual grant programs. No JS rendering needed.
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const NT_DIRECTORY_URL = 'https://nt.gov.au/community/grants-and-volunteers/grants/grants-directory';
const GRANTS_NT_SEARCH = 'https://grantsnt.nt.gov.au/grants';
const GRANTS_NT_API = 'https://grantsnt.nt.gov.au/api/v1/grants/search';
const GRANTS_NT_CLIENT_VERSION = '3.3.7.1';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

interface GrantsNTSearchResult {
  publicContentId: number;
  title: string;
  applicationsOpen: string | null;
  applicationsClose: string | null;
  slug: string;
  grantRoundSlug: string | null;
  agency: string;
  isIndividualEligible: boolean;
  isOrganisationEligible: boolean;
  showGlobalMaxFunding: boolean;
  globalFundingMax: number | null;
  overviewHtml: string | null;
  categories: string[];
}

interface GrantsNTSearchResponse {
  totalRecords: number;
  results: GrantsNTSearchResult[];
}

function inferCategories(title: string, description: string, sectionName?: string): string[] {
  const text = `${title} ${description} ${sectionName || ''}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation|land care/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|trade|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|skill|scholarship/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/sport|recreation|athlete/.test(text)) cats.push('sport');
  if (/disaster|recovery|cyclone|flood/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/remote|outback|regional/.test(text)) cats.push('community');
  if (/housing|infrastructure/.test(text)) cats.push('community');
  if (/tourism|visitor/.test(text)) cats.push('enterprise');
  if (/screen|film/.test(text)) cats.push('arts');
  if (/women|equality/.test(text)) cats.push('community');
  if (/history|heritage|museum/.test(text)) cats.push('arts');
  if (/suicide|mental/.test(text)) cats.push('health');

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

function applicationStatus(opensAt: string | null, closesAt: string | null, now = new Date()): RawGrant['applicationStatus'] {
  const opens = opensAt ? new Date(opensAt) : null;
  const closes = closesAt ? new Date(closesAt) : null;

  if (opens && !Number.isNaN(opens.getTime()) && now < opens) return 'upcoming';
  if (closes && !Number.isNaN(closes.getTime()) && now > closes) return 'closed';
  if (opens || closes) return 'open';
  return 'unknown';
}

function htmlToText(html: string | null): string | undefined {
  if (!html) return undefined;
  const text = cheerio.load(html).text().replace(/\s+/g, ' ').trim();
  return text || undefined;
}

export function mapGrantsNTResult(result: GrantsNTSearchResult, now = new Date()): RawGrant {
  const description = htmlToText(result.overviewHtml);
  const amount = result.globalFundingMax && result.globalFundingMax > 0
    ? { max: result.globalFundingMax }
    : extractAmounts(description || '');
  const categories = [
    ...new Set([
      ...result.categories.map(category => category.trim()).filter(Boolean),
      ...inferCategories(result.title, description || '', result.categories.join(' ')),
    ]),
  ];

  return {
    title: result.title.trim().slice(0, 200),
    provider: result.agency?.trim() || 'Northern Territory Government',
    sourceUrl: `https://grantsnt.nt.gov.au/grants/${result.grantRoundSlug || result.slug}`,
    amount,
    deadline: result.applicationsClose || undefined,
    applicationStatus: applicationStatus(result.applicationsOpen, result.applicationsClose, now),
    description: description?.slice(0, 4000),
    categories,
    program: result.grantRoundSlug || result.slug,
    sourceId: 'nt-grants',
    geography: ['AU-NT'],
  };
}

/** Fetch the authoritative GrantsNT public search API, including all result pages. */
async function fetchGrantsNTApi(): Promise<RawGrant[]> {
  const pageSize = 100;
  const grants: RawGrant[] = [];
  let page = 1;
  let totalRecords = Number.POSITIVE_INFINITY;

  while (grants.length < totalRecords) {
    const response = await fetch(GRANTS_NT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ClientVersion': GRANTS_NT_CLIENT_VERSION,
        'Referer': GRANTS_NT_SEARCH,
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify({
        agencies: [],
        categories: [],
        beneficiaries: [],
        publicContentTypes: [],
        pageSize,
        page,
        sortColumn: 'PublishDateFrom',
        sortDirection: 2,
        contentSlug: '',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error(`GrantsNT API returned ${response.status}`);
    const payload = await response.json() as GrantsNTSearchResponse;
    totalRecords = payload.totalRecords;
    grants.push(...payload.results.map(result => mapGrantsNTResult(result)));

    if (payload.results.length === 0 || payload.results.length < pageSize) break;
    page += 1;
  }

  return grants;
}

/** Scrape the NT Government Grants Directory — structured accordion with 100+ grants */
async function scrapeGrantsDirectory(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];
  const html = await fetchPage(NT_DIRECTORY_URL);
  if (!html) {
    console.log('[nt-grants] Could not fetch grants directory');
    return grants;
  }

  const $ = cheerio.load(html);

  // The directory uses accordion sections with category headings
  // Each section has <h2> or <h3> category name, then <ul><li><a> grant links
  let currentSection = '';

  $('h2, h3, h4').each((_, heading) => {
    const $heading = $(heading);
    const sectionTitle = $heading.text().trim();

    // Check if this is a category heading (not a page-level heading)
    if (sectionTitle.length > 2 && sectionTitle.length < 60) {
      currentSection = sectionTitle;
    }
  });

  // Find all grant links in the page
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const title = $el.text().trim();

    if (!title || title.length < 5 || title.length > 200) return;
    if (/privacy|contact|sitemap|login|search|menu|home|back|skip|expand|close|top of page/i.test(title)) return;

    // Must be a grant-related link
    const parentText = $el.closest('li, dd, div').text() || '';
    const context = parentText.replace(/\s+/g, ' ').trim();

    // Get the section this link belongs to by finding the closest preceding heading
    const $section = $el.closest('.accordion-content, .field-item, section, details');
    const sectionHeading = $section.prevAll('h2, h3, h4, summary').first().text().trim() ||
      $section.closest('details').find('summary').first().text().trim() || '';

    // Filter: link text or context should mention grant/fund/program
    const isGrant = /grant|fund|program|scheme|subsid|scholarship|initiative|rebate|support/i.test(title) ||
      /grant|fund|program|scheme/i.test(href) ||
      /grant|fund|program/i.test(sectionHeading);

    if (!isGrant) return;

    const fullUrl = href.startsWith('http') ? href
      : href.startsWith('/') ? `https://nt.gov.au${href}`
        : `https://nt.gov.au/community/grants-and-volunteers/grants/${href}`;

    grants.push({
      title: title.slice(0, 200),
      provider: 'Northern Territory Government',
      sourceUrl: fullUrl,
      description: context.slice(0, 500) || undefined,
      categories: inferCategories(title, context, sectionHeading),
      sourceId: 'nt-grants',
      geography: ['AU-NT'],
    });
  });

  return grants;
}

/** Also try the GrantsNT search portal */
async function scrapeGrantsNTPortal(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  try {
    console.log('[nt-grants] Fetching authoritative GrantsNT API...');
    return await fetchGrantsNTApi();
  } catch (error) {
    console.warn(`[nt-grants] GrantsNT API failed; using portal fallbacks: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Browser-rendered fallback for unexpected API changes.
  try {
    const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (apiKey) {
      console.log('[nt-grants] Trying GrantsNT portal via Firecrawl...');
      const firecrawl = new FirecrawlApp({ apiKey });
      const result = await firecrawl.scrape(GRANTS_NT_SEARCH, { formats: ['markdown'] });
      const md = result.markdown || '';

      if (md) {
        // Parse markdown for grant links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(md)) !== null) {
          const title = match[1].trim();
          const url = match[2].trim();
          if (title.length < 5 || !/grant/i.test(title + url)) continue;

          const fullUrl = url.startsWith('http') ? url : `https://grantsnt.nt.gov.au${url}`;

          grants.push({
            title: title.slice(0, 200),
            provider: 'Northern Territory Government',
            sourceUrl: fullUrl,
            categories: inferCategories(title, ''),
            sourceId: 'nt-grants',
            geography: ['AU-NT'],
          });
        }
      }

      return grants;
    }
  } catch {
    // Firecrawl not available, try direct HTTP
  }

  // Direct HTTP fallback
  const html = await fetchPage(GRANTS_NT_SEARCH);
  if (!html) return grants;

  const $ = cheerio.load(html);
  $('a[href*="grant"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const title = $el.text().trim();
    if (!title || title.length < 5) return;

    const fullUrl = href.startsWith('http') ? href : `https://grantsnt.nt.gov.au${href}`;
    const context = $el.closest('li, div, article').text() || '';

    grants.push({
      title: title.slice(0, 200),
      provider: 'Northern Territory Government',
      sourceUrl: fullUrl,
      amount: extractAmounts(context),
      deadline: extractDeadline(context),
      description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
      categories: inferCategories(title, context),
      sourceId: 'nt-grants',
      geography: ['AU-NT'],
    });
  });

  return grants;
}

export function createNTGrantsPlugin(): SourcePlugin {
  return {
    id: 'nt-grants',
    name: 'Northern Territory Grants',
    type: 'scraper',
    geography: ['AU-NT'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[nt-grants] Fetching NT grants...');

      // Scrape both sources in parallel
      const [directoryGrants, portalGrants] = await Promise.all([
        scrapeGrantsDirectory(),
        scrapeGrantsNTPortal(),
      ]);

      const allGrants = [...directoryGrants, ...portalGrants];
      console.log(`[nt-grants] Found ${allGrants.length} (directory: ${directoryGrants.length}, portal: ${portalGrants.length})`);

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

      console.log(`[nt-grants] Yielded ${yielded} grants`);
    },
  };
}
