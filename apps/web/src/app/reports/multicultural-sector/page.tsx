import Link from 'next/link';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';

const CLUSTER_ABNS = [
  '32390500229', '86110721406', '50192038354', '77674760578', '18134375892',
  '89278892329', '57738423800', '78596425974', '57894189429', '65071572705',
  '91163351869', '66291586945', '23684792947', '29252806279', '62711639794',
  '79445438274', '85023648955', '26186698348', '88244322400', '37282486762',
  '55010151256', '64758439692',
];

const ABNS_SQL = CLUSTER_ABNS.map(a => `'${a}'`).join(',');

type EntityRow = {
  gs_id: string;
  canonical_name: string;
  abn: string;
  state: string | null;
  ais_year: number | null;
  govt: number | null;
  donations: number | null;
  fees: number | null;
  total: number | null;
  govt_pct: number | null;
  staff_ft: number | null;
  staff_vols: number | null;
};

type ContractRow = {
  entity: string;
  buyer: string;
  title: string | null;
  value: number;
  contract_start: string | null;
  contract_end: string | null;
};

type DirectorRow = {
  person_name: string;
  all_boards: string;
  total_boards: number;
};

type InfluenceRow = {
  person_name: string;
  board_count: number;
  procurement: number | null;
  justice: number | null;
  donations: number | null;
  influence: number | null;
};

function money(n: number | null | undefined): string {
  if (!n) return '$0';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(0)}%`;
}

function dependencyTier(p: number | null): { label: string; bg: string; fg: string } {
  if (p == null) return { label: 'No AIS', bg: 'bg-bauhaus-canvas', fg: 'text-bauhaus-muted' };
  if (p >= 80) return { label: 'CRITICAL', bg: 'bg-bauhaus-red', fg: 'text-white' };
  if (p >= 50) return { label: 'HIGH', bg: 'bg-bauhaus-yellow', fg: 'text-bauhaus-black' };
  if (p > 0) return { label: 'MIXED', bg: 'bg-bauhaus-blue', fg: 'text-white' };
  return { label: 'UNKNOWN', bg: 'bg-bauhaus-canvas', fg: 'text-bauhaus-muted' };
}

async function getReport() {
  const supabase = getLiveReportSupabase();

  const [entities, contracts, directors, influence] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT e.gs_id, e.canonical_name, e.abn, e.state,
               a.ais_year::int,
               a.revenue_from_government::bigint AS govt,
               a.donations_and_bequests::bigint  AS donations,
               a.revenue_from_goods_services::bigint AS fees,
               a.total_revenue::bigint AS total,
               CASE WHEN a.total_revenue > 0
                    THEN (a.revenue_from_government / a.total_revenue) * 100
               END::numeric(5,1) AS govt_pct,
               a.staff_full_time::int AS staff_ft,
               a.staff_volunteers::int AS staff_vols
        FROM public.gs_entities e
        LEFT JOIN LATERAL (
          SELECT * FROM public.acnc_ais WHERE abn = e.abn ORDER BY ais_year DESC LIMIT 1
        ) a ON true
        WHERE e.abn IN (${ABNS_SQL})
        ORDER BY a.total_revenue DESC NULLS LAST
      `,
    })) as Promise<EntityRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT e.canonical_name AS entity,
               ac.buyer_name AS buyer,
               ac.title,
               ac.contract_value::bigint AS value,
               ac.contract_start::text,
               ac.contract_end::text
        FROM public.austender_contracts ac
        JOIN public.gs_entities e ON e.abn = ac.supplier_abn
        WHERE ac.supplier_abn IN (${ABNS_SQL})
        ORDER BY ac.contract_value DESC NULLS LAST
        LIMIT 30
      `,
    })) as Promise<ContractRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        WITH cluster AS (
          SELECT id, canonical_name FROM public.gs_entities WHERE abn IN (${ABNS_SQL})
        ),
        cluster_directors AS (
          SELECT DISTINCT src.id AS person_id, src.canonical_name AS person_name
          FROM public.gs_relationships r
          JOIN public.gs_entities src ON src.id = r.source_entity_id
          JOIN cluster tgt ON tgt.id = r.target_entity_id
          WHERE r.relationship_type = 'directorship' AND src.gs_id LIKE 'GS-PERSON-%'
        )
        SELECT cd.person_name,
               string_agg(DISTINCT te.canonical_name, ' | ' ORDER BY te.canonical_name) AS all_boards,
               COUNT(DISTINCT te.id)::int AS total_boards
        FROM cluster_directors cd
        JOIN public.gs_relationships r2 ON r2.source_entity_id = cd.person_id AND r2.relationship_type = 'directorship'
        JOIN public.gs_entities te ON te.id = r2.target_entity_id
        GROUP BY cd.person_name
        HAVING COUNT(DISTINCT te.id) >= 2
        ORDER BY total_boards DESC, cd.person_name
      `,
    })) as Promise<DirectorRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        WITH cluster_directors AS (
          SELECT DISTINCT src.canonical_name AS pname
          FROM public.gs_relationships r
          JOIN public.gs_entities src ON src.id = r.source_entity_id
          JOIN public.gs_entities tgt ON tgt.id = r.target_entity_id
          WHERE r.relationship_type = 'directorship'
            AND src.gs_id LIKE 'GS-PERSON-%'
            AND tgt.abn IN (${ABNS_SQL})
        )
        SELECT pi.person_name,
               pi.board_count::int,
               pi.total_procurement::bigint AS procurement,
               pi.total_justice::bigint AS justice,
               pi.total_donations::bigint AS donations,
               pi.max_influence_score::int AS influence
        FROM public.mv_person_influence pi
        JOIN cluster_directors cd ON LOWER(cd.pname) = LOWER(pi.person_name)
        ORDER BY pi.max_influence_score DESC NULLS LAST
        LIMIT 20
      `,
    })) as Promise<InfluenceRow[] | null>,
  ]);

  const ents = entities ?? [];
  const totalRevenue = ents.reduce((s, e) => s + (e.total ?? 0), 0);
  const totalGovt = ents.reduce((s, e) => s + (e.govt ?? 0), 0);
  const totalDonations = ents.reduce((s, e) => s + (e.donations ?? 0), 0);
  const withAis = ents.filter(e => e.ais_year != null).length;
  const critical = ents.filter(e => (e.govt_pct ?? 0) >= 80).length;
  const aggregateGovtPct = totalRevenue > 0 ? (totalGovt / totalRevenue) * 100 : 0;

  return {
    entities: ents,
    contracts: contracts ?? [],
    directors: directors ?? [],
    influence: influence ?? [],
    stats: {
      totalEntities: CLUSTER_ABNS.length,
      withAis,
      totalRevenue,
      totalGovt,
      totalDonations,
      aggregateGovtPct,
      critical,
    },
  };
}

export default async function MulticulturalSectorPage() {
  const r = await getReport();

  return (
    <div>
      <div className="mb-10">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Living Report — First Cut</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3 uppercase tracking-tight">
          The Multicultural Settlement Sector
        </h1>
        <p className="text-2xl font-black text-bauhaus-red uppercase tracking-tight mb-6">
          {r.stats.totalEntities} Organisations · {money(r.stats.totalRevenue)} Revenue · {r.stats.aggregateGovtPct.toFixed(0)}% From One Funder
        </p>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Australia&apos;s ethnic communities councils form a federation of {r.stats.totalEntities} organisations spanning every state.
          They run settlement services, multicultural advocacy, and community programs. They share directors, programs, and dependencies.
          Across the entire cluster, philanthropic donations totalled {money(r.stats.totalDonations)} — about {((r.stats.totalDonations / r.stats.totalRevenue) * 100).toFixed(2)}% of revenue.
          The other 99%+ comes from government.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-4 border-bauhaus-black mb-12">
        <div className="border-r-4 border-bauhaus-black p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Total Revenue (Cluster)</div>
          <div className="text-3xl font-black text-bauhaus-black">{money(r.stats.totalRevenue)}</div>
        </div>
        <div className="border-r-4 border-bauhaus-black p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Government Share</div>
          <div className="text-3xl font-black text-bauhaus-red">{r.stats.aggregateGovtPct.toFixed(0)}%</div>
        </div>
        <div className="border-r-4 border-bauhaus-black p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Critical Dependency (≥80% govt)</div>
          <div className="text-3xl font-black text-bauhaus-black">{r.stats.critical}<span className="text-bauhaus-muted text-xl"> / {r.stats.withAis}</span></div>
        </div>
        <div className="p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Multi-Board Directors</div>
          <div className="text-3xl font-black text-bauhaus-black">{r.directors.length}</div>
        </div>
      </div>

      {/* SECTION 1 — Cluster economics */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§1</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">The Funder-Concentration Cliff</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          ACNC Annual Information Statement, latest year per entity. Government share = revenue_from_government ÷ total_revenue.
          Entities marked CRITICAL collapse if their primary funder withdraws.
        </p>

        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Revenue</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Govt $</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donations</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Govt %</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Tier</th>
              </tr>
            </thead>
            <tbody>
              {r.entities.map((e, i) => {
                const t = dependencyTier(e.govt_pct);
                return (
                  <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">
                      <Link href={`/org/${e.gs_id}`} className="hover:underline">
                        {e.canonical_name}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-xs">{e.state ?? '—'}</td>
                    <td className="p-3 text-right font-mono">{e.total != null ? money(e.total) : '—'}</td>
                    <td className="p-3 text-right font-mono">{e.govt != null ? money(e.govt) : '—'}</td>
                    <td className="p-3 text-right font-mono">{e.donations != null ? money(e.donations) : '—'}</td>
                    <td className="p-3 text-right font-mono font-black">{pct(e.govt_pct)}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-widest ${t.bg} ${t.fg}`}>
                        {t.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-bauhaus-muted mt-3 font-medium">
          Geelong ECC shows 0% government in AIS but holds $1.0M in AusTender — a known AIS-coding gap where Settlement Services contracts get classified as &ldquo;fees from goods/services&rdquo;.
          FECCA has no AIS row in the source data — separate data-quality issue flagged.
        </p>
      </section>

      {/* SECTION 2 — Director power */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§2</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">The People Who Hold The Network Together</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          {r.directors.length} directors sit on 2+ boards inside or adjacent to the cluster. The federation runs on overlapping governance: state councils elect FECCA directors, who hold seats across regional, religious, and disability networks.
        </p>

        <div className="border-4 border-bauhaus-black overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Person</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs w-20">Boards</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Network Spans</th>
              </tr>
            </thead>
            <tbody>
              {r.directors.map((d, i) => (
                <tr key={d.person_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 font-black text-bauhaus-black whitespace-nowrap">{d.person_name}</td>
                  <td className="p-3 text-right font-mono font-black">
                    <span className={`inline-block px-2 py-1 ${d.total_boards >= 5 ? 'bg-bauhaus-red text-white' : d.total_boards >= 3 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black'}`}>
                      {d.total_boards}
                    </span>
                  </td>
                  <td className="p-3 text-xs leading-relaxed">{d.all_boards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mt-10 mb-3">Influence Footprint (CivicGraph person index)</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
          Cross-system $ touched by these directors via their full board portfolios — not just cluster boards.
          Procurement = AusTender contracts to entities they govern; Justice = justice_funding to those entities.
        </p>
        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Person</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Boards</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Procurement $</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Justice $</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Influence</th>
              </tr>
            </thead>
            <tbody>
              {r.influence.map((p, i) => (
                <tr key={p.person_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 font-black text-bauhaus-black">{p.person_name}</td>
                  <td className="p-3 text-right font-mono">{p.board_count}</td>
                  <td className="p-3 text-right font-mono">{money(p.procurement)}</td>
                  <td className="p-3 text-right font-mono">{money(p.justice)}</td>
                  <td className="p-3 text-right font-mono font-black">{p.influence ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3 — Where money comes from */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§3</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Where The Money Comes From — Visible Slice</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Only {new Set(r.contracts.map(c => c.entity)).size} of {r.stats.totalEntities} entities have visible Commonwealth contracts in AusTender.
          The other entities&apos; government revenue lives in DSS Community Grants Hub, GrantConnect awards, and state-level grants (DFFH, VMC, DPC) — none of which are currently ingested. Closing this gap is the deep-research priority.
        </p>

        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Buyer</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Title</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Value</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Period</th>
              </tr>
            </thead>
            <tbody>
              {r.contracts.map((c, i) => (
                <tr key={`${c.entity}-${c.title}-${c.value}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 font-black text-bauhaus-black">{c.entity}</td>
                  <td className="p-3 text-xs">{c.buyer}</td>
                  <td className="p-3 text-xs font-mono">{c.title ?? '—'}</td>
                  <td className="p-3 text-right font-mono font-black">{money(c.value)}</td>
                  <td className="p-3 text-xs font-mono whitespace-nowrap">
                    {c.contract_start?.slice(0, 7) ?? '—'} → {c.contract_end?.slice(0, 7) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 4 — Gaps + next moves */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§4</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">What We Can&apos;t See Yet</h2>

        <div className="grid sm:grid-cols-3 gap-0 border-4 border-bauhaus-black">
          <div className="border-r-4 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">Gap 1</div>
            <div className="text-lg font-black text-bauhaus-black mb-2 uppercase tracking-tight">VIC Awarded Grants</div>
            <p className="text-sm text-bauhaus-muted font-medium leading-relaxed">
              ECCV&apos;s $1.65M government revenue is invisible at program level. Need VMC, DFFH, DPC awarded-grants registers.
              Table built (<code className="bg-bauhaus-canvas px-1 text-xs">vic_grants_awarded</code>); waiting on CSVs.
            </p>
          </div>
          <div className="border-r-4 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">Gap 2</div>
            <div className="text-lg font-black text-bauhaus-black mb-2 uppercase tracking-tight">GrantConnect Awards</div>
            <p className="text-sm text-bauhaus-muted font-medium leading-relaxed">
              18 of 22 entities have $0 in AusTender — their Commonwealth funding likely flows through GrantConnect (DSS Settlement, Community Grants Hub). Ingest script ready; needs fresh weekly export CSV.
            </p>
          </div>
          <div className="p-6 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">Gap 3</div>
            <div className="text-lg font-black text-bauhaus-black mb-2 uppercase tracking-tight">FECCA AIS Missing</div>
            <p className="text-sm text-bauhaus-muted font-medium leading-relaxed">
              FECCA is a Large ACNC charity but has no rows in our 360K-row AIS table. Either a sync miss or a reporting-status edge case. Worth a one-shot enrichment pass.
            </p>
          </div>
        </div>
      </section>

      {/* Next moves */}
      <section className="mb-12 border-4 border-bauhaus-black p-8 bg-bauhaus-yellow">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Next Moves</h2>
        <ol className="space-y-3 text-bauhaus-black font-medium list-decimal list-inside">
          <li>Drop VMC + DFFH + DPC grant register CSVs into <code className="bg-bauhaus-black text-bauhaus-yellow px-2 py-0.5 text-xs">data/vic-grants-awarded/</code> → run <code className="bg-bauhaus-black text-bauhaus-yellow px-2 py-0.5 text-xs">import-vic-grants-awarded</code>.</li>
          <li>Re-download GrantConnect weekly export → run <code className="bg-bauhaus-black text-bauhaus-yellow px-2 py-0.5 text-xs">ingest-grantconnect</code>.</li>
          <li>Run <code className="bg-bauhaus-black text-bauhaus-yellow px-2 py-0.5 text-xs">bridge-funding-relationships --apply</code> to push both into <code className="bg-bauhaus-black text-bauhaus-yellow px-2 py-0.5 text-xs">gs_relationships</code> for graph visualisation.</li>
          <li>Re-run this report. Section 3 (Where The Money Comes From) goes from 4 visible entities to ~22.</li>
        </ol>
      </section>
    </div>
  );
}
