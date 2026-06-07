#!/usr/bin/env node
/**
 * ingest-state-se-networks.mjs — state SE network directories → social_enterprises
 *
 * Replaces the HTML-crawl approach of import-state-se-networks.mjs (which scooped
 * nav links — 144 junk rows deleted 2026-06-07). This reads the sites' actual
 * data-API payloads, captured 2026-06-07 into data/scrapes/:
 *
 *   qsec-members.json              QSEC (QLD)  — WP store-locator, double-encoded JSON
 *   senvic-storepoint.json         SENVIC (VIC) — Storepoint map API (.results.locations)
 *   secna-embeddirectory.json      SECNA (NSW/ACT) — Embeddirectory items + numeric custom fields
 *   sasec-loadmembers.json         SASEC (SA)  — while(1);-prefixed JS-literal "JsonStructure"
 *   wasec-directory.json           WASEC (WA)  — scrape-wasec-directory.mjs output (Livewire app)
 *
 * SENTAS (TAS) rebranded to SECTAS (sectas.org.au) — verified 2026-06-07: no
 * public member directory exists (members live in a private chat platform).
 *
 * SASEC: only "Social Enterprise Ordinary Member" rows are ingested — Associate
 * Members are supporters (foundations, law firms), not social enterprises.
 *
 * Merge strategy (one psql session, temp table):
 *   - existing row matched on UPPER(name) + state (NULL state counts as a match
 *     and gets filled): append network entry to sources jsonb (both array and
 *     object shapes handled, idempotent), fill NULL description/website/postcode/
 *     city/state, never overwrite.
 *   - no match: INSERT as a new row (source_primary = network key).
 *
 * Dry-run by default; --live applies. Proposals CSV written to data/backups/ every run.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';

const LIVE = process.argv.includes('--live');
const ONLY = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1] || null;
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
const SCRAPED_AT = '2026-06-07';
const PROPOSALS_FILE = `data/backups/${SCRAPED_AT}-state-se-networks-proposals.csv`;

if (!process.env.DATABASE_PASSWORD) {
  console.error('DATABASE_PASSWORD not set — run with --env-file=.env');
  process.exit(1);
}

// ---------- text utils ----------

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#38': '&', '#39': "'", '#8217': '’', '#8211': '–', '#8220': '“', '#8221': '”' };
const decode = (s) =>
  String(s ?? '')
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) || m : m))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanUrl = (u) => {
  const v = decode(u);
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return null; // "To be established", mailto:, fragments
};

// network membership ≠ HQ state (e.g. Givvable on the SENVIC map is Sydney-based) —
// when a postcode is present, derive state from it; fall back to the network's state
function stateFromPostcode(pc, fallback) {
  if (!/^\d{4}$/.test(pc || '')) return fallback;
  const n = Number(pc);
  if ((n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return 'ACT';
  if (n >= 800 && n <= 999) return 'NT';
  return { 2: 'NSW', 3: 'VIC', 4: 'QLD', 5: 'SA', 6: 'WA', 7: 'TAS', 8: 'VIC', 9: 'QLD' }[pc[0]] || fallback;
}

// junk guard — the failure mode that produced the deleted nav-link rows
const NAV_WORDS = /^(home|about( us)?|contact( us)?|members?|join( us)?|log ?in|sign ?up|news|events?|resources?|directory|privacy|terms|faq|search|donate)$/i;
const validName = (n) => n && n.length >= 3 && n.length <= 150 && !NAV_WORDS.test(n) && /[a-z]/i.test(n);

const splitList = (s, sep = ',') =>
  decode(s)
    .split(sep)
    .map((x) => x.trim())
    .filter((x) => x.length > 1 && x.length < 100);

// ---------- parsers (one per payload format) ----------

function parseQsec() {
  // double-encoded: file is a JSON string containing a JSON array
  const rows = JSON.parse(JSON.parse(readFileSync('data/scrapes/qsec-members.json', 'utf-8')));
  return rows.map((r) => {
    const site = cleanUrl(r.website);
    const ownSite = site && !/qsec\.org\.au/i.test(site) ? site : null;
    const postcode = /^\d{4}$/.test(r.postal_code) ? r.postal_code : null;
    return {
      name: decode(r.title),
      state: stateFromPostcode(postcode, 'QLD'),
      description: decode([r.description, r.description_2].filter(Boolean).join(' ')) || null,
      website: ownSite,
      postcode,
      city: decode(r.city) || null,
      sector: r.categories ? splitList(r.categories) : [],
      geographic_focus: [],
      entry: {
        source: 'qsec', member: true, scraped_at: SCRAPED_AT,
        url: ownSite ? null : site, // qsec profile page
        ...(r.email && { email: r.email }), ...(r.phone && { phone: r.phone }),
      },
    };
  });
}

function parseSenvic() {
  const { results } = JSON.parse(readFileSync('data/scrapes/senvic-storepoint.json', 'utf-8'));
  return results.locations.map((r) => {
    const addr = decode(r.streetaddress);
    const pc = addr.match(/\b(\d{4})\b(?!.*\b\d{4}\b)/); // last 4-digit run
    return {
      name: decode(r.name),
      state: stateFromPostcode(pc?.[1], 'VIC'),
      description: decode(r.description) || null,
      website: cleanUrl(r.website),
      postcode: pc ? pc[1] : null,
      city: null,
      sector: r.tags ? splitList(r.tags) : [],
      geographic_focus: [],
      entry: {
        source: 'senvic', member: true, scraped_at: SCRAPED_AT,
        ...(addr && { address: addr }),
        ...(r.email && { email: r.email }), ...(r.phone && { phone: r.phone }),
        ...(r.instagram && { instagram: r.instagram }), ...(r.facebook && { facebook: r.facebook }),
      },
    };
  });
}

// SECNA custom-field ids, inferred from values (settings payload doesn't label them)
const SECNA_CF = {
  industry: '1774323511683',
  impact: '1774323528427',
  linkedin: '1774584377480',
  website: '1774585522012',
  attributes: '1777957075584',
  coverage: '1777958083379',
};

function parseSecna() {
  const { items } = JSON.parse(readFileSync('data/scrapes/secna-embeddirectory.json', 'utf-8'));
  return items.map((r) => {
    const cf = r.custom_fields || {};
    const arr = (k) => (Array.isArray(cf[SECNA_CF[k]]) ? cf[SECNA_CF[k]].map(decode).filter(Boolean) : []);
    return {
      name: decode(r.name),
      state: 'NSW', // SECNA covers NSW & ACT; per-record state isn't in the payload
      description: decode(r.description) || null,
      website: cleanUrl(cf[SECNA_CF.website]),
      postcode: null,
      city: decode(r.address) || null,
      sector: [...arr('industry'), ...arr('impact')],
      geographic_focus: arr('coverage'),
      entry: {
        source: 'secna', member: true, scraped_at: SCRAPED_AT,
        ...(arr('attributes').length && { attributes: arr('attributes') }),
        ...(cleanUrl(cf[SECNA_CF.linkedin]) && { linkedin: cleanUrl(cf[SECNA_CF.linkedin]) }),
      },
    };
  });
}

function parseSasec() {
  // while(1); prefix, then JSON whose .JsonStructure is a JS object literal (unquoted keys)
  const raw = readFileSync('data/scrapes/sasec-loadmembers.json', 'utf-8').replace(/^while\(1\);\s*/, '');
  const structure = JSON.parse(raw).JsonStructure;
  const out = [];
  const V = `'((?:\\\\.|[^'\\\\])*)'`; // single-quoted JS string value
  for (const chunk of structure.split(/\{c1:/).slice(1)) {
    const name = chunk.match(new RegExp(`c2:\\[\\{fft:9, v:${V}`))?.[1];
    const cats = chunk.match(new RegExp(`\\},\\{fft:4, v:${V}\\}\\]`))?.[1];
    const type = chunk.match(new RegExp(`c3:\\[\\{sft:1, v:${V}`))?.[1];
    const region = chunk.match(new RegExp(`c4:\\[\\{fft:4, v:${V}`))?.[1];
    if (!name || !/social enterprise/i.test(type || '')) continue; // skip Associate Members
    out.push({
      name: decode(name.replace(/\\'/g, "'")),
      state: 'SA',
      description: null,
      website: null,
      postcode: null,
      city: null,
      sector: cats ? splitList(cats.replace(/\\'/g, "'")) : [],
      geographic_focus: region ? [decode(region.replace(/\\'/g, "'"))] : [],
      entry: { source: 'sasec', member: true, membership: decode(type), scraped_at: SCRAPED_AT },
    });
  }
  return out;
}

function parseWasec() {
  // output of scripts/scrape-wasec-directory.mjs (admin.wasec.org.au Livewire app)
  const { members } = JSON.parse(readFileSync('data/scrapes/wasec-directory.json', 'utf-8'));
  return members.filter((m) => !m.error).map((m) => ({
    name: decode(m.name),
    state: 'WA',
    description: decode(m.description) || null,
    website: cleanUrl(m.website),
    postcode: null,
    city: null,
    sector: (m.impact_areas || []).map(decode).filter(Boolean),
    geographic_focus: (m.service_areas || []).map(decode).filter(Boolean),
    certifications: (m.certifications || []).map(decode).filter(Boolean),
    entry: {
      source: 'wasec', member: true, scraped_at: SCRAPED_AT,
      url: `https://admin.wasec.org.au/directory/${m.slug}`,
      ...(m.instagram && { instagram: m.instagram }), ...(m.facebook && { facebook: m.facebook }),
      ...(m.linkedin && { linkedin: m.linkedin }),
    },
  }));
}

// ---------- SQL ----------

const esc = (v) => String(v).replace(/'/g, "''");
const sqlText = (v) => (v == null || v === '' ? 'NULL' : `'${esc(v)}'`);
const sqlArr = (a) => (a?.length ? `ARRAY[${a.map((x) => `'${esc(x)}'`).join(',')}]::text[]` : `'{}'::text[]`);
const sqlJson = (o) => `'${esc(JSON.stringify(o))}'::jsonb`;

function buildSql(rows) {
  const values = rows
    .map((r) => `(${sqlText(r.name)}, ${sqlText(r.state)}, ${sqlText(r.description)}, ${sqlText(r.website)}, ${sqlText(r.postcode)}, ${sqlText(r.city)}, ${sqlArr(r.sector)}, ${sqlArr(r.geographic_focus)}, ${r.certifications?.length ? sqlJson(r.certifications) : 'NULL'}, '${r.entry.source}', ${sqlJson(r.entry)})`)
    .join(',\n');

  return `
CREATE TEMP TABLE stage (
  name text, state text, description text, website text, postcode text, city text,
  sector text[], geographic_focus text[], certifications jsonb, source_key text, source_entry jsonb
);

INSERT INTO stage VALUES
${values};

-- enrich existing rows: same UPPER(name), same state (or existing state NULL)
WITH matched AS (
  SELECT se.id, st.*
  FROM stage st
  JOIN social_enterprises se
    ON UPPER(TRIM(se.name)) = UPPER(st.name)
   AND (se.state IS NULL OR UPPER(se.state) = st.state)
)
UPDATE social_enterprises se
SET
  description = COALESCE(se.description, m.description),
  website     = COALESCE(se.website, m.website),
  postcode    = COALESCE(se.postcode, m.postcode),
  city        = COALESCE(se.city, m.city),
  state       = COALESCE(se.state, m.state),
  sector      = CASE WHEN se.sector IS NULL OR se.sector = '{}' THEN m.sector ELSE se.sector END,
  geographic_focus = CASE WHEN se.geographic_focus IS NULL OR se.geographic_focus = '{}' THEN m.geographic_focus ELSE se.geographic_focus END,
  certifications = COALESCE(se.certifications, m.certifications),
  sources = CASE
    WHEN se.sources IS NULL THEN jsonb_build_array(m.source_entry)
    WHEN jsonb_typeof(se.sources) = 'array' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(se.sources) e WHERE e->>'source' = m.source_key
    ) THEN se.sources || jsonb_build_array(m.source_entry)
    WHEN jsonb_typeof(se.sources) = 'object' AND NOT se.sources ? m.source_key
      THEN se.sources || jsonb_build_object(m.source_key, m.source_entry)
    ELSE se.sources
  END,
  updated_at = now()
FROM matched m
WHERE se.id = m.id;

-- insert rows with no existing match
INSERT INTO social_enterprises (name, state, description, website, postcode, city, sector, geographic_focus, certifications, org_type, source_primary, sources)
SELECT st.name, st.state, st.description, st.website, st.postcode, st.city, st.sector, st.geographic_focus, st.certifications,
       'social_enterprise', st.source_key, jsonb_build_array(st.source_entry)
FROM stage st
WHERE NOT EXISTS (
  SELECT 1 FROM social_enterprises se
  WHERE UPPER(TRIM(se.name)) = UPPER(st.name)
    AND (se.state IS NULL OR UPPER(se.state) = st.state)
)
ON CONFLICT (name, state) DO NOTHING;
`;
}

function runPsqlFile(sql, label) {
  const file = `/tmp/${label}-${Date.now()}.sql`;
  writeFileSync(file, sql);
  try {
    return execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -f ${file}`, { encoding: 'utf-8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`psql failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(file); } catch {}
  }
}

// ---------- main ----------

function main() {
  console.log(`Mode: ${LIVE ? 'LIVE' : 'DRY RUN'}\n`);

  const parsed = [
    ...parseQsec(),
    ...parseSenvic(),
    ...parseSecna(),
    ...parseSasec(),
    ...parseWasec(),
  ].filter((r) => !ONLY || r.entry.source === ONLY);
  if (ONLY) console.log(`--source=${ONLY} filter active`);

  // validate + dedupe within batch on (upper name, state)
  const seen = new Set();
  const rejected = [];
  const rows = parsed.filter((r) => {
    if (!validName(r.name)) { rejected.push(r); return false; }
    const key = `${r.name.toUpperCase()}|${r.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const bySource = rows.reduce((acc, r) => ((acc[r.entry.source] = (acc[r.entry.source] || 0) + 1), acc), {});
  console.log(`Parsed ${parsed.length} → ${rows.length} valid+deduped ${JSON.stringify(bySource)}`);
  if (rejected.length) console.log(`Rejected ${rejected.length} invalid names: ${rejected.slice(0, 5).map((r) => JSON.stringify(r.name)).join(', ')}${rejected.length > 5 ? ', …' : ''}`);

  // audit trail
  mkdirSync('data/backups', { recursive: true });
  const csv = ['source,name,state,postcode,website,sectors']
    .concat(rows.map((r) => `${r.entry.source},"${r.name.replace(/"/g, '""')}",${r.state},${r.postcode || ''},${r.website || ''},"${r.sector.join('; ').replace(/"/g, '""')}"`))
    .join('\n');
  writeFileSync(PROPOSALS_FILE, csv + '\n');
  console.log(`Proposals written to ${PROPOSALS_FILE}`);

  if (!LIVE) {
    for (const src of Object.keys(bySource)) {
      const sample = rows.filter((r) => r.entry.source === src).slice(0, 3);
      console.log(`\n  [${src}] sample:`);
      sample.forEach((r) => console.log(`    ${r.name} (${r.state}${r.postcode ? ' ' + r.postcode : ''}) ${r.website || ''} [${r.sector.slice(0, 3).join(', ')}]`));
    }
    console.log('\nDry run — re-run with --live to apply.');
    return;
  }

  console.log('\nApplying via psql...');
  const out = runPsqlFile(buildSql(rows), 'state-se-ingest');
  const updated = out.match(/UPDATE (\d+)/)?.[1] ?? '?';
  // last INSERT tag — the first is the staging-table load
  const inserted = [...out.matchAll(/INSERT 0 (\d+)/g)].at(-1)?.[1] ?? '?';
  console.log(`Enriched existing: ${updated}, inserted new: ${inserted}`);

  const after = runPsqlFile(`SELECT source_primary, COUNT(*) FROM social_enterprises GROUP BY 1 ORDER BY 2 DESC;`, 'state-se-after');
  console.log(after);
}

main();
