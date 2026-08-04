#!/usr/bin/env node
/**
 * Fill missing GHL company website, email and phone fields from GrantScope.
 *
 * Matching is deliberately conservative:
 * - exact ABN from the GHL description; or
 * - exact organisation name after punctuation/legal-suffix normalisation.
 *
 * Existing GHL values are never overwritten. Dry-run is the default.
 *
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/enrich-ghl-companies.mjs
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/enrich-ghl-companies.mjs --apply
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const CSV_PATH = process.argv.find((arg) => arg.startsWith('--csv='))?.slice(6) || null;

if (!GHL_API_KEY || !GHL_LOCATION_ID) throw new Error('Missing GHL credentials');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing GrantScope Supabase credentials');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const clean = (value) => String(value || '').trim() || null;
const normalizeName = (value) => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\b(incorporated|inc|limited|ltd|pty|aboriginal corporation|aboriginal corp|corporation|corp)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');
const escapeSql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Public organisation channels checked against current official contact pages.
const VERIFIED_PUBLIC_OVERRIDES = new Map([
  ['urapuntja', {
    email: 'admin@urapuntja.com.au',
    phone: '(08) 8956 9099',
    source: 'https://urapuntja.com.au/contact/',
  }],
  ['anyinginyi health', {
    email: 'bss_reception@anyinginyi.com.au',
    phone: '(08) 8962 2633',
    source: 'https://www.anyinginyi.org.au/contact-us',
  }],
  ['katherine west health board', {
    email: 'info@kwhb.com.au',
    phone: '(08) 8971 9300',
    source: 'https://www.kwhb.com.au/privacy-policy/',
  }],
  ['aboriginal medical services alliance nt', {
    website: 'https://amsant.org.au',
    email: 'reception@amsant.org.au',
    phone: '(08) 8944 6666',
    source: 'https://amsant.org.au/get-in-touch/',
  }],
  ['npy women s council', {
    website: 'https://www.npywc.org.au',
    email: 'enquiries@npywc.org.au',
    phone: '(08) 8958 2345',
    source: 'https://www.npywc.org.au/pages/contact',
  }],
  ['northern peninsula area regional council', {
    website: 'https://www.nparc.qld.gov.au',
    email: 'contact@nparc.qld.gov.au',
    phone: '07 4090 4100',
    source: 'https://www.nparc.qld.gov.au/Site-Footer/Footer-Widgets/Contact-Us',
  }],
  ['the arnhem land progress', {
    website: 'https://www.alpa.asn.au',
    email: 'reception@alpa.asn.au',
    phone: '(08) 8944 6444',
    source: 'https://www.alpa.asn.au/contact-us',
  }],
]);

function publicOverride(companyName) {
  const normalized = normalizeName(companyName);
  for (const [needle, value] of VERIFIED_PUBLIC_OVERRIDES) {
    if (normalized.includes(needle)) return value;
  }
  return null;
}

async function ghl(endpoint, options = {}) {
  const response = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${endpoint}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`GrantScope SQL: ${error.message}`);
  return data || [];
}

function extractAbn(description) {
  return String(description || '').match(/\bABN\D*([0-9 ]{11,14})/i)?.[1]?.replace(/\D/g, '') || null;
}

function quality(row) {
  return (row.email ? 4 : 0) + (row.phone ? 2 : 0) + (row.website ? 1 : 0)
    + (row.contact_source === 'website_scrape' ? 2 : 0)
    + Number(row.confidence || 0);
}

async function main() {
  const companies = CSV_PATH
    ? parse(await fs.readFile(CSV_PATH, 'utf8'), { columns: true, skip_empty_lines: true, bom: true })
      .map((row) => ({
        id: row['Company ID'],
        name: row['Company Name'],
        website: row.Website,
        email: row.Email,
        phone: row.Phone,
        state: row.State,
        postalCode: row['Postal Code'],
        description: row.Description,
      }))
    : (await ghl(`/businesses/?locationId=${GHL_LOCATION_ID}&limit=100`)).businesses || [];
  const names = [...new Set(companies.map((row) => normalizeName(row.name)).filter(Boolean))];
  const abns = [...new Set(companies.map((row) => extractAbn(row.description)).filter(Boolean))];

  const normalisedSql = `trim(regexp_replace(regexp_replace(regexp_replace(lower(canonical_name), '&', ' and ', 'g'), '\\m(incorporated|inc|limited|ltd|pty|aboriginal corporation|aboriginal corp|corporation|corp)\\M', ' ', 'g'), '[^a-z0-9]+', ' ', 'g'))`;
  const rows = await sql(`
    SELECT id, gs_id, canonical_name, abn, website, email, phone, state, postcode,
           contact_source, confidence
    FROM gs_entities
    WHERE (${normalisedSql} IN (${names.map(escapeSql).join(',')}))
       OR (abn IN (${abns.length ? abns.map(escapeSql).join(',') : "''"}))
  `);

  const byAbn = new Map();
  const byName = new Map();
  for (const row of rows) {
    if (row.abn && (!byAbn.has(row.abn) || quality(row) > quality(byAbn.get(row.abn)))) byAbn.set(row.abn, row);
    const name = normalizeName(row.canonical_name);
    if (name && (!byName.has(name) || quality(row) > quality(byName.get(name)))) byName.set(name, row);
  }

  const results = [];
  let updated = 0;
  let addedWebsites = 0;
  let addedEmails = 0;
  let addedPhones = 0;
  let addedLocations = 0;
  let errors = 0;

  for (const company of companies) {
    const abn = extractAbn(company.description);
    const match = (abn && byAbn.get(abn)) || byName.get(normalizeName(company.name));
    const override = publicOverride(company.name);
    if (!match && !override) continue;
    const patch = {};
    if (!clean(company.website) && clean(override?.website || match?.website)) patch.website = clean(override?.website || match?.website);
    if (!clean(company.email) && clean(override?.email || match?.email)) patch.email = clean(override?.email || match?.email);
    if (!clean(company.phone) && clean(override?.phone || match?.phone)) patch.phone = clean(override?.phone || match?.phone);
    if (!clean(company.state) && clean(match?.state)) patch.state = clean(match.state);
    if (!clean(company.postalCode) && clean(match?.postcode)) patch.postalCode = clean(match.postcode);
    const description = clean(company.description) || '';
    const descriptionDigits = description.replace(/\D/g, '');
    const hasRegistryId = (match?.abn && descriptionDigits.includes(match.abn))
      || (match?.gs_id && description.includes(match.gs_id));
    if (match && !hasRegistryId) {
      patch.description = [
        description,
        match.abn ? `ABN ${match.abn}.` : null,
        match.gs_id ? `CivicGraph ${match.gs_id}.` : null,
        `Enriched from GrantScope ${new Date().toISOString().slice(0, 10)}.`,
      ].filter(Boolean).join(' ');
    }
    if (!Object.keys(patch).length) continue;

    const result = {
      company: company.name,
      match: match?.canonical_name || 'verified-public-source',
      matchBasis: match ? (abn && match.abn === abn ? 'ABN' : 'exact-normalised-name') : 'verified-public-source',
      source: override?.source || match?.contact_source || 'GrantScope registry',
      patch,
    };
    try {
      if (APPLY) {
        await ghl(`/businesses/${company.id}`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        });
        await sleep(100);
      }
      updated += 1;
      if (patch.website) addedWebsites += 1;
      if (patch.email) addedEmails += 1;
      if (patch.phone) addedPhones += 1;
      if (patch.state || patch.postalCode) addedLocations += 1;
      results.push(result);
    } catch (error) {
      errors += 1;
      results.push({ ...result, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    companies: companies.length,
    grantScopeCandidates: rows.length,
    updated,
    addedWebsites,
    addedEmails,
    addedPhones,
    addedLocations,
    errors,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
