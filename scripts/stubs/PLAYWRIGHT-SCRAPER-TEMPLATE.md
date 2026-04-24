# Playwright Scraper Template — for Dynamic-SPA Data Sources

Used when a government disclosure system is a JS-driven SPA with no public
API. Tested-shape pattern for NSW EFA disclosures and VEC disclosures
once they come out of maintenance.

## Install (one-time)

```bash
pnpm add -D playwright
pnpm playwright install chromium
```

## Scaffold — `scripts/scrape-nsw-donations.mjs` (example)

```js
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'CivicGraph-Research/1.0 (ben@benjamink.com.au)',
  });
  const page = await ctx.newPage();

  // Navigate to the public disclosure search page
  await page.goto('https://elections.nsw.gov.au/political-participants/disclosures', {
    waitUntil: 'networkidle',
  });

  // Intercept XHR/fetch requests to capture the actual API call
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.endsWith('.json')) {
      console.log('API:', url);
      try {
        const body = await response.json();
        console.log('  body keys:', Object.keys(body));
      } catch {
        /* not json */
      }
    }
  });

  // Drive the form: select financial year, click search
  // (inspect actual DOM on target site — this is a template)
  await page.selectOption('select[name="year"]', '2024');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Extract results from the rendered DOM
  const rows = await page.$$eval('table.results tr', (els) =>
    els.map((el) => ({
      donor: el.querySelector('.donor')?.textContent?.trim(),
      amount: el.querySelector('.amount')?.textContent?.trim(),
      recipient: el.querySelector('.recipient')?.textContent?.trim(),
      date: el.querySelector('.date')?.textContent?.trim(),
    })),
  );

  console.log(`Scraped ${rows.length} rows`);

  // Insert
  for (const row of rows) {
    await db.from('political_donations').upsert({
      donor_name: row.donor,
      amount: parseAmount(row.amount),
      donation_to: row.recipient,
      donation_date: parseDate(row.date),
      source_state: 'NSW',
    });
  }

  await browser.close();
}
```

## Risks with Cloudflare-protected SPAs

- Bot detection may block headless browsers — mitigate with
  `playwright-extra` + stealth plugins
- Rate limiting — throttle to 1 request every 2-5 seconds
- Session cookies may be required — use `ctx.storageState()` after manual
  login if needed

## Estimated effort

- NSW EFA: 6-8 hours to discover API via DevTools, build & test scraper,
  handle edge cases
- VEC: 4-6 hours (simpler system, once out of maintenance)

Both are real but non-trivial projects. Only build if the data is
load-bearing for a publication. For now, federal AEC coverage (already
in the atlas) addresses the majority of accountability use cases.
