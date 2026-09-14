/**
 * SmartyGrants Source Plugin
 *
 * One reader for every funder that runs its rounds on SmartyGrants (councils, state agencies,
 * foundations, corporate funds). Each funder is a tenant subdomain whose home page lists its
 * current rounds as plain links, and each round page states the funder, the round name, whether
 * submissions are being accepted, and the close date. All public; robots.txt only disallows the
 * applicant area and the forms, which this never touches.
 *
 * Found 2026-09-14: 347 of the 974 grants Grant'd added since June that we lacked apply through
 * SmartyGrants, across the 149 tenants below.
 *
 * NOT FOR THE PUBLIC ENGINE. Our Community's Terms of Use (July 2026) cover every SmartyGrants applicant portal and say users
 * "will not use bots or web scraping tools to access, browse or extract data" (cl 2(i)). robots.txt allowing a
 * path is not permission. Unregistered from the public engine on 2026-09-14 (migration 20260914160000). Its only
 * caller is scripts/sync-act-private-grant-rounds.mts, which writes to ACT's private table; Ben chose to run that
 * for ACT's own grant-seeking (migration 20260914180000). Written permission from Our Community would settle it.
 */

import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';
import { smartyGrantsGeography } from './smartygrants-places';

const UA = 'CivicGraph/1.0 (grant discovery; contact@act.place)';
const DELAY_MS = 700;

export const SMARTYGRANTS_TENANTS: readonly string[] = [
  'actgovt', 'acthealth', 'aflvic', 'alcoa', 'alexandrina', 'artstasmania', 'artsunimelb', 'auspost',
  'avant', 'banyule', 'bass-coast', 'bayswater', 'bendigo', 'brisbane', 'burnie', 'cairns', 'campaspe',
  'campbelltownnsw', 'canning', 'carclew', 'cardinia', 'casey', 'cassowarycoast', 'centralcoast',
  'centralcoasttas', 'chrc', 'cityofadelaide', 'cityofsydney', 'cityofyarra', 'cloncurry', 'cockburn',
  'communities', 'communitiestas', 'communitybankavocamaryborough', 'communitybanklaradistrict', 'createsa',
  'cumberland', 'departmentofcommunitiesapply', 'des', 'desbt', 'dhcs', 'ditidtourism', 'dpird', 'dplh',
  'dsa', 'dsiti', 'dubboregion', 'dwer-env', 'eastgippsland', 'emf', 'emfqld', 'fisheriesvictoria',
  'frankston', 'frasercoast', 'fremantle', 'geelong', 'georgesriver', 'georgetown', 'gladstone', 'gleneira',
  'goldcoast', 'greatershepparton', 'gympie', 'harvey', 'healthqld', 'hneccphn', 'hobartcity', 'holdfast',
  'horshamrcc', 'hume', 'innerwest', 'ipswich', 'joondalup', 'kiama', 'kingston', 'kwinana',
  'landcareaustralia', 'latrobe', 'lgasa', 'lockyervalley', 'loddon', 'logan', 'lowitja', 'mackay',
  'mainstreetaustralia', 'mandurah', 'mdo', 'melbourne', 'melton', 'melville', 'merri-bek', 'metrosouth',
  'moira', 'monash', 'moretonbay', 'morpen', 'mrcc', 'mrsc', 'murrayriver', 'mvcc', 'nillumbik', 'noosa',
  'norcenfs', 'northburnett', 'northernbeaches', 'nre', 'oca', 'onkaparinga', 'orsr', 'parracity',
  'pdfsvgrantsqld', 'penrith', 'perth', 'porthedland', 'portphillip', 'portstephens', 'prospect', 'qprc',
  'ravgrants', 'rockingham', 'safilm', 'saoecd', 'sbrc', 'scanlonfoundation', 'scenicrim',
  'screenaustraliafunding', 'screennsw', 'screenqueensland', 'screenwest', 'southerndowns', 'southgippsland',
  'stategrowthtas', 'stirling', 'swan', 'tourismaustralia', 'townsville', 'vaccho', 'vincent', 'wadbca',
  'wdrc', 'wellington', 'westtorrens', 'westwimmera', 'whittlesea', 'wingecarribee', 'wodonga', 'wollongong',
  'worksafevic', 'wyndham',
];

// Rounds that are admin paperwork, not funding: acquittals, reports, panel registers.
const NON_FUNDING = /acquittal|final report|progress report|outcome report|evaluation report|variation|expert register|panel register|assessor|reviewer|feedback|survey|update your details/i;

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function pageText(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

/** Round slugs linked from a tenant home page. */
export function parseRoundSlugs(homeHtml: string): string[] {
  const slugs = [...homeHtml.matchAll(/href="\/([A-Za-z0-9_-]{2,80})"/g)].map(m => m[1]);
  return [...new Set(slugs)].filter(s => !/^(applicant|sso|help|privacy|login|register|accessibility|error|scheduled|form|d)$/i.test(s));
}

/** "Submissions close at 5:00pm 30 November 2026 (AEDT)" → "2026-11-30". */
export function parseCloseDate(text: string): string | undefined {
  const m = text.match(/Submissions close[^.]*?\b(\d{1,2})(?:st|nd|rd|th)? (January|February|March|April|May|June|July|August|September|October|November|December),? (\d{4})/i);
  if (!m) return undefined;
  return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
}

export function parseStatus(text: string, closeDate: string | undefined, now: Date): GrantApplicationStatus {
  if (closeDate && closeDate < now.toISOString().slice(0, 10)) return 'closed';
  if (/Submissions are now being accepted/i.test(text)) return 'open';
  if (/Submissions (?:will )?open|This round will open/i.test(text)) return 'upcoming';
  if (/not (?:currently )?(?:being )?accept|Submissions (?:have )?closed|round (?:is|has) closed/i.test(text)) return 'closed';
  return 'unknown';
}

export function parseAmount(text: string): { min?: number; max?: number } | undefined {
  const num = (s: string) => parseInt(s.replace(/,/g, ''), 10);
  const range = text.match(/\$(\d[\d,]{2,})\s*(?:-|–|to)\s*\$(\d[\d,]{2,})/);
  if (range) return { min: num(range[1]), max: num(range[2]) };
  const upTo = text.match(/(?:up to|maximum of|receive|grants? of)\s+\$(\d[\d,]{2,})/i);
  if (upTo) return { max: num(upTo[1]) };
  return undefined;
}

function inferCategories(text: string): string[] {
  const t = text.toLowerCase();
  const cats: string[] = [];
  if (/communit|neighbourhood|volunteer|inclusion/.test(t)) cats.push('community');
  if (/arts?\b|cultur|creative|heritage|music|writer|film|screen/.test(t)) cats.push('arts');
  if (/sport|recreation|active|participation/.test(t)) cats.push('sport');
  if (/environment|climate|sustainab|conservation|enviro|biodiversity/.test(t)) cats.push('regenerative');
  if (/business|economic|enterprise|industry|tourism|event/.test(t)) cats.push('enterprise');
  if (/health|wellbeing|disabilit|mental/.test(t)) cats.push('health');
  if (/aboriginal|torres strait|first nations|indigenous/.test(t)) cats.push('indigenous');
  if (/youth|young people|scholarship|education|school/.test(t)) cats.push('education');
  return cats;
}

/** Map one round page. Returns null for pages that are not a fundable round. */
export function mapSmartyGrantsRound(tenant: string, slug: string, html: string, now = new Date()): RawGrant | null {
  const text = pageText(html);
  const titleTag = decode((html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim());
  const round = text.match(/Current Rounds (.+?) (?:Start a submission|Preview the form|Submissions |This round will open|IMPORTANT:)/)?.[1]?.replace(/^Round: /, '').trim();
  if (!round || NON_FUNDING.test(round)) return null;

  // <title> is "<round> - <funder>"; round names can contain " - " themselves, so take the last segment.
  const provider = titleTag.includes(' - ') ? titleTag.split(' - ').pop()!.trim() : tenant;
  const deadline = parseCloseDate(text);
  const after = text.slice(text.indexOf(round) + round.length);
  const description = after
    .replace(/^.*?Download preview form/, '')
    .replace(/Submissions (?:are now being accepted|close[^)]*\))\.?/g, '')
    .replace(/IMPORTANT: Please read[^.]*\.|BEFORE YOU BEGIN|Before you begin|Welcome to [^.]*SmartyGrants ?\.|If this is the first time[^.]*\.|You may begin anywhere[^.]*\.|Please ensure you save as you go\./gi, '')
    .trim()
    .slice(0, 600) || undefined;

  return {
    title: round.slice(0, 200),
    provider,
    sourceUrl: `https://${tenant}.smartygrants.com.au/${slug}`,
    amount: parseAmount(after),
    deadline,
    applicationStatus: parseStatus(text, deadline, now),
    description,
    categories: inferCategories(`${round} ${description ?? ''}`),
    geography: smartyGrantsGeography(tenant),
    sourceId: 'smartygrants',
  };
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function createSmartyGrantsPlugin(tenants: readonly string[] = SMARTYGRANTS_TENANTS): SourcePlugin {
  return {
    id: 'smartygrants',
    name: 'SmartyGrants funder portals',
    type: 'scraper',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      let yielded = 0;
      let failedTenants = 0;
      for (const tenant of tenants) {
        const home = await get(`https://${tenant}.smartygrants.com.au/`);
        await sleep(DELAY_MS);
        if (!home) { failedTenants++; continue; }

        for (const slug of parseRoundSlugs(home)) {
          const html = await get(`https://${tenant}.smartygrants.com.au/${slug}`);
          await sleep(DELAY_MS);
          if (!html) continue;
          const grant = mapSmartyGrantsRound(tenant, slug, html);
          if (!grant || grant.applicationStatus === 'closed') continue;
          if (query.status === 'open' && grant.applicationStatus !== 'open') continue;
          if (query.keywords?.length) {
            const hay = `${grant.title} ${grant.provider} ${grant.description ?? ''}`.toLowerCase();
            if (!query.keywords.some(k => hay.includes(k.toLowerCase()))) continue;
          }
          yielded++;
          yield grant;
        }
      }
      console.log(`[smartygrants] ${yielded} rounds from ${tenants.length} tenants (${failedTenants} unreachable)`);
    },
  };
}
