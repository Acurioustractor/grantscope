/**
 * The one way to write rows into `grant_opportunities`.
 *
 * WHY THIS EXISTS. The table carries THREE unique indexes, each a different idea of what makes a grant round the
 * same round:
 *   grant_opportunities_url_idx                (url)
 *   grant_opportunities_source_name_full_uniq  (source, name)
 *   idx_grant_opp_name_source_id               (name, source_id)
 * and the ingest agents pick one each: `source,name` (grantconnect, vic, foundation programs), `name,source_id`
 * (five importers), `url` (austender tenders). ON CONFLICT resolves exactly the index you name and no other, so an
 * agent that targets one key still raises a duplicate-key error on either of the others. Measured 2026-09-05:
 * "VIC Grants Gateway (Open)" failed 51 of 57 nightly runs on the url index, because those Victorian grants had been
 * ingested earlier under a different source label and kept their URLs. Switching the conflict target to `url` simply
 * moved the failure to the (source, name) index: a re-published grant arrives with a new URL under a name already
 * taken. Neither key alone can work, so this resolves the row first and writes by primary key.
 *
 * WHAT THIS DOES.
 *   1. De-duplicates inside the batch, by url first and (source, name) otherwise. A batch carrying the same round
 *      twice used to fail the whole statement. The later row wins: it is the fresher scrape.
 *   2. Looks the batch up in the table by url, and by (source, name) per source, in bulk.
 *   3. Writes each row by the id it resolved to, so no unique index is ever crossed. Rows that resolve to nothing
 *      are inserted.
 *   4. A row that resolves to TWO DIFFERENT existing rows (its url belongs to one, its name to another) is a genuine
 *      duplicate pair already in the table. It is reported, not guessed at, because merging them is a human call.
 *   5. Writes go in chunks; a chunk that still fails is retried row by row so one bad row cannot cost the run.
 *      Failures are returned, not thrown, for the agent to log as a partial run.
 *
 * It deliberately does not use `name,source_id`: nothing needs a third identity, and dropping that index is a
 * separate decision (thoughts/shared/findings/supabase-platform-review-2026-09-05.md).
 */

const CHUNK = 200;

export function dedupeGrantRows(rows) {
  const seen = new Map();
  const out = [];
  let dropped = 0;
  for (const row of rows ?? []) {
    const url = typeof row.url === 'string' && row.url.trim() ? row.url.trim() : null;
    const key = url ? `u:${url}` : `s:${row.source ?? ''}\u0000${row.name ?? ''}`;
    const at = seen.get(key);
    if (at !== undefined) {
      out[at] = { ...row, url };
      dropped += 1;
      continue;
    }
    seen.set(key, out.length);
    out.push({ ...row, url });
  }
  return { rows: out, dropped };
}

const pairKey = (source, name) => `${source ?? ''}\u0000${name ?? ''}`;

/** Existing ids for this batch, by url and by (source, name). Bulk, chunked, no per-row round trips. */
async function resolveExisting(supabase, rows, chunkSize) {
  const byUrl = new Map();
  const byPair = new Map();

  const urls = rows.map((r) => r.url).filter(Boolean);
  for (let i = 0; i < urls.length; i += chunkSize) {
    const { data, error } = await supabase
      .from('grant_opportunities')
      .select('id, url')
      .in('url', urls.slice(i, i + chunkSize));
    if (error) throw new Error(`lookup by url failed: ${error.message}`);
    for (const row of data ?? []) byUrl.set(row.url, row.id);
  }

  const namesBySource = new Map();
  for (const row of rows) {
    if (!row.name) continue;
    const list = namesBySource.get(row.source ?? null) ?? [];
    list.push(row.name);
    namesBySource.set(row.source ?? null, list);
  }
  for (const [source, names] of namesBySource) {
    for (let i = 0; i < names.length; i += chunkSize) {
      let query = supabase.from('grant_opportunities').select('id, source, name').in('name', names.slice(i, i + chunkSize));
      query = source === null ? query.is('source', null) : query.eq('source', source);
      const { data, error } = await query;
      if (error) throw new Error(`lookup by source and name failed: ${error.message}`);
      for (const row of data ?? []) byPair.set(pairKey(row.source, row.name), row.id);
    }
  }
  return { byUrl, byPair };
}

async function writeChunk(supabase, chunk, onConflict) {
  const { error } = await supabase.from('grant_opportunities').upsert(chunk, { onConflict, ignoreDuplicates: false });
  return error;
}

async function writeGroup(supabase, group, onConflict, chunkSize, tally) {
  for (let i = 0; i < group.length; i += chunkSize) {
    const chunk = group.slice(i, i + chunkSize);
    const error = await writeChunk(supabase, chunk, onConflict);
    if (!error) {
      tally.written += chunk.length;
      continue;
    }
    for (const row of chunk) {
      const rowError = await writeChunk(supabase, [row], onConflict);
      if (rowError) {
        tally.failed += 1;
        if (tally.errors.length < 20) tally.errors.push(`${row.url || `${row.source}/${row.name}`}: ${rowError.message}`);
      } else {
        tally.written += 1;
      }
    }
  }
}

/**
 * @returns {Promise<{written:number, failed:number, droppedInBatch:number, ambiguous:number, errors:string[]}>}
 */
export async function upsertGrantOpportunities(supabase, rawRows, { chunkSize = CHUNK } = {}) {
  const { rows, dropped } = dedupeGrantRows(rawRows);
  const tally = { written: 0, failed: 0, errors: [] };
  if (!rows.length) return { ...tally, droppedInBatch: dropped, ambiguous: 0 };

  const { byUrl, byPair } = await resolveExisting(supabase, rows, chunkSize);

  const updates = [];
  const inserts = [];
  let ambiguous = 0;
  for (const row of rows) {
    const urlId = row.url ? byUrl.get(row.url) : undefined;
    const pairId = byPair.get(pairKey(row.source, row.name));
    if (urlId && pairId && urlId !== pairId) {
      ambiguous += 1;
      if (tally.errors.length < 20) {
        tally.errors.push(`${row.url}: url belongs to ${urlId} but "${row.source}/${row.name}" belongs to ${pairId}; two rows in the table are the same round, skipped pending a merge`);
      }
      continue;
    }
    const id = urlId ?? pairId;
    if (id) updates.push({ ...row, id });
    else inserts.push(row);
  }

  await writeGroup(supabase, updates, 'id', chunkSize, tally);
  await writeGroup(supabase, inserts, 'url', chunkSize, tally);

  return { ...tally, droppedInBatch: dropped, ambiguous };
}

/**
 * One row, with the id back. Same resolution rule as the batch path, for callers that need the id to link other
 * records to the round (sync-foundation-programs links a foundation program to the round it produced).
 *
 * @returns {Promise<{id: string|null, created: boolean, error: string|null, ambiguous?: boolean}>}
 */
export async function upsertOneGrantOpportunity(supabase, row) {
  const url = typeof row.url === 'string' && row.url.trim() ? row.url.trim() : null;
  const candidate = { ...row, url };

  const { byUrl, byPair } = await resolveExisting(supabase, [candidate], 1);
  const urlId = url ? byUrl.get(url) : undefined;
  const pairId = byPair.get(pairKey(candidate.source, candidate.name));
  if (urlId && pairId && urlId !== pairId) {
    return {
      id: null,
      created: false,
      ambiguous: true,
      error: `url belongs to ${urlId} but "${candidate.source}/${candidate.name}" belongs to ${pairId}; two rows are the same round, skipped pending a merge`,
    };
  }

  const existingId = urlId ?? pairId;
  const payload = existingId ? { ...candidate, id: existingId } : candidate;
  const { data, error } = await supabase
    .from('grant_opportunities')
    .upsert(payload, { onConflict: existingId ? 'id' : 'url', ignoreDuplicates: false })
    .select('id')
    .maybeSingle();

  if (error) return { id: null, created: false, error: error.message };
  return { id: data?.id ?? existingId ?? null, created: !existingId, error: null };
}
