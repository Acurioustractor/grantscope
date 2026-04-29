import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Who Runs Australia? | CivicGraph Investigation',
  description: 'Cross-system influence analysis: boards, political donations, lobbying, and government contracts. 4,716 revolving door entities. 111 multi-board directors. 14 board members who donate politically.',
  openGraph: {
    title: 'Who Runs Australia?',
    description: 'Cross-system influence analysis across boards, political donations, lobbying, and government contracts.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Who Runs Australia?',
    description: 'Cross-system influence analysis: boards, donations, lobbying, contracts. The influence network mapped.',
  },
};

import { money, fmt } from '@/lib/format';

interface RevolvingDoorEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string;
  state: string;
  lga_name: string | null;
  is_community_controlled: boolean;
  lobbies: boolean;
  donates: boolean;
  contracts: boolean;
  receives_funding: boolean;
  influence_vectors: number;
  revolving_door_score: number;
  total_donated: number;
  total_contracts: number;
  total_funded: number;
  parties_funded: string[];
  distinct_buyers: number;
}

interface BoardInterlock {
  person_name_normalised: string;
  person_name_display: string;
  board_count: number;
  organisations: string[];
  role_types: string[];
  total_procurement_dollars: number;
  total_justice_dollars: number;
  total_donation_dollars: number;
  max_entity_system_count: number;
  total_power_score: number;
  connects_community_controlled: boolean;
  interlock_score: number;
}

interface PoliticalCrossover {
  person_name_normalised: string;
  display_name: string;
  board_count: number;
  board_entities: string[];
  total_donated: number;
  parties_funded: number;
  parties_funded_list: string[];
  donation_years: number;
  influence_score: number;
}

interface Stats {
  revolvingDoorTotal: number;
  threeVectorPlus: number;
  multiBoardPeople: number;
  boardDonors: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getData() {
  const supabase = getServiceSupabase();

  const [
    revolvingDoorResult,
    boardInterlocksResult,
    politicalCrossoverResult,
    statsResult,
  ] = await Promise.all([
    // Top revolving door entities by score
    safe(supabase
      .from('mv_revolving_door')
      .select('gs_id, canonical_name, entity_type, abn, state, lga_name, is_community_controlled, lobbies, donates, contracts, receives_funding, influence_vectors, revolving_door_score, total_donated, total_contracts, total_funded, parties_funded, distinct_buyers')
      .order('revolving_door_score', { ascending: false })
      .limit(20)),

    // Top board interlocks by interlock_score
    safe(supabase
      .from('mv_board_interlocks')
      .select('person_name_normalised, person_name_display, board_count, organisations, role_types, total_procurement_dollars, total_justice_dollars, total_donation_dollars, max_entity_system_count, total_power_score, connects_community_controlled, interlock_score')
      .gte('board_count', 2)
      .order('interlock_score', { ascending: false })
      .limit(20)),

    // People who sit on charity boards AND donate politically
    safe(supabase
      .from('mv_person_cross_system')
      .select('person_name_normalised, display_name, board_count, board_entities, total_donated, parties_funded, parties_funded_list, donation_years, influence_score')
      .eq('on_charity_boards', true)
      .eq('is_political_donor', true)
      .order('influence_score', { ascending: false })
      .limit(20)),

    // Aggregate stats
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
        (SELECT COUNT(*)::int FROM mv_revolving_door) as revolving_door_total,
        (SELECT COUNT(*)::int FROM mv_revolving_door WHERE influence_vectors >= 3) as three_vector_plus,
        (SELECT COUNT(*)::int FROM mv_board_interlocks WHERE board_count >= 2) as multi_board_people,
        (SELECT COUNT(*)::int FROM mv_person_cross_system WHERE on_charity_boards AND is_political_donor) as board_donors`,
    })),
  ]);

  const revolvingDoor = (revolvingDoorResult || []) as RevolvingDoorEntity[];
  const boardInterlocks = (boardInterlocksResult || []) as BoardInterlock[];
  const politicalCrossover = (politicalCrossoverResult || []) as PoliticalCrossover[];

  const summary = (statsResult as Record<string, string>[] | null)?.[0];
  const stats: Stats = {
    revolvingDoorTotal: Number(summary?.revolving_door_total) || 0,
    threeVectorPlus: Number(summary?.three_vector_plus) || 0,
    multiBoardPeople: Number(summary?.multi_board_people) || 0,
    boardDonors: Number(summary?.board_donors) || 0,
  };

  return { revolvingDoor, boardInterlocks, politicalCrossover, stats };
}

function VectorBadges({ entity }: { entity: RevolvingDoorEntity }) {
  const vectors = [
    { active: entity.lobbies, label: 'LOBBIES', color: 'bg-red-700' },
    { active: entity.donates, label: 'DONATES', color: 'bg-red-500' },
    { active: entity.contracts, label: 'CONTRACTS', color: 'bg-blue-600' },
    { active: entity.receives_funding, label: 'FUNDED', color: 'bg-amber-500' },
  ];
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {vectors.filter(v => v.active).map(v => (
        <span key={v.label} className={`inline-block px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${v.color}`}>
          {v.label}
        </span>
      ))}
    </div>
  );
}

export default async function WhoRunsAustraliaReport() {
  const d = await getData();
  const s = d.stats;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-System Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Who Runs Australia?
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Cross-system influence analysis: boards, political donations, lobbying, and
          government contracts. {fmt(s.revolvingDoorTotal)} entities operate through multiple
          influence channels simultaneously. {fmt(s.multiBoardPeople)} people sit on
          multiple charity boards. {fmt(s.boardDonors)} board members also donate politically.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Revolving Door</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.revolvingDoorTotal)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">entities with 2+ influence vectors</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Multi-Board Directors</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.multiBoardPeople)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">people on 2+ charity boards</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Political Crossover</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{fmt(s.boardDonors)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">board members who donate politically</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: AusTender &times; AEC Donations &times; ACNC Registry &times; Justice Funding &times; Lobbying Records.
            All cross-referenced by ABN and name.
          </p>
        </div>
      </section>

      {/* Section 1: Revolving Door */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Revolving Door
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(s.revolvingDoorTotal)} entities operate through 2+ influence channels:
          lobbying, political donations, government contracts, and/or justice funding.
          {s.threeVectorPlus > 0 && ` ${fmt(s.threeVectorPlus)} use 3 or more channels simultaneously.`}
          {' '}Scored by influence type: lobbying (5x), donations (3x),
          contracts (2x), funding (1x), plus dollar thresholds.
        </p>
        {d.revolvingDoor.length > 0 ? (
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-red text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Vectors</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Score</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donated</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                </tr>
              </thead>
              <tbody>
                {d.revolvingDoor.map((e, i) => (
                  <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <Link href={`/org/${slugify(e.canonical_name)}`} className="hover:text-bauhaus-red transition-colors">
                        <div className="font-bold text-bauhaus-black">{e.canonical_name}</div>
                        <div className="text-xs text-bauhaus-muted">
                          {e.entity_type} &middot; {e.state || '\u2014'}
                          {e.is_community_controlled && <span className="ml-2 text-green-700 font-black">COMMUNITY</span>}
                        </div>
                        <VectorBadges entity={e} />
                      </Link>
                    </td>
                    <td className="p-3 text-center font-mono font-black text-bauhaus-red">{e.influence_vectors}</td>
                    <td className="p-3 text-right font-mono font-black hidden sm:table-cell">{e.revolving_door_score}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">{money(Number(e.total_donated))}</td>
                    <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(Number(e.total_contracts))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white p-8 text-center">
            <p className="text-bauhaus-muted font-bold">No data available</p>
          </div>
        )}
        <div className="mt-3 text-right">
          <Link href="/api/data/who-runs-australia" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
            Raw Data API &rarr;
          </Link>
        </div>
      </section>

      <ReportCTA reportSlug="who-runs-australia" reportTitle="Who Runs Australia?" variant="inline" />

      {/* Section 2: Board Interlocks */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Board Interlocks
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(s.multiBoardPeople)} people sit on 2 or more charity boards simultaneously,
          creating structural connections between organisations. Scored by the financial
          significance and cross-system presence of the organisations they connect.
        </p>
        {d.boardInterlocks.length > 0 ? (
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Person</th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Boards</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Organisations</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Interlock Score</th>
                </tr>
              </thead>
              <tbody>
                {d.boardInterlocks.map((p, i) => {
                  const orgs = p.organisations || [];
                  const displayOrgs = orgs.slice(0, 3);
                  const moreCount = orgs.length - 3;
                  return (
                    <tr key={p.person_name_normalised} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-bauhaus-black">{p.person_name_display}</div>
                        <div className="text-xs text-bauhaus-muted">
                          {(p.role_types || []).join(', ')}
                          {p.connects_community_controlled && <span className="ml-2 text-green-700 font-black">ACCO LINK</span>}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-black text-bauhaus-red">{p.board_count}</td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="text-xs text-bauhaus-muted leading-relaxed">
                          {displayOrgs.join(', ')}
                          {moreCount > 0 && <span className="text-bauhaus-red font-black"> +{moreCount} more</span>}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-black hidden sm:table-cell">{Number(p.interlock_score).toFixed(0)}</td>
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

      {/* Section 3: Political Crossover */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Political Crossover
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(s.boardDonors)} people sit on charity boards AND donate to political
          parties. These individuals bridge the nonprofit and political systems,
          raising questions about where philanthropic governance ends and political
          influence begins.
        </p>
        {d.politicalCrossover.length > 0 ? (
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-blue text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Person</th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Boards</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Donated</th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties Funded</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Parties</th>
                </tr>
              </thead>
              <tbody>
                {d.politicalCrossover.map((p, i) => (
                  <tr key={p.person_name_normalised} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-bauhaus-black">{p.display_name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {(p.board_entities || []).slice(0, 2).join(', ')}
                        {(p.board_entities || []).length > 2 && ` +${(p.board_entities || []).length - 2} more`}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-black">{p.board_count}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                      {money(Number(p.total_donated))}
                    </td>
                    <td className="p-3 text-center font-mono font-black hidden sm:table-cell">{p.parties_funded}</td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(p.parties_funded_list || []).slice(0, 3).map(party => (
                          <span key={party} className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-white rounded bg-bauhaus-blue/80">
                            {party.length > 25 ? party.substring(0, 22) + '...' : party}
                          </span>
                        ))}
                        {(p.parties_funded_list || []).length > 3 && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-bauhaus-muted">
                            +{(p.parties_funded_list || []).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white p-8 text-center">
            <p className="text-bauhaus-muted font-bold">No data available</p>
          </div>
        )}
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Revolving door entities:</strong> Identified from the cross-system entity
              graph by matching entities across lobbying records, political donation data (AEC),
              government contracts (AusTender), and justice/social program funding. An entity
              qualifies as &ldquo;revolving door&rdquo; when it appears in 2 or more of these
              influence systems. Scored by influence type weight: lobbying (5x), donations (3x),
              contracts (2x), funding (1x), with bonuses for high-dollar amounts and breadth
              of political party funding.
            </p>
            <p>
              <strong>Board interlocks:</strong> Drawn from ACNC responsible person data. When
              the same individual (matched by normalised name) appears as a responsible person
              on 2 or more registered charities, they form an interlock. Scored by the combined
              financial significance (procurement, justice funding, and donation dollars) and
              cross-system presence of the connected organisations.
            </p>
            <p>
              <strong>Political crossover:</strong> People who appear in both the ACNC responsible
              person registry AND the AEC political donation records. Matched by normalised name.
              Shows the intersection of nonprofit governance and political funding, highlighting
              individuals who bridge both systems.
            </p>
            <p>
              <strong>Limitations:</strong> Name matching for individuals carries inherent
              ambiguity -- common names may produce false positives. Board data is limited
              to ACNC responsible persons (typically directors/trustees) and does not yet
              include ASIC officeholder data. Political donation data has AEC reporting
              thresholds. Lobbying data coverage varies by jurisdiction.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore the Influence Network</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            See these entities and their connections on the interactive network graph.
            Trace influence flows across boards, donations, contracts, and funding.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Power Index Report
            </Link>
            <Link
              href="/graph?mode=power&min_systems=3"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Power Map (3+ Systems)
            </Link>
            <Link
              href="/api/data/who-runs-australia"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Raw Data API
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="who-runs-australia" reportTitle="Who Runs Australia?" />
    </div>
  );
}
