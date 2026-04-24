'use client';

import { useState, useMemo, Fragment } from 'react';
import type { PiccProgramDefinition } from '@/lib/services/report-service';
import { money } from '@/lib/services/report-service';

type FundingRow = {
  program_name: string;
  parent_funder_name: string | null;
  parent_funder_gs_id: string | null;
  funder_name: string | null;
  funder_gs_id: string | null;
  total: number;
  records: number;
  from_fy: string;
  to_fy: string;
};

type AlmaRow = {
  name: string;
  type: string;
  description: string;
  evidence_level: string;
  target_cohort: string;
};

type ContractRow = {
  title: string;
  value: number;
  buyer_name: string;
  contract_start: string;
};

type PipelineRow = {
  name: string;
  amount_display: string;
  funder: string;
  deadline: string;
  status: string;
};

type FundingStatus = 'secured' | 'applied' | 'upcoming' | 'prospect' | 'gap' | 'self-funded';

// Unified program that ties all data sources together
type UnifiedProgram = {
  name: string;
  system: string;
  source: string;
  annualDisplay: string;
  fundingStatus: FundingStatus;
  govFunding: { total: number; grants: number; period: string; parentFunders: string[]; awardingBodies: string[] } | null;
  alma: AlmaRow | null;
  almaReference: string | null;
  contracts: { total: number; count: number } | null;
  pipeline: PipelineRow | null;
  pipelineReference: string | null;
  reporting: string;
};

const STATUS_STYLES: Record<FundingStatus, { bg: string; label: string }> = {
  'secured': { bg: 'bg-green-100 text-green-800 border-green-300', label: 'Secured' },
  'applied': { bg: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Applied' },
  'upcoming': { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Upcoming' },
  'prospect': { bg: 'bg-gray-100 text-gray-600 border-gray-300', label: 'Prospect' },
  'gap': { bg: 'bg-red-100 text-red-800 border-red-300', label: 'Gap' },
  'self-funded': { bg: 'bg-teal-100 text-teal-800 border-teal-300', label: 'Self-funded' },
};

const SYSTEM_COLORS: Record<string, string> = {
  'Health': 'bg-green-100 text-green-800',
  'Families': 'bg-blue-100 text-blue-800',
  'Community Services': 'bg-sky-100 text-sky-800',
  'Child Protection': 'bg-purple-100 text-purple-800',
  'DFV': 'bg-red-100 text-red-800',
  'Women': 'bg-pink-100 text-pink-800',
  'Youth Justice': 'bg-orange-100 text-orange-800',
  'Disability': 'bg-cyan-100 text-cyan-800',
  'Housing': 'bg-amber-100 text-amber-800',
  'Economic Dev': 'bg-teal-100 text-teal-800',
  'Enterprise': 'bg-amber-100 text-amber-800',
  'Cultural': 'bg-indigo-100 text-indigo-800',
};

function isFundingStatus(value: string | null): value is FundingStatus {
  return value === 'secured'
    || value === 'applied'
    || value === 'upcoming'
    || value === 'prospect'
    || value === 'gap'
    || value === 'self-funded';
}

export function ProgramsTable({
  programs,
  funding,
  alma,
  contracts,
  pipeline,
}: {
  programs: PiccProgramDefinition[];
  funding: FundingRow[] | null;
  alma: AlmaRow[] | null;
  contracts: ContractRow[] | null;
  pipeline: PipelineRow[];
}) {
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const unified = useMemo(() => {
    return programs.map((program): UnifiedProgram => {
      const fundingLinks = program.links.filter(link => link.source_type === 'justice_funding_program');
      const matchedFunding = funding?.filter(f => fundingLinks.some(link => link.source_key === f.program_name)) ?? [];
      const govFunding = matchedFunding.length > 0
        ? {
            total: matchedFunding.reduce((s, f) => s + Number(f.total), 0),
            grants: matchedFunding.reduce((s, f) => s + f.records, 0),
            period: `${matchedFunding.map(f => f.from_fy).sort()[0]} – ${matchedFunding.map(f => f.to_fy).sort().reverse()[0]}`,
            parentFunders: [...new Set(
              fundingLinks
                .map(link => link.parent_funder_name || link.funder_name)
                .filter((value): value is string => Boolean(value))
            )],
            awardingBodies: [...new Set(
              fundingLinks
                .map(link => link.funder_name)
                .filter((value): value is string => Boolean(value))
            )],
          }
        : null;

      const almaLinks = program.links.filter(link => link.source_type === 'alma_intervention');
      const matchedAlma = almaLinks
        .map(link => alma?.find(a => a.name === link.source_key) ?? null)
        .find((value): value is AlmaRow => Boolean(value)) ?? null;
      const almaReference = matchedAlma
        ? matchedAlma.name
        : almaLinks[0]?.source_label ?? almaLinks[0]?.source_key ?? null;

      const contractBuyers = program.links
        .filter(link => link.source_type === 'contract_buyer')
        .map(link => link.source_key);
      const matchedContracts = contracts?.filter(c => contractBuyers.includes(c.buyer_name)) ?? [];
      const contractData = matchedContracts.length > 0
        ? { total: matchedContracts.reduce((s, c) => s + Number(c.value), 0), count: matchedContracts.length }
        : null;

      const pipelineLinks = program.links.filter(link => link.source_type === 'pipeline_item');
      const matchedPipeline = pipeline.find(p => pipelineLinks.some(link => link.source_key === p.name)) ?? null;
      const pipelineReference = matchedPipeline
        ? matchedPipeline.name
        : pipelineLinks[0]?.source_label ?? pipelineLinks[0]?.source_key ?? null;

      return {
        name: program.name,
        system: program.system ?? 'Other',
        source: program.funding_source ?? 'Unmapped',
        annualDisplay: program.annual_amount_display ?? '—',
        fundingStatus: isFundingStatus(program.funding_status) ? program.funding_status : 'gap',
        govFunding,
        alma: matchedAlma,
        almaReference,
        contracts: contractData,
        pipeline: matchedPipeline,
        pipelineReference,
        reporting: program.reporting_cycle ?? '—',
      };
    });
  }, [programs, funding, alma, contracts, pipeline]);

  const systems = useMemo(() =>
    [...new Set(unified.map(p => p.system))].sort(),
    [unified]
  );

  const statuses = useMemo(() =>
    [...new Set(unified.map(p => p.fundingStatus))].sort(),
    [unified]
  );

  const filtered = useMemo(() => {
    let rows = unified;
    if (systemFilter !== 'all') rows = rows.filter(p => p.system === systemFilter);
    if (statusFilter !== 'all') rows = rows.filter(p => p.fundingStatus === statusFilter);
    return rows;
  }, [unified, systemFilter, statusFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="space-y-2 mb-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 self-center mr-1">System:</span>
          <button
            onClick={() => setSystemFilter('all')}
            className={`text-xs px-2 py-1 font-bold border transition-colors ${
              systemFilter === 'all' ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'border-gray-300 hover:border-bauhaus-black'
            }`}
          >
            All ({unified.length})
          </button>
          {systems.map(s => {
            const count = unified.filter(p => p.system === s).length;
            return (
              <button
                key={s}
                onClick={() => setSystemFilter(systemFilter === s ? 'all' : s)}
                className={`text-xs px-2 py-1 font-bold border transition-colors ${
                  systemFilter === s ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'border-gray-300 hover:border-bauhaus-black'
                }`}
              >
                {s} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 self-center mr-1">Status:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-xs px-2 py-1 font-bold border transition-colors ${
              statusFilter === 'all' ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'border-gray-300 hover:border-bauhaus-black'
            }`}
          >
            All
          </button>
          {statuses.map(s => {
            const style = STATUS_STYLES[s];
            const count = unified.filter(p => p.fundingStatus === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`text-xs px-2 py-1 font-bold border transition-colors ${
                  statusFilter === s ? 'bg-bauhaus-black text-white border-bauhaus-black' : `${style.bg} border-gray-300 hover:border-bauhaus-black`
                }`}
              >
                {style.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-4 border-bauhaus-black">
              <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Program</th>
              <th className="text-left py-2 font-black uppercase tracking-widest text-xs w-24">System</th>
              <th className="text-center py-2 font-black uppercase tracking-widest text-xs w-24">Status</th>
              <th className="text-right py-2 font-black uppercase tracking-widest text-xs w-24">Annual</th>
              <th className="text-right py-2 font-black uppercase tracking-widest text-xs w-28">Gov Funding</th>
              <th className="text-center py-2 font-black uppercase tracking-widest text-xs w-16">ALMA</th>
              <th className="text-right py-2 font-black uppercase tracking-widest text-xs w-24">Contracts</th>
              <th className="text-center py-2 font-black uppercase tracking-widest text-xs w-20">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <Fragment key={i}>
                <tr
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                >
                  <td className="py-2">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{p.source}</div>
                  </td>
                  <td className="py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 font-bold ${SYSTEM_COLORS[p.system] ?? 'bg-gray-100'}`}>
                      {p.system}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`text-[10px] px-2 py-0.5 font-bold border ${STATUS_STYLES[p.fundingStatus].bg}`}>
                      {STATUS_STYLES[p.fundingStatus].label}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-xs">{p.annualDisplay}</td>
                  <td className="py-2 text-right">
                    {p.govFunding ? (
                      <div>
                        <span className="font-mono font-bold">{money(p.govFunding.total)}</span>
                        <span className="text-[10px] text-gray-500 block">{p.govFunding.grants} grants</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    {p.alma ? (
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 font-bold" title={p.alma.evidence_level}>
                        Linked
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-50 text-gray-400 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {p.contracts ? (
                      <div>
                        <span className="font-mono font-bold">{money(p.contracts.total)}</span>
                        <span className="text-[10px] text-gray-500 block">{p.contracts.count} contracts</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    {p.pipeline ? (
                      <span className={`text-[10px] px-1.5 py-0.5 font-bold border uppercase ${
                        p.pipeline.status === 'submitted' ? 'bg-green-100 text-green-800 border-green-300' :
                        p.pipeline.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-gray-100 text-gray-600 border-gray-300'
                      }`}>
                        {p.pipeline.status}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
                {expandedRow === i && (
                  <tr key={`${i}-detail`} className="border-b border-gray-200 bg-gray-50">
                    <td colSpan={8} className="p-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        {/* Gov Funding Detail */}
                        <div>
                          <h4 className="font-black uppercase tracking-widest text-[10px] mb-2">Government Funding</h4>
                          {p.govFunding ? (
                            <div>
                              <p className="font-mono font-bold text-sm">{money(p.govFunding.total)}</p>
                              <p className="text-gray-600">{p.govFunding.grants} grants over {p.govFunding.period}</p>
                              <p className="text-gray-500 mt-1">Reporting: {p.reporting}</p>
                              {p.govFunding.parentFunders.length > 0 && (
                                <p className="text-gray-500 mt-1">
                                  Parent funder{p.govFunding.parentFunders.length > 1 ? 's' : ''}: {p.govFunding.parentFunders.join(', ')}
                                </p>
                              )}
                              {p.govFunding.awardingBodies.length > 0 && (
                                <p className="text-gray-500 mt-1">
                                  Awarding bod{p.govFunding.awardingBodies.length > 1 ? 'ies' : 'y'}: {p.govFunding.awardingBodies.join(', ')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-400">No tracked government funding</p>
                          )}
                        </div>

                        {/* ALMA Detail */}
                        <div>
                          <h4 className="font-black uppercase tracking-widest text-[10px] mb-2">ALMA Intervention</h4>
                          {p.alma ? (
                            <div>
                              <p className="font-bold">{p.alma.name}</p>
                              <p className="text-gray-600 mt-1">{p.alma.type} — {p.alma.evidence_level}</p>
                              <p className="text-gray-500 mt-1 line-clamp-3">{p.alma.description}</p>
                            </div>
                          ) : p.almaReference ? (
                            <div>
                              <p className="font-bold">{p.almaReference}</p>
                              <p className="text-gray-500 mt-1">Crosswalk exists, but the ALMA record is not linked in the live query yet.</p>
                            </div>
                          ) : (
                            <p className="text-gray-400">Not yet registered in ALMA. <span className="text-bauhaus-red font-bold">Add?</span></p>
                          )}
                        </div>

                        {/* Contracts Detail */}
                        <div>
                          <h4 className="font-black uppercase tracking-widest text-[10px] mb-2">Contracts</h4>
                          {p.contracts ? (
                            <div>
                              <p className="font-mono font-bold text-sm">{money(p.contracts.total)}</p>
                              <p className="text-gray-600">{p.contracts.count} AusTender contracts</p>
                            </div>
                          ) : (
                            <p className="text-gray-400">No tracked contracts</p>
                          )}
                        </div>

                        {/* Pipeline Detail */}
                        <div>
                          <h4 className="font-black uppercase tracking-widest text-[10px] mb-2">Grant Pipeline</h4>
                          {p.pipeline ? (
                            <div>
                              <p className="font-bold">{p.pipeline.name}</p>
                              <p className="text-gray-600">{p.pipeline.amount_display} from {p.pipeline.funder}</p>
                              <p className="text-gray-500">Deadline: {p.pipeline.deadline}</p>
                            </div>
                          ) : p.pipelineReference ? (
                            <div>
                              <p className="font-bold">{p.pipelineReference}</p>
                              <p className="text-gray-500">Crosswalk exists, but the live pipeline row is not populated.</p>
                            </div>
                          ) : (
                            <p className="text-gray-400">No active pipeline</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-4 gap-4 text-center border-t-4 border-bauhaus-black pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Programs</p>
          <p className="text-xl font-black">{filtered.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">ALMA Linked</p>
          <p className="text-xl font-black">{filtered.filter(p => p.alma).length}/{filtered.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Gov Funded</p>
          <p className="text-xl font-black">{filtered.filter(p => p.govFunding).length}/{filtered.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">In Pipeline</p>
          <p className="text-xl font-black">{filtered.filter(p => p.pipeline).length}/{filtered.length}</p>
        </div>
      </div>
    </div>
  );
}
