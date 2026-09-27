import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  Database,
  ExternalLink,
  FileSpreadsheet,
  MapPinned,
  Network,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { getWaTransitionReport } from '@/lib/services/wa-transition-report';
import { RegionMap } from './region-map';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'WA ACCO Transition Evidence | CivicGraph',
  description:
    'A source-led view of Western Australian ACCO transition evidence, procurement coverage, justice data and the path to a governed Kimberley pilot.',
};

const INVENTORY_LABELS: Record<string, string> = {
  entities: 'WA entities',
  community_controlled: 'Community-controlled signals',
  oric: 'ORIC corporations',
  charities_registered: 'Registered charities',
  social_enterprises: 'Social enterprises',
  justice_funding_rows: 'Justice funding rows',
  alma_interventions: 'WA-linked interventions',
  goods_places: 'Goods place records',
  state_contracts: 'WA state contracts',
  portal_contracts: 'Portal contracts',
  data_wa_contracts: 'Annual open-data contracts',
  dcsp_contracts: 'Official DCSP contracts',
  aboriginal_participation_contracts: 'Aboriginal participation requirements',
  aer_programs: 'Official AER programs',
  wa_source_frontier: 'WA evidence sources tracked',
};

const SOURCE_LABELS: Record<string, string> = {
  'austender-direct': 'Federal contracts',
  'foundation-notable-grants': 'Foundation narratives',
  'niaa-senate-order-16': 'NIAA grants',
  'rogs-yj-expenditure': 'ROGS expenditure',
  'prf-jr-portfolio-review-2025': 'Justice reinvestment portfolio',
  'wa-budget-2024': 'WA Budget announcements',
  'aihw-yj': 'AIHW youth justice',
  'dusseldorp-yir-2025': 'Youth investment review',
};

const FAMILY_LABELS: Record<string, string> = {
  youth_justice: 'Youth justice',
  child_family: 'Children and families',
  housing_homelessness: 'Housing and homelessness',
  health_mental_health: 'Health and mental health',
  disability: 'Disability',
  family_domestic_violence: 'Family and domestic violence',
  employment_training: 'Employment and training',
  community_services: 'Community services',
  cultural_services: 'Cultural services',
  other: 'Other',
};

const STAGES = [
  {
    number: '01',
    title: 'Aboriginal expenditure',
    status: 'Ingested + verified',
    tone: 'blue',
    body: 'The official workbook is preserved by file hash and reconciled row-for-row. It is a program inventory, not a contract or expenditure ledger.',
    evidence: 'Direct XLSX · 473 rows · immutable manifest',
  },
  {
    number: '02',
    title: 'Kimberley public evidence',
    status: 'Research assembled',
    tone: 'black',
    body: 'Connect KJJS initiatives, public evaluations, organisations, places and announcements without inferring authority or demand.',
    evidence: 'KWAC, MG Corporation, Wunan, KJJS',
  },
  {
    number: '03',
    title: 'WA procurement',
    status: 'Workbench live',
    tone: 'red',
    body: 'The public award feed, annual files and a bounded forward-plan capture are preserved with stable references, dates, regions and review states. Every held contract has an auditable classification decision.',
    evidence: '17,055 awards · 5 Kimberley forward plans · public sources',
  },
  {
    number: '04',
    title: 'Bounded classification',
    status: 'Second opinion held',
    tone: 'yellow',
    body: 'Deterministic rules produced a 283-record queue. Jev reviewed only that bounded set: 154 retain, 57 need review and 72 likely exclude. No review decision was written automatically.',
    evidence: '136 low-confidence · all 54 Kimberley records inspected',
  },
  {
    number: '05',
    title: 'Governance review',
    status: 'Permission required',
    tone: 'black',
    body: 'Test definitions, corrections, access and usefulness with CASWA and the relevant local organisations before building a pilot.',
    evidence: 'Private walkthrough before publication',
  },
  {
    number: '06',
    title: 'One governed pilot',
    status: 'Not started',
    tone: 'muted',
    body: 'One place, one service family and one accountable owner. Every record carries provenance, uncertainty and a human next action.',
    evidence: 'Kununurra is a candidate, not a selection',
  },
] as const;

const KIMBERLEY_NETWORK = [
  {
    name: 'KWAC',
    role: 'Youth Circuit Breaker, cultural programs and Coolamon Centre partner',
    href: 'https://kwac.com.au/',
  },
  {
    name: 'MG Corporation',
    role: 'Miriwoong and Gajerrong organisation, youth, housing and Target 120 delivery',
    href: 'https://mgcorp.com.au/our-initiatives/',
  },
  {
    name: 'Wunan Foundation',
    role: 'Education, employment, housing, health, enterprise and Coolamon partner',
    href: 'https://www.wunan.org.au/',
  },
  {
    name: 'Kimberley Juvenile Justice Strategy',
    role: '$81m across six State Budgets through June 2030; most initiatives ACCO-led',
    href: 'https://www.wa.gov.au/organisation/department-of-justice/kimberley-juvenile-justice-strategy',
  },
] as const;

function fmt(value: number): string {
  return Number(value || 0).toLocaleString('en-AU');
}

function money(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}b`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

function pct(value: number, total: number): string {
  return total ? `${Math.round((value / total) * 100)}%` : '0%';
}

function stageTone(tone: (typeof STAGES)[number]['tone']): string {
  return {
    blue: 'border-bauhaus-blue bg-blue-50 text-bauhaus-blue',
    black: 'border-bauhaus-black bg-white text-bauhaus-black',
    red: 'border-bauhaus-red bg-red-50 text-bauhaus-red',
    yellow: 'border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black',
    muted: 'border-bauhaus-black/30 bg-gray-50 text-bauhaus-muted',
  }[tone];
}

export default async function WaAccoTransitionPage() {
  const report = await getWaTransitionReport();
  const inventory = new Map(report.inventory.map((row) => [row.metric, Number(row.value)]));
  const currentWaAwardWindow = Number(report.frontier?.window_contracts ?? 0);
  const historicalWaContracts = Math.max(0, (inventory.get('portal_contracts') ?? 0) - currentWaAwardWindow);
  const stateCoverage = ['QLD', 'NSW', 'VIC', 'SA', 'WA'].map((state) => {
    const row = report.stateCoverage.find((item) => item.state === state);
    return {
      state,
      contracts: Number(row?.contracts ?? 0),
      suppliersWithAbn: Number(row?.suppliers_with_abn ?? 0),
      recordedValue: Number(row?.recorded_value ?? 0),
    };
  });
  const maxStateContracts = Math.max(...stateCoverage.map((row) => row.contracts), 1);
  const almaTotal = report.almaQuality.reduce((sum, row) => sum + Number(row.records), 0);
  const almaCommunityVerified = report.almaQuality
    .filter((row) => row.verification_status === 'community_verified')
    .reduce((sum, row) => sum + Number(row.records), 0);
  const almaAiGenerated = report.almaQuality
    .filter((row) => row.verification_status === 'ai_generated')
    .reduce((sum, row) => sum + Number(row.records), 0);
  const lastChecked = report.frontier?.last_checked_at
    ? new Date(report.frontier.last_checked_at).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : 'Not recorded';
  const historicalCoverage = report.frontier?.historical_coverage_from && report.frontier?.historical_coverage_to
    ? `${new Date(`${report.frontier.historical_coverage_from}T00:00:00+08:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} to ${new Date(`${report.frontier.historical_coverage_to}T00:00:00+08:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'No complete historical range';

  return (
    <main className="mx-auto max-w-[1500px] pb-20">
      <Link
        href="/reports/wa"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
      >
        &larr; Western Australia
      </Link>

      <section className="mt-5 border-4 border-bauhaus-black bg-white">
        <div className="grid lg:grid-cols-[1.4fr_0.6fr]">
          <div className="border-b-4 border-bauhaus-black p-6 sm:p-9 lg:border-b-0 lg:border-r-4">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="border-2 border-bauhaus-red bg-bauhaus-red px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Current evidence surface
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Western Australia · 27 Sep 2026 research frame
              </span>
            </div>
            <h1 className="max-w-5xl text-4xl font-black leading-[0.98] text-bauhaus-black sm:text-6xl">
              From public records to a governed ACCO transition map
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
              CivicGraph now connects WA contracts, transition timing, organisations, justice records, programs and places.
              The workbench identifies records for human review. It does not decide ACCO readiness, local authority or permission to engage.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1">
            <div className="border-r-4 border-bauhaus-black bg-bauhaus-black p-5 text-white lg:border-b-4 lg:border-r-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Official commitment</div>
              <div className="mt-2 text-4xl font-black">$5.8m</div>
              <div className="mt-2 text-xs font-bold leading-relaxed text-white/70">ACCO Transition Pipeline under WA Closing the Gap 2026-28</div>
            </div>
            <div className="bg-bauhaus-red p-5 text-white">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Current WA award window</div>
              <div className="mt-2 text-4xl font-black">{fmt(currentWaAwardWindow)}</div>
              <div className="mt-2 text-xs font-bold leading-relaxed text-white/80">Recently awarded Tenders WA contracts ingested. Six historical months are complete; earlier awards and variations remain outside the boundary.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-red">Transition workbench</p>
            <h2 className="mt-2 text-3xl font-black text-bauhaus-black">From {fmt(inventory.get('state_contracts') ?? 0)} contracts to a bounded review queue</h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Deterministic rules keep every positive and exclusion signal. Candidate means inspect the contract. It does not mean suitable to transition.
          </p>
        </div>

        <div className="grid border-4 border-bauhaus-black sm:grid-cols-3">
          {report.transitionDecisions.map((decision, index) => (
            <div key={decision.candidate_status} className={`p-5 ${index < report.transitionDecisions.length - 1 ? 'border-b-2 border-bauhaus-black sm:border-b-0 sm:border-r-2' : ''} ${decision.candidate_status === 'candidate' ? 'bg-bauhaus-red text-white' : decision.candidate_status === 'review' ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-white text-bauhaus-black'}`}>
              <div className="text-4xl font-black tabular-nums">{fmt(Number(decision.records))}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest">{decision.candidate_status}</div>
              <div className="mt-3 text-xs font-bold opacity-70">{money(Number(decision.recorded_value))} recorded value</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid border-4 border-bauhaus-black bg-white sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Supplier components', report.entityResolution.supplier_components, 'Every published supplier split from panels'],
            ['Graph linked', report.entityResolution.matched, 'Unique deterministic entity links'],
            ['Identity backed', report.entityResolution.registry_backed + report.entityResolution.sourced_alias, `${fmt(report.entityResolution.registry_backed)} registry · ${fmt(report.entityResolution.sourced_alias)} sourced aliases`],
            ['Needs identity review', report.entityResolution.ambiguous, 'More than one exact entity candidate'],
            ['Queue linked', report.entityResolution.transition_queue_linked, `${fmt(report.entityResolution.transition_queue_community_signals)} community-controlled signals`],
          ].map(([label, value, detail], index) => (
            <div key={String(label)} className={`p-4 ${index < 4 ? 'border-b-2 border-bauhaus-black sm:border-r-2 lg:border-b-0' : ''}`}>
              <div className="font-mono text-2xl font-black tabular-nums">{fmt(Number(value))}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest">{label}</div>
              <div className="mt-2 text-[10px] font-bold leading-relaxed text-bauhaus-muted">{detail}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-bold leading-relaxed text-bauhaus-muted">
          The resolver leaves {fmt(report.entityResolution.unmatched)} supplier components unresolved and {fmt(report.entityResolution.ambiguous)} ambiguous.
          In the Kimberley queue, {fmt(report.entityResolution.kimberley_linked)} of 54 contracts link to an entity and {fmt(report.entityResolution.kimberley_community_signals)} carry a community-controlled discovery signal.
        </p>

        <div className="mt-8 border-4 border-bauhaus-black bg-white">
          <div className="grid border-b-4 border-bauhaus-black lg:grid-cols-[1fr_auto]">
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Forward procurement · public display</p>
              <h3 className="mt-2 text-2xl font-black">Four human-service plans now have a review path</h3>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                The September 2026 public plan contains five Kimberley rows labelled Community Services. Four describe human services. One describes airstrip works and is retained as a source-classification anomaly.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t-4 border-bauhaus-black lg:border-l-4 lg:border-t-0">
              <div className="border-r-2 border-bauhaus-black bg-blue-50 p-5 text-bauhaus-blue">
                <div className="text-4xl font-black">{fmt(report.kimberleyForwardProcurements.filter((row) => row.review_classification === 'human_services_review').length)}</div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-widest">Human-service review</div>
              </div>
              <div className="bg-red-50 p-5 text-bauhaus-red">
                <div className="text-4xl font-black">{fmt(report.kimberleyForwardProcurements.filter((row) => row.review_classification === 'source_classification_anomaly').length)}</div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-widest">Source anomaly</div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="border-b-2 border-bauhaus-black bg-gray-100 text-[9px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-3">Planned procurement</th>
                  <th className="p-3">Agency</th>
                  <th className="p-3">Release</th>
                  <th className="p-3">Evidence state</th>
                  <th className="p-3">Next authority</th>
                </tr>
              </thead>
              <tbody>
                {report.kimberleyForwardProcurements.map((item) => (
                  <tr key={item.source_ref} className="border-b-2 border-bauhaus-black last:border-b-0">
                    <td className="max-w-[300px] p-3 align-top">
                      <a href={item.source_report_url} target="_blank" rel="noreferrer" className="font-black leading-snug hover:text-bauhaus-red">{item.title}</a>
                      <div className="mt-1 font-mono text-[9px] text-bauhaus-muted">{item.source_ref} · {item.unspsc_title ?? 'No category published'}</div>
                    </td>
                    <td className="p-3 align-top font-bold">{item.parent_agency}</td>
                    <td className="whitespace-nowrap p-3 align-top font-mono font-black">{item.release_financial_year ?? 'Unknown'}</td>
                    <td className="max-w-[260px] p-3 align-top">
                      <div className={`text-[9px] font-black uppercase tracking-widest ${item.review_classification === 'source_classification_anomaly' ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>
                        {item.review_classification === 'source_classification_anomaly' ? 'Source anomaly' : 'Verified plan · review signal'}
                      </div>
                      <p className="mt-1 font-medium leading-relaxed text-bauhaus-muted">{item.review_reason}</p>
                    </td>
                    <td className="max-w-[220px] p-3 align-top font-bold leading-relaxed">
                      {item.existing_contract_number
                        ? `Validate exact contract link: ${item.existing_contract_number}`
                        : item.review_classification === 'source_classification_anomaly'
                          ? 'Report owner to clarify classification'
                          : 'Agency owner, incumbent and local ACCO authority'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs font-bold leading-relaxed">
            These are planned procurements, not awards or guaranteed tenders. The public display does not expose a supported row-level export, incumbent contract number, value band, quarter, term or contact in this bounded capture. Those fields remain explicit acquisition gaps.
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="border-b-4 border-bauhaus-black p-4">
              <h3 className="text-lg font-black">Candidate and review families</h3>
              <p className="mt-1 text-xs font-medium text-bauhaus-muted">Machine-routed, awaiting human confirmation</p>
            </div>
            {report.transitionFamilies.map((family, index) => (
              <div key={family.service_family} className={`grid grid-cols-[1fr_auto] gap-4 p-4 ${index < report.transitionFamilies.length - 1 ? 'border-b-2 border-bauhaus-black' : ''}`}>
                <div>
                  <div className="text-sm font-black">{FAMILY_LABELS[family.service_family] ?? family.service_family}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">{money(Number(family.recorded_value))} recorded</div>
                </div>
                <div className="font-mono text-lg font-black">{fmt(Number(family.records))}</div>
              </div>
            ))}
          </div>

          <div className="min-w-0 border-4 border-bauhaus-black bg-white">
            <div className="border-b-4 border-bauhaus-black bg-bauhaus-black p-4 text-white">
              <h3 className="text-lg font-black">Kimberley review queue</h3>
              <p className="mt-1 text-xs font-medium text-white/65">Source-published Kimberley region only · no inferred geography</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b-2 border-bauhaus-black bg-gray-100 text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-3">Contract</th>
                    <th className="p-3">Service family</th>
                    <th className="p-3">Supplier evidence</th>
                    <th className="p-3 text-right">Value</th>
                    <th className="p-3">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {report.kimberleyCandidates.map((candidate) => (
                    <tr key={candidate.source_contract_id} className="border-b-2 border-bauhaus-black last:border-b-0">
                      <td className="max-w-[310px] p-3 align-top">
                        <a href={candidate.source_url} target="_blank" rel="noreferrer" className="font-black leading-snug hover:text-bauhaus-red">
                          {candidate.title}
                        </a>
                        <div className="mt-1 font-mono text-[9px] text-bauhaus-muted">WA {candidate.source_contract_id} · {candidate.candidate_status}</div>
                      </td>
                      <td className="p-3 align-top font-bold">{FAMILY_LABELS[candidate.service_family] ?? candidate.service_family}</td>
                      <td className="max-w-[220px] p-3 align-top">
                        <div className="font-bold">{candidate.supplier_name ?? 'Not published'}</div>
                        <div className={`mt-1 text-[9px] font-black uppercase tracking-widest ${candidate.supplier_is_community_controlled === true ? 'text-bauhaus-blue' : 'text-bauhaus-muted'}`}>
                          {candidate.supplier_is_community_controlled === true
                            ? 'Community-controlled entity signal'
                            : candidate.entity_match_status === 'matched'
                              ? 'Entity matched, not ACCO-flagged'
                              : `${candidate.entity_match_status} entity`}
                        </div>
                      </td>
                      <td className="p-3 text-right align-top font-mono font-black">{money(Number(candidate.contract_value))}</td>
                      <td className="whitespace-nowrap p-3 align-top font-bold">
                        {candidate.expiry_date ? new Date(candidate.expiry_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : 'Unknown'}
                        <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{candidate.transition_window.replaceAll('_', ' ')}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t-4 border-bauhaus-black bg-blue-50 p-4 text-xs font-bold leading-relaxed text-bauhaus-blue">
              Community-controlled is a CivicGraph discovery signal from a unique entity match. It is not a CASWA-approved ACCO determination. Human review and local authority remain required.
            </div>
          </div>
        </div>
      </section>

      {report.error && (
        <div className="mt-5 flex items-start gap-3 border-4 border-bauhaus-red bg-red-50 p-4 text-sm font-bold text-bauhaus-red">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          Live data is partially unavailable: {report.error}
        </div>
      )}

      <section className="mt-12">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-blue">The work, in order</p>
            <h2 className="mt-2 text-3xl font-black text-bauhaus-black">Six gates from evidence to engagement</h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Each gate has a different owner and evidence standard. More records do not move the work forward when provenance, authority or correction rights are absent.
          </p>
        </div>
        <div className="grid gap-0 border-4 border-bauhaus-black lg:grid-cols-3">
          {STAGES.map((stage, index) => (
            <article
              key={stage.number}
              className={`min-h-[260px] p-5 ${stageTone(stage.tone)} ${index % 3 !== 2 ? 'lg:border-r-4 lg:border-bauhaus-black' : ''} ${index < 3 ? 'border-b-4 border-bauhaus-black' : index !== 5 ? 'border-b-4 border-bauhaus-black lg:border-b-0' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="font-mono text-4xl font-black">{stage.number}</span>
                <span className="border-2 border-current px-2 py-1 text-[9px] font-black uppercase tracking-widest">
                  {stage.status}
                </span>
              </div>
              <h3 className="mt-7 text-xl font-black uppercase tracking-widest">{stage.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed opacity-80">{stage.body}</p>
              <div className="mt-5 border-t-2 border-current/20 pt-3 text-[10px] font-black uppercase tracking-widest opacity-70">
                {stage.evidence}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Database className="h-6 w-6 text-bauhaus-blue" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Live CivicGraph inventory</p>
              <h2 className="text-2xl font-black text-bauhaus-black">What is already held</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 border-4 border-bauhaus-black sm:grid-cols-3">
            {report.inventory.map((row, index) => (
              <div
                key={row.metric}
                className={`min-h-[130px] p-4 ${index % 3 !== 2 ? 'sm:border-r-2 sm:border-bauhaus-black' : ''} ${index < 6 ? 'border-b-2 border-bauhaus-black' : ''} ${row.metric === 'state_contracts' ? 'bg-red-50 text-bauhaus-red' : 'bg-white text-bauhaus-black'}`}
              >
                <div className="text-3xl font-black tabular-nums">{fmt(Number(row.value))}</div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                  {INVENTORY_LABELS[row.metric] ?? row.metric}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-3">
            <Building2 className="h-6 w-6 text-bauhaus-red" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Cohort quality</p>
              <h2 className="text-2xl font-black text-bauhaus-black">2,223 signals are not a verified register</h2>
            </div>
          </div>
          <div className="border-4 border-bauhaus-black bg-white">
            {[
              ['ABN present', report.accoCoverage.with_abn],
              ['LGA present', report.accoCoverage.with_lga],
              ['Sector present', report.accoCoverage.with_sector],
              ['Description present', report.accoCoverage.with_description],
              ['Website present', report.accoCoverage.with_website],
              ['Two or more sources', report.accoCoverage.multisource],
            ].map(([label, value], index) => {
              const count = Number(value);
              const percentage = report.accoCoverage.organisations
                ? (count / report.accoCoverage.organisations) * 100
                : 0;
              return (
                <div key={String(label)} className={`p-4 ${index < 5 ? 'border-b-2 border-bauhaus-black' : ''}`}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-xs font-black uppercase tracking-widest">
                    <span>{label}</span>
                    <span>{fmt(count)} · {Math.round(percentage)}%</span>
                  </div>
                  <div className="h-3 border-2 border-bauhaus-black bg-gray-100">
                    <div className="h-full bg-bauhaus-blue" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-red">State comparison</p>
            <h2 className="mt-2 text-3xl font-black text-bauhaus-black">The WA gap is visible because other states have records</h2>
          </div>
          <Link href="/reports/state-procurement" className="hidden items-center gap-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red sm:flex">
            State procurement report <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="border-4 border-bauhaus-black bg-white">
          {stateCoverage.map((row, index) => (
            <div key={row.state} className={`grid gap-3 p-4 sm:grid-cols-[80px_1fr_160px_160px] sm:items-center ${index < stateCoverage.length - 1 ? 'border-b-2 border-bauhaus-black' : ''} ${row.state === 'WA' ? 'bg-red-50' : ''}`}>
              <div className={`text-2xl font-black ${row.state === 'WA' ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{row.state}</div>
              <div className="h-5 border-2 border-bauhaus-black bg-gray-100">
                <div
                  className={`h-full ${row.state === 'WA' ? 'bg-bauhaus-red' : 'bg-bauhaus-black'}`}
                  style={{ width: `${Math.max((row.contracts / maxStateContracts) * 100, row.contracts ? 1 : 0)}%` }}
                />
              </div>
              <div className="text-sm font-bold tabular-nums sm:text-right">{fmt(row.contracts)} records</div>
              <div className="text-xs font-bold text-bauhaus-muted sm:text-right">{money(row.recordedValue)} recorded</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-medium leading-relaxed text-bauhaus-muted">
          State coverage reflects records currently stored in <code>state_tenders</code>. It is not a completeness comparison between jurisdictions.
        </p>
      </section>

      <section className="mt-14 grid gap-8 xl:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Scale className="h-6 w-6 text-bauhaus-red" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Unsafe aggregate</p>
              <h2 className="text-2xl font-black">WA justice rows contain different kinds of money</h2>
            </div>
          </div>
          <div className="border-4 border-bauhaus-black bg-white">
            {report.justiceSources.map((source, index) => (
              <div key={source.source} className={`grid grid-cols-[1fr_auto] gap-4 p-4 ${index < report.justiceSources.length - 1 ? 'border-b-2 border-bauhaus-black' : ''}`}>
                <div>
                  <div className="text-sm font-black">{SOURCE_LABELS[source.source] ?? source.source}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
                    {fmt(Number(source.records))} records · {fmt(Number(source.with_abn))} with ABN
                  </div>
                </div>
                <div className="text-sm font-black tabular-nums">{money(Number(source.recorded_value))}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-l-4 border-bauhaus-red pl-4 text-sm font-bold leading-relaxed text-bauhaus-muted">
            These values cannot be summed as ACCO investment. They mix aggregate expenditure, contracts, grants, budgets and narrative commitments.
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-bauhaus-blue" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Evidence quality</p>
              <h2 className="text-2xl font-black">ALMA needs curation before external use</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 border-4 border-bauhaus-black bg-white">
            <div className="border-r-2 border-bauhaus-black p-4">
              <div className="text-3xl font-black">{fmt(almaTotal)}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">WA-linked rows</div>
            </div>
            <div className="border-r-2 border-bauhaus-black bg-blue-50 p-4 text-bauhaus-blue">
              <div className="text-3xl font-black">{fmt(almaCommunityVerified)}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest">Community verified</div>
            </div>
            <div className="bg-red-50 p-4 text-bauhaus-red">
              <div className="text-3xl font-black">{fmt(almaAiGenerated)}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest">AI generated</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {report.almaQuality.map((row) => (
              <div key={`${row.verification_status}-${row.review_status}`} className="flex items-center justify-between border-2 border-bauhaus-black bg-white px-3 py-2 text-xs">
                <span className="font-black uppercase tracking-wider">{row.verification_status} · {row.review_status}</span>
                <span className="font-mono font-bold">{fmt(Number(row.records))}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-blue">Regional evidence map</p>
            <h2 className="mt-2 text-3xl font-black text-bauhaus-black">Where the public records point</h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Red circles show current-window Tenders WA awards. Blue circles show regions with AER program evidence but no contract in this window. Circle area follows contract count, not need.
          </p>
        </div>
        <div className="h-[520px] border-4 border-bauhaus-black bg-gray-100">
          <RegionMap regions={report.regionCoverage} />
        </div>
      </section>

      <section className="mt-14 border-y-4 border-bauhaus-black bg-bauhaus-black py-10 text-white">
        <div className="px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <div className="flex items-center gap-3 text-bauhaus-yellow">
                <MapPinned className="h-7 w-7" />
                <p className="text-xs font-black uppercase tracking-[0.28em]">Kununurra · East Kimberley</p>
              </div>
              <h2 className="mt-4 text-4xl font-black leading-tight">A legitimate network, not an empty pilot location</h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-white/65">
                The local work already connects youth, housing, employment, health and culture. A CivicGraph role begins with evidence under local direction, not choosing a solution for the place.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {KIMBERLEY_NETWORK.map((item) => (
                <a key={item.name} href={item.href} className="group border-2 border-white/25 p-4 hover:border-bauhaus-yellow" target="_blank" rel="noreferrer">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-black text-white group-hover:text-bauhaus-yellow">{item.name}</h3>
                    <ExternalLink className="h-4 w-4 shrink-0 text-white/40 group-hover:text-bauhaus-yellow" />
                  </div>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-white/60">{item.role}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-3">
        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
          <div className="flex items-center gap-3">
            <Network className="h-6 w-6" />
            <p className="text-xs font-black uppercase tracking-widest">Jeremy Donovan pathway</p>
          </div>
          <h2 className="mt-4 text-2xl font-black">Verified contribution, bounded authority</h2>
          <p className="mt-3 text-sm font-bold leading-relaxed text-bauhaus-black/75">
            KWAC names Jeremy in connection with Youth Circuit Breaker cost-benefit work. The appropriate first route is through KWAC and the project leadership. His authority to speak for KWAC, Coolamon partners or Kununurra more broadly is not established by that contribution.
          </p>
          <a href="https://kwac.com.au/projects/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border-2 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white">
            View KWAC project evidence <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="flex items-center gap-3 text-bauhaus-blue">
            <FileSpreadsheet className="h-6 w-6" />
            <p className="text-xs font-black uppercase tracking-widest">First ingestion result</p>
          </div>
          <h2 className="mt-4 text-2xl font-black">AER workbook is now a canonical artifact</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
            {fmt(report.aerCoverage.programs)} official program rows are held with the source fingerprint. They establish agency, broad delivery region, Closing the Gap alignment and reported Aboriginal-organisation involvement. They do not contain program-level expenditure values, named providers, contracts or ACCO payments.
          </p>
          <div className="mt-5 grid grid-cols-3 border-2 border-bauhaus-black text-center">
            <div className="border-r-2 border-bauhaus-black p-3">
              <div className="text-2xl font-black">{fmt(report.aerCoverage.kimberley_programs)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Kimberley</div>
            </div>
            <div className="border-r-2 border-bauhaus-black p-3">
              <div className="text-2xl font-black">{fmt(report.aerCoverage.justice_programs)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Justice</div>
            </div>
            <div className="p-3">
              <div className="text-2xl font-black">{fmt(report.aerCoverage.aboriginal_org_or_acco_rows)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Org involvement</div>
            </div>
          </div>
          <a href="https://www.wa.gov.au/government/publications/western-australian-aboriginal-expenditure-review-2023-24" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border-2 border-bauhaus-blue px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white">
            Open official source <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="border-4 border-bauhaus-black bg-bauhaus-blue p-6 text-white">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6" />
            <p className="text-xs font-black uppercase tracking-widest">Policy evidence archive</p>
          </div>
          <h2 className="mt-4 text-2xl font-black">APP reports are preserved by source hash</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-white/75">
            The annual APP publication pages and every linked PDF are now held as dated source artifacts. These reports establish aggregate policy performance, not a complete supplier-level award or expenditure ledger.
          </p>
          <div className="mt-5 grid grid-cols-2 border-2 border-white text-center">
            <div className="border-r-2 border-white p-3">
              <div className="text-2xl font-black">{fmt(report.appReportCoverage.publication_pages)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/70">Annual pages</div>
            </div>
            <div className="p-3">
              <div className="text-2xl font-black">{fmt(report.appReportCoverage.pdf_artifacts)}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/70">PDF artifacts</div>
            </div>
          </div>
          <a href="https://www.wa.gov.au/government/document-collections/aboriginal-procurement-policy-performance-reports" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-bauhaus-blue">
            Open official collection <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-4 flex items-center gap-3">
          <Check className="h-6 w-6 text-bauhaus-blue" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Engagement threshold</p>
            <h2 className="text-2xl font-black">What must be true before outreach</h2>
          </div>
        </div>
        <div className="grid border-4 border-bauhaus-black md:grid-cols-2 xl:grid-cols-4">
          {[
            'AER rows reconcile to the source workbook',
            'Kimberley organisation roles use first-party evidence',
            'ALMA false geography and generated rows are excluded',
            'Goods generated demand is excluded',
            'Tenders WA coverage dates and omissions are visible',
            'Jeremy\'s role is described from current public evidence',
            'Unknowns and corrections are prominent',
            'No readiness score or automated contact exists',
          ].map((item, index) => (
            <div key={item} className={`flex min-h-[110px] gap-3 p-4 ${index % 4 !== 3 ? 'xl:border-r-2 xl:border-bauhaus-black' : ''} ${index < 4 ? 'border-b-2 border-bauhaus-black' : index % 2 === 0 ? 'border-b-2 border-bauhaus-black md:border-b-0' : ''}`}>
              <span className="font-mono text-sm font-black text-bauhaus-red">{String(index + 1).padStart(2, '0')}</span>
              <p className="text-sm font-black leading-snug">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 border-4 border-bauhaus-black bg-white p-5 sm:p-7">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-muted">Source state</p>
            <h2 className="mt-2 text-2xl font-black">Provenance is part of the result</h2>
            <dl className="mt-5 grid grid-cols-[150px_1fr] gap-y-3 text-sm">
              <dt className="font-black">Tenders WA monitor</dt>
              <dd className="font-medium text-bauhaus-muted">Last checked {lastChecked}</dd>
              <dt className="font-black">HTTP status</dt>
              <dd className="font-medium text-bauhaus-muted">{report.frontier?.last_http_status ?? 'Unknown'} · {report.frontier?.failure_count ?? 0} recorded failures</dd>
              <dt className="font-black">Historical backfill</dt>
              <dd className="font-medium text-bauhaus-muted">{fmt(historicalWaContracts)} contracts · {fmt(Number(report.frontier?.historical_complete_days ?? 0))} complete days · {historicalCoverage}</dd>
              <dt className="font-black">Federal evidence</dt>
              <dd className="font-medium text-bauhaus-muted">{fmt(report.federalContracts.contracts)} contracts across {fmt(report.federalContracts.organisations)} WA community-controlled signals</dd>
              <dt className="font-black">Ending within 24m</dt>
              <dd className="font-medium text-bauhaus-muted">{fmt(report.federalContracts.ending_24m)} federal contracts</dd>
              <dt className="font-black">AER source hash</dt>
              <dd className="break-all font-mono text-xs font-medium text-bauhaus-muted">{report.aerCoverage.source_sha256 ?? 'Not ingested'}</dd>
            </dl>
          </div>
          <div className="border-l-4 border-bauhaus-blue pl-5">
            <p className="text-sm font-black leading-relaxed text-bauhaus-black">
              This surface shows what CivicGraph can currently prove, what it can only suggest and what must be learned through relationships. It is an operating evidence view, not a readiness assessment of WA organisations.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/reports/wa" className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white">WA state dashboard</Link>
              <Link href="/justice-reinvestment?state=WA" className="border-2 border-bauhaus-blue px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white">WA interventions</Link>
              <Link href="/reports/state-procurement" className="border-2 border-bauhaus-red px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-red hover:bg-bauhaus-red hover:text-white">Procurement coverage</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
