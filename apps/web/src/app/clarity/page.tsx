import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import SchemaGraph from './schema-graph';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Clarity | CivicGraph',
  description: 'How CivicGraph connects public data to make government spending, influence, and outcomes visible.',
};

/* ─── Types ───────────────────────────────────────── */

interface TopicCoverage {
  topic: string;
  state: string;
  records: number;
  total_dollars: number;
}

interface SystemLink {
  name: string;
  table: string;
  records: number;
  linkage_pct: number;
  description: string;
}

interface Finding {
  severity: 'strength' | 'gap' | 'insight';
  claim: string;
  evidence: string;
}

/* ─── Helpers ─────────────────────────────────────── */

function fmt(n: number): string { return n.toLocaleString(); }
function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
function pct(n: number): string { return `${Math.round(n)}%`; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe<T = any>(p: PromiseLike<T>, ms = 12000): Promise<T | { data: null; error: string }> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<{ data: null; error: string }>(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), ms)),
  ]);
}

/* ─── Coverage heatmap color ──────────────────────── */

function heatColor(records: number): string {
  if (records === 0) return 'bg-gray-100 text-gray-400';
  if (records < 10) return 'bg-red-100 text-red-700';
  if (records < 100) return 'bg-orange-100 text-orange-700';
  if (records < 500) return 'bg-yellow-100 text-yellow-700';
  if (records < 1000) return 'bg-blue-100 text-blue-700';
  return 'bg-green-100 text-green-700';
}

function linkageColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-bauhaus-red';
}

function linkageBg(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-bauhaus-red';
}

/* ─── Data fetching ───────────────────────────────── */

async function getData() {
  const db = getServiceSupabase();

  // Batch 1: heavy table scans (max 7 concurrent to stay under pool limit)
  const [
    topicMatrixResult,
    almaMatrixResult,
    justiceResult,
    almaLinkResult,
    contractResult,
    donationResult,
    foundationResult,
  ] = await Promise.all([
    safe(db.rpc('exec_sql', {
      query: `SELECT unnest(topics) as topic, state, COUNT(*) as records, COALESCE(SUM(amount_dollars), 0) as total_dollars
              FROM justice_funding WHERE source != 'austender-direct' AND cardinality(topics) > 0
              GROUP BY topic, state ORDER BY topic, total_dollars DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT unnest(topics) as topic, unnest(geography) as state, COUNT(*) as records
              FROM alma_interventions WHERE cardinality(topics) > 0
              GROUP BY topic, state ORDER BY topic, records DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(gs_entity_id) as linked,
              ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM justice_funding`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(gs_entity_id) as linked,
              ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM alma_interventions`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(supplier_abn) as with_abn,
              ROUND(COUNT(supplier_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM austender_contracts`,
    }), 20000),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(donor_abn) as with_abn,
              ROUND(COUNT(donor_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM political_donations`,
    }), 20000),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(acnc_abn) as with_abn,
              ROUND(COUNT(acnc_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM foundations`,
    })),
  ]);

  // Batch 2: use estimated counts (instant) + smaller queries
  const [
    estCountsResult,
    outcomesResult,
    untaggedResult,
    crossSystemResult,
    desertResult,
  ] = await Promise.all([
    // Fast estimated row counts from pg_stat (no table scan!)
    safe(db.rpc('exec_sql', {
      query: `SELECT relname as table_name, n_live_tup as est_rows
              FROM pg_stat_user_tables
              WHERE schemaname = 'public'
                AND relname IN ('gs_entities', 'gs_relationships')`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT jurisdiction as state, COUNT(DISTINCT metric_name) as metric_types, COUNT(*) as total
              FROM outcomes_metrics GROUP BY jurisdiction ORDER BY total DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT state, COUNT(*) as untagged FROM justice_funding
              WHERE (topics IS NULL OR cardinality(topics) = 0) AND source != 'austender-direct'
              GROUP BY state ORDER BY untagged DESC LIMIT 10`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT system_count, COUNT(*) as entities FROM mv_entity_power_index
              GROUP BY system_count ORDER BY system_count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as deserts FROM mv_funding_deserts WHERE desert_score >= 70`,
    })),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (r: any) => r?.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseFirst = (r: any) => (r?.data ?? [])[0] ?? {};

  // Parse estimated counts into entity/relationship totals
  const estCounts = parse(estCountsResult) as { table_name: string; est_rows: number }[];
  const entityCountResult = { data: [{ total: estCounts.find(r => r.table_name === 'gs_entities')?.est_rows ?? 0 }] };
  const relCountResult = { data: [{ total: estCounts.find(r => r.table_name === 'gs_relationships')?.est_rows ?? 0 }] };

  return {
    topicMatrix: parse(topicMatrixResult) as TopicCoverage[],
    almaMatrix: parse(almaMatrixResult) as { topic: string; state: string; records: number }[],
    justice: parseFirst(justiceResult),
    almaLink: parseFirst(almaLinkResult),
    contracts: parseFirst(contractResult),
    donations: parseFirst(donationResult),
    foundations: parseFirst(foundationResult),
    entities: parseFirst(entityCountResult),
    relationships: parseFirst(relCountResult),
    outcomes: parse(outcomesResult) as { state: string; metric_types: number; total: number }[],
    untagged: parse(untaggedResult) as { state: string; untagged: number }[],
    crossSystem: parse(crossSystemResult) as { system_count: number; entities: number }[],
    deserts: parseFirst(desertResult),
  };
}

/* ─── Auto-generate findings ──────────────────────── */

function generateFindings(data: Awaited<ReturnType<typeof getData>>): Finding[] {
  const findings: Finding[] = [];

  // Entity graph scale
  const entityTotal = Number(data.entities.total ?? 0);
  const relTotal = Number(data.relationships.total ?? 0);
  if (entityTotal > 0) {
    findings.push({
      severity: 'strength',
      claim: `${fmt(entityTotal)} entities connected by ${fmt(relTotal)} relationships`,
      evidence: 'Entity graph spans procurement, charities, donations, justice funding, lobbying, boards, and tax data.',
    });
  }

  // Justice funding linkage
  const jPct = Number(data.justice.pct ?? 0);
  if (jPct > 80) {
    findings.push({
      severity: 'strength',
      claim: `${pct(jPct)} of justice funding records linked to known entities`,
      evidence: `${fmt(Number(data.justice.linked))} of ${fmt(Number(data.justice.total))} records resolved to gs_entities via ABN + name matching.`,
    });
  }

  // ALMA evidence coverage
  const aPct = Number(data.almaLink.pct ?? 0);
  findings.push({
    severity: aPct >= 60 ? 'strength' : 'gap',
    claim: `${pct(aPct)} of ALMA interventions linked to CivicGraph entities`,
    evidence: `Evidence database connects to the funding graph — see which orgs have evidence-backed programs.`,
  });

  // Cross-system entities
  const multiSystem = data.crossSystem.filter(c => Number(c.system_count) >= 3);
  const multiCount = multiSystem.reduce((s, c) => s + Number(c.entities), 0);
  if (multiCount > 0) {
    findings.push({
      severity: 'insight',
      claim: `${fmt(multiCount)} entities appear in 3+ government systems`,
      evidence: 'Cross-system presence reveals influence concentration — who gets contracts AND donates AND receives justice funding.',
    });
  }

  // Coverage gaps
  const topicMatrix = data.topicMatrix;
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
  const topics = [...new Set(topicMatrix.map(t => t.topic))];
  const statesWithOrgData = new Set(
    topicMatrix.filter(t => Number(t.records) > 200).map(t => t.state)
  );
  const missingStates = states.filter(s => !statesWithOrgData.has(s));
  if (missingStates.length > 0) {
    findings.push({
      severity: 'gap',
      claim: `${missingStates.join(', ')} lack org-level funding data`,
      evidence: 'Only QLD has granular per-recipient grant data. Other states have aggregate ROGS budget lines only.',
    });
  }

  // Untagged records
  const totalUntagged = data.untagged.reduce((s, u) => s + Number(u.untagged), 0);
  if (totalUntagged > 1000) {
    findings.push({
      severity: 'gap',
      claim: `${fmt(totalUntagged)} funding records still unclassified by topic`,
      evidence: 'These are mostly general-purpose QLD government grants (gambling, sport, small business) that don\'t map to social sector topics.',
    });
  }

  // Funding deserts
  const desertCount = Number(data.deserts.deserts ?? 0);
  if (desertCount > 0) {
    findings.push({
      severity: 'insight',
      claim: `${fmt(desertCount)} LGAs identified as funding deserts`,
      evidence: 'High disadvantage (SEIFA + remoteness) combined with low per-capita funding. Methodology: desert_score = disadvantage × (1 / funding intensity).',
    });
  }

  // Topics coverage
  if (topics.length > 0) {
    findings.push({
      severity: 'strength',
      claim: `${topics.length} topic domains tracked across ${fmt(topicMatrix.length)} state-topic combinations`,
      evidence: `Topics: ${topics.join(', ')}. Each auto-classified by program name via database triggers.`,
    });
  }

  return findings;
}

/* ─── Full Platform Inventory ─────────────────────── */

const DOMAINS = {
  'Entity Graph': [
    { table: 'gs_entities', records: '566K', description: 'Central entity register — orgs, people, government bodies', link: 'abn' },
    { table: 'gs_relationships', records: '1.5M', description: 'Edges: contracts, grants, donations, directorships, lobbying', link: 'entity_id' },
    { table: 'entity_xref', records: '1.2M', description: 'Cross-reference map linking source records to entities', link: 'entity_id' },
    { table: 'gs_entity_aliases', records: '17K', description: 'Alternative names for entity matching', link: 'entity_id' },
    { table: 'entity_identifiers', records: '31K', description: 'ABN, ACN, ORIC ICN, and other identifiers per entity', link: 'entity_id' },
  ],
  'Registries (19.3M)': [
    { table: 'abr_registry', records: '19.9M', description: 'Full Australian Business Register — every ABN in Australia', link: 'abn' },
    { table: 'asic_companies', records: '~2M', description: 'ASIC company register — directors, addresses, status', link: 'abn' },
    { table: 'acnc_charities', records: '64K', description: 'ACNC charity register — purposes, beneficiaries, size', link: 'abn' },
    { table: 'acnc_ais', records: '~250K', description: 'ACNC Annual Information Statements — revenue, staff, volunteers', link: 'abn' },
    { table: 'acnc_programs', records: '98K', description: 'Programs run by registered charities', link: 'fk' },
    { table: 'oric_corporations', records: '7.4K', description: 'ORIC Indigenous corporation register', link: 'abn' },
    { table: 'asx_companies', records: '2.3K', description: 'ASX-listed companies', link: 'abn' },
  ],
  'Procurement ($200B+)': [
    { table: 'austender_contracts', records: '791K', description: 'Federal AusTender procurement — buyer, supplier, value, dates', link: 'abn' },
    { table: 'state_tenders', records: '200K', description: 'NSW + QLD state procurement contracts', link: 'abn' },
    { table: 'ndis_registered_providers', records: '49K', description: 'NDIS registered service providers', link: 'abn' },
    { table: 'ndis_active_providers', records: '~30K', description: 'Currently active NDIS providers with service types', link: 'abn' },
  ],
  'Funding & Grants': [
    { table: 'justice_funding', records: '145K', description: 'Justice + social sector grants — state & federal, 9 topics', link: 'entity_id' },
    { table: 'grant_opportunities', records: '30K', description: 'Open + closed grant rounds — amounts, deadlines, categories', link: 'none' },
    { table: 'foundations', records: '10.8K', description: 'Philanthropic foundations — giving, focus areas, programs', link: 'abn' },
    { table: 'foundation_programs', records: '~2.5K', description: 'Foundation grant programs with eligibility and focus', link: 'fk' },
    { table: 'research_grants', records: '~5K', description: 'ARC/NHMRC research grants', link: 'none' },
  ],
  'Influence & Accountability': [
    { table: 'political_donations', records: '313K', description: 'AEC political donation disclosures — donor, party, amount', link: 'abn' },
    { table: 'ato_tax_transparency', records: '24K', description: 'ATO corporate tax transparency — income, tax payable', link: 'abn' },
    { table: 'civic_hansard', records: '135', description: 'QLD parliamentary Hansard mentions of justice programs', link: 'none' },
    { table: 'civic_ministerial_diaries', records: '1.7K', description: 'Ministerial diary entries — who ministers meet', link: 'none' },
    { table: 'civic_ministerial_statements', records: '607', description: 'Ministerial media statements on youth justice', link: 'none' },
    { table: 'oversight_recommendations', records: '43', description: 'Oversight body recommendations (QLD Inspector-General etc)', link: 'none' },
  ],
  'People & Governance': [
    { table: 'person_roles', records: '340K', description: 'Board members, directors, trustees — ACNC, ASIC, foundations', link: 'entity_id' },
    { table: 'person_identity_map', records: '~9K', description: 'De-duplicated person identities across sources', link: 'fk' },
    { table: 'person_entity_links', records: '~1.5K', description: 'Verified person-to-entity connections', link: 'entity_id' },
  ],
  'Evidence & Outcomes': [
    { table: 'alma_interventions', records: '1.4K', description: 'ALMA evidence-based programs — 10 types, linked to orgs', link: 'entity_id' },
    { table: 'alma_evidence', records: '570', description: 'Evidence records — methodology, sample size, effect size', link: 'fk' },
    { table: 'alma_outcomes', records: '506', description: 'Measured outcomes per intervention', link: 'fk' },
    { table: 'outcomes_metrics', records: '9.2K', description: 'ROGS + AIHW structured indicators — rates, costs, trends', link: 'none' },
    { table: 'aihw_child_protection', records: '3K', description: 'AIHW child protection notifications and substantiations', link: 'none' },
    { table: 'crime_stats_lga', records: '58K', description: 'Crime statistics by LGA — offence types, counts, rates', link: 'fk' },
  ],
  'Social & Disability': [
    { table: 'ndis_utilisation', records: '144K', description: 'NDIS plan utilisation by service type, state, cohort', link: 'none' },
    { table: 'ndis_participants', records: '67K', description: 'NDIS participant counts by LGA, age, disability type', link: 'none' },
    { table: 'ndis_participants_lga', records: '8.3K', description: 'NDIS participants aggregated by LGA', link: 'fk' },
    { table: 'ndis_market_concentration', records: '~12K', description: 'NDIS market share by provider and region', link: 'none' },
    { table: 'dss_payment_demographics', records: '106K', description: 'Federal welfare payment demographics by region', link: 'none' },
    { table: 'social_enterprises', records: '~800', description: 'Social enterprise directory', link: 'abn' },
    { table: 'acara_schools', records: '9.8K', description: 'School profiles — ICSEA, enrolment, Indigenous %', link: 'none' },
  ],
  'Geography & Disadvantage': [
    { table: 'postcode_geo', records: '12K', description: 'Postcode → SA2, LGA, remoteness classification', link: 'none' },
    { table: 'lga_cross_system_stats', records: '360', description: 'Per-LGA aggregates across all data systems', link: 'fk' },
  ],
} as const;

const DOMAIN_COLORS: Record<string, string> = {
  'Entity Graph': 'bg-bauhaus-black',
  'Registries (19.3M)': 'bg-green-500',
  'Procurement ($200B+)': 'bg-bauhaus-blue',
  'Funding & Grants': 'bg-yellow-500',
  'Influence & Accountability': 'bg-bauhaus-red',
  'People & Governance': 'bg-purple-500',
  'Evidence & Outcomes': 'bg-pink-500',
  'Social & Disability': 'bg-teal-500',
  'Geography & Disadvantage': 'bg-orange-500',
};

/* ─── Page ────────────────────────────────────────── */

export default async function ClarityPage() {
  const data = await getData();
  const findings = generateFindings(data);

  // Build topic × state matrix
  const topics = [...new Set(data.topicMatrix.map(t => t.topic))].sort();
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

  const topicMap = new Map<string, number>();
  for (const row of data.topicMatrix) {
    topicMap.set(`${row.topic}:${row.state}`, Number(row.records));
  }

  // Build ALMA topic × state matrix
  const almaTopics = [...new Set(data.almaMatrix.map(t => t.topic))].sort();
  const almaMap = new Map<string, number>();
  for (const row of data.almaMatrix) {
    almaMap.set(`${row.topic}:${row.state}`, Number(row.records));
  }

  // System linkage data
  const systems: SystemLink[] = [
    {
      name: 'Justice Funding',
      table: 'justice_funding',
      records: Number(data.justice.total ?? 0),
      linkage_pct: Number(data.justice.pct ?? 0),
      description: 'State & federal justice program grants linked to entities via ABN',
    },
    {
      name: 'ALMA Interventions',
      table: 'alma_interventions',
      records: Number(data.almaLink.total ?? 0),
      linkage_pct: Number(data.almaLink.pct ?? 0),
      description: 'Evidence-based program database linked to delivering organisations',
    },
    {
      name: 'Federal Contracts',
      table: 'austender_contracts',
      records: Number(data.contracts.total ?? 0),
      linkage_pct: Number(data.contracts.pct ?? 0),
      description: 'AusTender procurement records linked to suppliers via ABN',
    },
    {
      name: 'Political Donations',
      table: 'political_donations',
      records: Number(data.donations.total ?? 0),
      linkage_pct: Number(data.donations.pct ?? 0),
      description: 'AEC donation disclosures linked to donor entities via ABN',
    },
    {
      name: 'Foundations',
      table: 'foundations',
      records: Number(data.foundations.total ?? 0),
      linkage_pct: Number(data.foundations.pct ?? 0),
      description: 'Philanthropic foundations linked to ACNC charity register via ABN',
    },
  ];

  // Outcomes coverage
  const outcomesMap = new Map<string, { metric_types: number; total: number }>();
  for (const row of data.outcomes) {
    outcomesMap.set(row.state, { metric_types: Number(row.metric_types), total: Number(row.total) });
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-blue mt-6 mb-1 uppercase tracking-widest">Transparency</div>
        <h1 className="text-3xl sm:text-5xl font-black text-bauhaus-black mb-4">
          Data Clarity
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How CivicGraph connects public data to make government spending, influence, and outcomes visible.
          Every claim we make is traceable to data. Here is what we have, where it connects, and where gaps remain.
        </p>
      </div>

      {/* ─── Section 1: Full Platform Inventory ─────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">The Full Platform</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(Number(data.entities.total ?? 0))} entities connected by {fmt(Number(data.relationships.total ?? 0))} relationships,
          drawn from {Object.keys(DOMAINS).reduce((s, d) => s + DOMAINS[d as keyof typeof DOMAINS].length, 0)} data systems
          across government registries, procurement, funding, influence, and evidence.
          All connected through ABN as the universal join key.
        </p>

        {Object.entries(DOMAINS).map(([domain, tables]) => (
          <div key={domain} className="mb-6">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${DOMAIN_COLORS[domain as keyof typeof DOMAIN_COLORS]}`} />
              {domain}
            </h3>
            <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left p-2 font-black uppercase tracking-widest">Table</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Records</th>
                    <th className="text-left p-2 font-black uppercase tracking-widest">What It Contains</th>
                    <th className="text-center p-2 font-black uppercase tracking-widest">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t, i) => (
                    <tr key={t.table} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 font-mono font-bold text-bauhaus-black">{t.table}</td>
                      <td className="p-2 text-right font-mono">{t.records}</td>
                      <td className="p-2 text-bauhaus-muted">{t.description}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          t.link === 'abn' ? 'bg-green-500' :
                          t.link === 'entity_id' ? 'bg-bauhaus-blue' :
                          t.link === 'fk' ? 'bg-yellow-500' :
                          'bg-gray-300'
                        }`} title={t.link} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="text-xs text-bauhaus-muted">
          Link key:{' '}
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 align-middle" /> ABN join{' '}
          <span className="inline-block w-2 h-2 rounded-full bg-bauhaus-blue mr-1 ml-2 align-middle" /> Entity ID FK{' '}
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1 ml-2 align-middle" /> Other FK{' '}
          <span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1 ml-2 align-middle" /> Standalone
        </p>
      </section>

      {/* ─── Section 2: Interactive Schema Graph ──────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">How It Connects</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Interactive data model graph. Each node is a table, sized by record count.
          Edges show how tables connect — via ABN, entity ID, or foreign key.
          Click a domain to filter. Drag to explore. Scroll to zoom.
        </p>
        <SchemaGraph />
      </section>

      {/* ─── Section 3: System Linkage ─────────────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Entity Linkage</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          How well each major data system connects to the central entity graph.
          Higher linkage = more cross-system queries possible.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          {systems.map((sys, i) => (
            <div key={sys.table} className={`border-4 border-bauhaus-black p-5 bg-white
              ${i % 3 !== 0 ? 'lg:border-l-0' : ''}
              ${i % 2 !== 0 && i % 3 !== 0 ? '' : i % 2 !== 0 ? 'sm:border-l-0 lg:border-l-4' : ''}
              ${i >= 3 ? 'border-t-0' : i >= 2 ? 'sm:border-t-0' : ''}
            `}>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">{sys.name}</div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`text-3xl font-black ${linkageColor(sys.linkage_pct)}`}>
                  {pct(sys.linkage_pct)}
                </span>
                <span className="text-sm text-bauhaus-muted font-mono">{fmt(sys.records)}</span>
              </div>
              <div className="w-full bg-gray-100 h-2 mb-2">
                <div className={`h-2 ${linkageBg(sys.linkage_pct)}`} style={{ width: `${Math.min(sys.linkage_pct, 100)}%` }} />
              </div>
              <p className="text-xs text-bauhaus-muted">{sys.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Section 3: Coverage Heatmap ───────────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Funding Coverage</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          State-by-topic matrix showing how many org-level funding records exist.
          Dark green = rich data. Red = thin. Grey = no data. Excludes aggregate ROGS rows.
        </p>

        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-2 font-black uppercase tracking-widest">Topic</th>
                {states.map(s => (
                  <th key={s} className="text-center p-2 font-black uppercase tracking-widest w-16">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topics.map((topic, i) => (
                <tr key={topic} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 font-bold text-bauhaus-black whitespace-nowrap">{topic}</td>
                  {states.map(state => {
                    const count = topicMap.get(`${topic}:${state}`) ?? 0;
                    return (
                      <td key={state} className={`p-2 text-center font-mono font-bold ${heatColor(count)}`}>
                        {count === 0 ? '—' : fmt(count)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-bauhaus-muted mt-2">
          <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 mr-1 align-middle" /> 1000+{' '}
          <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 mr-1 ml-2 align-middle" /> 500-999{' '}
          <span className="inline-block w-3 h-3 bg-yellow-100 border border-yellow-300 mr-1 ml-2 align-middle" /> 100-499{' '}
          <span className="inline-block w-3 h-3 bg-orange-100 border border-orange-300 mr-1 ml-2 align-middle" /> 10-99{' '}
          <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 mr-1 ml-2 align-middle" /> 1-9{' '}
          <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 mr-1 ml-2 align-middle" /> None
        </p>
      </section>

      {/* ─── Section 4: Evidence Coverage (ALMA) ───── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Evidence Coverage</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Australian Living Map of Alternatives (ALMA) — evidence-based interventions mapped by topic and geography.
          This is the &ldquo;what works&rdquo; layer that sits on top of the funding data.
        </p>

        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-2 font-black uppercase tracking-widest">Topic</th>
                {[...states, 'National'].map(s => (
                  <th key={s} className="text-center p-2 font-black uppercase tracking-widest w-14">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {almaTopics.map((topic, i) => (
                <tr key={topic} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 font-bold text-bauhaus-black whitespace-nowrap">{topic}</td>
                  {[...states, 'National'].map(state => {
                    const count = almaMap.get(`${topic}:${state}`) ?? 0;
                    return (
                      <td key={state} className={`p-2 text-center font-mono font-bold ${heatColor(count)}`}>
                        {count === 0 ? '—' : count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Section 5: Outcomes Metrics Coverage ──── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Outcomes Metrics</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          ROGS + AIHW structured indicators: detention rates, costs, recidivism, self-harm, staffing.
          This is the most uniform dataset — all states have comparable coverage.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-0">
          {states.map((state, i) => {
            const d = outcomesMap.get(state);
            return (
              <div key={state} className={`border-4 border-bauhaus-black p-4 bg-white text-center
                ${i > 0 ? 'border-l-0' : ''}
              `}>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">{state}</div>
                <div className="text-2xl font-black text-bauhaus-black">{d ? fmt(d.total) : '—'}</div>
                <div className="text-xs text-bauhaus-muted">{d ? `${d.metric_types} types` : ''}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Section 6: Findings ───────────────────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">What the Data Shows</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Auto-generated findings from live data. Every claim links to evidence.
        </p>

        <div className="space-y-0">
          {findings.map((f, i) => (
            <div key={i} className={`border-4 border-bauhaus-black p-5 bg-white ${i > 0 ? 'border-t-0' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`inline-block mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                  f.severity === 'strength' ? 'bg-green-500' :
                  f.severity === 'gap' ? 'bg-bauhaus-red' :
                  'bg-bauhaus-blue'
                }`} />
                <div>
                  <div className="font-black text-bauhaus-black text-sm">{f.claim}</div>
                  <div className="text-xs text-bauhaus-muted mt-1">{f.evidence}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-bauhaus-muted mt-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1 align-middle" /> Strength{' '}
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-bauhaus-red mr-1 ml-3 align-middle" /> Gap{' '}
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-bauhaus-blue mr-1 ml-3 align-middle" /> Insight
        </p>
      </section>

      {/* ─── Section 7: Methodology ────────────────── */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black text-bauhaus-yellow mb-4 uppercase tracking-widest">How This Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-black text-white mb-2">Entity Resolution</h3>
              <p className="text-white/70 leading-relaxed">
                The Australian Business Number (ABN) is the universal join key.
                We resolve 559K+ entities from 8 government data systems using ABN matching
                and normalised name fuzzy-matching against ASIC + ACNC registers.
              </p>
            </div>
            <div>
              <h3 className="font-black text-white mb-2">Topic Classification</h3>
              <p className="text-white/70 leading-relaxed">
                Database triggers auto-classify records into {topics.length} topic domains
                based on program name keywords. No ML — deterministic pattern matching
                that can be audited. Triggers fire on INSERT and UPDATE.
              </p>
            </div>
            <div>
              <h3 className="font-black text-white mb-2">Open Data Sources</h3>
              <p className="text-white/70 leading-relaxed">
                All data is from public government sources: AusTender, AEC, ACNC, ATO,
                ROGS, AIHW, state grant portals, parliamentary hansard, and lobbying registers.
                No proprietary data. Fully reproducible.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
