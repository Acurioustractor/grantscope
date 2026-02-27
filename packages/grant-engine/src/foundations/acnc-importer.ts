/**
 * ACNC Register Importer
 *
 * Downloads the ACNC (Australian Charities and Not-for-profits Commission) register CSV
 * and filters to foundations, PAFs, PuAFs, and trusts.
 *
 * Data source: https://data.gov.au/data/dataset/acnc-register
 * CSV is ~15MB with 53,000+ charities.
 */

import { parse } from 'csv-parse';
import { Readable } from 'stream';
import type { ACNCRecord, Foundation, FoundationType } from './types.js';

// ACNC subtypes that indicate a foundation/trust (vs regular charity)
const FOUNDATION_SUBTYPES = new Set([
  'Private Ancillary Fund',
  'Public Ancillary Fund',
  'Trust',
]);

// Keywords in org name or subtype that indicate a foundation
const FOUNDATION_KEYWORDS = [
  'foundation',
  'ancillary fund',
  'trust',
  'endowment',
  'philanthropic',
  'giving',
];

/**
 * Map ACNC charity subtype to our foundation type.
 */
function mapFoundationType(subtype: string, name: string): FoundationType | null {
  const lower = subtype.toLowerCase();
  if (lower.includes('private ancillary')) return 'private_ancillary_fund';
  if (lower.includes('public ancillary')) return 'public_ancillary_fund';
  if (lower.includes('trust') || name.toLowerCase().includes('trust')) return 'trust';
  if (name.toLowerCase().includes('foundation')) return 'corporate_foundation';
  return null;
}

/**
 * Determine if an ACNC record represents a foundation/trust.
 */
function isFoundation(record: ACNCRecord): boolean {
  // Check subtype
  const subtype = record['Charity_Subtype'] || '';
  if (FOUNDATION_SUBTYPES.has(subtype)) return true;

  // Check name keywords
  const name = (record['Charity_Legal_Name'] || '').toLowerCase();
  const otherNames = (record['Other_Organisation_Names'] || '').toLowerCase();
  const combined = `${name} ${otherNames} ${subtype.toLowerCase()}`;

  return FOUNDATION_KEYWORDS.some(kw => combined.includes(kw));
}

/**
 * Extract geographic focus from ACNC operating state columns.
 */
function extractGeography(record: ACNCRecord): string[] {
  const geo: string[] = [];
  const stateMap: Record<string, string> = {
    'Operates_in_ACT': 'AU-ACT',
    'Operates_in_NSW': 'AU-NSW',
    'Operates_in_NT': 'AU-NT',
    'Operates_in_QLD': 'AU-QLD',
    'Operates_in_SA': 'AU-SA',
    'Operates_in_TAS': 'AU-TAS',
    'Operates_in_VIC': 'AU-VIC',
    'Operates_in_WA': 'AU-WA',
  };

  let stateCount = 0;
  for (const [col, code] of Object.entries(stateMap)) {
    if (record[col] === 'Y') {
      geo.push(code);
      stateCount++;
    }
  }

  // If operating in all states, simplify to national
  if (stateCount >= 7) {
    return ['AU-National'];
  }

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
export function acncToFoundation(record: ACNCRecord): Foundation {
  const name = record['Charity_Legal_Name'] || '';
  const subtype = record['Charity_Subtype'] || '';
  const size = record['Charity_Size'] || '';
  const giving = estimateGivingFromSize(size);

  return {
    acnc_abn: record['ABN'],
    name,
    type: mapFoundationType(subtype, name),
    website: record['Website'] || null,
    description: null,
    total_giving_annual: giving.avg,
    giving_history: null,
    avg_grant_size: null,
    grant_range_min: giving.min,
    grant_range_max: giving.max,
    thematic_focus: [],
    geographic_focus: extractGeography(record),
    target_recipients: [],
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
 *
 * @param csvData - Raw CSV string or Buffer
 * @param onProgress - Optional progress callback
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

    // Only include registered charities
    if (record['Registration_Status'] !== 'Registered') continue;

    if (isFoundation(record as ACNCRecord)) {
      foundations++;
      if (onProgress && foundations % 100 === 0) {
        onProgress(`Parsed ${total} records, found ${foundations} foundations`);
      }
      yield acncToFoundation(record as ACNCRecord);
    }
  }

  onProgress?.(`Complete: ${total} total records, ${foundations} foundations identified`);
}

/**
 * Download ACNC register CSV from data.gov.au.
 * Returns the raw CSV text.
 */
export async function downloadACNCRegister(
  onProgress?: (message: string) => void,
): Promise<string> {
  // The ACNC register is available as a CSV from data.gov.au
  // We first need to find the actual download URL from the CKAN API
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

  // Find the main CSV resource
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
