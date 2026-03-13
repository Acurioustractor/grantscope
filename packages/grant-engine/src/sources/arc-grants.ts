/**
 * ARC (Australian Research Council) Source Plugin
 *
 * Fetches grants from the ARC NCGP Data Portal JSON:API.
 * No auth required. ~34k grants total.
 *
 * API: https://dataportal.arc.gov.au/NCGP/API/grants
 * Pagination: JSON:API style — page[size] and page[number]
 * Fields: kebab-case inside data[].attributes
 */

import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const API_BASE = 'https://dataportal.arc.gov.au/NCGP/API/grants';

interface ARCMeta {
  'total-size': number;
  'total-pages': number;
  'actual-page-size': number;
  'requested-page-number': number;
}

interface ARCAttributes {
  'code': string;
  'scheme-name': string;
  'funding-commencement-year': number;
  'current-admin-organisation': string;
  'announcement-admin-organisation': string;
  'grant-summary': string;
  'lead-investigator': string;
  'current-funding-amount': number;
  'announced-funding-amount': number;
  'grant-status': string;
  'primary-field-of-research': string;
  'anticipated-end-date': string;
  'investigators': string;
}

interface ARCGrant {
  type: string;
  id: string;
  attributes: ARCAttributes;
}

interface ARCResponse {
  meta: ARCMeta;
  data: ARCGrant[];
}

function inferCategories(summary: string, scheme: string, forCode: string): string[] {
  const text = `${summary} ${scheme} ${forCode}`.toLowerCase();
  const cats: string[] = ['research'];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage|humanities|philosophy|history|language/.test(text)) cats.push('arts');
  if (/health|medical|biomedical|clinical|disease|cancer|brain|neuro/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|ecology|conservation|earth science|ocean|marine/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|management/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|pedagogy|learning/.test(text)) cats.push('education');
  if (/technolog|digital|engineering|comput|quantum|nano|material|robot/.test(text)) cats.push('technology');

  return cats;
}

export function createARCGrantsPlugin(): SourcePlugin {
  return {
    id: 'arc-grants',
    name: 'Australian Research Council (ARC)',
    type: 'api',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[arc-grants] Fetching from ARC NCGP Data Portal...');

      // Only fetch recent grants (last 5 years) to keep volume manageable
      const cutoffYear = new Date().getFullYear() - 5;
      const pageSize = 200;
      let pageNumber = 1;
      let totalYielded = 0;
      let totalPages = 1;

      while (pageNumber <= totalPages) {
        try {
          const url = `${API_BASE}?page%5Bsize%5D=${pageSize}&page%5Bnumber%5D=${pageNumber}`;
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'GrantScope/1.0 (research; contact@act.place)',
            },
          });

          if (!response.ok) {
            console.error(`[arc-grants] API error: HTTP ${response.status}`);
            break;
          }

          const data = await response.json() as ARCResponse;
          if (!data.data?.length) break;

          totalPages = data.meta['total-pages'];

          if (pageNumber === 1) {
            console.log(`[arc-grants] Total grants: ${data.meta['total-size']}, pages: ${totalPages}`);
          }

          for (const grant of data.data) {
            const attrs = grant.attributes;
            const year = attrs['funding-commencement-year'];

            // Skip grants older than cutoff
            if (year < cutoffYear) continue;

            const summary = attrs['grant-summary'] || '';
            const scheme = attrs['scheme-name'] || '';
            const code = attrs['code'] || '';
            const forCode = attrs['primary-field-of-research'] || '';
            const amount = attrs['current-funding-amount'] || attrs['announced-funding-amount'];
            const org = attrs['current-admin-organisation'] || attrs['announcement-admin-organisation'] || 'Australian Research Council';

            const categories = inferCategories(summary, scheme, forCode);

            // Apply query filters
            if (query.categories?.length) {
              const queryLower = query.categories.map(c => c.toLowerCase());
              if (categories.length > 0 && !categories.some(c => queryLower.includes(c))) continue;
            }

            if (query.keywords?.length) {
              const text = `${summary} ${scheme} ${code}`.toLowerCase();
              if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
            }

            yield {
              title: (summary || `${scheme} — ${code}`).slice(0, 200),
              provider: org,
              sourceUrl: `https://dataportal.arc.gov.au/NCGP/Web/Grant/Grant/${code}`,
              amount: amount ? { max: amount } : undefined,
              deadline: attrs['anticipated-end-date'] || undefined,
              description: [
                summary,
                `Scheme: ${scheme}`,
                forCode ? `Field: ${forCode}` : '',
                attrs['lead-investigator'] ? `Lead: ${attrs['lead-investigator']}` : '',
              ].filter(Boolean).join('. ').slice(0, 1000),
              categories,
              program: scheme || undefined,
              sourceId: 'arc-grants',
              geography: ['AU'],
            };
            totalYielded++;
          }

          // Check if all remaining grants are too old
          const oldestYear = Math.min(...data.data.map(g => g.attributes['funding-commencement-year']));
          if (oldestYear < cutoffYear) {
            console.log(`[arc-grants] Reached grants from ${oldestYear}, stopping (cutoff: ${cutoffYear})`);
            break;
          }

          pageNumber++;

          // Polite delay
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[arc-grants] Error on page ${pageNumber}: ${msg}`);
          break;
        }
      }

      console.log(`[arc-grants] Yielded ${totalYielded} grants from ${pageNumber} page(s)`);
    },
  };
}
