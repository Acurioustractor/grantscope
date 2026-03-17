'use client';

import { useState, useMemo } from 'react';
import { money } from '@/lib/services/report-service';

type FundingRow = {
  program_name: string;
  total: number;
  records: number;
  from_fy: string;
  to_fy: string;
};

// Categorise programs into systems
function getSystem(program: string): string {
  const p = program.toLowerCase();
  if (p.includes('child protection') || p.includes('child safety') || p.includes('making decisions')) return 'Child Protection';
  if (p.includes('youth justice') || p.includes('young offender') || p.includes('community and youth')) return 'Youth Justice';
  if (p.includes('domestic') || p.includes('family violence') || p.includes('women') || p.includes('keeping women')) return 'DFV';
  if (p.includes('families') || p.includes('family') || p.includes('social inclusion')) return 'Families';
  if (p.includes('disability') || p.includes('mental health')) return 'Disability';
  if (p.includes('housing') || p.includes('homelessness')) return 'Housing';
  if (p.includes('health') || p.includes('niaa') || p.includes('safety and wellbeing')) return 'Health';
  if (p.includes('service system')) return 'Capacity';
  return 'Other';
}

const SYSTEM_COLORS: Record<string, string> = {
  'Health': 'bg-green-100 text-green-800',
  'Families': 'bg-blue-100 text-blue-800',
  'Child Protection': 'bg-purple-100 text-purple-800',
  'DFV': 'bg-red-100 text-red-800',
  'Youth Justice': 'bg-orange-100 text-orange-800',
  'Disability': 'bg-teal-100 text-teal-800',
  'Housing': 'bg-amber-100 text-amber-800',
  'Capacity': 'bg-gray-100 text-gray-800',
  'Other': 'bg-gray-100 text-gray-800',
};

export function FundingTable({ data }: { data: FundingRow[] }) {
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  // Annotate with system
  const annotated = useMemo(() =>
    data.map(r => ({ ...r, system: getSystem(r.program_name) })),
    [data]
  );

  // Get unique systems and periods
  const systems = useMemo(() =>
    [...new Set(annotated.map(r => r.system))].sort(),
    [annotated]
  );

  const periods = ['all', 'recent', 'historical'] as const;

  // Filter
  const filtered = useMemo(() => {
    let rows = annotated;
    if (systemFilter !== 'all') rows = rows.filter(r => r.system === systemFilter);
    if (periodFilter === 'recent') rows = rows.filter(r => r.to_fy >= '2021-22');
    if (periodFilter === 'historical') rows = rows.filter(r => r.to_fy < '2021-22');
    return rows;
  }, [annotated, systemFilter, periodFilter]);

  const filteredTotal = filtered.reduce((s, r) => s + Number(r.total), 0);
  const filteredGrants = filtered.reduce((s, r) => s + r.records, 0);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">System:</span>
          <button
            onClick={() => setSystemFilter('all')}
            className={`text-xs px-2 py-1 font-bold border transition-colors ${
              systemFilter === 'all' ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'border-gray-300 hover:border-bauhaus-black'
            }`}
          >
            All
          </button>
          {systems.map(s => (
            <button
              key={s}
              onClick={() => setSystemFilter(systemFilter === s ? 'all' : s)}
              className={`text-xs px-2 py-1 font-bold border transition-colors ${
                systemFilter === s ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'border-gray-300 hover:border-bauhaus-black'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Period:</span>
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriodFilter(periodFilter === p ? 'all' : p)}
              className={`text-xs px-2 py-1 font-bold border transition-colors ${
                periodFilter === p ? 'bg-bauhaus-black text-white border-bauhaus-black' : 'border-gray-300 hover:border-bauhaus-black'
              }`}
            >
              {p === 'all' ? 'All Years' : p === 'recent' ? '2021+' : 'Pre-2021'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-4 border-bauhaus-black">
              <th className="text-left py-2 pr-4 font-black uppercase tracking-widest text-xs">Program</th>
              <th className="text-left py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">System</th>
              <th className="text-right py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Total</th>
              <th className="text-right py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Grants</th>
              <th className="text-left py-2 pl-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Period</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-2 pr-4">{p.program_name}</td>
                <td className="py-2 px-4">
                  <span className={`text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${SYSTEM_COLORS[p.system] ?? 'bg-gray-100'}`}>
                    {p.system}
                  </span>
                </td>
                <td className="py-2 px-4 text-right font-mono font-bold whitespace-nowrap">{money(Number(p.total))}</td>
                <td className="py-2 px-4 text-right">{p.records}</td>
                <td className="py-2 pl-4 text-gray-600 whitespace-nowrap">{p.from_fy} – {p.to_fy}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-4 border-bauhaus-black font-black">
              <td className="py-2">TOTAL ({filtered.length} programs)</td>
              <td></td>
              <td className="py-2 text-right font-mono">{money(filteredTotal)}</td>
              <td className="py-2 text-right">{filteredGrants}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
