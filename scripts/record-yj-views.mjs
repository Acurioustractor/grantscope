#!/usr/bin/env node
/**
 * Record the Youth Justice visualization pages as MP4.
 *
 * Uses Playwright's built-in video recording (WebM), then ffmpeg to convert.
 * The "play" views are recorded with Play clicked and held for the full year scrub.
 * The "static" views are recorded with a small reveal animation (CSS fade-in).
 *
 * Usage:
 *   pnpm exec node scripts/record-yj-views.mjs                      # all 5
 *   pnpm exec node scripts/record-yj-views.mjs tanks money-river    # subset
 *
 * Requires:
 *   - dev server on localhost:3003
 *   - playwright (already installed in apps/web)
 *   - ffmpeg in PATH
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'videos');
const TMP_DIR = join(OUT_DIR, '_tmp');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
const VIEWPORT = { width: 1920, height: 1080 };

const VIEWS = {
  tanks: {
    path: '/graph/youth-justice-views/tanks',
    duration: 16000, // ms after Play
    play: true,
    title: 'Two Tanks · Reactive vs Prevention',
  },
  'money-river': {
    path: '/graph/youth-justice-views/money-river',
    duration: 16000,
    play: true,
    title: 'Money River · 17 years of cumulative spend',
  },
  drain: {
    path: '/graph/youth-justice-views/drain',
    duration: 8000,
    play: false,
    title: 'The Drain · Where the money lands',
  },
  cityscape: {
    path: '/graph/youth-justice-views/cityscape',
    duration: 8000,
    play: false,
    title: 'Cityscape of Injustice',
  },
  'tree-rings': {
    path: '/graph/youth-justice-views/tree-rings',
    duration: 8000,
    play: false,
    title: 'Tree Rings of Spend',
  },
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

async function recordOne(slug) {
  const view = VIEWS[slug];
  if (!view) throw new Error(`Unknown view: ${slug}`);

  const tmpVideoDir = join(TMP_DIR, slug);
  await rm(tmpVideoDir, { recursive: true, force: true });
  await mkdir(tmpVideoDir, { recursive: true });

  console.log(`\n▶  Recording ${slug} → ${view.path}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpVideoDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${view.path}`, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for SVG / data to settle
  await page.waitForTimeout(2500);

  if (view.play) {
    // Find and click the Play button
    const playBtn = page.locator('button', { hasText: /play/i }).first();
    if (await playBtn.count() > 0) {
      await playBtn.click();
      console.log(`   ⌖ clicked Play`);
    }
  }

  await page.waitForTimeout(view.duration);

  await page.close();
  await context.close();
  await browser.close();

  // Find the recorded webm and rename
  const files = await readdir(tmpVideoDir);
  const webm = files.find(f => f.endsWith('.webm'));
  if (!webm) throw new Error(`No .webm found in ${tmpVideoDir}`);
  const webmPath = join(tmpVideoDir, webm);
  const finalWebm = join(OUT_DIR, `yj-${slug}.webm`);
  const finalMp4 = join(OUT_DIR, `yj-${slug}.mp4`);
  await rename(webmPath, finalWebm);
  await rm(tmpVideoDir, { recursive: true, force: true });

  // Convert to MP4 (h.264, faststart for web playback)
  console.log(`   ⌖ converting to MP4`);
  await run('ffmpeg', [
    '-y',
    '-i', finalWebm,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '20',
    '-preset', 'medium',
    '-movflags', '+faststart',
    finalMp4,
  ]);

  const s = await stat(finalMp4);
  console.log(`   ✅ ${finalMp4}  (${(s.size / 1e6).toFixed(1)} MB)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(TMP_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const slugs = args.length > 0 ? args : Object.keys(VIEWS);

  for (const slug of slugs) {
    try {
      await recordOne(slug);
    } catch (err) {
      console.error(`   ❌ ${slug}: ${err.message}`);
    }
  }

  // Cleanup tmp
  await rm(TMP_DIR, { recursive: true, force: true });

  console.log(`\nDone. Outputs in ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
