import Link from 'next/link';
import { money, fmt } from '@/lib/services/report-service';
import type { ProgramRow, OrgRow, AlmaRow, LgaRow, MetricRow, PolicyRow, OversightRow, CrossSystemRow } from './shared-types';

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

/* ── State Navigation Pills ── */
export function StateNav({ domain, currentState }: { domain: string; currentState: string }) {
  return (
    <div className="flex flex-wrap gap-1 mt-4">
      {STATES.map(s => (
        <Link
          key={s}
          href={`/reports/${domain}/${s.toLowerCase()}`}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
            s === currentState.toUpperCase()
              ? 'border-bauhaus-black bg-bauhaus-black text-white'
              : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
          }`}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}

/* ── Programs Table ── */
export function ProgramsTable({ programs }: { programs: ProgramRow[] }) {
  if (!programs.length) return null;
  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
        <h2 className="text-xl font-black">Programs</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-canvas">
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Program</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Orgs</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((row, i) => (
              <tr key={row.program_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3 font-bold text-bauhaus-black">{row.program_name}</td>
                <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total)}</td>
                <td className="p-3 text-right font-mono">{fmt(row.orgs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Top Funded Organisations Table ── */
export function TopOrgsTable({ orgs, headerBg = 'bg-bauhaus-blue' }: { orgs: OrgRow[]; headerBg?: string }) {
  if (!orgs.length) return null;
  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className={`${headerBg} text-white border-b-4 border-bauhaus-black p-5`}>
        <h2 className="text-xl font-black">Top Funded Organisations</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-canvas">
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
              <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((row, i) => (
              <tr key={`${row.recipient_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3">
                  {row.gs_id ? (
                    <Link href={`/entity/${row.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">{row.recipient_name}</Link>
                  ) : (
                    <span className="font-bold text-bauhaus-black">{row.recipient_name}</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── ALMA Interventions Section ── */
export function AlmaSection({ interventions, count, topic }: { interventions: AlmaRow[]; count: number; topic: string }) {
  if (!interventions.length && !count) return null;
  return (
    <section className="mb-10">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="bg-emerald-600 text-white border-b-4 border-bauhaus-black p-5">
          <p className="text-xs font-black text-emerald-200 uppercase tracking-widest mb-1">Evidence Base</p>
          <h2 className="text-xl font-black">What Works — {count} Interventions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-canvas">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Intervention</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Type</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Evidence</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
              </tr>
            </thead>
            <tbody>
              {interventions.map((row, i) => (
                <tr key={`${row.name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-bold text-bauhaus-black">{row.name}</td>
                  <td className="p-3 text-xs">
                    {row.type && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">{row.type}</span>}
                  </td>
                  <td className="p-3 text-xs">
                    {row.evidence_level && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">{row.evidence_level}</span>}
                  </td>
                  <td className="p-3 text-xs text-bauhaus-muted">
                    {row.gs_id ? (
                      <Link href={`/entity/${row.gs_id}`} className="hover:text-bauhaus-blue">{row.org_name}</Link>
                    ) : row.org_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
          <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">ROGS 2026</p>
          <h2 className="text-xl font-black">{title || `System Outcomes — ${stateName}`}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-canvas">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Indicator</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Value</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Period</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((row, i) => (
                <tr key={`${row.metric_name}-${row.period}-${row.cohort}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-bold text-bauhaus-black">
                    {metricLabels[row.metric_name] || row.metric_name.replace(new RegExp(`^${prefixStrip || 'rogs_'}`), '').replace(/_/g, ' ')}
                    {row.cohort && row.cohort !== 'all' && (
                      <span className="ml-2 text-[9px] font-black text-bauhaus-muted uppercase">{row.cohort}</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-black">
                    {row.metric_unit === 'dollars' ? money(row.metric_value) :
                     row.metric_unit === 'percent' ? `${Number(row.metric_value).toFixed(1)}%` :
                     fmt(row.metric_value)}
                  </td>
                  <td className="p-3 text-right text-xs text-bauhaus-muted font-bold">{row.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-[10px] text-bauhaus-muted font-medium border-t border-bauhaus-black/10">
          Source: Productivity Commission, Report on Government Services 2026
        </div>
      </div>
    </section>
  );
}

/* ── LGA Funding Table ── */
export function LgaFundingTable({ lgas }: { lgas: LgaRow[] }) {
  if (!lgas.length) return null;
  return (
    <section className="mb-10">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="bg-bauhaus-black text-white p-5">
          <h2 className="text-xl font-black">Funding by LGA</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-canvas">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Orgs</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">SEIFA</th>
              </tr>
            </thead>
            <tbody>
              {lgas.map((row, i) => (
                <tr key={row.lga_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-bold text-bauhaus-black">{row.lga_name}</td>
                  <td className="p-3 text-right font-mono">{row.orgs}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total_funding)}</td>
                  <td className="p-3 text-right">
                    {row.seifa_decile != null && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        row.seifa_decile <= 3 ? 'bg-red-100 text-red-700' :
                        row.seifa_decile <= 6 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        D{row.seifa_decile}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ── Policy Timeline ── */
export function PolicyTimeline({ events }: { events: PolicyRow[] }) {
  if (!events.length) return null;

  const typeColors: Record<string, string> = {
    legislation: 'bg-blue-100 text-blue-700',
    inquiry: 'bg-red-100 text-red-700',
    report: 'bg-amber-100 text-amber-700',
    framework: 'bg-emerald-100 text-emerald-700',
    policy: 'bg-purple-100 text-purple-700',
    funding: 'bg-orange-100 text-orange-700',
  };

  return (
    <section className="mb-10">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="bg-bauhaus-black text-white p-5">
          <h2 className="text-xl font-black">Policy Timeline</h2>
        </div>
        <div className="divide-y divide-bauhaus-black/10">
          {events.slice(0, 20).map((ev, i) => (
            <div key={`${ev.event_date}-${i}`} className="p-4 flex gap-4">
              <div className="text-xs font-mono font-bold text-bauhaus-muted whitespace-nowrap w-20 shrink-0">
                {ev.event_date}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${typeColors[ev.event_type] || 'bg-gray-100 text-gray-600'}`}>
                    {ev.event_type}
                  </span>
                  <span className="font-bold text-sm text-bauhaus-black">{ev.title}</span>
                </div>
                <p className="text-xs text-bauhaus-muted line-clamp-2">{ev.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Cross-System Overlap ── */
export function CrossSystemTable({ orgs }: { orgs: CrossSystemRow[] }) {
  if (!orgs.length) return null;

  const topicColors: Record<string, string> = {
    'youth-justice': 'bg-red-100 text-red-700',
    'child-protection': 'bg-amber-100 text-amber-700',
    'ndis': 'bg-blue-100 text-blue-700',
    'disability': 'bg-blue-100 text-blue-700',
    'family-services': 'bg-purple-100 text-purple-700',
    'indigenous': 'bg-orange-100 text-orange-700',
    'education': 'bg-emerald-100 text-emerald-700',
  };

  return (
    <section className="mb-10">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="bg-bauhaus-black text-white p-5">
          <h2 className="text-xl font-black">Cross-System Organisations</h2>
          <p className="text-xs text-white/60 mt-1">Organisations appearing in multiple policy domains</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-canvas">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Domains</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((row, i) => (
                <tr key={row.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">
                    <Link href={`/entity/${row.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">
                      {row.canonical_name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {row.topics.map(t => (
                        <span key={t} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${topicColors[t] || 'bg-gray-100 text-gray-600'}`}>
                          {t.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total_funding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
