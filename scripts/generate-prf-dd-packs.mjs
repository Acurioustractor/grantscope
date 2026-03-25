#!/usr/bin/env node
/**
 * Generate PRF DD Pack PDFs to ~/Downloads/prf-dd-packs/
 *
 * Prerequisites: dev server running on port 3003
 *   npx next dev --turbopack -p 3003
 *
 * Usage:
 *   node scripts/generate-prf-dd-packs.mjs
 *   node scripts/generate-prf-dd-packs.mjs --collection=prf-plus-sites
 */
import { writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const BASE_URL = 'http://localhost:3003';
const collection = process.argv.find(a => a.startsWith('--collection='))?.split('=')[1] || 'prf-portfolio';
const outDir = join(homedir(), 'Downloads', 'prf-dd-packs');

async function main() {
  await mkdir(outDir, { recursive: true });

  // 1. Fetch the collection manifest
  console.log(`Fetching ${collection} collection...`);
  const manifestRes = await fetch(`${BASE_URL}/api/dd-packs/batch?collection=${collection}&format=summary`);
  if (!manifestRes.ok) {
    console.error(`Failed to fetch collection: ${manifestRes.status} ${await manifestRes.text()}`);
    process.exit(1);
  }
  const manifest = await manifestRes.json();
  console.log(`Collection: ${manifest.collection}`);
  console.log(`Entities: ${manifest.summary.total} (${manifest.summary.successful} successful)\n`);

  // 2. Download each PDF
  let downloaded = 0;
  let failed = 0;

  for (const result of manifest.results) {
    if (result.status !== 'success') {
      console.log(`  SKIP ${result.gsId} — ${result.status}`);
      failed++;
      continue;
    }

    const gsId = result.gsId;
    const name = result.name;
    console.log(`  Generating PDF for ${name} (${gsId})...`);

    try {
      const pdfRes = await fetch(
        `${BASE_URL}/api/dd-packs/batch?collection=${collection}&format=pdf&entity=${encodeURIComponent(gsId)}`
      );

      if (!pdfRes.ok) {
        console.log(`    FAILED: ${pdfRes.status}`);
        failed++;
        continue;
      }

      const contentDisp = pdfRes.headers.get('content-disposition') || '';
      const filenameMatch = contentDisp.match(/filename="(.+?)"/);
      const filename = filenameMatch?.[1] || `due-diligence-${gsId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

      const buffer = Buffer.from(await pdfRes.arrayBuffer());
      const filepath = join(outDir, filename);
      await writeFile(filepath, buffer);
      console.log(`    Saved: ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`);
      downloaded++;
    } catch (err) {
      console.log(`    ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${downloaded} PDFs saved to ${outDir}`);
  if (failed > 0) console.log(`${failed} failed/skipped.`);

  // 3. Generate index file
  const indexLines = [
    `# ${manifest.collection}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `| # | Entity | ABN | Status |`,
    `|---|--------|-----|--------|`,
  ];
  for (const result of manifest.results) {
    const abn = result.pack?.entity?.abn || '—';
    indexLines.push(`| ${manifest.results.indexOf(result) + 1} | ${result.name} | ${abn} | ${result.status} |`);
  }
  await writeFile(join(outDir, 'INDEX.md'), indexLines.join('\n'));
  console.log(`Index written to ${outDir}/INDEX.md`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
