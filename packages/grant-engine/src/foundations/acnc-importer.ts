/**
 * ACNC Register Importer
 *
 * Downloads the ACNC (Australian Charities and Not-for-profits Commission) register CSV
 * and filters to foundations, PAFs, PuAFs, and trusts.
 *
 * Data source: https://data.gov.au/data/dataset/acnc-register
 * CSV is ~14MB with 65,000+ charities.
 *
 * Actual CSV columns (verified):
 *   ABN, Charity_Legal_Name, Other_Organisation_Names, Address_Type, Address_Line_1..3,
 *   Town_City, State, Postcode, Country, Charity_Website, Registration_Date,
 *   Date_Organisation_Established, Charity_Size, Number_of_Responsible_Persons,
 *   Financial_Year_End, Operates_in_{ACT,NSW,NT,QLD,SA,TAS,VIC,WA},
 *   Operating_Countries, PBI, HPC, [purpose boolean columns], [beneficiary boolean columns]
 */

import { parse } from 'csv-parse';
import { Readable } from 'stream';
import type { Foundation, FoundationType } from './types.js';

// Keywords in org name that indicate a foundation/trust/PAF
const FOUNDATION_NAME_PATTERNS = [
  /\bfoundation\b/i,
  /\bancillary fund\b/i,
  /\bpaf\b/i,       // Private Ancillary Fund
  /\bpuaf\b/i,      // Public Ancillary Fund
  /\btrust\b/i,
  /\bendowment\b/i,
  /\bphilanthrop/i,
  /\bgiving\b/i,
  /\bcommunity fund\b/i,
  /\bcharitable fund\b/i,
  /\bgrant.?making\b/i,
];

// False positive patterns to exclude (trusts that aren't grant-making)
const EXCLUDE_PATTERNS = [
  /\bunit trust\b/i,
  /\bliving trust\b/i,
  /\bfamily trust\b/i,       // Keep if it also has 'foundation' or 'charitable'
  /\bsuperannuation\b/i,
  /\bsuper fund\b/i,
  /\bstrata\b/i,
  /\bproperty trust\b/i,
  /\binvestment trust\b/i,
  /\btrustee (company|services)\b/i,
];

interface ACNCRow {
  ABN: string;
  Charity_Legal_Name: string;
  Other_Organisation_Names: string;
  Charity_Website: string;
  Charity_Size: string;
  Registration_Date: string;
  Date_Organisation_Established: string;
  Operates_in_ACT: string;
  Operates_in_NSW: string;
  Operates_in_NT: string;
  Operates_in_QLD: string;
  Operates_in_SA: string;
  Operates_in_TAS: string;
  Operates_in_VIC: string;
  Operates_in_WA: string;
  PBI: string;
  HPC: string;
  // Purpose booleans
  Advancing_Culture: string;
  Advancing_Education: string;
  Advancing_Health: string;
  Advancing_natual_environment: string;
  Promoting_reconciliation__mutual_respect_and_tolerance: string;
  Advancing_social_or_public_welfare: string;
  Promoting_or_protecting_human_rights: string;
  Purposes_beneficial_to_ther_general_public_and_other_analogous: string;
  // Beneficiary booleans
  Aboriginal_or_TSI: string;
  General_Community_in_Australia: string;
  Children: string;
  Youth: string;
  Aged_Persons: string;
  Financially_Disadvantaged: string;
  People_with_Disabilities: string;
  Rural_Regional_Remote_Communities: string;
  [key: string]: string;
}

/**
 * Determine foundation type from name.
 */
function classifyFoundationType(name: string): FoundationType | null {
  const lower = name.toLowerCase();
  if (/\bprivate ancillary fund\b/.test(lower) || /\bpaf\b/.test(lower)) return 'private_ancillary_fund';
  if (/\bpublic ancillary fund\b/.test(lower) || /\bpuaf\b/.test(lower)) return 'public_ancillary_fund';
  if (/\bfoundation\b/.test(lower)) return 'corporate_foundation';
  if (/\btrust\b/.test(lower)) return 'trust';
  return null;
}

/**
 * Determine if an ACNC record represents a foundation/trust.
 */
function isFoundation(record: ACNCRow): boolean {
  const name = record.Charity_Legal_Name || '';
  const otherNames = record.Other_Organisation_Names || '';
  const combined = `${name} ${otherNames}`;

  // Check if name matches any foundation pattern
  const matchesFoundation = FOUNDATION_NAME_PATTERNS.some(p => p.test(combined));
  if (!matchesFoundation) return false;

  // Check for false positives (but keep if explicitly charitable)
  const isExcluded = EXCLUDE_PATTERNS.some(p => p.test(combined));
  if (isExcluded) {
    // Still include if the name also includes charitable/foundation keywords
    if (/\bcharitable\b/i.test(combined) || /\bfoundation\b/i.test(combined)) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Extract thematic focus from ACNC purpose boolean columns.
 */
function extractThematicFocus(record: ACNCRow): string[] {
  const focus: string[] = [];
  if (record.Advancing_Culture === 'Y') focus.push('arts');
  if (record.Advancing_Education === 'Y') focus.push('education');
  if (record.Advancing_Health === 'Y') focus.push('health');
  if (record.Advancing_natual_environment === 'Y') focus.push('environment');
  if (record.Promoting_reconciliation__mutual_respect_and_tolerance === 'Y') focus.push('indigenous');
  if (record.Advancing_social_or_public_welfare === 'Y') focus.push('community');
  if (record.Promoting_or_protecting_human_rights === 'Y') focus.push('human_rights');
  if (record.Aboriginal_or_TSI === 'Y') focus.push('indigenous');
  return [...new Set(focus)];
}

/**
 * Extract target recipients from ACNC beneficiary boolean columns.
 */
function extractTargetRecipients(record: ACNCRow): string[] {
  const recipients: string[] = [];
  if (record.General_Community_in_Australia === 'Y') recipients.push('community');
  if (record.Children === 'Y' || record.Youth === 'Y') recipients.push('youth');
  if (record.Aged_Persons === 'Y') recipients.push('aged');
  if (record.Financially_Disadvantaged === 'Y') recipients.push('disadvantaged');
  if (record.People_with_Disabilities === 'Y') recipients.push('disability');
  if (record.Rural_Regional_Remote_Communities === 'Y') recipients.push('rural_remote');
  if (record.Aboriginal_or_TSI === 'Y') recipients.push('indigenous');
  return [...new Set(recipients)];
}

/**
 * Extract geographic focus from ACNC operating state columns.
 */
function extractGeography(record: ACNCRow): string[] {
  const geo: string[] = [];
  const stateMap: Record<string, string> = {
    Operates_in_ACT: 'AU-ACT',
    Operates_in_NSW: 'AU-NSW',
    Operates_in_NT: 'AU-NT',
    Operates_in_QLD: 'AU-QLD',
    Operates_in_SA: 'AU-SA',
    Operates_in_TAS: 'AU-TAS',
    Operates_in_VIC: 'AU-VIC',
    Operates_in_WA: 'AU-WA',
  };

  let stateCount = 0;
  for (const [col, code] of Object.entries(stateMap)) {
    if (record[col] === 'Y') {
      geo.push(code);
      stateCount++;
    }
  }

  if (stateCount >= 7) return ['AU-National'];
  return geo.length > 0 ? geo : ['AU-National'];
}

/**
 * Map ACNC size to estimated giving range.
 */
function estimateGivingFromSize(size: string): { avg: number | null; min: number | null; max: number | null } {
  switch (size) {
    case 'Large':
      return { avg: 500000, min: 10000, max: 5000000 };
    case 'Medium':
      return { avg: 100000, min: 5000, max: 500000 };
    case 'Small':
      return { avg: 25000, min: 1000, max: 100000 };
    default:
      return { avg: null, min: null, max: null };
  }
}

/**
 * Convert an ACNC record into a Foundation object.
 */
export function acncToFoundation(record: ACNCRow): Foundation {
  const name = record.Charity_Legal_Name || '';
  const size = record.Charity_Size || '';
  const giving = estimateGivingFromSize(size);

  return {
    acnc_abn: record.ABN,
    name,
    type: classifyFoundationType(name),
    website: record.Charity_Website || null,
    description: null,
    total_giving_annual: giving.avg,
    giving_history: null,
    avg_grant_size: null,
    grant_range_min: giving.min,
    grant_range_max: giving.max,
    thematic_focus: extractThematicFocus(record),
    geographic_focus: extractGeography(record),
    target_recipients: extractTargetRecipients(record),
    endowment_size: null,
    investment_returns: null,
    giving_ratio: null,
    revenue_sources: [],
    parent_company: null,
    asx_code: null,
    open_programs: null,
    acnc_data: record as unknown as Record<string, unknown>,
    last_scraped_at: null,
    profile_confidence: 'low',
  };
}

/**
 * Parse ACNC CSV data and yield Foundation records for foundation/trust entities.
 */
export async function* parseACNCRegister(
  csvData: string | Buffer,
  onProgress?: (message: string) => void,
): AsyncGenerator<Foundation> {
  const input = typeof csvData === 'string' ? csvData : csvData.toString('utf-8');
  const stream = Readable.from(input);

  const parser = stream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    })
  );

  let total = 0;
  let foundations = 0;

  for await (const record of parser) {
    total++;

    if (isFoundation(record as ACNCRow)) {
      foundations++;
      if (onProgress && foundations % 500 === 0) {
        onProgress(`Parsed ${total} records, found ${foundations} foundations`);
      }
      yield acncToFoundation(record as ACNCRow);
    }
  }

  onProgress?.(`Complete: ${total} total records, ${foundations} foundations identified`);
}

/**
 * Download ACNC register CSV from data.gov.au.
 */
export async function downloadACNCRegister(
  onProgress?: (message: string) => void,
): Promise<string> {
  const datasetUrl = 'https://data.gov.au/data/api/3/action/package_show?id=b050b242-4487-4306-abf5-07ca073e5594';

  onProgress?.('Fetching ACNC dataset metadata from data.gov.au...');

  const metaResponse = await fetch(datasetUrl);
  if (!metaResponse.ok) {
    throw new Error(`Failed to fetch ACNC dataset metadata: ${metaResponse.status}`);
  }

  const meta = await metaResponse.json() as {
    result: {
      resources: Array<{ url: string; format: string; name: string }>;
    };
  };

  const csvResource = meta.result.resources.find(
    (r) => r.format?.toUpperCase() === 'CSV' && r.name?.toLowerCase().includes('register')
  ) || meta.result.resources.find(
    (r) => r.format?.toUpperCase() === 'CSV'
  );

  if (!csvResource) {
    throw new Error('Could not find CSV resource in ACNC dataset');
  }

  onProgress?.(`Downloading CSV from ${csvResource.url}...`);

  const csvResponse = await fetch(csvResource.url);
  if (!csvResponse.ok) {
    throw new Error(`Failed to download ACNC CSV: ${csvResponse.status}`);
  }

  const text = await csvResponse.text();
  onProgress?.(`Downloaded ${(text.length / 1024 / 1024).toFixed(1)}MB CSV`);

  return text;
}
