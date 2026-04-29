import Link from 'next/link';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';

const FECCA_ABN = '23684792947';
const ECCV_ABN = '65071572705';

type AnchorRow = {
  gs_id: string;
  canonical_name: string;
  abn: string;
  state: string | null;
  charity_size: string | null;
  website: string | null;
  ais_year: number | null;
  total_revenue: number | null;
  govt: number | null;
  donations: number | null;
  fees: number | null;
  staff_ft: number | null;
  staff_vols: number | null;
  govt_pct: number | null;
};

type AisYearRow = {
  abn: string;
  ais_year: number;
  total: number;
  govt: number;
  donations: number;
  fees: number;
  expenses: number;
  surplus: number;
  ft: number | null;
  vols: number | null;
};

type ContractRow = {
  buyer_name: string;
  title: string | null;
  contract_value: number;
  contract_start: string | null;
  contract_end: string | null;
};

type DirectorRow = {
  person_name: string;
  person_id: string;
  entity: string;
  role_dataset: string;
  role: string | null;
};

type DirectorPortfolio = {
  person_name: string;
  board_count: number;
  organisations: string[];
  total_procurement: number | null;
  total_justice: number | null;
  total_donations: number | null;
  influence: number | null;
};

type AnnualReport = {
  abn: string;
  charity_name: string | null;
  report_year: number;
  source_url: string | null;
  source_type: string | null;
  total_beneficiaries: number | null;
  programs_delivered: number | null;
  evidence_quality: string | null;
  impact_summary: string | null;
  programs_mentioned: string[] | null;
  pdf_pages: number | null;
  extracted_text_chars: number | null;
  reports_employment: boolean | null;
  reports_housing: boolean | null;
  reports_education: boolean | null;
  reports_cultural_connection: boolean | null;
  reports_mental_health: boolean | null;
  reports_family_reunification: boolean | null;
  has_quantitative_outcomes: boolean | null;
  has_external_evaluation: boolean | null;
};

function money(n: number | null | undefined): string {
  if (!n) return '$0';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(0)}%`;
}

async function getReport() {
  const supabase = getLiveReportSupabase();

  const [anchors, aisYears, fecca_contracts, eccv_contracts, directorsAll, portfolios, annualReports, vicGrantsRaw, siblingGrantsRaw] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT e.gs_id, e.canonical_name, e.abn, e.state,
               c.charity_size, c.website,
               a.ais_year::int,
               a.total_revenue::bigint AS total_revenue,
               a.revenue_from_government::bigint AS govt,
               a.donations_and_bequests::bigint AS donations,
               a.revenue_from_goods_services::bigint AS fees,
               a.staff_full_time::int AS staff_ft,
               a.staff_volunteers::int AS staff_vols,
               CASE WHEN a.total_revenue > 0
                    THEN (a.revenue_from_government / a.total_revenue) * 100
               END::numeric(5,1) AS govt_pct
        FROM public.gs_entities e
        LEFT JOIN public.acnc_charities c ON c.abn = e.abn
        LEFT JOIN LATERAL (
          SELECT * FROM public.acnc_ais WHERE abn = e.abn ORDER BY ais_year DESC LIMIT 1
        ) a ON true
        WHERE e.abn IN ('${FECCA_ABN}','${ECCV_ABN}')
      `,
    })) as Promise<AnchorRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT abn, ais_year::int,
               total_revenue::bigint AS total,
               revenue_from_government::bigint AS govt,
               donations_and_bequests::bigint AS donations,
               revenue_from_goods_services::bigint AS fees,
               total_expenses::bigint AS expenses,
               net_surplus_deficit::bigint AS surplus,
               staff_full_time::int AS ft,
               staff_volunteers::int AS vols
        FROM public.acnc_ais
        WHERE abn IN ('${FECCA_ABN}','${ECCV_ABN}')
        ORDER BY abn, ais_year ASC
      `,
    })) as Promise<AisYearRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT buyer_name, title, contract_value::bigint AS contract_value,
               contract_start::text, contract_end::text
        FROM public.austender_contracts
        WHERE supplier_abn = '${FECCA_ABN}'
        ORDER BY contract_value DESC NULLS LAST
      `,
    })) as Promise<ContractRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT buyer_name, title, contract_value::bigint AS contract_value,
               contract_start::text, contract_end::text
        FROM public.austender_contracts
        WHERE supplier_abn = '${ECCV_ABN}'
        ORDER BY contract_value DESC NULLS LAST
      `,
    })) as Promise<ContractRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT
          src.canonical_name AS person_name,
          src.gs_id AS person_id,
          tgt.canonical_name AS entity,
          r.dataset AS role_dataset,
          r.properties->>'role' AS role
        FROM public.gs_relationships r
        JOIN public.gs_entities src ON src.id = r.source_entity_id
        JOIN public.gs_entities tgt ON tgt.id = r.target_entity_id
        WHERE tgt.abn IN ('${FECCA_ABN}','${ECCV_ABN}')
          AND r.relationship_type = 'directorship'
          AND src.gs_id LIKE 'GS-PERSON-%'
        ORDER BY tgt.canonical_name, src.canonical_name
      `,
    })) as Promise<DirectorRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        WITH cluster_directors AS (
          SELECT DISTINCT src.id AS pid, src.canonical_name AS pname
          FROM public.gs_relationships r
          JOIN public.gs_entities src ON src.id = r.source_entity_id
          JOIN public.gs_entities tgt ON tgt.id = r.target_entity_id
          WHERE r.relationship_type = 'directorship'
            AND src.gs_id LIKE 'GS-PERSON-%'
            AND tgt.abn IN ('${FECCA_ABN}','${ECCV_ABN}')
        ),
        person_orgs AS (
          SELECT cd.pname,
                 array_agg(DISTINCT te.canonical_name ORDER BY te.canonical_name) AS organisations,
                 COUNT(DISTINCT te.id)::int AS local_board_count
          FROM cluster_directors cd
          JOIN public.gs_relationships r2 ON r2.source_entity_id = cd.pid AND r2.relationship_type = 'directorship'
          JOIN public.gs_entities te ON te.id = r2.target_entity_id
          GROUP BY cd.pname
        )
        SELECT po.pname AS person_name,
               COALESCE(pi.board_count, po.local_board_count)::int AS board_count,
               po.organisations,
               pi.total_procurement::bigint AS total_procurement,
               pi.total_justice::bigint AS total_justice,
               pi.total_donations::bigint AS total_donations,
               pi.max_influence_score::int AS influence
        FROM person_orgs po
        LEFT JOIN public.mv_person_influence pi ON LOWER(pi.person_name) = LOWER(po.pname)
        ORDER BY pi.max_influence_score DESC NULLS LAST, po.local_board_count DESC
      `,
    })) as Promise<DirectorPortfolio[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT abn, charity_name, report_year, source_url, source_type,
               total_beneficiaries, programs_delivered,
               evidence_quality, impact_summary, programs_mentioned,
               pdf_pages, extracted_text_chars,
               reports_employment, reports_housing, reports_education,
               reports_cultural_connection, reports_mental_health, reports_family_reunification,
               has_quantitative_outcomes, has_external_evaluation
        FROM public.charity_impact_reports
        WHERE abn IN ('${FECCA_ABN}','${ECCV_ABN}')
        ORDER BY abn, report_year DESC
      `,
    })) as Promise<AnnualReport[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT vga.recipient_name, vga.program_name, vga.amount_aud::bigint AS amount,
               vga.financial_year, vga.source AS dept_source, vga.source_url,
               t.canonical_name AS recipient_canonical, t.abn AS recipient_abn, t.gs_id AS recipient_gs_id
        FROM public.vic_grants_awarded vga
        LEFT JOIN public.gs_entities t ON t.id = vga.gs_entity_id
        WHERE vga.recipient_name ILIKE '%ethnic communities%council of victoria%'
           OR vga.recipient_name ILIKE '%FECCA%'
           OR vga.recipient_name ILIKE '%federation of ethnic%'
           OR vga.gs_entity_id IN (SELECT id FROM public.gs_entities WHERE abn IN ('${FECCA_ABN}','${ECCV_ABN}'))
        ORDER BY vga.amount_aud DESC NULLS LAST
        LIMIT 50
      `,
    })) as Promise<Array<{
      recipient_name: string;
      program_name: string | null;
      amount: number;
      financial_year: string | null;
      dept_source: string;
      source_url: string | null;
      recipient_canonical: string | null;
      recipient_abn: string | null;
      recipient_gs_id: string | null;
    }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT vga.recipient_name, vga.program_name, vga.amount_aud::bigint AS amount,
               vga.financial_year, vga.source AS dept_source, vga.source_url,
               t.canonical_name AS recipient_canonical, t.gs_id AS recipient_gs_id
        FROM public.vic_grants_awarded vga
        JOIN public.gs_entities t ON t.id = vga.gs_entity_id
        WHERE t.abn IN ('37282486762','29252806279','50192038354','55010151256','91163351869','78596425974','64758439692','62711639794','18134375892','89278892329','79445438274','85023648955','86110721406','77674760578','26186698348','88244322400','57738423800','57894189429','66291586945','32390500229')
        ORDER BY vga.amount_aud DESC NULLS LAST
        LIMIT 30
      `,
    })) as Promise<Array<{ recipient_name: string; program_name: string | null; amount: number; financial_year: string | null; dept_source: string; source_url: string | null; recipient_canonical: string | null; recipient_gs_id: string | null }> | null>,
  ]);

  const fecca = (anchors ?? []).find(a => a.abn === FECCA_ABN) || null;
  const eccv = (anchors ?? []).find(a => a.abn === ECCV_ABN) || null;
  const ais = aisYears ?? [];
  const eccv_ais = ais.filter(a => a.abn === ECCV_ABN);
  const fecca_ais = ais.filter(a => a.abn === FECCA_ABN);

  const directors = directorsAll ?? [];
  const fecca_directors = directors.filter(d => d.entity.toLowerCase().includes('federation'));
  const eccv_directors = directors.filter(d => d.entity.toLowerCase().includes('council of victoria'));

  return {
    fecca,
    eccv,
    eccv_ais,
    fecca_ais,
    fecca_contracts: fecca_contracts ?? [],
    eccv_contracts: eccv_contracts ?? [],
    fecca_directors,
    eccv_directors,
    portfolios: portfolios ?? [],
    annualReports: annualReports ?? [],
    vicGrants: vicGrantsRaw ?? [],
    siblingGrants: siblingGrantsRaw ?? [],
  };
}

function AnchorCard({ a, label }: { a: AnchorRow | null; label: string }) {
  if (!a) {
    return (
      <div className="border-4 border-bauhaus-black p-6 bg-white">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
        <div className="text-bauhaus-muted">No anchor data</div>
      </div>
    );
  }
  return (
    <div className="border-4 border-bauhaus-black p-6 bg-white">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">{label}</div>
      <Link href={`/org/${a.gs_id}`} className="text-xl font-black text-bauhaus-black uppercase tracking-tight hover:underline block mb-2 leading-tight">
        {a.canonical_name}
      </Link>
      <div className="text-xs font-mono text-bauhaus-muted mb-4">
        ABN {a.abn} · {a.state ?? '—'} · {a.charity_size ?? '—'} charity
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Latest Revenue</div>
          <div className="font-black text-2xl text-bauhaus-black">{money(a.total_revenue)}</div>
          <div className="text-xs text-bauhaus-muted font-mono">{a.ais_year ?? '—'} AIS</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Govt Share</div>
          <div className={`font-black text-2xl ${(a.govt_pct ?? 0) >= 80 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
            {pct(a.govt_pct)}
          </div>
          <div className="text-xs text-bauhaus-muted font-mono">{money(a.govt)} of {money(a.total_revenue)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Donations</div>
          <div className="font-black text-2xl text-bauhaus-black">{money(a.donations)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Staff (FT / Vols)</div>
          <div className="font-black text-2xl text-bauhaus-black">{a.staff_ft ?? '—'} / {a.staff_vols ?? '—'}</div>
        </div>
      </div>
      {a.website ? (
        <a href={a.website.startsWith('http') ? a.website : `https://${a.website}`} target="_blank" rel="noopener"
           className="block mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline">
          {a.website} ↗
        </a>
      ) : null}
    </div>
  );
}

export default async function FeccaEccvPage() {
  const r = await getReport();

  // ECCV revenue trajectory — render as horizontal bars normalised to peak
  const eccvPeak = Math.max(...r.eccv_ais.map(a => a.total || 0), 1);

  return (
    <div>
      <div className="mb-10">
        <Link href="/reports/multicultural-sector" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Multicultural Sector
        </Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Deep Dive · Two Anchors</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3 uppercase tracking-tight">
          FECCA &amp; ECCV — The Federation&apos;s Two Anchors
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          The national peak (FECCA) and Victoria&apos;s state council (ECCV) carry most of the federation&apos;s policy weight.
          They sit on each other&apos;s referral pathways, share board pipelines through the state↔national bridge,
          and depend almost entirely on government funding. This is where their wealth, programs, and people meet.
        </p>
      </div>

      {/* Anchor cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        <AnchorCard a={r.fecca} label="National Peak" />
        <AnchorCard a={r.eccv} label="Victoria State Council" />
      </div>

      {/* SECTION 1 — ECCV financial trajectory */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§1</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">ECCV — Seven Years Of Government Dependence</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Total revenue doubled from $1.18M (2017) to $2.40M (2023), peaking at $3.63M in 2022. Government share never dropped below 84%.
          Donations: zero, every year. The 2022 peak likely reflects a one-time project cycle that did not sustain.
        </p>

        <div className="border-4 border-bauhaus-black p-6 bg-white">
          {r.eccv_ais.map((a) => {
            const totalPct = (a.total / eccvPeak) * 100;
            const govtPct = a.total > 0 ? (a.govt / a.total) * 100 : 0;
            return (
              <div key={a.ais_year} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="font-black text-bauhaus-black">{a.ais_year}</span>
                  <span className="text-bauhaus-muted">
                    {money(a.total)} total · {money(a.govt)} govt ({govtPct.toFixed(0)}%) · surplus {money(a.surplus)}
                  </span>
                </div>
                <div className="relative h-8 bg-bauhaus-canvas border-2 border-bauhaus-black">
                  <div className="absolute inset-y-0 left-0 bg-bauhaus-red" style={{ width: `${(a.govt / eccvPeak) * 100}%` }} />
                  <div
                    className="absolute inset-y-0 bg-bauhaus-blue"
                    style={{ left: `${(a.govt / eccvPeak) * 100}%`, width: `${((a.fees + a.donations) / eccvPeak) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-black text-bauhaus-black">
                    {totalPct.toFixed(0)}%
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-6 text-xs font-black uppercase tracking-widest mt-4 pt-4 border-t-2 border-bauhaus-black">
            <span><span className="inline-block w-3 h-3 bg-bauhaus-red mr-2 align-middle" /> Government revenue</span>
            <span><span className="inline-block w-3 h-3 bg-bauhaus-blue mr-2 align-middle" /> Fees + donations</span>
          </div>
        </div>
      </section>

      {/* SECTION 2 — FECCA Commonwealth contracts */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§2</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">FECCA — Eight Commonwealth Contracts</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Total visible Commonwealth procurement: {money(r.fecca_contracts.reduce((s, c) => s + c.contract_value, 0))} across {r.fecca_contracts.length} contracts.
          Concentrated with Health &amp; Aged Care + Australian Digital Health Agency.
          {r.fecca_contracts.length === 0 ? ' (No contracts found.)' : ''}
        </p>

        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Buyer</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Title / Reference</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Value</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Period</th>
              </tr>
            </thead>
            <tbody>
              {r.fecca_contracts.map((c, i) => (
                <tr key={`${c.title}-${c.contract_value}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 font-black text-bauhaus-black">{c.buyer_name}</td>
                  <td className="p-3 text-xs font-mono">{c.title ?? '—'}</td>
                  <td className="p-3 text-right font-mono font-black">{money(c.contract_value)}</td>
                  <td className="p-3 text-xs font-mono whitespace-nowrap">
                    {c.contract_start?.slice(0, 7) ?? '—'} → {c.contract_end?.slice(0, 7) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {r.eccv_contracts.length > 0 && (
          <div className="mt-6 border-l-4 border-bauhaus-yellow pl-4 text-sm text-bauhaus-muted font-medium">
            ECCV has {r.eccv_contracts.length} Commonwealth contracts totalling {money(r.eccv_contracts.reduce((s, c) => s + c.contract_value, 0))} — but most ECCV revenue is Victorian state grants (DFFH, VMC, DPC), which we don&apos;t yet ingest.
          </div>
        )}
        {r.eccv_contracts.length === 0 && (
          <div className="mt-6 border-l-4 border-bauhaus-yellow pl-4 text-sm text-bauhaus-muted font-medium">
            ECCV has zero Commonwealth contracts. Their government revenue flows through Victorian state programs.
            See <a href="#vic-state-grants" className="text-bauhaus-blue hover:underline font-black">§6</a> for the now-ingested VIC department grants.
          </div>
        )}
      </section>

      {/* SECTION 3 — Directors with full portfolios */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§3</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The People — FECCA Board &amp; Their Other Boards</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          {r.fecca_directors.length} directors on FECCA&apos;s board. Each row shows where else that person serves —
          this is the federation&apos;s shadow network: Islamic charities, disability advocacy, asylum support, regional arts.
        </p>

        {r.fecca_directors.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <p className="text-bauhaus-muted font-medium">No FECCA directors in dataset. Run ACNC scraper.</p>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Director</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Other Boards</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Network Spans</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Procurement $ in Network</th>
                </tr>
              </thead>
              <tbody>
                {r.fecca_directors.map((d, i) => {
                  const port = r.portfolios.find(p => p.person_name.toLowerCase() === d.person_name.toLowerCase());
                  const otherOrgs = (port?.organisations || []).filter(o => o && !o.toLowerCase().includes('federation of ethnic communities'));
                  return (
                    <tr key={d.person_id} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                      <td className="p-3 font-black text-bauhaus-black whitespace-nowrap">
                        <Link href={`/org/${d.person_id}`} className="hover:underline">{d.person_name}</Link>
                      </td>
                      <td className="p-3 text-right font-mono font-black">
                        <span className={`inline-block px-2 py-1 ${(port?.board_count ?? 1) >= 5 ? 'bg-bauhaus-red text-white' : (port?.board_count ?? 1) >= 3 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black'}`}>
                          {port?.board_count ?? 1}
                        </span>
                      </td>
                      <td className="p-3 text-xs leading-relaxed">
                        {otherOrgs.length ? otherOrgs.join(' · ') : <span className="text-bauhaus-muted">FECCA only (in dataset)</span>}
                      </td>
                      <td className="p-3 text-right font-mono">{port && (port.board_count ?? 1) > 1 && port.total_procurement ? money(port.total_procurement) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 4 — ECCV Board */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§4</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">ECCV Board — Victoria&apos;s State Council</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          {r.eccv_directors.length} directors on ECCV&apos;s board. ACNC&apos;s public register withholds responsible-person data for ECCV,
          so this is sourced from <code className="bg-bauhaus-canvas px-1 text-xs">eccv.org.au/about/board</code>.
          Roles + portfolios where matched against the rest of CivicGraph.
        </p>

        {r.eccv_directors.length === 0 ? (
          <div className="border-4 border-bauhaus-red p-6 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">Not Synced Yet</div>
            <p className="text-bauhaus-black font-medium mb-3">
              Zero directors found for ECCV. Run the focused board sync.
            </p>
            <p className="text-xs text-bauhaus-muted font-mono">
              <code className="bg-bauhaus-black text-bauhaus-yellow px-2 py-1">node --env-file=.env scripts/sync-charity-board.mjs --abn={ECCV_ABN} --board-url=https://eccv.org.au/about/board</code>
            </p>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Director</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Role</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Total Boards</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Network Spans</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Procurement $ in Network</th>
                </tr>
              </thead>
              <tbody>
                {r.eccv_directors.map((d, i) => {
                  const port = r.portfolios.find(p => p.person_name.toLowerCase() === d.person_name.toLowerCase());
                  const otherOrgs = (port?.organisations || []).filter(o => o && !o.toLowerCase().includes('council of victoria'));
                  return (
                    <tr key={d.person_id} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                      <td className="p-3 font-black text-bauhaus-black whitespace-nowrap">
                        <Link href={`/org/${d.person_id}`} className="hover:underline">{d.person_name}</Link>
                      </td>
                      <td className="p-3 text-xs uppercase tracking-widest font-black text-bauhaus-blue whitespace-nowrap">
                        {d.role ?? 'Director'}
                      </td>
                      <td className="p-3 text-right font-mono font-black">
                        <span className={`inline-block px-2 py-1 ${(port?.board_count ?? 1) >= 5 ? 'bg-bauhaus-red text-white' : (port?.board_count ?? 1) >= 3 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black'}`}>
                          {port?.board_count ?? 1}
                        </span>
                      </td>
                      <td className="p-3 text-xs leading-relaxed">
                        {otherOrgs.length ? otherOrgs.join(' · ') : <span className="text-bauhaus-muted">ECCV only (in dataset)</span>}
                      </td>
                      <td className="p-3 text-right font-mono">{port?.total_procurement ? money(port.total_procurement) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 5 — Annual Reports */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§5</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Annual Reports — What They Say About Themselves</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Beneficiaries reported, programs delivered, evidence quality — extracted from FECCA + ECCV annual report PDFs.
          The scraper pulls directly from <code className="bg-bauhaus-canvas px-1 text-xs">{r.fecca?.website ?? 'fecca.org.au'}</code> and{' '}
          <code className="bg-bauhaus-canvas px-1 text-xs">{r.eccv?.website ?? 'eccv.org.au'}</code>.
        </p>

        {r.annualReports.length === 0 ? (
          <div className="border-4 border-bauhaus-yellow p-6 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Not Scraped Yet</div>
            <p className="text-bauhaus-black font-medium mb-3">
              No annual report rows in <code className="bg-bauhaus-canvas px-1 text-xs">charity_impact_reports</code> for either entity.
            </p>
            <pre className="bg-bauhaus-black text-bauhaus-yellow text-xs p-3 overflow-x-auto font-mono">
{`node --env-file=.env scripts/scrape-charity-annual-reports.mjs --abn=${FECCA_ABN} --abn=${ECCV_ABN}`}
            </pre>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {r.annualReports.map(rep => {
              const topics = [
                { key: 'employment', flag: rep.reports_employment, label: 'Employment' },
                { key: 'housing', flag: rep.reports_housing, label: 'Housing' },
                { key: 'education', flag: rep.reports_education, label: 'Education' },
                { key: 'cultural', flag: rep.reports_cultural_connection, label: 'Cultural Connection' },
                { key: 'mental', flag: rep.reports_mental_health, label: 'Mental Health' },
                { key: 'family', flag: rep.reports_family_reunification, label: 'Family Reunification' },
              ];
              const evidenceColor = rep.evidence_quality === 'evaluated' ? 'bg-bauhaus-blue text-white'
                : rep.evidence_quality === 'outcome_metrics' ? 'bg-bauhaus-yellow text-bauhaus-black'
                : rep.evidence_quality === 'basic_counts' ? 'bg-bauhaus-canvas text-bauhaus-black'
                : 'bg-bauhaus-canvas text-bauhaus-muted';
              const orgLabel = rep.abn === FECCA_ABN ? 'FECCA' : 'ECCV';
              const sourceLabel = rep.source_type === 'website_pdf' ? 'PDF' : rep.source_type === 'website_page' ? 'Web' : 'Source';
              return (
                <div key={`${rep.abn}-${rep.report_year}`} className="border-4 border-bauhaus-black p-5 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">{orgLabel}</div>
                      <div className="text-3xl font-black text-bauhaus-black tracking-tight">{rep.report_year}</div>
                    </div>
                    <span className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-widest ${evidenceColor}`}>
                      {(rep.evidence_quality ?? 'none').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {topics.filter(t => t.flag).map(t => (
                      <span key={t.key} className="text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white px-2 py-1">
                        {t.label}
                      </span>
                    ))}
                    {!topics.some(t => t.flag) && (
                      <span className="text-xs text-bauhaus-muted font-mono">no topic flags detected</span>
                    )}
                  </div>

                  {rep.programs_mentioned && rep.programs_mentioned.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs uppercase tracking-widest font-black text-bauhaus-muted mb-1">Programs Mentioned</div>
                      <div className="flex flex-wrap gap-1">
                        {rep.programs_mentioned.slice(0, 6).map((p, i) => (
                          <span key={i} className="text-xs font-mono bg-bauhaus-canvas text-bauhaus-black px-2 py-1 border border-bauhaus-black">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {rep.impact_summary && (
                    <p className="text-sm text-bauhaus-black font-medium leading-relaxed mt-3 border-l-4 border-bauhaus-yellow pl-3 py-1">
                      {rep.impact_summary}
                    </p>
                  )}

                  <div className="flex gap-4 mt-4 pt-3 border-t-2 border-bauhaus-black text-xs font-mono text-bauhaus-muted">
                    <span>{rep.extracted_text_chars ? `${(rep.extracted_text_chars / 1000).toFixed(1)}K chars read` : '—'}</span>
                    {rep.has_external_evaluation && <span className="text-bauhaus-red font-black">EVALUATED</span>}
                    {rep.source_url && (
                      <a href={rep.source_url} target="_blank" rel="noopener" className="ml-auto text-bauhaus-blue hover:underline font-black">
                        {sourceLabel} ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 border-l-4 border-bauhaus-yellow pl-4 text-xs text-bauhaus-muted font-medium">
          Topic flags are regex-matched against extracted text — narrative-only reports may have themes the regex missed.
          A future LLM enrichment pass will extract structured impact narratives.
        </div>
      </section>

      {/* SECTION 6 — VIC State Grants (newly ingested via LLM extraction) */}
      <section id="vic-state-grants" className="mb-16 scroll-mt-24">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§6</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">VIC State Grants — Now Visible</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Extracted by LLM from Victorian department annual report PDFs (DPC, DFFH).
          Each row is a real grant disclosed in 2023-24, parsed via Claude Haiku tool-use → <code className="bg-bauhaus-canvas px-1 text-xs">vic_grants_awarded</code>.
        </p>

        {r.vicGrants.length === 0 ? (
          <div className="border-4 border-bauhaus-yellow p-6 bg-white">
            <p className="text-bauhaus-black font-medium">No VIC grants ingested yet for FECCA / ECCV / cluster.</p>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Program</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Amount</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">FY</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Dept</th>
                </tr>
              </thead>
              <tbody>
                {r.vicGrants.map((g, i) => (
                  <tr key={`${g.recipient_name}-${g.amount}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">
                      {g.recipient_gs_id ? (
                        <Link href={`/org/${g.recipient_gs_id}`} className="hover:underline">{g.recipient_name}</Link>
                      ) : g.recipient_name}
                      {g.recipient_canonical && g.recipient_canonical !== g.recipient_name && (
                        <span className="block text-xs text-bauhaus-muted font-mono">→ {g.recipient_canonical}</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">{g.program_name ?? '—'}</td>
                    <td className="p-3 text-right font-mono font-black">{money(g.amount)}</td>
                    <td className="p-3 text-xs font-mono whitespace-nowrap">{g.financial_year ?? '—'}</td>
                    <td className="p-3 text-xs uppercase tracking-widest font-black text-bauhaus-blue">{g.dept_source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 7 — Cluster Siblings */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§7</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Cluster Siblings — Other VIC Ethnic Communities Councils Funded</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Grants from VIC departments to the 20 sister organisations across the federation. ECCV is the Victoria peak; these are the regional + cause-specific councils.
        </p>

        {r.siblingGrants.length === 0 ? (
          <div className="border-4 border-bauhaus-yellow p-6 bg-white">
            <p className="text-bauhaus-black font-medium">(no sibling grants ingested yet)</p>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Program</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Amount</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">FY</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Dept</th>
                </tr>
              </thead>
              <tbody>
                {r.siblingGrants.map((g, i) => (
                  <tr key={`${g.recipient_name}-${g.amount}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">
                      {g.recipient_gs_id ? (
                        <Link href={`/org/${g.recipient_gs_id}`} className="hover:underline">{g.recipient_name}</Link>
                      ) : g.recipient_name}
                      {g.recipient_canonical && g.recipient_canonical !== g.recipient_name && (
                        <span className="block text-xs text-bauhaus-muted font-mono">→ {g.recipient_canonical}</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">{g.program_name ?? '—'}</td>
                    <td className="p-3 text-right font-mono font-black">{money(g.amount)}</td>
                    <td className="p-3 text-xs font-mono whitespace-nowrap">{g.financial_year ?? '—'}</td>
                    <td className="p-3 text-xs uppercase tracking-widest font-black text-bauhaus-blue">{g.dept_source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Action panel — what's done */}
      <section className="mb-12 border-4 border-bauhaus-black p-8 bg-bauhaus-yellow">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-4">What&apos;s Done · What&apos;s Next</h2>
        <ul className="space-y-3 text-bauhaus-black font-medium text-sm">
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">ECCV directors</span> — 10 board members synced from <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">eccv.org.au/about/board</code> (ACNC withholds responsible-person data publicly for ECCV).</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">Annual reports</span> — 7 reports scraped (4 FECCA, 3 ECCV) into <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">charity_impact_reports</code> with topic flags + programs.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">VIC state-grant pipeline</span> — DFFH + DPC 2023-24 annual reports parsed via Claude Haiku tool-use → 1,002 grants, $202M into <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">vic_grants_awarded</code>. ECCV&apos;s $962,500 visible in §6.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">Bridge to entity graph</span> — 199 grant edges in <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">gs_relationships</code>. Visible on <Link href={`/org/${r.eccv?.gs_id ?? ''}`} className="underline">ECCV org page</Link> + <Link href="/graph" className="underline">/graph</Link>.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">FECCA AIS gap closed</span> — pulled FY2025 financials from ACNC Dynamics API directly ($4.97M govt revenue). National-peak card now populated.</span></li>
        </ul>
        <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mt-6 mb-2">Easy follow-ups</h3>
        <ul className="space-y-2 text-bauhaus-black font-medium text-sm">
          <li>• Run <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">scrape-vic-dept-annual-reports --dept=djsir</code> + <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">--dept=djcs</code> for full VIC coverage (~$0.05/run via Haiku).</li>
          <li>• Re-run for 2021-22 + 2022-23 annual reports to build a 3-year time series.</li>
          <li>• Add NSW + QLD: same pattern, different department configs in <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">DEPT_CONFIG</code>.</li>
          <li>• Fuzzy-name link the unlinked 79% of grants (apostrophes, &ldquo;Inc&rdquo;/&ldquo;Ltd&rdquo; suffixes) via a name-canonicaliser pass.</li>
        </ul>
      </section>

      <section className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">Last updated: {new Date().toISOString().slice(0, 10)} · CivicGraph</div>
      </section>
    </div>
  );
}
