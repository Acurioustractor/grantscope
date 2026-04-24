#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getArgValue(prefix) {
  const arg = process.argv.find(entry => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const DRY_RUN = process.argv.includes('--dry-run');
const FOUNDATION_ID = getArgValue('--foundation-id');
const FOUNDATION_NAME = getArgValue('--foundation-name');
const FISCAL_YEAR = getArgValue('--fiscal-year') || inferCurrentFiscalYear();
const REPORT_YEAR = Number.parseInt(getArgValue('--report-year') || inferReportYear(FISCAL_YEAR), 10);

if (!FOUNDATION_ID && !FOUNDATION_NAME) {
  console.error('Pass --foundation-id=<uuid> or --foundation-name=<name>');
  process.exit(1);
}

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

function emitBlocked(error) {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'Database connection unavailable for foundation program year seed.',
    foundation_id: FOUNDATION_ID || null,
    foundation_name: FOUNDATION_NAME || null,
    fiscal_year: FISCAL_YEAR,
    report_year: REPORT_YEAR,
    error: String(error?.message || error || 'Unknown error'),
  }, null, 2));
}

function inferCurrentFiscalYear(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (month >= 7) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

function inferReportYear(fiscalYear) {
  const [, endShort] = fiscalYear.split('-');
  if (!endShort) return String(new Date().getUTCFullYear());
  return `20${endShort}`;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

function dedupe(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function summarize(text) {
  if (!text) return null;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= 220) return trimmed;
  const cut = trimmed.slice(0, 217);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > 120 ? cut.slice(0, boundary) : cut).trim()}.`;
}

function inferPartners(description) {
  if (!description) return [];
  const partners = [];
  const patterns = [
    /partnership with (?:the )?([A-Z][A-Za-z&'’\- ]{3,80}?)(?:,|\.| supports| that| to |$)/g,
    /partner(?:ed)? with (?:the )?([A-Z][A-Za-z&'’\- ]{3,80}?)(?:,|\.| supports| that| to |$)/g,
  ];

  for (const pattern of patterns) {
    for (const match of description.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (name && !/^This\b/.test(name) && !/^A\b/.test(name)) {
        partners.push({ name, role: 'partner' });
      }
    }
  }

  return dedupe(partners.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function inferPlaces(description, geographicFocus) {
  const places = [];
  const text = `${description || ''} ${(geographicFocus || []).join(' ')}`;
  const mappings = [
    { patterns: [/\bNT\b/, /Northern Territory/i], value: { name: 'Northern Territory', type: 'state' } },
    { patterns: [/\bQLD\b/, /Queensland/i], value: { name: 'Queensland', type: 'state' } },
    { patterns: [/\bNSW\b/, /New South Wales/i], value: { name: 'New South Wales', type: 'state' } },
    { patterns: [/\bSA\b/, /South Australia/i], value: { name: 'South Australia', type: 'state' } },
    { patterns: [/\bWA\b/, /Western Australia/i], value: { name: 'Western Australia', type: 'state' } },
    { patterns: [/\bACT\b/, /Australian Capital Territory/i], value: { name: 'ACT', type: 'territory' } },
    { patterns: [/\bVIC\b/, /Victoria/i], value: { name: 'Victoria', type: 'state' } },
    { patterns: [/\bTAS\b/, /Tasmania/i], value: { name: 'Tasmania', type: 'state' } },
    { patterns: [/AU-National/i, /\bAustralia\b/i, /\bNational\b/i], value: { name: 'Australia', type: 'country' } },
  ];

  for (const entry of mappings) {
    if (entry.patterns.some(pattern => pattern.test(text))) {
      places.push(entry.value);
    }
  }

  return dedupe(places.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

async function resolveFoundation() {
  let query = supabase
    .from('foundations')
    .select('id, name, geographic_focus')
    .limit(1);

  if (FOUNDATION_ID) {
    query = query.eq('id', FOUNDATION_ID);
  } else {
    query = query.ilike('name', `%${FOUNDATION_NAME}%`).order('total_giving_annual', { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query.single();
  if (error || !data) {
    throw new Error(error?.message || 'Foundation not found');
  }
  return data;
}

async function main() {
  const foundation = await resolveFoundation();

  const { data: programs, error } = await supabase
    .from('foundation_programs')
    .select('id, name, description, categories, program_type, status, amount_min, amount_max, url, slug')
    .eq('foundation_id', foundation.id)
    .in('status', ['open', 'ongoing', 'closed'])
    .order('name');

  if (error) throw error;
  if (!programs || programs.length === 0) {
    console.log(JSON.stringify({ foundation: foundation.name, inserted: 0, updated: 0, skipped: 0, rows: [] }, null, 2));
    return;
  }

  const rows = programs.map(program => ({
    foundation_program_id: program.id,
    foundation_id: foundation.id,
    report_year: REPORT_YEAR,
    fiscal_year: FISCAL_YEAR,
    summary: summarize(program.description),
    reported_amount: null,
    partners: inferPartners(program.description),
    places: inferPlaces(program.description, foundation.geographic_focus),
    outcomes: [],
    source_report_url: program.url || null,
    metadata: {
      source: 'current_program_surface_inferred',
      inferred_at: new Date().toISOString(),
      inferred_from_status: program.status,
      amount_min: program.amount_min,
      amount_max: program.amount_max,
      categories: program.categories || [],
      confidence: 'inferred',
    },
  }));

  const slugUpdates = programs
    .filter(program => !program.slug)
    .map(program => ({
      id: program.id,
      slug: slugify(program.name),
    }));

  if (DRY_RUN) {
    console.log(JSON.stringify({
      foundation: foundation.name,
      fiscal_year: FISCAL_YEAR,
      report_year: REPORT_YEAR,
      slug_updates: slugUpdates.length,
      rows,
    }, null, 2));
    return;
  }

  for (const update of slugUpdates) {
    const { error: slugError } = await supabase
      .from('foundation_programs')
      .update({ slug: update.slug })
      .eq('id', update.id);
    if (slugError) throw slugError;
  }

  const { data: upserted, error: upsertError } = await supabase
    .from('foundation_program_years')
    .upsert(rows, { onConflict: 'foundation_program_id,fiscal_year', ignoreDuplicates: false })
    .select('id');

  if (upsertError) throw upsertError;

  console.log(JSON.stringify({
    foundation: foundation.name,
    foundation_id: foundation.id,
    fiscal_year: FISCAL_YEAR,
    report_year: REPORT_YEAR,
    slug_updates: slugUpdates.length,
    upserted: upserted?.length || 0,
  }, null, 2));
}

main().catch(error => {
  if (isNetworkError(error)) {
    emitBlocked(error);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
