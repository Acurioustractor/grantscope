#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://www.wa.gov.au';
const COLLECTION = `${BASE}/government/document-collections/aboriginal-procurement-policy-performance-reports`;
const OUT_DIR = resolve('data/wa-app-performance');
const APPLY = process.argv.includes('--apply');
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function absolute(url) {
  return new URL(url, BASE).href;
}

function slug(url) {
  return new URL(url).pathname.split('/').filter(Boolean).at(-1);
}

async function fetchOk(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 WA public evidence collector' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

async function main() {
  await mkdir(resolve(OUT_DIR, 'pages'), { recursive: true });
  await mkdir(resolve(OUT_DIR, 'files'), { recursive: true });

  const collectionResponse = await fetchOk(COLLECTION);
  const collectionHtml = await collectionResponse.text();
  await writeFile(resolve(OUT_DIR, 'collection.html'), collectionHtml);
  const $ = cheerio.load(collectionHtml);
  const publicationUrls = [...new Set(
    $('a.document-card__link[href*="/government/publications/aboriginal-procurement-policy-"]')
      .map((_, element) => absolute($(element).attr('href')))
      .get()
      .filter((url) => /performance-report/i.test(url)),
  )];
  const directFiles = [...new Set(
    $('a[href]')
      .map((_, element) => absolute($(element).attr('href')))
      .get()
      .filter((url) => /\.pdf(?:\?|$)/i.test(url) && /Aboriginal-Procurement-Policy-Performance-Report/i.test(url)),
  )];
  if (!publicationUrls.length) throw new Error('No APP annual publication pages were discovered');

  const pageArtifacts = [];
  const fileUrls = new Set(directFiles);
  for (const pageUrl of publicationUrls) {
    const response = await fetchOk(pageUrl);
    const html = await response.text();
    const pageName = slug(pageUrl);
    await writeFile(resolve(OUT_DIR, 'pages', `${pageName}.html`), html);
    const page = cheerio.load(html);
    const pdfs = [...new Set(
      page('a[href]')
        .map((_, element) => absolute(page(element).attr('href')))
        .get()
        .filter((url) => /\.pdf(?:\?|$)/i.test(url)),
    )];
    if (!pdfs.length) throw new Error(`No PDF assets found on ${pageUrl}`);
    pdfs.forEach((url) => fileUrls.add(url));
    pageArtifacts.push({
      title: page('h1').first().text().replace(/\s+/g, ' ').trim(),
      url: pageUrl,
      sha256: sha256(html),
      bytes: Buffer.byteLength(html),
      pdf_urls: pdfs,
    });
  }

  const files = [];
  for (const url of fileUrls) {
    const response = await fetchOk(url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('pdf') && bytes.subarray(0, 4).toString() !== '%PDF') {
      throw new Error(`Expected PDF content from ${url}, received ${contentType || 'unknown'}`);
    }
    const fileName = decodeURIComponent(basename(new URL(url).pathname));
    await writeFile(resolve(OUT_DIR, 'files', fileName), bytes);
    files.push({ url, file_name: fileName, sha256: sha256(bytes), bytes: bytes.length, content_type: contentType });
  }

  const fetchedAt = new Date().toISOString();
  const manifest = {
    fetched_at: fetchedAt,
    collection_url: COLLECTION,
    collection_sha256: sha256(collectionHtml),
    publication_pages: pageArtifacts,
    files,
  };
  await writeFile(resolve(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  if (APPLY) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required with --apply');
    const { error } = await db
      .from('source_frontier')
      .update({
        last_checked_at: fetchedAt,
        last_success_at: fetchedAt,
        last_changed_at: fetchedAt,
        last_http_status: 200,
        failure_count: 0,
        last_error: null,
        content_hash: manifest.collection_sha256,
        metadata: {
          geography: 'AU-WA',
          lane: 'aboriginal-procurement',
          data_fit: 'document-extraction',
          evidence_status: 'artifacts-preserved',
          proves: 'Annual aggregate contract counts, value, agency and regional performance under the APP.',
          cannot_prove: 'Individual award detail, complete supplier participation, realised expenditure or community outcomes.',
          jev_policy: 'public-text-review-queue-only',
          collector: 'scripts/wa/fetch-app-performance-reports.mjs',
          publication_pages: pageArtifacts.length,
          pdf_artifacts: files.length,
        },
        updated_at: fetchedAt,
      })
      .eq('source_key', 'wa-transition:app-performance');
    if (error) throw error;
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    publication_pages: pageArtifacts.length,
    pdf_artifacts: files.length,
    total_pdf_bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    manifest: resolve(OUT_DIR, 'manifest.json'),
  }, null, 2));
}

main().catch((error) => {
  console.error(`[wa-app-performance] ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
