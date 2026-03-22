#!/usr/bin/env node
/**
 * Annual Report Scraper + Impact Extractor
 *
 * Finds annual report PDFs for justice-funded charities,
 * extracts text, and uses Gemini Flash to pull structured impact data.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-annual-reports.mjs [--limit N] [--dry-run] [--abn 12345678901]
 */

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

// pdf-parse v1 installed in /tmp/pdf-tools
const require = createRequire('/tmp/pdf-tools/');
const pdfParse = require('pdf-parse');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Use OpenAI gpt-4o-mini — cheap ($0.15/M input, $0.60/M output) and reliable
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const BROWSE_BIN = '/Users/benknight/.claude/skills/browse/dist/browse';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = 'gpt-4o-mini';
const PDF_DIR = 'data/annual-reports';
const MAX_TEXT_CHARS = 50000; // Gemini context limit consideration

// Known annual report URLs for high-priority orgs (manually curated)
const KNOWN_REPORT_URLS = {
  '15000002522': 'https://yfsejk.files.cmp.optimizely.com/download/assets/mission-australia-annual-report-2024.pdf/b2bd66b6fa5e11efb7f9b6f900a17b1d', // Mission Australia (CDN)
  '50169561394': 'https://www.redcross.org.au/about/governance-and-reports/',        // Red Cross
  '28746881862': 'https://www.wmq.org.au/about-us/annual-report',                   // Wesley Mission QLD
  '95084695045': 'https://www.benevolent.org.au/about-us/annual-report',            // Benevolent Society
  '93093357165': 'https://www.wellways.org/about-us/annual-reports',                // Wellways
  '80009663478': 'https://www.flyingdoctor.org.au/qld/about/annual-report/',        // RFDS QLD
  '32140019290': 'https://www.iuih.org.au/about-us/annual-report/',                 // IUIH
  '98142986767': 'https://www.actforkids.com.au/about-us/annual-reports/',           // Act for Kids
  '99008610035': 'https://www.savethechildren.org.au/about-us/publications',         // Save the Children
  '70066591811': 'https://www.marist180.org.au/about-us/annual-report/',             // Marist Youth Care
  '76409721192': 'https://micahprojects.org.au/about/annual-reports/',               // Micah Projects
  '14211506904': 'https://www.svdpqld.org.au/about-us/annual-reports/',              // St Vincent de Paul QLD
  '69131388102': 'https://www.ifys.com.au/about-us/',                                // IFYS
  '27167737144': 'https://www.syc.net.au/about/publications/',                       // SYC Ltd
  '20061257725': 'https://www.carersqld.com.au/about-us/annual-reports/',            // Carers QLD
  '47140180169': 'https://www.keyassets.org.au/about/annual-reports/',               // Key Assets
  '36301121574': 'https://www.suncare.org.au/annual-reports/',                       // Suncare
  '58072422925': 'https://www.ozcare.org.au/about/annual-report/',                   // Ozcare
  '53658668627': 'https://oonchiumpa.org.au/',                                       // Oonchiumpa
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(args.find((_, i, a) => a[i - 1] === '--limit') || '20');
const SINGLE_ABN = args.find((_, i, a) => a[i - 1] === '--abn');

// ── ACNC Document Discovery ──────────────────────────────────

async function findAcncDocuments(abn) {
  // ACNC charity register page: search by ABN
  const searchUrl = `https://www.acnc.gov.au/api/dynamics/search/charity?searchText=${abn}&pageNum=1&pageSize=1`;

  try {
    const res = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CivicGraph/1.0 (research)' }
    });
    if (!res.ok) return null;
    const data = await res.json();

    if (!data?.results?.length) return null;
    const charityId = data.results[0].ABN || data.results[0].Id;

    // Try ACNC document API
    const docUrl = `https://www.acnc.gov.au/api/dynamics/entity/${abn}/documents`;
    const docRes = await fetch(docUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CivicGraph/1.0 (research)' }
    });
    if (docRes.ok) {
      const docs = await docRes.json();
      return docs;
    }
  } catch (e) {
    // ACNC API might not be public — fall through
  }
  return null;
}

// ── ACNC Charity Page PDF Discovery ──────────────────────────

async function findAcncCharityPagePdf(abn) {
  // The ACNC charity register page has a documents section
  const url = `https://www.acnc.gov.au/charity/charities/${abn}/documents`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'CivicGraph/1.0 (research)' }
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for annual report PDF links
    const pdfLinks = [...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)]
      .map(m => m[1])
      .filter(l => /annual|report|impact/i.test(l));

    if (pdfLinks.length) {
      return { url: new URL(pdfLinks[0], url).href, type: 'acnc_pdf' };
    }
  } catch { /* timeout */ }
  return null;
}

// ── Website PDF Discovery ────────────────────────────────────

async function findReportFromWebsite(websiteUrl) {
  if (!websiteUrl) return null;

  // Normalize URL
  let url = websiteUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  // Common annual report URL patterns
  const patterns = [
    '/annual-report',
    '/annual-reports',
    '/about/annual-report',
    '/about-us/annual-report',
    '/about/annual-reports',
    '/about-us/annual-reports',
    '/publications/annual-report',
    '/publications/annual-reports',
    '/resources/annual-report',
    '/resources/annual-reports',
    '/our-impact',
    '/impact-report',
    '/about/publications',
    '/corporate-publications',
    '/about/corporate-publications',
    '/governance/annual-reports',
    '/about/governance/annual-reports',
  ];

  for (const pattern of patterns) {
    try {
      const testUrl = new URL(pattern, url).href;
      const res = await fetch(testUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'CivicGraph/1.0 (research)' }
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('pdf')) {
          return { url: res.url, type: 'direct_pdf' };
        }
        if (ct.includes('html')) {
          return { url: res.url, type: 'landing_page' };
        }
      }
    } catch {
      // timeout or network error — skip
    }
  }

  return null;
}

// ── Brave Search API Fallback ─────────────────────────────────

async function findReportViaSearch(charityName, websiteUrl) {
  // Use DuckDuckGo HTML search (no API key needed)
  try {
    const domain = websiteUrl ? new URL(websiteUrl.startsWith('http') ? websiteUrl : 'https://' + websiteUrl).hostname : '';
    const siteClause = domain ? `site:${domain} ` : '';
    const query = encodeURIComponent(`${siteClause}"annual report" "${charityName}" 2024 OR 2023`);

    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for PDF links first
    const pdfMatch = html.match(/uddg=(https?[^&]*\.pdf[^&]*)/i);
    if (pdfMatch) {
      return { url: decodeURIComponent(pdfMatch[1]), type: 'website_pdf' };
    }

    // Look for annual report page links
    const pageMatch = html.match(/uddg=(https?[^&]*annual[_-]?report[^&]*)/i);
    if (pageMatch) {
      return { url: decodeURIComponent(pageMatch[1]), type: 'website_page' };
    }
  } catch { /* search failed */ }
  return null;
}

// ── Browser-Based Text Extraction (for Cloudflare-protected sites) ──

function browserExtractText(url) {
  try {
    // Navigate and wait for content
    execSync(`${BROWSE_BIN} goto "${url}"`, { timeout: 20000, stdio: 'pipe' });
    // Wait for Cloudflare challenge to resolve
    execSync(`sleep 5`, { stdio: 'pipe' });
    const text = execSync(`${BROWSE_BIN} text`, { timeout: 15000, stdio: 'pipe' }).toString();
    if (text.includes('security verification') || text.includes('Checking your browser')) {
      // Still blocked, wait longer
      execSync(`sleep 5`, { stdio: 'pipe' });
      return execSync(`${BROWSE_BIN} text`, { timeout: 15000, stdio: 'pipe' }).toString();
    }
    return text;
  } catch (e) {
    return null;
  }
}

// ── PDF Download & Text Extraction ───────────────────────────

async function downloadAndExtractPdf(url, abn, depth = 0) {
  await mkdir(PDF_DIR, { recursive: true });
  const pdfPath = `${PDF_DIR}/${abn}.pdf`;

  // Check cache
  if (existsSync(pdfPath)) {
    console.log(`    Cache hit: ${pdfPath}`);
    const buf = await readFile(pdfPath);
    const data = await pdfParse(buf);
    return { text: data.text.slice(0, MAX_TEXT_CHARS), pages: data.numpages, path: pdfPath };
  }

  if (depth > 2) return null; // prevent infinite recursion

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'CivicGraph/1.0 (research)' }
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 503) {
        console.log(`    Blocked (${res.status}), trying browser...`);
        const text = browserExtractText(url);
        if (text && text.length > 2000) {
          console.log(`    Browser extracted: ${text.length} chars`);
          return { text: text.slice(0, MAX_TEXT_CHARS), pages: 1, path: url, isHtml: true };
        }
      }
      return null;
    }

    const ct = res.headers.get('content-type') || '';

    // If it's an HTML page
    if (ct.includes('html')) {
      const html = await res.text();

      // First try: annual report PDF links
      const pdfMatch = html.match(/href="([^"]*(?:annual[_-]?report|impact[_-]?report)[^"]*\.pdf)"/i)
        || html.match(/href="([^"]*\.pdf[^"]*)"/i);
      if (pdfMatch) {
        const pdfUrl = new URL(pdfMatch[1], url).href;
        return downloadAndExtractPdf(pdfUrl, abn, depth + 1);
      }

      // Second try: follow annual report sub-page links (e.g., "2023-24-annual-report")
      const yearMatch = html.match(/href="([^"]*202[3-5][^"]*annual[_-]?report[^"]*)"/i)
        || html.match(/href="([^"]*annual[_-]?report[^"]*202[3-5][^"]*)"/i);
      if (yearMatch) {
        const subUrl = new URL(yearMatch[1], url).href;
        console.log(`    Following sub-page: ${subUrl}`);
        return downloadAndExtractPdf(subUrl, abn, depth + 1);
      }

      // Third try: extract text directly from HTML annual report page
      // Strip tags, get clean text — many orgs publish HTML annual reports
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (textContent.length > 2000) {
        console.log(`    HTML report: ${textContent.length} chars extracted from page`);
        return { text: textContent.slice(0, MAX_TEXT_CHARS), pages: 1, path: url, isHtml: true };
      }

      return null;
    }

    if (!ct.includes('pdf') && !url.endsWith('.pdf')) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(pdfPath, buf);
    console.log(`    Downloaded: ${pdfPath} (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);

    const data = await pdfParse(buf);
    return { text: data.text.slice(0, MAX_TEXT_CHARS), pages: data.numpages, path: pdfPath };
  } catch (e) {
    console.log(`    PDF error: ${e.message}`);
    return null;
  }
}

// ── Gemini Flash Impact Extraction ───────────────────────────

const EXTRACTION_PROMPT = `You are analyzing an Australian charity's annual report to extract impact and outcome data.

Extract the following structured information. Be precise — only include data explicitly stated in the report, not inferences.

Return JSON (no markdown, no code fences):
{
  "report_year": <number, the financial year the report covers>,
  "total_beneficiaries": <number or null>,
  "youth_beneficiaries": <number or null, people aged 10-25>,
  "indigenous_beneficiaries": <number or null, Aboriginal/Torres Strait Islander>,
  "programs_delivered": <number or null>,
  "reports_recidivism": <boolean, mentions reoffending/recidivism rates>,
  "recidivism_metric": <string or null, exact quote of recidivism data>,
  "reports_employment": <boolean, mentions employment outcomes>,
  "employment_metric": <string or null, exact quote>,
  "reports_housing": <boolean, mentions housing/homelessness outcomes>,
  "housing_metric": <string or null, exact quote>,
  "reports_education": <boolean, mentions education/training outcomes>,
  "education_metric": <string or null, exact quote>,
  "reports_cultural_connection": <boolean, mentions cultural programs/connection for Indigenous people>,
  "cultural_metric": <string or null, exact quote>,
  "reports_mental_health": <boolean, mentions mental health outcomes>,
  "mental_health_metric": <string or null, exact quote>,
  "reports_family_reunification": <boolean, mentions family reunification/restoration>,
  "family_metric": <string or null, exact quote>,
  "has_quantitative_outcomes": <boolean, reports specific numbers/percentages for ANY outcome>,
  "has_external_evaluation": <boolean, mentions external evaluation/review/assessment>,
  "has_closing_the_gap": <boolean, references Closing the Gap targets>,
  "evidence_quality": <"none"|"narrative_only"|"basic_counts"|"outcome_metrics"|"evaluated">,
  "impact_summary": <string, 2-3 sentence summary of impact claims>,
  "key_quotes": [<array of up to 5 direct quotes about outcomes/impact, max 100 words each>],
  "programs_mentioned": [<array of program names mentioned>],
  "extraction_confidence": <0.0-1.0, how confident you are in this extraction>
}

Evidence quality scale:
- "none": No impact information found
- "narrative_only": Stories and anecdotes only
- "basic_counts": Reports numbers served but no outcomes
- "outcome_metrics": Reports specific outcome measures (% employed, recidivism rates, etc.)
- "evaluated": References external evaluation or uses validated measurement tools`;

async function extractImpact(text, charityName) {
  const body = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: `Charity: ${charityName}\n\nAnnual Report Text:\n${text}` }
    ],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text_response = data.choices?.[0]?.message?.content;
  if (!text_response) throw new Error('Empty OpenAI response');

  return JSON.parse(text_response);
}

// ── Main Pipeline ────────────────────────────────────────────

async function getTargetOrgs() {
  if (SINGLE_ABN) {
    const { data } = await supabase.from('acnc_ais')
      .select('abn, charity_name, charity_website, charity_size, revenue_from_government')
      .eq('abn', SINGLE_ABN)
      .eq('ais_year', 2023)
      .limit(1);
    return data || [];
  }

  // Step 1: Get justice-funded ABNs directly from justice_funding (no JOIN — fast)
  const statesArg = args.find((_, i, a) => a[i - 1] === '--states');
  const stateFilter = statesArg ? `WHERE state IN (${statesArg.split(',').map(s => `'${s.trim()}'`).join(',')})` : 'WHERE TRUE';
  const abnSet = new Set();
  for (let offset = 0; ; offset += 1000) {
    const { data: page } = await supabase.rpc('exec_sql', {
      query: `SELECT DISTINCT recipient_abn AS abn FROM justice_funding
              ${stateFilter} AND recipient_abn IS NOT NULL AND recipient_abn != '' AND recipient_abn != '0'
              ORDER BY recipient_abn LIMIT 1000 OFFSET ${offset}`
    });
    if (!page?.length) break;
    page.forEach(r => abnSet.add(r.abn));
    if (page.length < 1000) break;
  }
  console.log(`  ${abnSet.size} justice-funded ABNs (${statesArg || 'all states'})`);

  // Step 2: Get AIS data with websites, ordered by gov revenue
  const { data } = await supabase.from('acnc_ais')
    .select('abn, charity_name, charity_website, charity_size, revenue_from_government')
    .eq('ais_year', 2023)
    .not('charity_website', 'is', null)
    .order('revenue_from_government', { ascending: false, nullsFirst: false })
    .limit(1000);

  // Filter to justice-funded, exclude universities/hospitals
  const filtered = (data || []).filter(r => {
    if (!abnSet.has(r.abn)) return false;
    const name = r.charity_name.toLowerCase();
    if (name.includes('university') || name.includes('hospital') || name.includes('archdiocese')
        || name.includes('diocese') || name.includes('tafe')) return false;
    return true;
  });
  console.log(`  ${filtered.length} candidates with AIS + website`);

  // Skip already-processed
  const { data: existing } = await supabase.from('charity_impact_reports')
    .select('abn');
  const existingAbns = new Set((existing || []).map(r => r.abn));

  return filtered.filter(r => !existingAbns.has(r.abn)).slice(0, LIMIT);
}

async function processOrg(org) {
  console.log(`  ${org.charity_name} (ABN: ${org.abn})`);

  // Step 1: Find annual report PDF
  let pdfSource = null;

  // Check known URLs first (manually curated for high-priority orgs)
  if (KNOWN_REPORT_URLS[org.abn]) {
    pdfSource = { url: KNOWN_REPORT_URLS[org.abn], type: 'website_page' };
  }

  // Try ACNC API
  if (!pdfSource) {
    const acncDocs = await findAcncDocuments(org.abn);
    if (acncDocs?.length) {
      const report = acncDocs.find(d => d.name?.toLowerCase().includes('annual'));
      if (report?.url) {
        pdfSource = { url: report.url, type: 'acnc_pdf' };
      }
    }
  }

  // Try ACNC charity page
  if (!pdfSource) {
    pdfSource = await findAcncCharityPagePdf(org.abn);
  }

  // Try website URL patterns
  if (!pdfSource) {
    const webResult = await findReportFromWebsite(org.charity_website);
    if (webResult) {
      pdfSource = { url: webResult.url, type: webResult.type === 'direct_pdf' ? 'website_pdf' : 'website_page' };
    }
  }

  // Try DuckDuckGo search as last resort
  if (!pdfSource) {
    const searchResult = await findReportViaSearch(org.charity_name, org.charity_website);
    if (searchResult) {
      pdfSource = searchResult;
    }
  }

  if (!pdfSource) {
    console.log(`    No annual report found`);
    return null;
  }

  console.log(`    Found: ${pdfSource.url} (${pdfSource.type})`);

  // Step 2: Download & extract text
  const pdf = await downloadAndExtractPdf(pdfSource.url, org.abn);
  if (!pdf || !pdf.text || pdf.text.length < 500) {
    console.log(`    Insufficient text extracted (${pdf?.text?.length || 0} chars)`);
    return null;
  }

  console.log(`    Extracted: ${pdf.pages} pages, ${pdf.text.length} chars`);

  // Step 3: LLM extraction
  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would extract impact with Gemini Flash`);
    return { abn: org.abn, charity_name: org.charity_name, source_url: pdfSource.url, dry_run: true };
  }

  const impact = await extractImpact(pdf.text, org.charity_name);
  console.log(`    Impact: ${impact.evidence_quality} | Quant: ${impact.has_quantitative_outcomes} | Confidence: ${impact.extraction_confidence}`);

  // Step 4: Store
  const record = {
    abn: org.abn,
    charity_name: org.charity_name,
    report_year: impact.report_year || 2023,
    source_url: pdfSource.url,
    source_type: pdfSource.type,
    total_beneficiaries: impact.total_beneficiaries != null ? Math.round(impact.total_beneficiaries) : null,
    youth_beneficiaries: impact.youth_beneficiaries != null ? Math.round(impact.youth_beneficiaries) : null,
    indigenous_beneficiaries: impact.indigenous_beneficiaries != null ? Math.round(impact.indigenous_beneficiaries) : null,
    programs_delivered: impact.programs_delivered != null ? Math.round(impact.programs_delivered) : null,
    reports_recidivism: impact.reports_recidivism || false,
    recidivism_metric: impact.recidivism_metric,
    reports_employment: impact.reports_employment || false,
    employment_metric: impact.employment_metric,
    reports_housing: impact.reports_housing || false,
    housing_metric: impact.housing_metric,
    reports_education: impact.reports_education || false,
    education_metric: impact.education_metric,
    reports_cultural_connection: impact.reports_cultural_connection || false,
    cultural_metric: impact.cultural_metric,
    reports_mental_health: impact.reports_mental_health || false,
    mental_health_metric: impact.mental_health_metric,
    reports_family_reunification: impact.reports_family_reunification || false,
    family_metric: impact.family_metric,
    has_quantitative_outcomes: impact.has_quantitative_outcomes || false,
    has_external_evaluation: impact.has_external_evaluation || false,
    has_closing_the_gap: impact.has_closing_the_gap || false,
    evidence_quality: impact.evidence_quality || 'none',
    impact_summary: impact.impact_summary,
    key_quotes: impact.key_quotes || [],
    programs_mentioned: impact.programs_mentioned || [],
    extraction_model: LLM_MODEL,
    extraction_confidence: impact.extraction_confidence,
    pdf_pages: pdf.pages,
    extracted_text_chars: pdf.text.length,
  };

  const { error } = await supabase.from('charity_impact_reports').insert(record);
  if (error) {
    console.log(`    DB error: ${error.message}`);
    return null;
  }

  return record;
}

async function main() {
  console.log(`Annual Report Scraper + Impact Extractor`);
  console.log(`========================================`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Limit: ${LIMIT}`);
  if (SINGLE_ABN) console.log(`Target: ABN ${SINGLE_ABN}`);
  console.log();

  const orgs = await getTargetOrgs();
  console.log(`Found ${orgs.length} orgs to process\n`);

  let found = 0, extracted = 0, errors = 0;
  const results = [];

  for (const org of orgs) {
    try {
      const result = await processOrg(org);
      if (result) {
        found++;
        if (!result.dry_run) extracted++;
        results.push(result);
      }
    } catch (e) {
      console.log(`    ERROR: ${e.message}`);
      errors++;
    }
    // Rate limit: 200ms between orgs
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n── Summary ──────────────────────────────`);
  console.log(`  Processed:  ${orgs.length}`);
  console.log(`  Found PDFs: ${found}`);
  console.log(`  Extracted:  ${extracted}`);
  console.log(`  Errors:     ${errors}`);

  if (extracted > 0) {
    const quals = results.filter(r => !r.dry_run).reduce((acc, r) => {
      acc[r.evidence_quality] = (acc[r.evidence_quality] || 0) + 1;
      return acc;
    }, {});
    console.log(`\n── Evidence Quality ─────────────────────`);
    for (const [q, c] of Object.entries(quals).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${q}: ${c}`);
    }

    const withQuant = results.filter(r => r.has_quantitative_outcomes).length;
    console.log(`\n  Quantitative outcomes: ${withQuant}/${extracted}`);
  }
}

main().catch(console.error);
