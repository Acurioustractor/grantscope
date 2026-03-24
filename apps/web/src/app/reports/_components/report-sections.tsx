import Link from 'next/link';
import { money, fmt } from '@/lib/services/report-service';
import type { ProgramRow, OrgRow, AlmaRow, LgaRow, MetricRow, PolicyRow, OversightRow, CrossSystemRow } from './shared-types';

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

/* ── State Navigation Pills ── */
export function StateNav({ domain, currentState }: { domain: string; currentState: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-4">
      {STATES.map(s => (
        <Link
          key={s}
          href={`/reports/${domain}/${s.toLowerCase()}`}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
            s === currentState.toUpperCase()
              ? 'bg-bauhaus-black text-white shadow-sm'
              : 'bg-white text-bauhaus-muted border border-bauhaus-black/10 hover:border-bauhaus-black/30 hover:text-bauhaus-black hover:shadow-sm'
          }`}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, subtitle, accent = 'black' }: { title: string; subtitle?: string; accent?: 'black' | 'red' | 'blue' | 'emerald' }) {
  const colors = {
    black: 'border-bauhaus-black',
    red: 'border-bauhaus-red',
    blue: 'border-bauhaus-blue',
    emerald: 'border-emerald-600',
  };
  return (
    <div className={`border-b-2 ${colors[accent]} pb-3 mb-5`}>
      <h2 className="text-lg font-black text-bauhaus-black tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-bauhaus-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* ── Table wrapper — consistent styling ── */
function DataTable({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className="bg-white border border-bauhaus-black/8 overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
          {children}
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th className={`text-${align} px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted bg-gray-50/80 border-b border-bauhaus-black/5`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', mono, accent }: { children: React.ReactNode; align?: 'left' | 'right'; mono?: boolean; accent?: boolean }) {
  return (
    <td className={`text-${align} px-4 py-3 ${mono ? 'font-mono tabular-nums' : ''} ${accent ? 'font-bold text-bauhaus-red' : ''}`}>
      {children}
    </td>
  );
}

function Tr({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <tr className={`border-b border-bauhaus-black/4 transition-colors hover:bg-bauhaus-blue/3 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
      {children}
    </tr>
  );
}

/* ── Programs Table ── */
export function ProgramsTable({ programs }: { programs: ProgramRow[] }) {
  if (!programs.length) return null;
  return (
    <div>
      <SectionHeader title="Programs" accent="black" />
      <DataTable>
        <thead>
          <tr>
            <Th>Program</Th>
            <Th align="right">Funding</Th>
            <Th align="right">Orgs</Th>
          </tr>
        </thead>
        <tbody>
          {programs.map((row, i) => (
            <Tr key={row.program_name} index={i}>
              <Td><span className="font-medium text-bauhaus-black">{row.program_name}</span></Td>
              <Td align="right" mono accent>{money(row.total)}</Td>
              <Td align="right" mono>{fmt(row.orgs)}</Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

/* ── Top Funded Organisations Table ── */
export function TopOrgsTable({ orgs }: { orgs: OrgRow[] }) {
  if (!orgs.length) return null;
  return (
    <div>
      <SectionHeader title="Top Funded Organisations" accent="blue" />
      <DataTable>
        <thead>
          <tr>
            <Th>Organisation</Th>
            <Th align="right">Funding</Th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((row, i) => (
            <Tr key={`${row.recipient_name}-${i}`} index={i}>
              <Td>
                {row.gs_id ? (
                  <Link href={`/entity/${row.gs_id}`} className="font-medium text-bauhaus-black hover:text-bauhaus-blue transition-colors">
                    {row.recipient_name}
                  </Link>
                ) : (
                  <span className="font-medium text-bauhaus-black">{row.recipient_name}</span>
                )}
              </Td>
              <Td align="right" mono accent>{money(row.total)}</Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

/* ── ALMA Interventions Section ── */
export function AlmaSection({ interventions, count }: { interventions: AlmaRow[]; count: number }) {
  if (!interventions.length && !count) return null;

  const evidenceColors: Record<string, string> = {
    'Strong': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Promising': 'bg-blue-50 text-blue-700 border-blue-200',
    'Emerging': 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <section className="mb-10">
      <SectionHeader title={`What Works — ${count} Interventions`} subtitle="Australian Living Map of Alternatives (ALMA)" accent="emerald" />
      <DataTable>
        <thead>
          <tr>
            <Th>Intervention</Th>
            <Th>Type</Th>
            <Th>Evidence</Th>
            <Th>Organisation</Th>
          </tr>
        </thead>
        <tbody>
          {interventions.map((row, i) => (
            <Tr key={`${row.name}-${i}`} index={i}>
              <Td><span className="font-medium text-bauhaus-black">{row.name}</span></Td>
              <Td>
                {row.type && (
                  <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {row.type}
                  </span>
                )}
              </Td>
              <Td>
                {row.evidence_level && (
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${evidenceColors[row.evidence_level] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {row.evidence_level}
                  </span>
                )}
              </Td>
              <Td>
                {row.gs_id ? (
                  <Link href={`/entity/${row.gs_id}`} className="text-bauhaus-muted hover:text-bauhaus-blue text-xs transition-colors">{row.org_name}</Link>
                ) : (
                  <span className="text-bauhaus-muted text-xs">{row.org_name}</span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}

/* ── Outcomes Metrics Table ── */
export function OutcomesTable({
  outcomes,
  metricLabels,
  stateName,
  title,
  prefixStrip,
}: {
  outcomes: MetricRow[];
  metricLabels: Record<string, string>;
  stateName: string;
  title?: string;
  prefixStrip?: string;
}) {
  if (!outcomes.length) return null;
  return (
    <section className="mb-10">
      <SectionHeader
        title={title || `System Outcomes — ${stateName}`}
        subtitle="Productivity Commission, Report on Government Services 2026"
        accent="red"
      />
      <DataTable>
        <thead>
          <tr>
            <Th>Indicator</Th>
            <Th align="right">Value</Th>
            <Th align="right">Period</Th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((row, i) => (
            <Tr key={`${row.metric_name}-${row.period}-${row.cohort}`} index={i}>
              <Td>
                <span className="font-medium text-bauhaus-black">
                  {metricLabels[row.metric_name] || row.metric_name.replace(new RegExp(`^${prefixStrip || 'rogs_'}`), '').replace(/_/g, ' ')}
                </span>
                {row.cohort && row.cohort !== 'all' && (
                  <span className="ml-2 text-[9px] font-bold text-bauhaus-muted uppercase bg-gray-100 px-1.5 py-0.5">{row.cohort}</span>
                )}
              </Td>
              <Td align="right" mono>
                <span className="font-bold">
                  {row.metric_unit === 'dollars' ? money(row.metric_value) :
                   row.metric_unit === 'percent' ? `${Number(row.metric_value).toFixed(1)}%` :
                   fmt(row.metric_value)}
                </span>
              </Td>
              <Td align="right">
                <span className="text-xs text-bauhaus-muted">{row.period}</span>
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}

/* ── LGA Funding Table ── */
export function LgaFundingTable({ lgas }: { lgas: LgaRow[] }) {
  if (!lgas.length) return null;
  return (
    <section className="mb-10">
      <SectionHeader title="Funding by LGA" subtitle="SEIFA decile: 1 = most disadvantaged, 10 = least" />
      <DataTable>
        <thead>
          <tr>
            <Th>LGA</Th>
            <Th align="right">Orgs</Th>
            <Th align="right">Funding</Th>
            <Th align="right">SEIFA</Th>
          </tr>
        </thead>
        <tbody>
          {lgas.map((row, i) => (
            <Tr key={row.lga_name} index={i}>
              <Td><span className="font-medium text-bauhaus-black">{row.lga_name}</span></Td>
              <Td align="right" mono>{row.orgs}</Td>
              <Td align="right" mono accent>{money(row.total_funding)}</Td>
              <Td align="right">
                {row.seifa_decile != null && (
                  <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold ${
                    row.seifa_decile <= 3 ? 'bg-red-50 text-red-700 border border-red-200' :
                    row.seifa_decile <= 6 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {row.seifa_decile}
                  </span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}

/* ── Policy Timeline ── */
export function PolicyTimeline({ events }: { events: PolicyRow[] }) {
  if (!events.length) return null;

  const typeColors: Record<string, { bg: string; text: string }> = {
    legislation: { bg: 'bg-blue-50', text: 'text-blue-700' },
    inquiry: { bg: 'bg-red-50', text: 'text-red-700' },
    report: { bg: 'bg-amber-50', text: 'text-amber-700' },
    framework: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    policy: { bg: 'bg-purple-50', text: 'text-purple-700' },
    funding: { bg: 'bg-orange-50', text: 'text-orange-700' },
  };

  return (
    <section className="mb-10">
      <SectionHeader title="Policy Timeline" subtitle="Key legislation, inquiries, and reforms" />
      <div className="bg-white border border-bauhaus-black/8">
        {events.slice(0, 20).map((ev, i) => {
          const colors = typeColors[ev.event_type] || { bg: 'bg-gray-50', text: 'text-gray-600' };
          return (
            <div
              key={`${ev.event_date}-${i}`}
              className={`flex gap-4 px-5 py-4 transition-colors hover:bg-gray-50/60 ${i > 0 ? 'border-t border-bauhaus-black/4' : ''}`}
            >
              <div className="text-xs font-mono font-bold text-bauhaus-muted whitespace-nowrap w-16 shrink-0 pt-0.5">
                {ev.event_date?.slice(0, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${colors.bg} ${colors.text}`}>
                    {ev.event_type}
                  </span>
                  {ev.severity === 'critical' && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-100 text-red-600">critical</span>
                  )}
                </div>
                <p className="font-medium text-sm text-bauhaus-black leading-snug">{ev.title}</p>
                <p className="text-xs text-bauhaus-muted mt-1 line-clamp-2 leading-relaxed">{ev.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Cross-System Overlap ── */
export function CrossSystemTable({ orgs }: { orgs: CrossSystemRow[] }) {
  if (!orgs.length) return null;

  const topicColors: Record<string, string> = {
    'youth-justice': 'bg-red-50 text-red-700',
    'child-protection': 'bg-amber-50 text-amber-700',
    'ndis': 'bg-blue-50 text-blue-700',
    'disability': 'bg-blue-50 text-blue-700',
    'family-services': 'bg-purple-50 text-purple-700',
    'indigenous': 'bg-orange-50 text-orange-700',
    'education': 'bg-emerald-50 text-emerald-700',
  };

  return (
    <section className="mb-10">
      <SectionHeader title="Cross-System Organisations" subtitle="Entities appearing across multiple policy domains" />
      <DataTable>
        <thead>
          <tr>
            <Th>Organisation</Th>
            <Th>Domains</Th>
            <Th align="right">Funding</Th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((row, i) => (
            <Tr key={row.gs_id} index={i}>
              <Td>
                <Link href={`/entity/${row.gs_id}`} className="font-medium text-bauhaus-black hover:text-bauhaus-blue transition-colors">
                  {row.canonical_name}
                </Link>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {row.topics.map(t => (
                    <span key={t} className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${topicColors[t] || 'bg-gray-100 text-gray-600'}`}>
                      {t.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </Td>
              <Td align="right" mono accent>{money(row.total_funding)}</Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}
