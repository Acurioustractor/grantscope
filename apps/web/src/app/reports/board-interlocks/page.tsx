import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Board Interlocks & Executive Pay | CivicGraph Investigation',
  description:
    'A small network of people control billions in charity spending. Board interlocks, executive compensation, and cross-sector governance mapped.',
  openGraph: {
    title: 'Who Controls Australia\'s Charities?',
    description:
      'Board interlocks and executive pay across 3,000+ charities. The governance network exposed.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Who Controls Australia\'s Charities?',
    description:
      'Board interlocks and executive pay: a small network controls billions in charity spending.',
  },
};

import { money, fmt } from '@/lib/format';

/* ── helpers ── */

function pct(n: number, d: number): string {
  if (d === 0) return '0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── types ── */

interface PersonRole {
  person_name: string;
  person_name_normalised: string;
  role_type: string;
  company_abn: string;
  company_name: string;
}

interface AisRecord {
  abn: string;
  charity_name: string;
  total_revenue: number | null;
  total_expenses: number | null;
  total_paid_key_management: number | null;
  charity_size: string | null;
}

interface CommunityControlled {
  abn: string;
}

/* ── data loading ── */

async function getData() {
  const db = getServiceSupabase();

  // Query 1: All person_roles (paginated)
  const personRoles: PersonRole[] = [];
  {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const data = await safe(
        db
          .from('person_roles')
          .select('person_name, person_name_normalised, role_type, company_abn, company_name')
          .range(offset, offset + PAGE - 1),
      );
      const rows = (data ?? []) as PersonRole[];
      if (rows.length === 0) break;
      personRoles.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }

  // Query 2: ACNC AIS for 2023 (paginated)
  const aisRecords: AisRecord[] = [];
  {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const data = await safe(
        db
          .from('acnc_ais')
          .select('abn, charity_name, total_revenue, total_expenses, total_paid_key_management, charity_size')
          .eq('ais_year', 2023)
          .range(offset, offset + PAGE - 1),
      );
      const rows = (data ?? []) as AisRecord[];
      if (rows.length === 0) break;
      aisRecords.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }

  // Query 3: Community-controlled ABNs from gs_entities
  const accoAbns: CommunityControlled[] = [];
  {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const data = await safe(
        db
          .from('gs_entities')
          .select('abn')
          .eq('is_community_controlled', true)
          .not('abn', 'is', null)
          .range(offset, offset + PAGE - 1),
      );
      const rows = (data ?? []) as CommunityControlled[];
      if (rows.length === 0) break;
      accoAbns.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }

  return { personRoles, aisRecords, accoAbns };
}

/* ── computation ── */

interface PersonSummary {
  name: string;
  normalisedName: string;
  boards: number;
  charities: { abn: string; name: string; revenue: number; execPay: number }[];
  totalRevenue: number;
  totalExecPay: number;
}

function computeReport(
  personRoles: PersonRole[],
  aisRecords: AisRecord[],
  accoAbns: CommunityControlled[],
) {
  // Build AIS lookup by ABN
  const aisMap = new Map<string, AisRecord>();
  for (const r of aisRecords) {
    if (r.abn) aisMap.set(r.abn, r);
  }

  // Build ACCO set
  const accoSet = new Set(accoAbns.map(a => a.abn));

  // Group person_roles by normalised name
  const personMap = new Map<string, { name: string; roles: PersonRole[] }>();
  for (const pr of personRoles) {
    const key = pr.person_name_normalised || pr.person_name;
    if (!personMap.has(key)) {
      personMap.set(key, { name: pr.person_name, roles: [] });
    }
    personMap.get(key)!.roles.push(pr);
  }

  // Build person summaries (distinct ABNs per person)
  const people: PersonSummary[] = [];
  for (const [normName, { name, roles }] of personMap) {
    const abnSet = new Map<string, string>(); // abn -> charity name
    for (const r of roles) {
      if (r.company_abn && !abnSet.has(r.company_abn)) {
        abnSet.set(r.company_abn, r.company_name);
      }
    }
    if (abnSet.size < 2) continue; // only multi-board people

    const charities: PersonSummary['charities'] = [];
    let totalRev = 0;
    let totalPay = 0;
    for (const [abn, cname] of abnSet) {
      const ais = aisMap.get(abn);
      const rev = Number(ais?.total_revenue) || 0;
      const pay = Number(ais?.total_paid_key_management) || 0;
      charities.push({ abn, name: cname, revenue: rev, execPay: pay });
      totalRev += rev;
      totalPay += pay;
    }

    people.push({
      name,
      normalisedName: normName,
      boards: abnSet.size,
      charities,
      totalRevenue: totalRev,
      totalExecPay: totalPay,
    });
  }

  // Sort by boards desc, then total revenue desc
  people.sort((a, b) => b.boards - a.boards || b.totalRevenue - a.totalRevenue);

  // Stats
  const totalPeople = personMap.size;
  const totalBoardSeats = personRoles.length;
  const multiBoardPeople = people.length;
  const totalMultiBoardSeats = people.reduce((s, p) => s + p.boards, 0);
  const totalRevenueControlled = people.reduce((s, p) => s + p.totalRevenue, 0);
  const avgBoards = multiBoardPeople > 0 ? totalMultiBoardSeats / multiBoardPeople : 0;

  // Sector analysis
  const interlockedAbns = new Set<string>();
  for (const p of people) {
    for (const c of p.charities) interlockedAbns.add(c.abn);
  }

  let accoBoards = 0;
  let accoRevTotal = 0;
  let mainstreamBoards = 0;
  let mainstreamRevTotal = 0;
  const crossSectorPeople: PersonSummary[] = [];

  for (const p of people) {
    let hasAcco = false;
    let hasMainstream = false;
    for (const c of p.charities) {
      if (accoSet.has(c.abn)) {
        hasAcco = true;
        accoBoards++;
        accoRevTotal += c.revenue;
      } else {
        hasMainstream = true;
        mainstreamBoards++;
        mainstreamRevTotal += c.revenue;
      }
    }
    if (hasAcco && hasMainstream) crossSectorPeople.push(p);
  }

  // Exec pay comparison: interlocked vs standalone charities
  let interlockedPayTotal = 0;
  let interlockedPayCount = 0;
  let standalonePayTotal = 0;
  let standalonePayCount = 0;
  for (const [abn, ais] of aisMap) {
    const pay = Number(ais.total_paid_key_management) || 0;
    if (pay <= 0) continue;
    if (interlockedAbns.has(abn)) {
      interlockedPayTotal += pay;
      interlockedPayCount++;
    } else {
      standalonePayTotal += pay;
      standalonePayCount++;
    }
  }
  const avgPayInterlocked = interlockedPayCount > 0 ? interlockedPayTotal / interlockedPayCount : 0;
  const avgPayStandalone = standalonePayCount > 0 ? standalonePayTotal / standalonePayCount : 0;

  // Top 10 highest-paid networks (by total exec comp across charities)
  const topPaidNetworks = [...people]
    .filter(p => p.totalExecPay > 0)
    .sort((a, b) => b.totalExecPay - a.totalExecPay)
    .slice(0, 10);

  return {
    totalPeople,
    totalBoardSeats,
    multiBoardPeople,
    totalMultiBoardSeats,
    totalRevenueControlled,
    avgBoards,
    top20: people.slice(0, 20),
    accoBoards,
    accoRevTotal,
    accoAvgRev: accoBoards > 0 ? accoRevTotal / accoBoards : 0,
    mainstreamBoards,
    mainstreamRevTotal,
    mainstreamAvgRev: mainstreamBoards > 0 ? mainstreamRevTotal / mainstreamBoards : 0,
    crossSectorPeople: crossSectorPeople.slice(0, 10),
    avgPayInterlocked,
    avgPayStandalone,
    interlockedPayCount,
    standalonePayCount,
    topPaidNetworks,
  };
}

/* ── page ── */

export default async function BoardInterlocksReport() {
  const { personRoles, aisRecords, accoAbns } = await getData();
  const r = computeReport(personRoles, aisRecords, accoAbns);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a
          href="/reports"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; All Reports
        </a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">
          Governance Investigation
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Who Controls Australia&apos;s Charities?
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {fmt(r.totalPeople)} people hold {fmt(r.totalBoardSeats)} board seats across{' '}
          {fmt(new Set(personRoles.map(pr => pr.company_abn)).size)} charities.{' '}
          {fmt(r.multiBoardPeople)} of them serve on multiple boards, collectively controlling{' '}
          {money(r.totalRevenueControlled)} in revenue. A small network of people controls
          billions in charity spending.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated{' '}
          {new Date().toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              Multi-Board People
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(r.multiBoardPeople)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">serving on 2+ boards</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Total Seats Held
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(r.totalMultiBoardSeats)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              by multi-board members
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Revenue Controlled
            </div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">
              {money(r.totalRevenueControlled)}
            </div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">
              total charity revenue
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">
              Avg Boards
            </div>
            <div className="text-3xl sm:text-4xl font-black">{r.avgBoards.toFixed(1)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">per multi-board person</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ACNC Responsible Persons &times; ACNC Annual Information Statements (2023)
            &times; CivicGraph Entity Registry.
          </p>
        </div>
      </section>

      {/* Section: Top 20 most-connected people */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 20 Most-Connected People
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Ranked by number of distinct charity boards. Revenue figures from ACNC 2023
          Annual Information Statements.
        </p>
        {r.top20.length > 0 ? (
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-red text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">
                    #
                  </th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                    Person
                  </th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                    Boards
                  </th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                    Charities
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.top20.map((p, i) => {
                  const displayCharities = p.charities.slice(0, 3);
                  const moreCount = p.charities.length - 3;
                  return (
                    <tr
                      key={p.normalisedName}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}
                    >
                      <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-bauhaus-black">{p.name}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-black text-bauhaus-red">
                        {p.boards}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="text-xs text-bauhaus-muted leading-relaxed">
                          {displayCharities.map((c, ci) => (
                            <span key={c.abn}>
                              {ci > 0 && ', '}
                              <Link
                                href={`/org/${slugify(c.name)}`}
                                className="hover:text-bauhaus-red underline decoration-dotted"
                              >
                                {c.name}
                              </Link>
                            </span>
                          ))}
                          {moreCount > 0 && (
                            <span className="text-bauhaus-red font-black">
                              {' '}
                              and {moreCount} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-black whitespace-nowrap hidden sm:table-cell">
                        {money(p.totalRevenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white p-8 text-center">
            <p className="text-bauhaus-muted font-bold">No data available</p>
          </div>
        )}
      </section>

      <ReportCTA
        reportSlug="board-interlocks"
        reportTitle="Board Interlocks & Executive Pay"
        variant="inline"
      />

      {/* Section: Multi-board networks by sector */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Multi-Board Networks by Sector
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Board seats held by multi-board people, split by whether the charity is
          Aboriginal Community Controlled (ACCO) or mainstream. Cross-sector people bridge both worlds.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-6">
          <div className="border-4 border-bauhaus-black p-6 bg-green-900 text-white">
            <div className="text-xs font-black text-green-300 uppercase tracking-widest mb-2">
              ACCO Boards
            </div>
            <div className="text-3xl font-black">{fmt(r.accoBoards)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              Avg revenue: {money(r.accoAvgRev)}
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Mainstream Boards
            </div>
            <div className="text-3xl font-black text-bauhaus-black">{fmt(r.mainstreamBoards)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">
              Avg revenue: {money(r.mainstreamAvgRev)}
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Cross-Sector People
            </div>
            <div className="text-3xl font-black">{fmt(r.crossSectorPeople.length)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              on both ACCO + mainstream boards
            </div>
          </div>
        </div>
        {r.crossSectorPeople.length > 0 && (
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                    Person
                  </th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                    Boards
                  </th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                    Organisations
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.crossSectorPeople.map((p, i) => (
                  <tr key={p.normalisedName} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{p.name}</td>
                    <td className="p-3 text-center font-mono font-black text-bauhaus-red">
                      {p.boards}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="text-xs text-bauhaus-muted leading-relaxed">
                        {p.charities.slice(0, 4).map((c, ci) => (
                          <span key={c.abn}>
                            {ci > 0 && ', '}
                            <Link
                              href={`/org/${slugify(c.name)}`}
                              className="hover:text-bauhaus-red underline decoration-dotted"
                            >
                              {c.name}
                            </Link>
                          </span>
                        ))}
                        {p.charities.length > 4 && (
                          <span className="text-bauhaus-red font-black">
                            {' '}
                            +{p.charities.length - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section: Exec pay comparison */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Executive Pay at Interlocked Charities
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Do charities that share board members with other charities pay their executives more?
          Comparing average key management personnel compensation at interlocked vs standalone charities.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-4">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Interlocked Charities
            </div>
            <div className="text-3xl font-black">{money(r.avgPayInterlocked)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              avg exec pay ({fmt(r.interlockedPayCount)} charities reporting)
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Standalone Charities
            </div>
            <div className="text-3xl font-black text-bauhaus-black">
              {money(r.avgPayStandalone)}
            </div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">
              avg exec pay ({fmt(r.standalonePayCount)} charities reporting)
            </div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas">
          <p className="text-sm text-bauhaus-muted font-bold text-center">
            {r.avgPayInterlocked > r.avgPayStandalone ? (
              <>
                Interlocked charities pay{' '}
                <span className="text-bauhaus-red">
                  {pct(r.avgPayInterlocked - r.avgPayStandalone, r.avgPayStandalone)}
                </span>{' '}
                more on average in key management compensation.
              </>
            ) : r.avgPayInterlocked < r.avgPayStandalone ? (
              <>
                Standalone charities pay{' '}
                <span className="text-bauhaus-red">
                  {pct(r.avgPayStandalone - r.avgPayInterlocked, r.avgPayInterlocked)}
                </span>{' '}
                more on average in key management compensation.
              </>
            ) : (
              <>Average exec pay is comparable between interlocked and standalone charities.</>
            )}
          </p>
        </div>
      </section>

      {/* Section: Top 10 highest-paid interlocked networks */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 10 Highest-Paid Interlocked Networks
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          People who sit on multiple boards, ranked by total key management personnel
          compensation across all their charities. The question: how much executive pay
          flows through these governance networks?
        </p>
        {r.topPaidNetworks.length > 0 ? (
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">
                    #
                  </th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                    Person
                  </th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                    Boards
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                    Total Exec Pay
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                    Total Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.topPaidNetworks.map((p, i) => (
                  <tr
                    key={p.normalisedName}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-bauhaus-black">{p.name}</div>
                      <div className="text-xs text-bauhaus-muted mt-1">
                        {p.charities.slice(0, 3).map((c, ci) => (
                          <span key={c.abn}>
                            {ci > 0 && ', '}
                            <Link
                              href={`/org/${slugify(c.name)}`}
                              className="hover:text-bauhaus-red underline decoration-dotted"
                            >
                              {c.name}
                            </Link>
                          </span>
                        ))}
                        {p.charities.length > 3 && (
                          <span className="text-bauhaus-red font-black">
                            {' '}
                            +{p.charities.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-black text-bauhaus-red">
                      {p.boards}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                      {money(p.totalExecPay)}
                    </td>
                    <td className="p-3 text-right font-mono font-black whitespace-nowrap hidden sm:table-cell">
                      {money(p.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white p-8 text-center">
            <p className="text-bauhaus-muted font-bold">No exec pay data available</p>
          </div>
        )}
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">
            Methodology
          </h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Board interlocks:</strong> Identified from the CivicGraph{' '}
              <code>person_roles</code> table ({fmt(personRoles.length)} records), which
              aggregates responsible person data from ACNC and ASIC filings. A person is
              flagged as &ldquo;multi-board&rdquo; when they appear as a responsible person
              on 2 or more registered charities (matched by normalised name).
            </p>
            <p>
              <strong>Revenue and executive pay:</strong> Sourced from ACNC Annual Information
              Statements (2023 reporting year). Total revenue and total key management
              personnel compensation are self-reported by charities. Not all charities report
              executive pay; only those with <code>has_key_management_personnel = true</code>{' '}
              and a non-zero <code>total_paid_key_management</code> value are included in
              compensation analysis.
            </p>
            <p>
              <strong>Community-controlled classification:</strong> Charities flagged as
              Aboriginal Community Controlled Organisations (ACCOs) are identified via
              CivicGraph&apos;s entity classification system, which uses ABN matching, name
              patterns, and sector analysis.
            </p>
            <p>
              <strong>Limitations:</strong> Name-based matching carries inherent ambiguity
              &mdash; common names may produce false positives. Board data reflects
              point-in-time filings and may not capture all current appointments. Executive
              pay figures are aggregated totals for all key management personnel, not
              individual salaries. Revenue figures are from the most recent available AIS
              (2023) and may not reflect current financial positions.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <ReportCTA reportSlug="board-interlocks" reportTitle="Board Interlocks & Executive Pay" />
    </div>
  );
}
