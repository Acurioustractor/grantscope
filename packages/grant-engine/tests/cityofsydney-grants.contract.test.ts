import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createCityOfSydneyGrantsPlugin } from '../src/sources/cityofsydney-grants';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function htmlPage({ title, description, h1, body }: { title?: string; description?: string; h1: string; body: string }) {
  return `<!doctype html>
    <html>
      <head>
        ${title ? `<title>${title}</title>` : ''}
        ${description ? `<meta name="description" content="${description}">` : ''}
      </head>
      <body>
        <main>
          <h1>${h1}</h1>
          <p>${body}</p>
        </main>
      </body>
    </html>`;
}

function mockCityOfSydneyFetch() {
  const pages = new Map<string, string>([
    ['https://www.cityofsydney.nsw.gov.au/grants-sponsorships', htmlPage({
      h1: 'Grants and sponsorships',
      body: `
        <a href="/community-support-funding">Community support & funding</a>
        <a href="/cultural-support-funding/future-cultural-grant">Future Cultural Grant</a>
        <a href="/cultural-support-funding/dixon-street-improvement-grant">Dixon Street improvement grant</a>
        <a href="/cultural-support-funding/short-term-empty-properties-program">Short-term empty properties program</a>
      `,
    })],
    ['https://www.cityofsydney.nsw.gov.au/community-support-funding', htmlPage({
      description: 'Support for community wellbeing.',
      h1: 'Community support & funding',
      body: 'This page lists funding streams and support options for community organisations.',
    })],
    ['https://www.cityofsydney.nsw.gov.au/cultural-support-funding', htmlPage({
      description: 'Support for culture and creativity.',
      h1: 'Cultural support & funding',
      body: 'This page lists cultural funding opportunities and support programs.',
    })],
    ['https://www.cityofsydney.nsw.gov.au/cultural-support-funding/future-cultural-grant', htmlPage({
      description: 'Applications open for the next cultural grant round.',
      h1: 'Future Cultural Grant',
      body: 'Funding is available. Applications close 31 December 2026. Eligible organisations may apply for up to $25,000.',
    })],
    ['https://www.cityofsydney.nsw.gov.au/cultural-support-funding/dixon-street-improvement-grant', htmlPage({
      description: 'Legacy grant round.',
      h1: 'Dixon Street improvement grant',
      body: 'Funding is available. Applications close 9 July 2024. Eligible organisations may apply for up to $60,000.',
    })],
    ['https://www.cityofsydney.nsw.gov.au/cultural-support-funding/short-term-empty-properties-program', htmlPage({
      description: 'Temporary occupancy of under-used properties.',
      h1: 'Short-term empty properties program',
      body: 'The program provides immediate and short-term occupancy of temporarily vacant or under-used properties within our portfolio.',
    })],
  ]);

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const page = pages.get(url);
    if (!page) {
      return {
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      text: async () => page,
    } as Response;
  }) as typeof fetch;
}

async function collectOpenTitles() {
  const plugin = createCityOfSydneyGrantsPlugin();
  const grants = [];

  for await (const grant of plugin.discover({ status: 'open' })) {
    grants.push(grant);
  }

  return grants;
}

test('cityofsydney-grants excludes landing pages, generic programs, and past-deadline rounds from open discovery', async () => {
  mockCityOfSydneyFetch();

  const grants = await collectOpenTitles();

  assert.deepEqual(
    grants.map((grant) => grant.title),
    ['Future Cultural Grant'],
  );
  assert.equal(grants[0]?.applicationStatus, 'open');
  assert.equal(grants[0]?.deadline, '31 December 2026');
});
