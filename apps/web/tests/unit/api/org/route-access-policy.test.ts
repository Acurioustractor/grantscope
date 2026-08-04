import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES = [
  'contacts/route.ts',
  'contacts/sync-ghl/route.ts',
  'daily-actions/route.ts',
  'journeys/route.ts',
  'journeys/[journeyId]/route.ts',
  'journeys/chat/route.ts',
  'pipeline/route.ts',
  'programs/route.ts',
  'projects/route.ts',
  'projects/[projectId]/foundations/route.ts',
];

function exportedMethodBlocks(source: string) {
  const starts = [...source.matchAll(/export async function (GET|POST|PATCH|DELETE)\b/g)];
  return starts.map((match, index) => ({
    method: match[1],
    source: source.slice(match.index, starts[index + 1]?.index ?? source.length),
  }));
}

describe('organisation route access policy', () => {
  it('requires editor access for every organisation mutation', () => {
    const routeRoot = join(__dirname, '../../../../src/app/api/org/[orgProfileId]');

    for (const route of ROUTES) {
      const blocks = exportedMethodBlocks(readFileSync(join(routeRoot, route), 'utf8'));
      const mutations = blocks.filter(({ method }) => method !== 'GET');
      expect(mutations.length, `${route} should expose a checked mutation`).toBeGreaterThan(0);
      for (const block of mutations) {
        expect(block.source, `${block.method} ${route}`).toContain('requireOrgWriteAccess(orgProfileId)');
      }
    }
  });
});
