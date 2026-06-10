#!/usr/bin/env node
/**
 * Refresh the QBE Diagnostic Artifact Database snapshot from Notion.
 *
 * This board on the Goods governance page MIRRORS Notion; it never edits it.
 * Run as:  node --env-file=.env scripts/sync-qbe-diagnostic.mjs
 *
 * Requires NOTION_TOKEN in the environment. Writes the same JSON shape to both
 * data/goods-qbe-diagnostic.json (root) and
 * apps/web/src/lib/data/goods-qbe-diagnostic.json (bundled into the app).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DATABASE_ID = 'cb3794d427914d72bf1036106d8116f5';
const NOTION_VERSION = '2022-06-28';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const OUT_PATHS = [
  resolve(repoRoot, 'data/goods-qbe-diagnostic.json'),
  resolve(repoRoot, 'apps/web/src/lib/data/goods-qbe-diagnostic.json'),
];

/** Pull plain text out of a Notion title or rich_text array. */
function plainText(prop) {
  const arr = prop?.title ?? prop?.rich_text;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const text = arr.map((t) => t?.plain_text ?? '').join('').trim();
  return text.length > 0 ? text : null;
}

/** Pull the name of a Notion select, or null. */
function selectName(prop) {
  return prop?.select?.name ?? null;
}

/** Pull the start date of a Notion date, or null. */
function dateStart(prop) {
  return prop?.date?.start ?? null;
}

/** Pull a Notion number, or null. */
function numberValue(prop) {
  return prop?.number ?? null;
}

/** Map one Notion page into our area row shape, tolerating missing props. */
function mapPage(page) {
  const p = page.properties ?? {};
  const row = {
    number: numberValue(p['Number']),
    area: plainText(p['Area']),
    diagnosticStatus: selectName(p['Diagnostic Status']),
    buildStatus: selectName(p['Build Status']),
    priority: selectName(p['Priority']),
    timing: selectName(p['Timing']),
    due: dateStart(p['Due']),
    owner: plainText(p['Owner']),
    primaryGap: plainText(p['Primary Gap']),
    nextBuild: plainText(p['Next Build']),
    publicCopyRisk: plainText(p['Public Copy Risk']),
    notionUrl: page.url ?? null,
  };
  const verified = plainText(p['Verified Numbers']);
  if (verified) row.verifiedNumbers = verified;
  return row;
}

async function queryDatabase(token) {
  const pages = [];
  let cursor = undefined;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion query failed (${res.status}): ${body}`);
    }
    const json = await res.json();
    pages.push(...(json.results ?? []));
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error('NOTION_TOKEN is not set. Run as: node --env-file=.env scripts/sync-qbe-diagnostic.mjs');
    process.exit(1);
  }

  const pages = await queryDatabase(token);
  const areas = pages
    .map(mapPage)
    .filter((a) => a.number != null || a.area != null)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const snapshot = {
    source: `Notion — QBE Diagnostic Artifact Database (db ${DATABASE_ID})`,
    syncedAt: new Date().toISOString(),
    syncMethod: 'scripts/sync-qbe-diagnostic.mjs (Notion API)',
    notes:
      'Claim-label taxonomy: verified | modelled | target | future | internal only. This board mirrors Notion; it does not edit it.',
    areas,
  };

  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  for (const out of OUT_PATHS) {
    writeFileSync(out, serialized);
  }

  const p0 = areas.filter((a) => a.priority === 'P0').length;
  console.log(`Synced ${areas.length} areas (${p0} P0) to ${OUT_PATHS.length} files.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
