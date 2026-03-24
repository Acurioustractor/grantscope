import { NextRequest, NextResponse } from 'next/server';
import {
  getFundingByState,
  getTopOrgs,
  getTopPrograms,
  getFundingByLga,
  getAlmaInterventions,
  getOutcomesMetrics,
  type Topic,
} from '@/lib/services/report-service';

export const revalidate = 3600;

const VALID_DOMAINS = ['youth-justice', 'child-protection', 'ndis', 'family-services', 'indigenous', 'disability', 'education'] as const;
const VALID_STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const;
const VALID_SECTIONS = ['funding', 'programs', 'organisations', 'lga', 'alma', 'outcomes', 'all'] as const;

type Section = typeof VALID_SECTIONS[number];

function escapeCsv(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCsv).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escapeCsv(row[h])).join(',')
  );
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const domain = searchParams.get('domain') as string;
  const state = searchParams.get('state')?.toUpperCase() as string | undefined;
  const section = (searchParams.get('section') || 'all') as Section;

  if (!domain || !VALID_DOMAINS.includes(domain as typeof VALID_DOMAINS[number])) {
    return NextResponse.json({ error: 'Invalid domain. Valid: ' + VALID_DOMAINS.join(', ') }, { status: 400 });
  }
  if (state && !VALID_STATES.includes(state as typeof VALID_STATES[number])) {
    return NextResponse.json({ error: 'Invalid state. Valid: ' + VALID_STATES.join(', ') }, { status: 400 });
  }
  if (!VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: 'Invalid section. Valid: ' + VALID_SECTIONS.join(', ') }, { status: 400 });
  }

  const topic = domain as Topic;
  const sheets: Array<{ name: string; csv: string }> = [];

  try {
    // Fetch requested sections
    if (section === 'all' || section === 'funding') {
      const data = await getFundingByState(topic);
      if (data?.length) {
        sheets.push({ name: 'funding_by_state', csv: toCsv(['state', 'grants', 'total', 'orgs'], data) });
      }
    }

    if (section === 'all' || section === 'programs') {
      const data = await getTopPrograms(topic, 50);
      if (data?.length) {
        sheets.push({ name: 'programs', csv: toCsv(['program_name', 'state', 'grants', 'total'], data) });
      }
    }

    if (section === 'all' || section === 'organisations') {
      const data = await getTopOrgs(topic, 100, state);
      if (data?.length) {
        sheets.push({ name: 'organisations', csv: toCsv(['recipient_name', 'recipient_abn', 'state', 'grants', 'total', 'gs_id'], data) });
      }
    }

    if (section === 'all' || section === 'lga') {
      const data = await getFundingByLga(topic, 100, state);
      if (data?.length) {
        sheets.push({ name: 'lga_funding', csv: toCsv(['lga_name', 'state', 'orgs', 'total_funding', 'seifa_decile'], data) });
      }
    }

    if (section === 'all' || section === 'alma') {
      const data = await getAlmaInterventions(topic, 100, state);
      if (data?.length) {
        sheets.push({ name: 'alma_interventions', csv: toCsv(['name', 'type', 'evidence_level', 'geography', 'portfolio_score', 'org_name', 'org_abn'], data) });
      }
    }

    if (section === 'all' || section === 'outcomes') {
      const jurisdiction = state || 'National';
      const data = await getOutcomesMetrics(jurisdiction, domain);
      if (data?.length) {
        sheets.push({ name: 'outcomes_metrics', csv: toCsv(['metric_name', 'metric_value', 'metric_unit', 'period', 'cohort', 'source', 'notes'], data) });
      }
    }
  } catch (err) {
    console.error('[export] query failed:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  if (!sheets.length) {
    return NextResponse.json({ error: 'No data found for the requested parameters' }, { status: 404 });
  }

  // If single section, return single CSV. If 'all', combine with section headers.
  let csv: string;
  if (sheets.length === 1) {
    csv = sheets[0].csv;
  } else {
    csv = sheets.map(s => `# ${s.name}\n${s.csv}`).join('\n\n');
  }

  const filename = `civicgraph-${domain}${state ? `-${state.toLowerCase()}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
