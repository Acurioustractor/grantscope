#!/usr/bin/env node
/**
 * scrape-rogs-all.mjs — Multi-domain ROGS data ingestion
 *
 * Downloads Productivity Commission Report on Government Services (ROGS 2026)
 * data tables for 4 domains and upserts key metrics to `outcomes_metrics`.
 *
 * ROGS Excel format:
 *   Row 0: Table title
 *   Row 1 (or 2): State headers — "Unit", "NSW", "Vic", "Qld", ...
 *   Data rows: [label, unit, nsw_val, vic_val, qld_val, ...]
 *   Values are offset +1 from header columns (unit column inserted)
 *   Year markers appear as [year_string] rows (no data) or [year, unit, values...] rows
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-rogs-all.mjs
 *   node --env-file=.env scripts/scrape-rogs-all.mjs --domain=education
 *   node --env-file=.env scripts/scrape-rogs-all.mjs --dry-run
 */

import XLSX from 'xlsx';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID = 'scrape-rogs-all';
const DRY_RUN = process.argv.includes('--dry-run');
const DOMAIN_FILTER = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1];
const CACHE_DIR = '/tmp/rogs-cache';

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// ── ROGS 2026 download URLs (from assets.pc.gov.au) ──
const ROGS_SOURCES = {
  'youth-justice': {
    url: 'https://assets.pc.gov.au/2026-01/rogs-2026-partf-section17-youth-justice-data-tables.xlsx?VersionId=a16us9GTQoMFTntwcnsf5.RV3aL4eTMY',
    source: 'ROGS 2026 Section 17',
    file: `${CACHE_DIR}/rogs-yj.xlsx`,
  },
  'child-protection': {
    url: 'https://assets.pc.gov.au/2026-01/rogs-2026-partf-section16-child-protection-data-tables.xlsx?VersionId=DcmYhxybbvt0EnHChwCGBlSAfZmO_kA5',
    source: 'ROGS 2026 Section 16',
    file: `${CACHE_DIR}/rogs-cp.xlsx`,
  },
  'disability': {
    url: 'https://assets.pc.gov.au/2026-01/rogs-2026-partf-section15-disability-services-data-tables.xlsx?VersionId=3jlO_kWLpKq5X065mrLUWM8khySiEx8p',
    source: 'ROGS 2026 Section 15',
    file: `${CACHE_DIR}/rogs-dis.xlsx`,
  },
  'education': {
    url: 'https://assets.pc.gov.au/2026-02/rogs-2026-partb-section4-school-education-data-tables.xlsx?VersionId=Ghjw.odk7JkcERuWL2hwwnsU.krgfG19',
    source: 'ROGS 2026 Section 4',
    file: `${CACHE_DIR}/rogs-edu.xlsx`,
  },
};

// State name → code (strip footnote markers like "(b)")
const STATE_MAP = {
  'NSW': 'NSW', 'Vic': 'VIC', 'Qld': 'QLD', 'WA': 'WA',
  'SA': 'SA', 'Tas': 'TAS', 'ACT': 'ACT', 'NT': 'NT',
  'Aust': 'National', 'Total': 'National',
};

function normaliseHeader(h) {
  return String(h || '').replace(/\s*\(.*?\)\s*/g, '').trim();
}

// ── Helpers ──

function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/rogs-psql-${Date.now()}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(`psql "${connStr}" -f ${tmpFile} 2>/dev/null`, {
      encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000,
    });
    unlinkSync(tmpFile);
    return result;
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    throw err;
  }
}

function download(url, dest) {
  if (existsSync(dest)) {
    console.log(`  [cache] ${dest}`);
    return;
  }
  console.log(`  [download] ${url.slice(0, 80)}...`);
  execSync(`curl -sSL -o "${dest}" "${url}"`, { timeout: 60000 });
}

function parseNum(val) {
  if (val == null || val === '' || val === '..' || val === 'na' || val === 'n.a.' || val === 'np' || val === '–' || val === '—') return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/,/g, '').replace(/\s/g, '').replace(/%$/, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const YEAR_RE = /^(20\d{2}(?:-\d{2})?)$/;

/**
 * Read a ROGS sheet and extract all data rows as structured entries.
 *
 * ROGS Excel layout (merged cells create sparse arrays):
 *   Row 0: [col0=title, ..., col10+=description]  (title row)
 *   Row 1: [..., col11="Unit", col12="NSW", col13="Vic", ...]  (header row)
 *   Data:  [col0=year?, col1=section?, col2=label?, ..., col11=unit, col12=NSW_val, ...]
 *
 * State data columns match header columns exactly (no offset).
 * Labels can be at col0, col1, or col2 depending on hierarchy level.
 */
function readRogsSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, header: 1 });

  // Find state header row — search all columns in first 6 rows
  let stateColMap = {}; // colIndex -> stateCode
  let headerIdx = -1;

  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const row = rows[i] || [];
    const matches = {};
    for (let j = 0; j < row.length; j++) {
      if (row[j] == null) continue;
      const norm = normaliseHeader(row[j]);
      if (STATE_MAP[norm]) matches[j] = STATE_MAP[norm];
    }
    if (Object.keys(matches).length >= 6) {
      stateColMap = matches;
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) return null;

  // Walk data rows
  const entries = [];
  let currentYear = null;
  let currentSection = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];

    // Find all non-null cells
    const nonNullCells = [];
    for (let j = 0; j < row.length; j++) {
      if (row[j] != null && String(row[j]).trim() !== '') nonNullCells.push(j);
    }
    if (nonNullCells.length === 0) continue;

    // Get text from first few columns (label area, typically cols 0-10)
    const firstStateCol = Math.min(...Object.keys(stateColMap).map(Number));
    const textCells = nonNullCells.filter(j => j < firstStateCol);
    const firstText = textCells.length > 0 ? String(row[textCells[0]]).trim() : '';

    // Source/footnote rows — stop parsing
    if (firstText.startsWith('Source:') || firstText.startsWith('(a)') || firstText.startsWith('Note:')) break;

    // Year detection: a year string in any early column
    const yearMatch = firstText.match(YEAR_RE);
    if (yearMatch) {
      currentYear = yearMatch[1];
    }

    // Extract state values at header column positions (same col, no offset)
    const values = {};
    let hasValues = false;
    for (const [colIdx, stateCode] of Object.entries(stateColMap)) {
      const val = parseNum(row[parseInt(colIdx)]);
      if (val !== null) {
        values[stateCode] = val;
        hasValues = true;
      }
    }

    // If no state values, this is a header/section row
    if (!hasValues) {
      if (!yearMatch && firstText) {
        currentSection = firstText;
      }
      continue;
    }

    // Data row — find the label (rightmost text before state columns, excluding years and units)
    let label = currentSection || '(unknown)';
    for (const j of textCells) {
      const cell = String(row[j]).trim();
      if (cell.match(YEAR_RE)) continue; // skip year
      if (['no.', '$m', '$\'000', 'rate', '%', '$', 'ratio'].includes(cell)) continue; // skip units
      label = cell;
    }

    const year = currentYear;

    entries.push({ label, year, section: currentSection, values });
  }

  return entries;
}

/**
 * Extract specific metrics from a ROGS sheet.
 * `targets` = [{ sheet, labelMatch, metric_name, metric_unit, cohort, notes, year }]
 * `labelMatch` is a substring match (case-insensitive) against the label field.
 * If `year` is specified, only take that year; otherwise take the latest.
 */
function extractMetrics(workbook, targets, domain, source) {
  const metrics = [];
  const sheetCache = {};

  for (const t of targets) {
    const sheetName = t.sheet;
    if (!sheetCache[sheetName]) {
      sheetCache[sheetName] = readRogsSheet(workbook, sheetName) || [];
    }
    const entries = sheetCache[sheetName];

    // Find matching entries (optionally constrained by section)
    const matches = entries.filter(e => {
      if (!e.label || !e.label.toLowerCase().includes(t.labelMatch.toLowerCase())) return false;
      if (t.sectionMatch && (!e.section || !e.section.toLowerCase().includes(t.sectionMatch.toLowerCase()))) return false;
      return true;
    });

    if (matches.length === 0) continue;

    // Pick target year or most recent
    let chosen;
    if (t.year) {
      chosen = matches.find(m => m.year === t.year);
    } else {
      // Most recent = first match (ROGS puts newest first)
      chosen = matches[0];
    }

    if (!chosen) continue;

    for (const [stateCode, val] of Object.entries(chosen.values)) {
      metrics.push({
        jurisdiction: stateCode,
        domain,
        metric_name: t.metric_name,
        metric_value: val,
        metric_unit: t.metric_unit || 'number',
        period: chosen.year || 'latest',
        cohort: t.cohort || 'all',
        source,
        notes: t.notes || null,
      });
    }
  }

  return metrics;
}

// ── Domain definitions: which tables + which rows to extract ──

const DOMAIN_TARGETS = {
  'youth-justice': [
    // Table 17A.1: Supervision numbers
    { sheet: 'Table 17A.1', labelMatch: 'Detention', metric_name: 'rogs_avg_daily_detention', metric_unit: 'number', notes: 'Average daily number in detention' },
    { sheet: 'Table 17A.1', labelMatch: 'Community-based supervision', metric_name: 'rogs_avg_daily_community', metric_unit: 'number', notes: 'Average daily community-based supervision' },
    { sheet: 'Table 17A.1', labelMatch: 'Total', metric_name: 'rogs_avg_daily_total_supervision', metric_unit: 'number', notes: 'Average daily total supervision' },
    // Table 17A.2: Detention centre utilisation
    { sheet: 'Table 17A.2', labelMatch: 'permanently funded beds', metric_name: 'rogs_detention_beds', metric_unit: 'number', notes: 'Number of permanently funded detention beds' },
    { sheet: 'Table 17A.2', labelMatch: 'Centre utilisation rate', metric_name: 'rogs_detention_utilisation', metric_unit: 'percent', notes: 'Detention centre utilisation rate' },
    // Table 17A.3: By sex
    { sheet: 'Table 17A.3', labelMatch: 'Males', metric_name: 'rogs_detention_males', metric_unit: 'number', notes: 'Average daily males in detention' },
    { sheet: 'Table 17A.3', labelMatch: 'Females', metric_name: 'rogs_detention_females', metric_unit: 'number', notes: 'Average daily females in detention' },
    // Table 17A.5: Indigenous detention
    { sheet: 'Table 17A.5', labelMatch: 'Aboriginal and Torres Strait Islander', metric_name: 'rogs_indigenous_detention', metric_unit: 'number', cohort: 'indigenous', notes: 'Average daily Indigenous young people in detention' },
    { sheet: 'Table 17A.5', labelMatch: 'Non-Indigenous', metric_name: 'rogs_nonindigenous_detention', metric_unit: 'number', cohort: 'non-indigenous', notes: 'Average daily non-Indigenous in detention' },
    // Table 17A.6: Community supervision by Indigenous status
    { sheet: 'Table 17A.6', labelMatch: 'Aboriginal and Torres Strait Islander', metric_name: 'rogs_indigenous_community', metric_unit: 'number', cohort: 'indigenous', notes: 'Average daily Indigenous young people under community supervision' },
    { sheet: 'Table 17A.6', labelMatch: 'Non-Indigenous', metric_name: 'rogs_nonindigenous_community', metric_unit: 'number', cohort: 'non-indigenous', notes: 'Average daily non-Indigenous under community supervision' },
    // Table 17A.14: Education in detention — proportion attending (compulsory school age)
    { sheet: 'Table 17A.14', labelMatch: 'All people', sectionMatch: 'Proportion of young people', metric_name: 'rogs_yj_education_in_detention', metric_unit: 'percent', notes: 'Proportion of young people in detention attending education/training' },
    // Table 17A.15: Deaths in custody
    { sheet: 'Table 17A.15', labelMatch: 'All people', metric_name: 'rogs_yj_deaths_in_custody', metric_unit: 'number', notes: 'Deaths in youth justice custody' },
    // Table 17A.20: Cost per day — detention
    { sheet: 'Table 17A.20', labelMatch: 'Cost per average day per young person', metric_name: 'rogs_cost_per_day_detention', metric_unit: 'dollars_per_day', notes: 'Cost per day per young person in detention' },
    // Table 17A.21: Cost per day — community supervision
    { sheet: 'Table 17A.21', labelMatch: 'Cost per average day per young person', metric_name: 'rogs_cost_per_day_community', metric_unit: 'dollars_per_day', notes: 'Cost per day per young person in community supervision' },
    // Table 17A.25: Completion of community orders — proportion successfully completed
    { sheet: 'Table 17A.25', labelMatch: 'All people', sectionMatch: 'Proportion of orders', metric_name: 'rogs_yj_community_completion', metric_unit: 'percent', notes: 'Proportion of community-based orders successfully completed' },
    // Table 17A.26: Recidivism — return to sentenced supervision within 12 months
    { sheet: 'Table 17A.26', labelMatch: 'Year of release from sentenced supervision', metric_name: 'rogs_yj_recidivism_12m', metric_unit: 'percent', notes: 'Young people returning to sentenced supervision within 12 months of release' },
  ],
  'child-protection': [
    // Table 16A.1: Notifications
    { sheet: 'Table 16A.1', labelMatch: 'All children', metric_name: 'rogs_cp_notifications', metric_unit: 'number', notes: 'Child protection notifications — all children' },
    { sheet: 'Table 16A.1', labelMatch: 'Aboriginal and Torres Strait Islander children', metric_name: 'rogs_cp_notifications_indigenous', metric_unit: 'number', cohort: 'indigenous', notes: 'CP notifications — Indigenous children' },
    // Table 16A.3: Substantiations
    { sheet: 'Table 16A.3', labelMatch: 'All children', metric_name: 'rogs_cp_substantiations', metric_unit: 'number', notes: 'Substantiated child protection cases' },
    { sheet: 'Table 16A.3', labelMatch: 'Aboriginal and Torres Strait Islander children', metric_name: 'rogs_cp_substantiations_indigenous', metric_unit: 'number', cohort: 'indigenous', notes: 'Substantiated cases — Indigenous children' },
    // Table 16A.5: Notifications + substantiations combined (different view)
    { sheet: 'Table 16A.5', labelMatch: 'Substantiated', metric_name: 'rogs_cp_substantiated_detailed', metric_unit: 'number', notes: 'Substantiated cases (detailed notifications table)' },
    { sheet: 'Table 16A.5', labelMatch: 'Notifications investigated', metric_name: 'rogs_cp_investigated', metric_unit: 'number', notes: 'Notifications investigated' },
    // Table 16A.7: Children in OOHC
    { sheet: 'Table 16A.7', labelMatch: 'Care and protection order', metric_name: 'rogs_cp_oohc_on_orders', metric_unit: 'number', notes: 'Children in OOHC on care and protection orders' },
    { sheet: 'Table 16A.7', labelMatch: 'Not on an order', metric_name: 'rogs_cp_oohc_no_order', metric_unit: 'number', notes: 'Children in OOHC not on an order' },
    // Table 16A.8: Kinship households
    { sheet: 'Table 16A.8', labelMatch: 'Number of households', metric_name: 'rogs_cp_kinship_households', metric_unit: 'number', notes: 'Relative/kinship carer households' },
    // Table 16A.9: Foster carer households
    { sheet: 'Table 16A.9', labelMatch: 'Number of households', metric_name: 'rogs_cp_foster_households', metric_unit: 'number', notes: 'Foster carer households with children placed' },
    // Table 16A.10: Protective intervention services expenditure
    { sheet: 'Table 16A.10', labelMatch: 'Protective intervention services', metric_name: 'rogs_cp_protective_expenditure', metric_unit: 'dollars_thousands', notes: 'State/territory expenditure on protective intervention services ($000)' },
    // Table 16A.10: Care services expenditure
    { sheet: 'Table 16A.10', labelMatch: 'Care services', metric_name: 'rogs_cp_care_expenditure', metric_unit: 'dollars_thousands', notes: 'State/territory expenditure on care services ($000)' },
    // Table 16A.15: Substantiation rate
    { sheet: 'Table 16A.15', labelMatch: 'Proportion of finalised investigations substantiated', metric_name: 'rogs_cp_substantiation_rate', metric_unit: 'percent', notes: 'Proportion of finalised investigations substantiated — all children' },
    // Table 16A.24: Children placed with relatives/kin
    { sheet: 'Table 16A.24', labelMatch: 'All children', metric_name: 'rogs_cp_kinship_placement_pct', metric_unit: 'percent', notes: 'Children in care placed with relatives/kin' },
    // Table 16A.36: Expenditure on intensive family support
    { sheet: 'Table 16A.36', labelMatch: 'Real recurrent expenditure', metric_name: 'rogs_cp_expenditure_per_child', metric_unit: 'dollars', notes: 'Real recurrent expenditure on intensive family support' },
    // Table 16A.41: Re-substantiation within 12 months (proportion)
    { sheet: 'Table 16A.41', labelMatch: 'Proportion of children', sectionMatch: 'within 12 months', metric_name: 'rogs_cp_resubstantiation_12m', metric_unit: 'percent', notes: 'Children substantiated who had subsequent substantiation within 12 months' },
  ],
  'disability': [
    // Table 15A.1: Total government expenditure
    { sheet: 'Table 15A.1', labelMatch: 'Total', metric_name: 'rogs_dis_total_expenditure', metric_unit: 'dollars_millions', notes: 'Total government expenditure on disability services ($m)' },
    // Table 15A.3: Government expenditure (NDIS contributions)
    { sheet: 'Table 15A.3', labelMatch: 'NDIS contributions', metric_name: 'rogs_dis_ndis_expenditure', metric_unit: 'dollars_millions', notes: 'State/territory NDIS contributions ($m)' },
    // Table 15A.6: NDIS participants by disability type
    { sheet: 'Table 15A.6', labelMatch: 'Autism', metric_name: 'rogs_dis_autism_pct', metric_unit: 'percent', notes: 'NDIS participants — autism (%)' },
    { sheet: 'Table 15A.6', labelMatch: 'Intellectual disability', metric_name: 'rogs_dis_intellectual_pct', metric_unit: 'percent', notes: 'NDIS participants — intellectual disability (%)' },
    { sheet: 'Table 15A.6', labelMatch: 'Psychosocial disability', metric_name: 'rogs_dis_psychosocial_pct', metric_unit: 'percent', notes: 'NDIS participants — psychosocial disability (%)' },
    // Table 15A.13: Satisfaction — plan implementation process
    { sheet: 'Table 15A.13', labelMatch: 'Plan implementation process', metric_name: 'rogs_dis_satisfaction_plan', metric_unit: 'percent', notes: 'NDIS participant satisfaction with plan implementation process (%)' },
    // Table 15A.15: Committed supports and payments
    { sheet: 'Table 15A.15', labelMatch: 'Total payments', metric_name: 'rogs_dis_total_payments', metric_unit: 'dollars_millions', notes: 'Total NDIS payments ($m)' },
    // Table 15A.20: Population participation rate (0-64, all people)
    { sheet: 'Table 15A.20', labelMatch: 'All people', sectionMatch: '0–64 years old', metric_name: 'rogs_dis_participation_rate', metric_unit: 'rate_per_1000', notes: 'NDIS participants per 1,000 people aged 0-64' },
    // Table 15A.26: Plan utilisation by remoteness
    { sheet: 'Table 15A.26', labelMatch: 'Major cities', metric_name: 'rogs_dis_utilisation_metro', metric_unit: 'percent', notes: 'NDIS plan utilisation — major cities' },
    { sheet: 'Table 15A.26', labelMatch: 'Inner and outer regional', metric_name: 'rogs_dis_utilisation_regional', metric_unit: 'percent', notes: 'NDIS plan utilisation — regional' },
    { sheet: 'Table 15A.26', labelMatch: 'Remote and very remote', metric_name: 'rogs_dis_utilisation_remote', metric_unit: 'percent', notes: 'NDIS plan utilisation — remote' },
    // Table 15A.27: Plan utilisation by Indigenous status
    { sheet: 'Table 15A.27', labelMatch: 'Aboriginal and Torres Strait Islander', metric_name: 'rogs_dis_utilisation_indigenous', metric_unit: 'percent', cohort: 'indigenous', notes: 'NDIS plan utilisation — Indigenous' },
    { sheet: 'Table 15A.27', labelMatch: 'Non-Indigenous', metric_name: 'rogs_dis_utilisation_nonindigenous', metric_unit: 'percent', cohort: 'non-indigenous', notes: 'NDIS plan utilisation — non-Indigenous' },
    // Table 15A.30: Average NDIS payments by remoteness
    { sheet: 'Table 15A.30', labelMatch: 'Major cities', metric_name: 'rogs_dis_avg_payment_metro', metric_unit: 'dollars', notes: 'Average annualised NDIS payments — major cities' },
    { sheet: 'Table 15A.30', labelMatch: 'Remote and very remote', metric_name: 'rogs_dis_avg_payment_remote', metric_unit: 'dollars', notes: 'Average annualised NDIS payments — remote' },
    // Table 15A.31: Average NDIS payments by Indigenous status
    { sheet: 'Table 15A.31', labelMatch: 'Aboriginal and Torres Strait Islander', metric_name: 'rogs_dis_avg_payment_indigenous', metric_unit: 'dollars', cohort: 'indigenous', notes: 'Average annualised NDIS payments — Indigenous' },
    // Table 15A.60: Restrictive practices
    { sheet: 'Table 15A.60', labelMatch: 'Seclusion', metric_name: 'rogs_dis_restrictive_seclusion', metric_unit: 'number', notes: 'Unauthorised seclusion incidents' },
    { sheet: 'Table 15A.60', labelMatch: 'Chemical restraint', metric_name: 'rogs_dis_restrictive_chemical', metric_unit: 'number', notes: 'Unauthorised chemical restraint incidents' },
    { sheet: 'Table 15A.60', labelMatch: 'Physical restraint', metric_name: 'rogs_dis_restrictive_physical', metric_unit: 'number', notes: 'Unauthorised physical restraint incidents' },
    // Table 15A.73: Transport difficulty
    { sheet: 'Table 15A.73', labelMatch: 'With profound or severe disability', metric_name: 'rogs_dis_transport_difficulty_severe', metric_unit: 'percent', notes: 'Transport difficulty — profound/severe disability (%)' },
    { sheet: 'Table 15A.73', labelMatch: 'Total with disability', metric_name: 'rogs_dis_transport_difficulty_total', metric_unit: 'percent', notes: 'Transport difficulty — all disability (%)' },
  ],
  'education': [
    // Table 4A.1: Combined government expenditure on education
    { sheet: 'Table 4A.1', labelMatch: 'Australian, state and territory government expenditure', metric_name: 'rogs_edu_total_expenditure', metric_unit: 'dollars_thousands', notes: 'Total government recurrent expenditure on school education ($000)' },
    // Table 4A.7: Enrolments
    { sheet: 'Table 4A.7', labelMatch: 'All school levels', metric_name: 'rogs_edu_total_enrolments', metric_unit: 'number', notes: 'Total school enrolments (FTE)' },
    { sheet: 'Table 4A.7', labelMatch: 'Primary', metric_name: 'rogs_edu_primary_enrolments', metric_unit: 'number', notes: 'Primary school enrolments (FTE)' },
    { sheet: 'Table 4A.7', labelMatch: 'Secondary', metric_name: 'rogs_edu_secondary_enrolments', metric_unit: 'number', notes: 'Secondary school enrolments (FTE)' },
    // Table 4A.8: Participation rates
    { sheet: 'Table 4A.8', labelMatch: '15 years old', metric_name: 'rogs_edu_participation_15yo', metric_unit: 'percent', notes: 'School participation rate — 15 year olds' },
    { sheet: 'Table 4A.8', labelMatch: '16 years old', metric_name: 'rogs_edu_participation_16yo', metric_unit: 'percent', notes: 'School participation rate — 16 year olds' },
    { sheet: 'Table 4A.8', labelMatch: '17 years old', metric_name: 'rogs_edu_participation_17yo', metric_unit: 'percent', notes: 'School participation rate — 17 year olds' },
    // Table 4A.12: Students with disability adjustment
    { sheet: 'Table 4A.12', labelMatch: 'Supplementary', metric_name: 'rogs_edu_disability_supplementary', metric_unit: 'percent', notes: 'Students receiving supplementary disability adjustment (%)' },
    { sheet: 'Table 4A.12', labelMatch: 'Substantial', metric_name: 'rogs_edu_disability_substantial', metric_unit: 'percent', notes: 'Students receiving substantial disability adjustment (%)' },
    { sheet: 'Table 4A.12', labelMatch: 'Extensive', metric_name: 'rogs_edu_disability_extensive', metric_unit: 'percent', notes: 'Students receiving extensive disability adjustment (%)' },
    // Table 4A.14: Student-teacher ratios
    { sheet: 'Table 4A.14', labelMatch: 'Primary schools', metric_name: 'rogs_edu_ratio_primary', metric_unit: 'ratio', notes: 'Student-teacher ratio — government primary schools' },
    // Table 4A.15: Year 12 completion (VET)
    { sheet: 'Table 4A.15', labelMatch: 'Proportion of students', metric_name: 'rogs_edu_vet_completion_pct', metric_unit: 'percent', notes: '15-19 year olds completing VET unit (%)' },
    // Table 4A.17: Attendance rates — Years 1–10 (all students)
    { sheet: 'Table 4A.17', labelMatch: 'Years 1\u201310', metric_name: 'rogs_edu_attendance_all', metric_unit: 'percent', notes: 'Student attendance rate — all students, Years 1-10' },
    // Table 4A.25: Apparent retention rates — Year 10 to Year 12 (all full-time)
    { sheet: 'Table 4A.25', labelMatch: 'All full-time students', metric_name: 'rogs_edu_retention_yr12', metric_unit: 'percent', notes: 'Apparent retention rate Year 10 to Year 12 — all full-time students' },
    // Table 4A.32: Expenditure per student — combined government
    { sheet: 'Table 4A.32', labelMatch: 'Australian, state and territory government expenditure', metric_name: 'rogs_edu_expenditure_per_student', metric_unit: 'dollars', notes: 'Combined government recurrent expenditure per FTE student' },
  ],
};

// ── Main ──

async function main() {
  const run = await logStart(supabase, AGENT_ID, 'ROGS All-Domain Scraper');
  const runId = run?.id;
  const results = { downloaded: 0, metrics: 0, domains: [], errors: [] };

  try {
    const domains = DOMAIN_FILTER ? [DOMAIN_FILTER] : Object.keys(ROGS_SOURCES);

    for (const domain of domains) {
      const src = ROGS_SOURCES[domain];
      if (!src) { console.error(`Unknown domain: ${domain}`); continue; }

      console.log(`\n── ${domain.toUpperCase()} ──`);

      // Download
      try {
        download(src.url, src.file);
        results.downloaded++;
      } catch (err) {
        console.error(`  [error] Download failed: ${err.message?.slice(0, 200)}`);
        results.errors.push(`Download failed: ${domain}`);
        continue;
      }

      // Parse workbook
      let workbook;
      try {
        workbook = XLSX.readFile(src.file);
      } catch (err) {
        console.error(`  [error] Parse failed: ${err.message?.slice(0, 200)}`);
        results.errors.push(`Parse failed: ${domain}`);
        continue;
      }

      console.log(`  [sheets] ${workbook.SheetNames.length}`);

      // Extract metrics
      const targets = DOMAIN_TARGETS[domain] || [];
      const metrics = extractMetrics(workbook, targets, domain, src.source);
      console.log(`  [extracted] ${metrics.length} metrics across ${new Set(metrics.map(m => m.metric_name)).size} metric types`);

      if (metrics.length === 0) {
        // Debug: show what we can read from first data sheet
        const firstDataSheet = workbook.SheetNames.find(n => n.includes('A.1'));
        if (firstDataSheet) {
          const entries = readRogsSheet(workbook, firstDataSheet);
          console.log(`  [debug] ${firstDataSheet} has ${entries?.length || 0} data rows`);
          if (entries && entries.length > 0) {
            console.log(`  [debug] First entry: ${JSON.stringify(entries[0]).slice(0, 200)}`);
          }
        }
        results.domains.push({ domain, metrics: 0, note: 'no metrics extracted' });
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] Would upsert ${metrics.length} metrics:`);
        // Group by metric name
        const byMetric = {};
        for (const m of metrics) {
          if (!byMetric[m.metric_name]) byMetric[m.metric_name] = [];
          byMetric[m.metric_name].push(m);
        }
        for (const [name, items] of Object.entries(byMetric)) {
          const states = items.map(i => `${i.jurisdiction}=${i.metric_value}`).join(', ');
          console.log(`    ${name} (${items[0].period}): ${states}`);
        }
        results.domains.push({ domain, metrics: metrics.length });
        results.metrics += metrics.length;
        continue;
      }

      // Upsert to outcomes_metrics
      const esc = (s) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
      const values = metrics.map(m =>
        `(gen_random_uuid(), ${esc(m.jurisdiction)}, ${esc(m.domain)}, ${esc(m.metric_name)}, ${m.metric_value}, ${esc(m.metric_unit)}, ${esc(m.period)}, ${esc(m.cohort)}, ${esc(m.source)}, NULL, NULL, ${esc(m.notes)}, now())`
      ).join(',\n  ');

      const sql = `INSERT INTO outcomes_metrics (id, jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, source_table, notes, created_at)
VALUES
  ${values}
ON CONFLICT (jurisdiction, domain, metric_name, period, cohort, source)
DO UPDATE SET metric_value = EXCLUDED.metric_value, metric_unit = EXCLUDED.metric_unit, notes = EXCLUDED.notes, created_at = now();`;

      try {
        psql(sql);
        console.log(`  [upserted] ${metrics.length} metrics`);
        results.metrics += metrics.length;
        results.domains.push({ domain, metrics: metrics.length });
      } catch (err) {
        console.error(`  [error] Upsert failed: ${err.message?.slice(0, 300)}`);
        results.errors.push(`Upsert failed: ${domain}`);
      }
    }

    console.log(`\n── SUMMARY ──`);
    console.log(`Downloaded: ${results.downloaded} files`);
    console.log(`Metrics upserted: ${results.metrics}`);
    for (const d of results.domains) {
      console.log(`  ${d.domain}: ${d.metrics} metrics${d.note ? ` (${d.note})` : ''}`);
    }
    if (results.errors.length > 0) {
      console.log(`Errors: ${results.errors.join(', ')}`);
    }

    await logComplete(supabase, runId, {
      items_found: results.metrics,
      items_new: results.metrics,
      metadata: { domains: results.domains, errors: results.errors },
    });
  } catch (err) {
    console.error('Fatal error:', err.message);
    await logFailed(supabase, runId, err.message);
    process.exit(1);
  }
}

main();
