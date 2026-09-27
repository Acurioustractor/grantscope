#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { BASE, HOME, fetchText, nonce, parseDetail, sha256 } from './ingest-tenders-wa-recent.mjs';

function arg(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

const manifestArg = arg('manifest');
const apply = process.argv.includes('--apply');
if (!manifestArg) throw new Error('Usage: ingest-tenders-wa-history.mjs --manifest=PATH [--apply]');
const manifestPath = resolve(manifestArg);
const db = apply
  ? createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  : null;

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.complete !== true) throw new Error('Refusing to ingest a historical manifest that is not marked complete');
  if (!Array.isArray(manifest.contracts)) throw new Error('Historical manifest has no contracts array');
  const detailsDir = resolve(dirname(manifestPath), 'details');
  await mkdir(detailsDir, { recursive: true });
  if (!manifest.contracts.length) {
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', contracts: 0, manifest: manifestPath }, null, 2));
    return;
  }

  const home = await fetchText(HOME);
  const csrf = nonce(home.text);
  const cookie = home.cookie;
  const records = [];
  const artifacts = [];
  for (let index = 0; index < manifest.contracts.length; index += 4) {
    const batch = await Promise.all(manifest.contracts.slice(index, index + 4).map(async (row) => {
      const url = `${BASE}/watenders/contract/view.action?id=${row.id}&CSRFNONCE=${csrf}`;
      const detail = await fetchText(url, cookie);
      await writeFile(resolve(detailsDir, `${row.id}.html`), detail.text);
      const listRow = {
        ...row,
        awardedDate: row.awarded_date,
        expiryDate: row.expiry_date,
      };
      return {
        record: parseDetail(detail.text, listRow),
        artifact: { id: row.id, url: url.replace(/CSRFNONCE=[A-F0-9]+/, 'CSRFNONCE=[session]'), sha256: sha256(detail.text), bytes: Buffer.byteLength(detail.text) },
      };
    }));
    batch.forEach(({ record, artifact }) => {
      records.push(record);
      artifacts.push(artifact);
    });
  }
  await writeFile(resolve(dirname(manifestPath), 'details-manifest.json'), `${JSON.stringify({
    fetched_at: new Date().toISOString(),
    source_manifest: manifestPath,
    source_result_sha256: manifest.result_sha256,
    artifacts,
  }, null, 2)}\n`);

  if (apply) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required with --apply');
    const { error } = await db.from('state_tenders').upsert(records, { onConflict: 'source,source_id' });
    if (error) throw error;
    const ids = records.map((record) => record.source_id);
    const { count, error: countError } = await db
      .from('state_tenders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'tenders-wa')
      .in('source_id', ids);
    if (countError) throw countError;
    if (count !== records.length) throw new Error(`Post-write mismatch: expected ${records.length}, found ${count}`);
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    contracts: records.length,
    with_supplier: records.filter((record) => record.supplier_name).length,
    with_value: records.filter((record) => record.contract_value != null).length,
    manifest: manifestPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[tenders-wa-history-ingest] ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
