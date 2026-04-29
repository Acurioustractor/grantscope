#!/usr/bin/env node
/**
 * Scrape charity annual report PDFs and parse them into charity_impact_reports.
 *
 * Strategy:
 *   1. Resolve ABN → website (acnc_charities.website)
 *   2. Use Firecrawl /map to discover all URLs on the org's site
 *   3. Filter to URLs that look like annual reports (pdf in path/filename or words like "annual report" / "report" + year)
 *   4. For each PDF URL: Firecrawl /scrape with formats=['markdown'] returns extracted text
 *   5. Heuristic-extract: report_year, beneficiary counts, named programs, evidence quality
 *   6. Upsert into charity_impact_reports
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-charity-annual-reports.mjs --abn=23684792947
 *   node --env-file=.env scripts/scrape-charity-annual-reports.mjs --abn=23684792947 --abn=65071572705
 *   node --env-file=.env scripts/scrape-charity-annual-reports.mjs --abn=23684792947 --dry-run
 *   node --env-file=.env scripts/scrape-charity-annual-reports.mjs --abn=23684792947 --max-reports=3
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!FIRECRAWL_KEY) {
  console.error('Missing FIRECRAWL_API_KEY (.env)');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const ABNS = process.argv.filter(a => a.startsWith('--abn=')).map(a => a.split('=')[1]);
const MAX_REPORTS = Number(process.argv.find(a => a.startsWith('--max-reports='))?.split('=')[1] || 8);

if (!ABNS.length) {
  console.error('Usage: --abn=<abn> [--abn=<abn> ...] [--dry-run] [--max-reports=N]');
  process.exit(1);
}

function normaliseUrl(u) {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  return `https://${u}`;
}

function looksLikeReport(url) {
  const u = url.toLowerCase();
  if (!u.endsWith('.pdf') && !/\/(reports?|publications?|annual-?reports?|about\/our-impact|impact)/.test(u)) return false;
  // Filter obvious non-report PDFs
  if (/(privacy|terms|conditions|membership-form|application-form|template|brochure)/.test(u)) return false;
  return /annual|report|review|impact|year/.test(u) || u.endsWith('.pdf');
}

function extractYear(text, url) {
  const candidates = [];
  // From URL
  const urlYear = url.match(/(20\d{2})[-_/](?:20)?(\d{2})/);
  if (urlYear) candidates.push(Number(urlYear[1]));
  const urlSingle = url.match(/(20\d{2})/g);
  if (urlSingle) candidates.push(...urlSingle.map(Number));
  // From content — find "Annual Report 2023-24" / "2022/2023" / "Year ended 30 June 2023"
  const titleMatch = text.match(/annual report\s*[-:]?\s*(20\d{2})/i);
  if (titleMatch) candidates.push(Number(titleMatch[1]));
  const fyMatch = text.match(/(?:year\s+ended|year\s+ending|financial\s+year)[^0-9]+(20\d{2})/i);
  if (fyMatch) candidates.push(Number(fyMatch[1]));
  // Pick most recent that's not in the future
  const thisYear = new Date().getFullYear();
  const valid = candidates.filter(y => y >= 2010 && y <= thisYear + 1);
  if (!valid.length) return null;
  return Math.max(...valid);
}

function extractMetrics(text) {
  const lower = text.toLowerCase();
  const num = (re) => {
    const m = text.match(re);
    if (!m) return null;
    const cleaned = m[1].replace(/[, ]/g, '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? null : n;
  };

  const beneficiaries = num(/(\d{1,3}(?:,\d{3})+|\d{4,})\s+(?:people|community members|clients|beneficiaries|participants|individuals)\s+(?:supported|reached|served|helped|assisted)/i);
  const programs = num(/(\d+)\s+programs?\s+delivered/i)
                || num(/delivered\s+(\d+)\s+programs?/i)
                || num(/across\s+(\d+)\s+programs?/i);

  const reportsRecidivism = /\brecidivism\b|\bre-?offending\b|\breoffend(?:ing|er)\b/.test(lower);
  const reportsEmployment = /\bemployment outcome|jobs? secured|placed in employment|employment rate\b/.test(lower);
  const reportsHousing = /\bhousing outcome|tenancy sustained|homelessness reduced|secure(?:d)? housing\b/.test(lower);
  const reportsEducation = /\benrol(?:led|ment)\b.*\b(?:school|tafe|university|course|training)|completed (?:training|tafe|certificate)\b/.test(lower);
  const reportsCultural = /\bcultural connection|cultural identity|elders involved|first nations|indigenous-led\b/.test(lower);
  const reportsMentalHealth = /\bmental health (?:outcome|improvement|score|measure)\b|\bk10\b|\bphq-?9\b/.test(lower);
  const reportsFamily = /\bfamily reunification|reunified|family preservation\b/.test(lower);

  const hasQuant = /(\d+%|\d+\s+out of\s+\d+|increased by|decreased by|reduced by)/i.test(text);
  const hasExternalEval = /\bexternal evaluation|independent evaluation|evaluated by\b/i.test(text);
  const hasCtg = /\bclosing the gap\b|\bctg\b/i.test(text);

  // Programs mentioned — pull capitalised multi-word phrases ending in "Program" or "Project" or "Initiative"
  const programMatches = Array.from(text.matchAll(/([A-Z][A-Za-z'’]+(?:\s+[A-Z][A-Za-z'’]+){0,4}\s+(?:Program|Project|Initiative|Network|Forum))/g)).map(m => m[1]);
  const programsMentioned = Array.from(new Set(programMatches)).slice(0, 12);

  // Impact summary — first sentence after "Our impact" / "Highlights" / "What we did"
  let impactSummary = null;
  const sectionMatch = text.match(/(?:our impact|highlights|key highlights|year in review|what we (?:did|achieved))[:\s]*([^\n]{40,400}\.)/i);
  if (sectionMatch) impactSummary = sectionMatch[1].trim().replace(/\s+/g, ' ');

  // Evidence quality — must match charity_impact_reports CHECK constraint:
  // 'none' | 'narrative_only' | 'basic_counts' | 'outcome_metrics' | 'evaluated'
  let evidenceQuality = 'narrative_only';
  if (hasExternalEval) evidenceQuality = 'evaluated';
  else if (reportsRecidivism || reportsEmployment || reportsHousing || reportsEducation || reportsMentalHealth) evidenceQuality = 'outcome_metrics';
  else if (beneficiaries || programs) evidenceQuality = 'basic_counts';
  else if (!hasQuant) evidenceQuality = 'none';

  return {
    total_beneficiaries: beneficiaries,
    programs_delivered: programs,
    reports_recidivism: reportsRecidivism,
    reports_employment: reportsEmployment,
    reports_housing: reportsHousing,
    reports_education: reportsEducation,
    reports_cultural_connection: reportsCultural,
    reports_mental_health: reportsMentalHealth,
    reports_family_reunification: reportsFamily,
    has_quantitative_outcomes: hasQuant,
    has_external_evaluation: hasExternalEval,
    has_closing_the_gap: hasCtg,
    evidence_quality: evidenceQuality,
    impact_summary: impactSummary,
    programs_mentioned: programsMentioned,
  };
}

async function firecrawlMap(siteUrl) {
  const res = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: siteUrl, limit: 500 }),
  });
  if (!res.ok) throw new Error(`Firecrawl map ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.links || []).map(l => (typeof l === 'string' ? l : l?.url)).filter(Boolean);
}

async function firecrawlScrape(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], waitFor: 1500 }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const j = await res.json();
  const md = j?.data?.markdown || j?.markdown || '';
  return { ok: true, markdown: md, metadata: j?.data?.metadata || j?.metadata || {} };
}

async function processCharity(abn) {
  console.log(`\n=== ${abn} ===`);
  const { data: charity, error } = await db.from('acnc_charities').select('abn, name, website').eq('abn', abn).single();
  if (error || !charity) {
    console.log(`  no acnc_charities row for ${abn}`);
    return { found: 0, inserted: 0 };
  }

  const site = normaliseUrl(charity.website);
  if (!site) {
    console.log(`  no website on file`);
    return { found: 0, inserted: 0 };
  }
  console.log(`  ${charity.name} → ${site}`);

  // Phase 1 — discover URLs
  let urls = [];
  try {
    urls = await firecrawlMap(site);
  } catch (e) {
    console.log(`  map error: ${e.message}`);
    return { found: 0, inserted: 0 };
  }
  console.log(`  mapped ${urls.length} urls`);

  const candidates = Array.from(new Set(urls.filter(looksLikeReport)));
  console.log(`  candidates: ${candidates.length}`);
  candidates.slice(0, 12).forEach(u => console.log(`    · ${u}`));

  // Prioritise PDFs, then year-tagged URLs
  candidates.sort((a, b) => {
    const aPdf = a.toLowerCase().endsWith('.pdf');
    const bPdf = b.toLowerCase().endsWith('.pdf');
    if (aPdf !== bPdf) return aPdf ? -1 : 1;
    const ay = (a.match(/20\d{2}/) || ['0'])[0];
    const by = (b.match(/20\d{2}/) || ['0'])[0];
    return Number(by) - Number(ay);
  });

  // Phase 2 — scrape each
  const reports = [];
  for (const url of candidates.slice(0, MAX_REPORTS)) {
    console.log(`  scraping: ${url}`);
    const out = await firecrawlScrape(url);
    if (!out.ok) {
      console.log(`    ✗ ${out.status}`);
      continue;
    }
    const md = out.markdown || '';
    if (md.length < 300) {
      console.log(`    ✗ too short (${md.length} chars)`);
      continue;
    }
    const year = extractYear(md, url);
    if (!year) {
      console.log(`    ✗ no year detected`);
      continue;
    }
    if (reports.find(r => r.report_year === year)) {
      console.log(`    ⊘ year ${year} already captured, skipping`);
      continue;
    }
    const metrics = extractMetrics(md);
    reports.push({
      abn,
      charity_name: charity.name,
      report_year: year,
      source_url: url,
      source_type: url.toLowerCase().endsWith('.pdf') ? 'website_pdf' : 'website_page',
      pdf_pages: out.metadata?.numPages ?? null,
      extracted_text_chars: md.length,
      extraction_model: 'firecrawl-markdown+regex-v1',
      extraction_confidence: 0.5,
      ...metrics,
    });
    console.log(`    ✓ ${year} | beneficiaries: ${metrics.total_beneficiaries ?? '—'} | programs: ${metrics.programs_delivered ?? '—'} | evidence: ${metrics.evidence_quality}`);
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`  parsed ${reports.length} reports`);
  if (DRY_RUN || !reports.length) return { found: candidates.length, inserted: 0 };

  // Phase 3 — upsert
  const { error: upErr } = await db.from('charity_impact_reports').upsert(reports, {
    onConflict: 'abn,report_year',
    ignoreDuplicates: false,
  });
  if (upErr) {
    console.log(`  upsert error: ${upErr.message}`);
    return { found: candidates.length, inserted: 0 };
  }
  console.log(`  upserted ${reports.length}`);
  return { found: candidates.length, inserted: reports.length };
}

async function main() {
  const run = await logStart(db, 'scrape-charity-annual-reports', 'Charity Annual Report Scraper');
  console.log('=== Charity Annual Report Scraper ===');
  console.log(`  mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | abns: ${ABNS.join(', ')}`);

  let totalFound = 0;
  let totalInserted = 0;
  const errors = [];

  for (const abn of ABNS) {
    try {
      const r = await processCharity(abn);
      totalFound += r.found;
      totalInserted += r.inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${abn}: ${msg}`);
      console.error(`  fatal for ${abn}: ${msg}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  candidates: ${totalFound} | reports inserted: ${totalInserted}`);
  await logComplete(db, run.id, {
    items_found: totalFound,
    items_new: totalInserted,
    status: errors.length ? 'partial' : 'success',
    errors,
  });
}

main().catch(async err => {
  console.error('Fatal:', err);
  process.exit(1);
});
