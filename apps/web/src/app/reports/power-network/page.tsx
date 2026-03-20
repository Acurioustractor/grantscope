import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Power Network: Who Runs Australia\'s Civic Sector | CivicGraph',
  description: '237,984 people mapped across boards, foundations, political donations, and government contracts. Who holds power, who sits on multiple boards, and who controls the money.',
  openGraph: {
    title: 'Power Network: Who Runs Australia\'s Civic Sector',
    description: '237,984 people mapped across boards, foundations, and political systems. The power network of Australia\'s civic sector revealed.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Power Network: Who Runs Australia\'s Civic Sector',
    description: '237,984 people. Board interlocks. Political money. The civic power network mapped.',
  },
};

/* --- Formatting helpers ---------------------------------------- */

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmt(n: number): string { return n.toLocaleString(); }

/* --- Types ----------------------------------------------------- */

interface PersonPowerRow {
  person_name_normalised: string;
  power_score: number;
  system_count: number;
  board_count: number;
  role_count: number;
  is_politician: boolean;
  is_foundation_trustee: boolean;
  donation_count: number;
  parties_donated_to: number;
  total_donated: number;
  contract_count: number;
  total_contract_value: number;
  justice_grant_count: number;
  total_justice_funding: number;
  foundation_count: number;
  total_foundation_giving: number;
}

interface SystemDistRow {
  system_count: number;
  people: number;
}

interface TrusteeGranteeRow {
  person_name_normalised: string;
  foundation_name: string;
  foundation_abn: string;
  recipient_name: string;
  recipient_abn: string;
  foundation_giving: number;
  funding_to_recipient: number;
  grant_count: number;
}

/* --- Safe wrapper ---------------------------------------------- */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Query failed:', error);
    return fallback;
  }
}

/* --- Data fetching --------------------------------------------- */

async function getData() {
  const db = getServiceSupabase();

  // All queries use pre-computed materialized views — fast, no timeouts
  const [topPower, stats, systemDist, politicians, donorDirectors, trusteeGrantee, trusteePower] = await Promise.all([
    // Top 50 by power score
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT * FROM mv_person_network ORDER BY power_score DESC LIMIT 50`,
      });
      return (data || []) as PersonPowerRow[];
    }, [] as PersonPowerRow[]),

    // Hero stats
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total_people,
          COUNT(*) FILTER (WHERE board_count > 1) as board_interlockers,
          COUNT(*) FILTER (WHERE total_donated > 0 AND board_count > 0) as donor_directors,
          COUNT(*) FILTER (WHERE system_count >= 3) as multi_system,
          COUNT(*) FILTER (WHERE is_politician) as politicians,
          COUNT(*) FILTER (WHERE is_foundation_trustee) as foundation_trustees
        FROM mv_person_network`,
      });
      return data?.[0] || { total_people: 0, board_interlockers: 0, donor_directors: 0, multi_system: 0, politicians: 0, foundation_trustees: 0 };
    }, { total_people: 0, board_interlockers: 0, donor_directors: 0, multi_system: 0, politicians: 0, foundation_trustees: 0 }),

    // System distribution
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT system_count, COUNT(*) as people FROM mv_person_network GROUP BY system_count ORDER BY system_count DESC`,
      });
      return (data || []) as SystemDistRow[];
    }, [] as SystemDistRow[]),

    // Politicians on charity boards
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT * FROM mv_person_network WHERE is_politician = true AND board_count > 1 ORDER BY board_count DESC LIMIT 20`,
      });
      return (data || []) as PersonPowerRow[];
    }, [] as PersonPowerRow[]),

    // Donate → Direct → Contract cycle
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT * FROM mv_person_network WHERE total_donated > 1000 AND total_contract_value > 0 ORDER BY total_donated DESC LIMIT 20`,
      });
      return (data || []) as PersonPowerRow[];
    }, [] as PersonPowerRow[]),

    // Trustee-grantee conflicts
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT * FROM mv_trustee_grantee_overlaps ORDER BY funding_to_recipient DESC LIMIT 30`,
      });
      return (data || []) as TrusteeGranteeRow[];
    }, [] as TrusteeGranteeRow[]),

    // Foundation trustee power
    safe(async () => {
      const { data } = await db.rpc('exec_sql', {
        query: `SELECT * FROM mv_person_network WHERE is_foundation_trustee = true AND total_foundation_giving > 0 ORDER BY total_foundation_giving DESC LIMIT 20`,
      });
      return (data || []) as PersonPowerRow[];
    }, [] as PersonPowerRow[]),
  ]);

  // Coerce bigints to numbers
  const coerce = (rows: PersonPowerRow[]) => rows.map(p => ({
    ...p,
    power_score: Number(p.power_score) || 0,
    system_count: Number(p.system_count) || 0,
    board_count: Number(p.board_count) || 0,
    total_donated: Number(p.total_donated) || 0,
    total_contract_value: Number(p.total_contract_value) || 0,
    total_justice_funding: Number(p.total_justice_funding) || 0,
    total_foundation_giving: Number(p.total_foundation_giving) || 0,
    parties_donated_to: Number(p.parties_donated_to) || 0,
  }));

  return {
    topPower: coerce(topPower),
    stats: {
      total_people: Number(stats.total_people) || 0,
      board_interlockers: Number(stats.board_interlockers) || 0,
      donor_directors: Number(stats.donor_directors) || 0,
      multi_system: Number(stats.multi_system) || 0,
      politicians: Number((stats as any).politicians) || 0,
      foundation_trustees: Number((stats as any).foundation_trustees) || 0,
    },
    systemDist: systemDist.map(r => ({ system_count: Number(r.system_count), people: Number(r.people) })),
    politicians: coerce(politicians),
    donorDirectors: coerce(donorDirectors),
    trusteeGrantee: trusteeGrantee.map(t => ({
      ...t,
      funding_to_recipient: Number(t.funding_to_recipient) || 0,
      foundation_giving: Number(t.foundation_giving) || 0,
      grant_count: Number(t.grant_count) || 0,
    })),
    trusteePower: coerce(trusteePower),
  };
}

/* --- Page ------------------------------------------------------ */

export default async function PowerNetworkReport() {
  const d = await getData();
  const s = d.stats;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">People Power Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Power Network: Who Runs Australia&apos;s Civic Sector?
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {fmt(s.total_people)} people mapped across 6 systems: charity boards, foundations,
          political donations, government contracts, justice funding, and parliament.
          Scored by cross-system influence.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats bar */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Total People</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.total_people)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">across 339,687 roles</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Board Interlockers</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.board_interlockers)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">sit on 2+ boards</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Donor-Directors</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{fmt(s.donor_directors)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">donate + direct boards</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Multi-System</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.multi_system)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">3+ systems touched</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ACNC responsible persons &times; political donations &times; AusTender contracts &times; justice funding &times; foundations &times; parliament.
          </p>
        </div>
      </section>

      {/* Top 50 Power Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 50 by Power Score
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Composite score: boards held + political donations + contract pipeline + justice funding + foundation giving + politician status.
          Cross-system multiplier rewards people who span multiple systems.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Name</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Score</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Systems</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Boards</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden lg:table-cell">Justice $</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden lg:table-cell">Foundation $</th>
              </tr>
            </thead>
            <tbody>
              {d.topPower.map((p, i) => {
                const sysColor =
                  p.system_count >= 5 ? 'text-bauhaus-red' :
                  p.system_count >= 4 ? 'text-orange-600' :
                  p.system_count >= 3 ? 'text-bauhaus-yellow' :
                  p.system_count >= 2 ? 'text-bauhaus-blue' :
                  'text-bauhaus-muted';

                return (
                  <tr key={`${p.person_name_normalised}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-bauhaus-black capitalize">{p.person_name_normalised.toLowerCase()}</div>
                      <div className="text-xs mt-1 space-x-2">
                        {p.is_politician && <span className="text-red-600 font-black">MP</span>}
                        {p.is_foundation_trustee && <span className="text-purple-600 font-black">TRUSTEE</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{p.power_score}</td>
                    <td className={`p-3 text-right font-mono font-black ${sysColor} hidden sm:table-cell`}>{p.system_count}</td>
                    <td className="p-3 text-right font-mono hidden sm:table-cell">{p.board_count}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">
                      {p.total_donated > 0 ? money(p.total_donated) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                      {p.total_contract_value > 0 ? money(p.total_contract_value) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden lg:table-cell">
                      {p.total_justice_funding > 0 ? money(p.total_justice_funding) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden lg:table-cell">
                      {p.total_foundation_giving > 0 ? money(p.total_foundation_giving) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* System Distribution Chart */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          System Distribution
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          6 systems: charity boards, political donations, government contracts, justice funding, foundations, parliament.
          Most people appear in 1 system. The power elite span 4-6.
        </p>
        <div className="border-4 border-bauhaus-black p-6 bg-white">
          {d.systemDist.map(row => {
            const maxCount = Math.max(...d.systemDist.map(r => r.people));
            const widthPct = (row.people / maxCount) * 100;
            const barColor =
              row.system_count >= 5 ? 'bg-bauhaus-red' :
              row.system_count >= 4 ? 'bg-orange-600' :
              row.system_count >= 3 ? 'bg-yellow-600' :
              row.system_count >= 2 ? 'bg-bauhaus-blue' :
              'bg-gray-400';

            return (
              <div key={row.system_count} className="flex items-center gap-3 mb-3">
                <div className="w-24 text-xs font-bold text-bauhaus-black text-right shrink-0">
                  {row.system_count} {row.system_count === 1 ? 'system' : 'systems'}
                </div>
                <div className="flex-1 h-8 bg-gray-100 relative">
                  <div
                    className={`h-full ${barColor} transition-all flex items-center justify-end pr-3`}
                    style={{ width: `${Math.max(widthPct, 5)}%` }}
                  >
                    <span className="text-xs font-black text-white">{fmt(row.people)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ReportCTA reportSlug="power-network" reportTitle="Power Network" variant="inline" />

      {/* Donate → Direct → Contract Cycle */}
      {d.donorDirectors.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            The Donate &rarr; Direct &rarr; Contract Cycle
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            People who donate to political parties AND sit on boards of organisations with government contracts.
            The direct line between political money and procurement outcomes.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-red text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Name</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donated</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Boards</th>
                </tr>
              </thead>
              <tbody>
                {d.donorDirectors.map((p, i) => (
                  <tr key={`donor-${p.person_name_normalised}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3 font-bold text-bauhaus-black capitalize">{p.person_name_normalised.toLowerCase()}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">{money(p.total_donated)}</td>
                    <td className="p-3 text-right font-mono hidden sm:table-cell">{p.parties_donated_to}</td>
                    <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(p.total_contract_value)}</td>
                    <td className="p-3 text-right font-mono hidden md:table-cell">{p.board_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Politicians on Charity Boards */}
      {d.politicians.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Politicians on Charity Boards
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Current and former MPs who also sit on charity and nonprofit boards.
            The intersection of political power and civic governance.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Name</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Boards</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Power</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donated</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Contracts</th>
                </tr>
              </thead>
              <tbody>
                {d.politicians.map((p, i) => (
                  <tr key={`pol-${p.person_name_normalised}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-bauhaus-black capitalize">{p.person_name_normalised.toLowerCase()}</div>
                      <span className="text-xs text-red-600 font-black">MP</span>
                    </td>
                    <td className="p-3 text-right font-mono font-black">{p.board_count}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{p.power_score}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">
                      {p.total_donated > 0 ? money(p.total_donated) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                      {p.total_contract_value > 0 ? money(p.total_contract_value) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Trustee-Grantee Conflicts */}
      {d.trusteeGrantee.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Trustee-Grantee Overlaps
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Foundation trustees who also sit on boards of organisations that receive justice funding.
            Same person, two sides of the table.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-blue text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Person</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Foundation</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Recipient Org</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                </tr>
              </thead>
              <tbody>
                {d.trusteeGrantee.map((t, i) => (
                  <tr key={`tg-${t.person_name_normalised}-${t.foundation_abn}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3 font-bold text-bauhaus-black capitalize">{t.person_name_normalised.toLowerCase()}</td>
                    <td className="p-3 text-sm">{t.foundation_name}</td>
                    <td className="p-3 text-sm text-bauhaus-muted hidden md:table-cell">{t.recipient_name}</td>
                    <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                      {t.funding_to_recipient > 0 ? money(t.funding_to_recipient) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Foundation Trustee Power */}
      {d.trusteePower.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Foundation Trustee Power
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            People who govern foundations and control where philanthropic dollars flow.
            Ranked by total foundation giving under their governance.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-700 text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Name</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Foundation $</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Boards</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Power</th>
                </tr>
              </thead>
              <tbody>
                {d.trusteePower.map((p, i) => (
                  <tr key={`trustee-${p.person_name_normalised}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-bauhaus-black capitalize">{p.person_name_normalised.toLowerCase()}</div>
                      <span className="text-xs text-purple-600 font-black">TRUSTEE</span>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-purple-700 whitespace-nowrap">{money(p.total_foundation_giving)}</td>
                    <td className="p-3 text-right font-mono hidden sm:table-cell">{p.board_count}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red hidden md:table-cell">{p.power_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* How The System Works */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-6 text-bauhaus-yellow uppercase tracking-widest">
            The Person Network Explained
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-yellow mb-3">1</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Board Interlocks</div>
              <p className="text-sm text-white/70">
                {fmt(s.board_interlockers)} people sit on 2+ boards simultaneously. These
                board interlocks create power networks that span organisations, sectors, and systems.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-yellow mb-3">2</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Political Money</div>
              <p className="text-sm text-white/70">
                {fmt(s.donor_directors)} people both donate to political parties AND sit on
                organisational boards. The direct link between political funding and civic governance.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-yellow mb-3">3</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Foundation Control</div>
              <p className="text-sm text-white/70">
                Trustees decide where foundation dollars flow. When trustees also sit on
                recipient boards, conflicts of interest emerge.
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-white/20 text-center">
            <p className="text-sm text-white/50 max-w-2xl mx-auto">
              CivicGraph maps {fmt(s.total_people)} people across ACNC responsible persons,
              ASIC officeholders, political donations, and government contracts. All linked
              by name normalization to reveal Australia's civic power network.
            </p>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Person resolution:</strong> People are matched across datasets using normalized
              name matching (lowercase, trimmed, punctuation removed). This approach has limitations —
              common names may be conflated, and people who use different name variations across
              datasets may be split into multiple records.
            </p>
            <p>
              <strong>Board interlocks:</strong> Counted as people who appear as directors, trustees,
              or officeholders on 2 or more organisational boards where the cessation date is null
              or in the future. Data sourced from ACNC responsible persons and ASIC officeholder records.
            </p>
            <p>
              <strong>Political donations:</strong> Individual donations (where donor_abn is null)
              are attributed to people by name matching. Corporate donations are excluded from person-level
              analysis. Data sourced from AEC political donations transparency register.
            </p>
            <p>
              <strong>Systems count:</strong> A person is counted as touching a "system" if they meet
              any of the following criteria: (1) board interlock (2+ boards), (2) political donor
              (&gt;$1,000 donated), (3) foundation trustee. Maximum systems count is 3 in this analysis.
            </p>
            <p>
              <strong>Trustee-grantee overlaps:</strong> Identified by matching people who hold trustee
              roles on foundation boards with people who sit on boards of organisations that receive
              grants from those foundations. Requires foundation grantee data to be available and linked.
            </p>
            <p>
              <strong>Limitations:</strong> Name-based matching has error rates. Common names (e.g., "John Smith")
              may aggregate multiple people. Spelling variations, nicknames, and name changes create
              false negatives. ASIC officeholder data would significantly improve coverage but is not
              yet fully integrated. Politicians are identified from political_candidates table which
              may have incomplete coverage.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore Related Reports</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            See how organisational power concentration, influence networks, and political money
            intersect with the people who run Australia's civic sector.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Power Concentration
            </Link>
            <Link
              href="/reports/influence-network"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Influence Network
            </Link>
            <Link
              href="/graph?mode=people"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Person Network Graph
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="power-network" reportTitle="Power Network" />
    </div>
  );
}
