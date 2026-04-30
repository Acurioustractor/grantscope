import Link from 'next/link';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';

/**
 * Renders an org/person link if we're inside the full app, or just bold text
 * inside `/share/*` so visitors can't drill into pages they haven't paid for.
 */
function OrgRef({ gsId, name, isShare }: { gsId: string | null | undefined; name: string; isShare: boolean }) {
  if (isShare || !gsId) return <span className="font-black">{name}</span>;
  return <Link href={`/org/${gsId}`} className="hover:underline">{name}</Link>;
}

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

type AmesContractRow = {
  supplier_name: string;
  contracts: number;
  total: number;
};

type TopicMixRow = {
  topic: string;
  grants: number;
  total: number;
};

type YearMixRow = {
  financial_year: string;
  dept: string;
  grants: number;
  total: number;
};

type AisFinancialsRow = {
  abn: string;
  ais_year: number;
  // revenue
  total_revenue: number | null;
  govt: number | null;
  donations: number | null;
  fees: number | null;
  investments: number | null;
  other_revenue: number | null;
  // expenses
  total_expenses: number | null;
  employee_expenses: number | null;
  grants_made_au: number | null;
  grants_made_intl: number | null;
  other_expenses: number | null;
  surplus: number | null;
  // staff
  staff_ft: number | null;
  staff_pt: number | null;
  staff_casual: number | null;
  staff_fte: number | null;
  staff_vols: number | null;
  // governance
  num_kmp: number | null;
  total_paid_kmp: number | null;
  // provenance — "ACNC AIS" or "Annual Report (LLM-extracted)"
  data_source: string | null;
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
  top_funders_mentioned: string[] | null;
  key_quotes: string[] | null;
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
  // LLM-extracted financial fields (when source PDF includes audited statements)
  total_revenue: number | null;
  revenue_from_government: number | null;
  total_expenses: number | null;
  employee_expenses: number | null;
  net_surplus_deficit: number | null;
  staff_full_time: number | null;
  staff_fte: number | null;
};

type PowerRow = {
  abn: string;
  power_score: number | null;
  system_count: number | null;
  in_procurement: number | null;
  in_charity_registry: number | null;
  in_justice_funding: number | null;
  in_political_donations: number | null;
  has_board_links: number | null;
  contract_count: number | null;
  procurement_dollars: number | null;
  total_dollar_flow: number | null;
  board_connections: number | null;
  distinct_directors: number | null;
  distinct_govt_buyers: number | null;
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

  const [anchors, aisYears, fecca_contracts, eccv_contracts, directorsAll, portfolios, annualReports, vicGrantsRaw, siblingGrantsRaw, powerRows, aisLatest, amesContractsRaw, topicMixRaw, yearMixRaw] = await Promise.all([
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
               top_funders_mentioned, key_quotes,
               pdf_pages, extracted_text_chars,
               reports_employment, reports_housing, reports_education,
               reports_cultural_connection, reports_mental_health, reports_family_reunification,
               has_quantitative_outcomes, has_external_evaluation,
               total_revenue::bigint, revenue_from_government::bigint,
               total_expenses::bigint, employee_expenses::bigint,
               net_surplus_deficit::bigint,
               staff_full_time, staff_fte::numeric(10,1)
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

    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT abn,
               power_score::int,
               system_count::int,
               in_procurement::int, in_charity_registry::int,
               in_justice_funding::int, in_political_donations::int,
               has_board_links::int,
               contract_count::int,
               procurement_dollars::bigint,
               total_dollar_flow::bigint,
               board_connections::int,
               distinct_directors::int,
               distinct_govt_buyers::int
        FROM public.mv_entity_power_index
        WHERE abn IN ('${FECCA_ABN}','${ECCV_ABN}')
      `,
    })) as Promise<PowerRow[] | null>,

    safe(supabase.rpc('exec_sql', {
      query: `
        -- Latest available P&L per anchor: try ACNC AIS first (audited), fall back to
        -- LLM-extracted annual-report financials in charity_impact_reports when AIS
        -- is missing (FECCA's case — it's not in any public ACNC AIS bulk dataset).
        WITH ais AS (
          SELECT DISTINCT ON (abn)
                 abn, ais_year::int,
                 total_revenue::bigint, revenue_from_government::bigint AS govt,
                 donations_and_bequests::bigint AS donations,
                 revenue_from_goods_services::bigint AS fees,
                 revenue_from_investments::bigint AS investments,
                 (COALESCE(all_other_revenue,0) + COALESCE(other_income,0))::bigint AS other_revenue,
                 total_expenses::bigint, employee_expenses::bigint,
                 grants_donations_au::bigint AS grants_made_au,
                 grants_donations_intl::bigint AS grants_made_intl,
                 all_other_expenses::bigint AS other_expenses,
                 net_surplus_deficit::bigint AS surplus,
                 staff_full_time::int AS staff_ft,
                 staff_part_time::int AS staff_pt,
                 staff_casual::int AS staff_casual,
                 staff_fte::numeric(10,1) AS staff_fte,
                 staff_volunteers::int AS staff_vols,
                 num_key_management_personnel::int AS num_kmp,
                 total_paid_key_management::bigint AS total_paid_kmp,
                 'ACNC AIS' AS data_source
          FROM public.acnc_ais
          WHERE abn IN ('${FECCA_ABN}','${ECCV_ABN}')
            AND total_expenses IS NOT NULL
          ORDER BY abn, ais_year DESC
        ),
        cir AS (
          SELECT DISTINCT ON (abn)
                 abn, report_year::int AS ais_year,
                 total_revenue::bigint, revenue_from_government::bigint AS govt,
                 donations_and_bequests::bigint AS donations,
                 revenue_from_goods_services::bigint AS fees,
                 revenue_from_investments::bigint AS investments,
                 0::bigint AS other_revenue,
                 total_expenses::bigint, employee_expenses::bigint,
                 grants_donations_paid::bigint AS grants_made_au,
                 0::bigint AS grants_made_intl,
                 (COALESCE(total_expenses,0) - COALESCE(employee_expenses,0) - COALESCE(grants_donations_paid,0))::bigint AS other_expenses,
                 net_surplus_deficit::bigint AS surplus,
                 staff_full_time::int AS staff_ft,
                 staff_part_time::int AS staff_pt,
                 staff_casual::int AS staff_casual,
                 staff_fte::numeric(10,1) AS staff_fte,
                 staff_volunteers::int AS staff_vols,
                 num_kmp::int AS num_kmp,
                 total_paid_kmp::bigint AS total_paid_kmp,
                 'Annual Report (LLM-extracted)' AS data_source
          FROM public.charity_impact_reports
          WHERE abn IN ('${FECCA_ABN}','${ECCV_ABN}')
            AND total_expenses IS NOT NULL
          ORDER BY abn, report_year DESC
        )
        SELECT * FROM ais
        UNION ALL
        SELECT * FROM cir WHERE abn NOT IN (SELECT abn FROM ais)
        ORDER BY abn
      `,
    })) as Promise<AisFinancialsRow[] | null>,

    // Top federal contractors in the multicultural / settlement / ethnic-services sector
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT
          -- Collapse the obvious AMES variants under one banner
          CASE
            WHEN supplier_name ILIKE 'ADULT MULTICULTURAL EDUCATION%' OR supplier_name ILIKE '%AMES Australia%' OR supplier_name ILIKE 'Adult Multicultural Education Services%'
              THEN 'AMES (Adult Multicultural Education Services)'
            WHEN supplier_name ILIKE 'ETHNIC INTERPRETERS%'
              THEN 'Ethnic Interpreters & Translators'
            WHEN supplier_name ILIKE 'MULTICULTURAL DEVELOPMENT%'
              THEN 'Multicultural Development Association'
            ELSE supplier_name
          END AS supplier_name,
          COUNT(*)::int AS contracts,
          SUM(contract_value)::bigint AS total
        FROM public.austender_contracts
        WHERE (supplier_name ILIKE '%multicultural%' OR supplier_name ILIKE '%ethnic%')
          AND contract_value > 0
        GROUP BY 1
        ORDER BY total DESC NULLS LAST
        LIMIT 8
      `,
    })) as Promise<AmesContractRow[] | null>,

    // Topic mix across our newly-ingested 5K+ VIC grants.
    // Two-pass classifier: keywords on program_name first, recipient_name fallback.
    // The First Peoples bucket includes specific Traditional Owner group names + acronyms
    // (DDWCAC = Dja Dja Wurrung Clans Aboriginal Corporation, RAP = Reconciliation Action
    // Plan, Munarra = Yorta-Yorta cultural centre) that wouldn't match a generic
    // "aboriginal" keyword.
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT topic, COUNT(*)::int AS grants, SUM(amount_aud)::bigint AS total
        FROM (
          SELECT
            amount_aud,
            CASE
              -- First Peoples / Treaty: program_name OR recipient_name keywords + named groups
              WHEN program_name ILIKE '%aboriginal%' OR program_name ILIKE '%first peoples%' OR program_name ILIKE '%treaty%' OR program_name ILIKE '%self-determination%'
                   OR program_name ILIKE '%traditional owner%' OR program_name ILIKE '%stolen generations%' OR program_name ILIKE '%reconciliation%'
                   OR program_name ILIKE '%RAP %' OR program_name ILIKE '%RAP-%' OR program_name ILIKE '%native title%' OR program_name ILIKE '%indigenous%'
                   OR program_name ILIKE '%munarra%' OR program_name ILIKE '%DDWCAC%' OR program_name ILIKE '%taungurung%' OR program_name ILIKE '%yorta yorta%'
                   OR program_name ILIKE '%wurundjeri%' OR program_name ILIKE '%gunditj%' OR program_name ILIKE '%dja dja wurrung%'
                   OR program_name ILIKE '%bunurong%' OR program_name ILIKE '%gunaikurnai%' OR program_name ILIKE '%wadawurrung%' OR program_name ILIKE '%boon wurrung%'
                   OR recipient_name ILIKE '%aboriginal corporation%' OR recipient_name ILIKE '%traditional owner%' OR recipient_name ILIKE '%first peoples%'
                   OR recipient_name ILIKE '%first nations%' OR recipient_name ILIKE '%RNTBC%'
                THEN 'First Peoples / Treaty'

              -- Multicultural / Settlement: keyword OR recipient is ethnic/multicultural body OR migrant
              WHEN program_name ILIKE '%multicultural%' OR program_name ILIKE '%ethnic%' OR program_name ILIKE '%refugee%' OR program_name ILIKE '%settlement%'
                   OR program_name ILIKE '%cald %' OR program_name ILIKE '% cald%' OR program_name ILIKE '%migrant%' OR program_name ILIKE '%MCIF%'
                   OR program_name ILIKE '%diversity%' OR program_name ILIKE '%anti-racism%'
                   OR recipient_name ILIKE '%ethnic communit%' OR recipient_name ILIKE '%multicultural%' OR recipient_name ILIKE '%migrant%'
                   OR recipient_name ILIKE '%refugee%' OR recipient_name ILIKE '%new and emerging communit%'
                THEN 'Multicultural / Settlement'

              WHEN program_name ILIKE '%family violence%' OR program_name ILIKE '%family safety%' OR program_name ILIKE '%violence against%'
                   OR program_name ILIKE '%respectful relationships%' OR program_name ILIKE '%domestic violence%'
                THEN 'Family Violence'

              WHEN program_name ILIKE '%children%' OR program_name ILIKE '%family%' OR program_name ILIKE '%kindergarten%' OR program_name ILIKE '%early childhood%'
                   OR program_name ILIKE '%child protection%' OR program_name ILIKE '%parenting%'
                THEN 'Children / Family'

              WHEN program_name ILIKE '%housing%' OR program_name ILIKE '%homeless%' OR program_name ILIKE '%rooming house%' OR program_name ILIKE '%tenancy%'
                THEN 'Housing / Homelessness'

              WHEN program_name ILIKE '%mental%' OR program_name ILIKE '%suicide%' OR program_name ILIKE '%alcohol%' OR program_name ILIKE '%drug%'
                   OR program_name ILIKE '%AOD%' OR program_name ILIKE '%wellbeing%'
                THEN 'Mental Health / AOD'

              WHEN program_name ILIKE '%youth%' OR program_name ILIKE '%young people%' THEN 'Youth'

              WHEN program_name ILIKE '%women%' OR program_name ILIKE '%gender%' OR program_name ILIKE '%LGBT%' OR program_name ILIKE '%pride%'
                   OR program_name ILIKE '%equality%'
                THEN 'Gender / Equality'

              WHEN program_name ILIKE '%disability%' OR program_name ILIKE '%NDIS%' OR program_name ILIKE '%changing places%' OR program_name ILIKE '%accessib%'
                   OR program_name ILIKE '%inclusion%'
                THEN 'Disability / Accessibility'

              WHEN program_name ILIKE '%employ%' OR program_name ILIKE '%jobs%' OR program_name ILIKE '%skills%' OR program_name ILIKE '%TAFE%'
                   OR program_name ILIKE '%apprentic%' OR program_name ILIKE '%vocational%' OR program_name ILIKE '%construction industry%'
                THEN 'Jobs / Skills'

              WHEN program_name ILIKE '%arts%' OR program_name ILIKE '%culture%' OR program_name ILIKE '%creative%' OR program_name ILIKE '%festival%'
                   OR program_name ILIKE '%heritage%'
                THEN 'Arts / Culture'

              WHEN program_name ILIKE '%sport%' OR program_name ILIKE '%active%' OR program_name ILIKE '%athlete%' OR program_name ILIKE '%recreation%'
                THEN 'Sport / Recreation'

              WHEN program_name ILIKE '%community participation%' OR program_name ILIKE '%community funding%' OR program_name ILIKE '%neighbourhood%'
                   OR program_name ILIKE '%community grant%'
                THEN 'Community / Local'

              WHEN program_name ILIKE '%municipal%' OR program_name ILIKE '%essential services%' OR program_name ILIKE '%infrastructure%'
                   OR program_name ILIKE '%services funding%' OR program_name ILIKE '%operational%'
                THEN 'Infrastructure / Operating'

              WHEN program_name ILIKE '%veteran%' OR program_name ILIKE '%shrine%' OR program_name ILIKE '%remembrance%' OR program_name ILIKE '%legacy%'
                THEN 'Veterans / Legacy'

              ELSE 'Other / Unclassified'
            END AS topic
          FROM public.vic_grants_awarded
          WHERE program_name IS NOT NULL AND amount_aud > 0
        ) t
        GROUP BY 1
        ORDER BY total DESC NULLS LAST
      `,
    })) as Promise<TopicMixRow[] | null>,

    // Year-over-year by department
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT financial_year, source AS dept,
               COUNT(*)::int AS grants,
               SUM(amount_aud)::bigint AS total
        FROM public.vic_grants_awarded
        WHERE financial_year IS NOT NULL AND amount_aud > 0
        GROUP BY 1,2
        ORDER BY 1,2
      `,
    })) as Promise<YearMixRow[] | null>,
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
    power: powerRows ?? [],
    aisLatest: aisLatest ?? [],
    amesContracts: amesContractsRaw ?? [],
    topicMix: topicMixRaw ?? [],
    yearMix: yearMixRaw ?? [],
  };
}

function AnchorCard({ a, label, isShare }: { a: AnchorRow | null; label: string; isShare?: boolean }) {
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
      {isShare ? (
        <div className="text-xl font-black text-bauhaus-black uppercase tracking-tight block mb-2 leading-tight">{a.canonical_name}</div>
      ) : (
        <Link href={`/org/${a.gs_id}`} className="text-xl font-black text-bauhaus-black uppercase tracking-tight hover:underline block mb-2 leading-tight">
          {a.canonical_name}
        </Link>
      )}
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

function StackedBar({ label, total, segments }: { label: string; total: number | null; segments: Array<{ key: string; value: number | null; color: string; label: string }> }) {
  const t = Math.max(total || 0, 1);
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="font-black uppercase tracking-widest text-bauhaus-black">{label}</span>
        <span className="text-bauhaus-muted">{money(total)}</span>
      </div>
      <div className="relative h-7 bg-bauhaus-canvas border-2 border-bauhaus-black flex">
        {segments.map(s => {
          const v = s.value || 0;
          if (v <= 0) return null;
          const pctW = (v / t) * 100;
          return <div key={s.key} className={`${s.color} h-full`} style={{ width: `${pctW}%` }} title={`${s.label}: ${money(v)}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-1 text-[10px] font-mono text-bauhaus-muted">
        {segments.filter(s => (s.value || 0) > 0).map(s => (
          <span key={s.key}>
            <span className={`inline-block w-2 h-2 ${s.color} mr-1 align-middle`} />
            {s.label} {money(s.value)} ({total ? (((s.value || 0) / total) * 100).toFixed(0) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}

function MoneyAndStaffCard({ row, label }: { row: AisFinancialsRow | null; label: string }) {
  if (!row) {
    return (
      <div className="border-4 border-bauhaus-black p-5 bg-white">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{label}</div>
        <p className="text-bauhaus-black font-medium text-sm mt-3">FECCA is <span className="font-black">missing from every public ACNC AIS bulk dataset (2017&ndash;2023)</span>.</p>
        <p className="text-bauhaus-muted text-xs mt-2 leading-relaxed">
          We pulled the FY2025 revenue figure from the ACNC Charity Portal Dynamics API, but that endpoint exposes only revenue / govt-share / donations &mdash; no expenses, staff, or KMP comp. Their own annual report PDFs publish narrative + program data, not audited financial statements.
        </p>
        <p className="text-bauhaus-muted text-xs mt-2 leading-relaxed">
          Current visible: revenue $4.97M (100% govt). To get spend / staff / surplus history we&apos;d need either the ACNC Charity Portal HTML scrape (anti-bot) or FY2024+ bulk data once published.
        </p>
      </div>
    );
  }
  const empPct = row.total_expenses ? ((row.employee_expenses ?? 0) / row.total_expenses) * 100 : 0;
  const surplusColor = (row.surplus ?? 0) >= 0 ? 'text-bauhaus-blue' : 'text-bauhaus-red';
  return (
    <div className="border-4 border-bauhaus-black p-5 bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">{label}</div>
          <div className="text-2xl font-black text-bauhaus-black tracking-tight">FY {row.ais_year}</div>
          {row.data_source && (
            <div className={`text-[10px] font-mono uppercase tracking-widest mt-1 ${row.data_source === 'ACNC AIS' ? 'text-bauhaus-blue' : 'text-bauhaus-red'}`}>
              source: {row.data_source}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Surplus</div>
          <div className={`font-black text-2xl ${surplusColor} tabular-nums`}>{money(row.surplus)}</div>
        </div>
      </div>

      <div className="space-y-4 mb-4">
        <StackedBar
          label="Revenue In"
          total={row.total_revenue}
          segments={[
            { key: 'govt', value: row.govt, color: 'bg-bauhaus-red', label: 'Govt grants' },
            { key: 'fees', value: row.fees, color: 'bg-bauhaus-blue', label: 'Fees / services' },
            { key: 'don', value: row.donations, color: 'bg-bauhaus-yellow', label: 'Donations' },
            { key: 'inv', value: row.investments, color: 'bg-bauhaus-black', label: 'Investments' },
            { key: 'oth', value: row.other_revenue, color: 'bg-bauhaus-muted', label: 'Other' },
          ]}
        />
        <StackedBar
          label="Spend Out"
          total={row.total_expenses}
          segments={[
            { key: 'emp', value: row.employee_expenses, color: 'bg-bauhaus-red', label: 'Employees' },
            { key: 'grants_au', value: row.grants_made_au, color: 'bg-bauhaus-blue', label: 'Grants (AU)' },
            { key: 'grants_int', value: row.grants_made_intl, color: 'bg-bauhaus-yellow', label: 'Grants (Intl)' },
            { key: 'other', value: row.other_expenses, color: 'bg-bauhaus-black', label: 'Other' },
          ]}
        />
      </div>

      <div className={`text-sm font-medium border-l-4 pl-3 py-1 mb-4 ${empPct >= 70 ? 'border-bauhaus-red text-bauhaus-black' : 'border-bauhaus-yellow text-bauhaus-muted'}`}>
        {empPct.toFixed(0)}% of spend goes to staff. {(row.grants_made_au ?? 0) + (row.grants_made_intl ?? 0) === 0 ? 'No grants redistributed — this is a service / advocacy body, not a re-granter.' : `${money((row.grants_made_au ?? 0) + (row.grants_made_intl ?? 0))} redistributed as grants.`}
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest font-black text-bauhaus-muted mb-2">Workforce</div>
        {(() => {
          const stats = [
            { label: 'FT', val: row.staff_ft },
            { label: 'PT', val: row.staff_pt },
            { label: 'Casual', val: row.staff_casual },
            { label: 'FTE', val: row.staff_fte },
            { label: 'Volunteers', val: row.staff_vols },
          ];
          const allMissing = stats.every(s => s.val == null);
          if (allMissing) {
            return (
              <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas text-xs text-bauhaus-muted font-medium leading-relaxed">
                Workforce headcount not disclosed in the audited annual report. ACNC AIS would have these fields, but FECCA is exempt from public AIS bulk publication (see card-source line above).
              </div>
            );
          }
          return (
            <div className="grid grid-cols-5 gap-2 text-center">
              {stats.map(s => (
                <div key={s.label} className="border-2 border-bauhaus-black p-2 bg-bauhaus-canvas">
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">{s.label}</div>
                  <div className="text-lg font-black text-bauhaus-black tabular-nums">{s.val ?? '—'}</div>
                </div>
              ))}
            </div>
          );
        })()}
        {(row.num_kmp != null && row.num_kmp > 0) || (row.total_paid_kmp ?? 0) > 0 ? (
          <div className="mt-3 text-xs font-mono text-bauhaus-muted">
            Key Management: {row.num_kmp != null && row.num_kmp > 0 ? `${row.num_kmp} ${row.num_kmp === 1 ? 'person' : 'people'}` : 'count not disclosed'} · {money(row.total_paid_kmp)} total comp
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function FeccaEccvPage() {
  const hdrs = await headers();
  const isShare = (hdrs.get('x-pathname') ?? '').startsWith('/share/');
  const dashboardPath = isShare ? '/share/fecca-eccv' : '/reports/multicultural-sector/fecca-eccv';
  const longReadPath = isShare ? '/share/fecca-eccv/long-read' : '/reports/multicultural-sector/fecca-eccv/long-read';
  const r = await getReport();

  // ECCV revenue trajectory — render as horizontal bars normalised to peak
  const eccvPeak = Math.max(...r.eccv_ais.map(a => a.total || 0), 1);
  const feccaPeak = Math.max(...r.fecca_ais.map(a => a.total || 0), 1);
  const feccaPower = r.power.find(p => p.abn === FECCA_ABN) || null;
  const eccvPower = r.power.find(p => p.abn === ECCV_ABN) || null;
  const feccaFin = r.aisLatest.find(a => a.abn === FECCA_ABN) || null;
  const eccvFin = r.aisLatest.find(a => a.abn === ECCV_ABN) || null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0 mb-6">
        <Link href={dashboardPath} className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-black text-white" aria-current="page">Dashboard</Link>
        <Link href={longReadPath} className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black -ml-0.5 bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas">📖 Read the Long-form Report</Link>
      </div>
      <div className="mb-10">
        {!isShare && (
          <Link href="/reports/multicultural-sector" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Multicultural Sector
          </Link>
        )}
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Deep Dive · Two Single-Funder Dependencies</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3 uppercase tracking-tight">
          FECCA &amp; ECCV — The Federation&apos;s Money Map
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Two policy bodies, two single-funder dependencies. FECCA runs <span className="font-black">86&ndash;100% federal</span> revenue (latest audited FY2023-24: <span className="font-black text-bauhaus-red">$508K deficit</span>); ECCV&apos;s <span className="font-black">total revenue dropped 34%</span> in FY2022-23 &mdash; grants fell $986K, &ldquo;other income&rdquo; fell $247K. They survived a $15K surplus only by cutting program expenses 79% and wages 21% (~6 FTE equivalent).
          Combined revenue ~$7.4M, combined federal contracts $0.77M &mdash; while AMES alone holds <span className="font-black text-bauhaus-red">$1.85B</span> of federal multicultural procurement (§2c).
          This page maps where each anchor&apos;s money comes from, where it goes, who works there, and what happens when a cycle ends.
        </p>
      </div>

      {/* Anchor cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        <AnchorCard a={r.fecca} label="National Peak" isShare={isShare} />
        <AnchorCard a={r.eccv} label="Victoria State Council" isShare={isShare} />
      </div>

      {/* SECTION 1 — Financial trajectories */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§1</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Financial Trajectories — Single-Funder Dependence</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Year-by-year revenue mix. Red is government grant revenue; blue is fees + donations. Both anchors run on a single revenue stream &mdash; FECCA on Commonwealth contracts (100% federal), ECCV on Victorian state grants (84&ndash;95% state). With ECCV&apos;s 77% wage-share spend (§1b), there&apos;s no buffer to absorb a cycle-end without staff cuts.
        </p>

        {/* Funder concentration + biggest YoY drop callout */}
        {(() => {
          const eccvAisAsc = [...r.eccv_ais].sort((a, b) => a.ais_year - b.ais_year);
          let worstDrop = null as { from: number; to: number; pct: number; total: number } | null;
          for (let i = 1; i < eccvAisAsc.length; i++) {
            const prev = eccvAisAsc[i - 1].total;
            const cur = eccvAisAsc[i].total;
            if (prev > 0) {
              const pct = ((cur - prev) / prev) * 100;
              if (pct < (worstDrop?.pct ?? 0)) worstDrop = { from: eccvAisAsc[i - 1].ais_year, to: eccvAisAsc[i].ais_year, pct, total: cur };
            }
          }
          const feccaConcentration = r.fecca?.govt_pct ?? null;
          const eccvLatestConcentration = eccvAisAsc.length ? (eccvAisAsc[eccvAisAsc.length - 1].govt / eccvAisAsc[eccvAisAsc.length - 1].total) * 100 : null;
          return (
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="border-4 border-bauhaus-red p-4 bg-white">
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">FECCA Funder Concentration</div>
                <div className="text-3xl font-black text-bauhaus-black tabular-nums">86&ndash;100%</div>
                <p className="text-xs text-bauhaus-muted font-medium mt-2 leading-relaxed">
                  Audited FY2023-24: <span className="font-black">86% federal</span> ($3.31M of $3.83M); ACNC Dynamics FY2024-25: <span className="font-black">100% federal</span>. Mainly Department of Home Affairs (settlement) + Department of Infrastructure (Australian Mosaic). Ran a <span className="font-black text-bauhaus-red">$508K deficit in FY2023-24</span>.
                </p>
              </div>
              <div className="border-4 border-bauhaus-red p-4 bg-white">
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">ECCV — FY2022-23 Revenue Collapse</div>
                <div className="text-3xl font-black text-bauhaus-red tabular-nums">&minus;34%</div>
                <p className="text-xs text-bauhaus-muted font-medium mt-2 leading-relaxed">
                  Audited FY2022-23: grants <span className="font-black">$2.64M &rarr; $1.65M</span> (&minus;$986K), &ldquo;other income&rdquo; $971K &rarr; $724K. Total revenue $3.63M &rarr; $2.40M. Survived with a $15K surplus by cutting program-expenses <span className="font-black">79%</span> ($885K &rarr; $183K) + wages <span className="font-black">21%</span> (~6 FTE).
                </p>
              </div>
              <div className={`border-4 ${worstDrop && worstDrop.pct < -20 ? 'border-bauhaus-red' : 'border-bauhaus-black'} p-4 bg-white`}>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Funding Cycle Risk (ECCV)</div>
                {worstDrop ? (
                  <>
                    <div className={`text-3xl font-black tabular-nums ${worstDrop.pct < -20 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{worstDrop.pct.toFixed(0)}%</div>
                    <p className="text-xs text-bauhaus-muted font-medium mt-2 leading-relaxed">
                      Worst single-year revenue drop: FY{worstDrop.from} &rarr; FY{worstDrop.to}. With 77% wage-share, a drop of this size means redundancies unless reserves cover ~{Math.round(Math.abs(worstDrop.pct) * 0.77)}% of payroll.
                    </p>
                  </>
                ) : (
                  <div className="text-bauhaus-muted text-xs font-medium">Insufficient YoY data.</div>
                )}
              </div>
            </div>
          );
        })()}

        <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">FECCA &mdash; National Peak</h3>
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-8">
          {r.fecca_ais.length === 0 ? (
            <p className="text-bauhaus-muted font-medium">No FECCA AIS data ingested yet.</p>
          ) : r.fecca_ais.map((a) => {
            const totalPct = (a.total / feccaPeak) * 100;
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
                  <div className="absolute inset-y-0 left-0 bg-bauhaus-red" style={{ width: `${(a.govt / feccaPeak) * 100}%` }} />
                  <div
                    className="absolute inset-y-0 bg-bauhaus-blue"
                    style={{ left: `${(a.govt / feccaPeak) * 100}%`, width: `${((a.fees + a.donations) / feccaPeak) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-black text-bauhaus-black">
                    {totalPct.toFixed(0)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">ECCV &mdash; Victoria State Council</h3>
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

      {/* SECTION 1b — Where the Money Goes (revenue + expense + staff) */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§1b</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Where the Money Goes — Spend &amp; Staff</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Latest ACNC AIS for each anchor, decomposed. The revenue stack shows where the money comes from; the spend stack shows where it ends up. Staff breakdown beneath. ECCV pays out 65–85% as wages and redistributes nothing — they&apos;re a service / advocacy body, not a re-granter.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <MoneyAndStaffCard row={feccaFin} label="FECCA — National Peak" />
          <MoneyAndStaffCard row={eccvFin} label="ECCV — VIC State Council" />
        </div>

        {/* FECCA structural-stress callout */}
        <div className="border-4 border-bauhaus-red p-6 bg-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-3">FECCA — A Fragile National Peak (Audited FY2023-24)</div>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-bauhaus-muted mb-1">2-Year Cumulative Deficit</div>
              <div className="text-2xl font-black text-bauhaus-red tabular-nums">&minus;$1.00M</div>
              <p className="text-xs text-bauhaus-muted mt-1">
                FY2022-23: &minus;$494,998 · FY2023-24: &minus;$508,347. Both years disclosed in the Directors&apos; Report.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-bauhaus-muted mb-1">Reserves Remaining</div>
              <div className="text-2xl font-black text-bauhaus-black tabular-nums">$1.27M</div>
              <p className="text-xs text-bauhaus-muted mt-1">
                Accumulated Surplus, FY2024 balance sheet (down from $1.78M). At ~$500K/yr burn rate, <span className="font-black">~2.5 years of buffer</span> at current trajectory.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-bauhaus-muted mb-1">Late ACNC Registration</div>
              <div className="text-2xl font-black text-bauhaus-black tabular-nums">24 yrs</div>
              <p className="text-xs text-bauhaus-muted mt-1">
                ABN active since 01 Nov 1999, GST since 01 Jul 2000, but charity tax concession + ACNC registration both granted <span className="font-black">08 Aug 2023</span>.
              </p>
            </div>
          </div>
          <div className="border-l-4 border-bauhaus-red pl-4 text-sm font-medium text-bauhaus-black leading-relaxed mt-3">
            FY2023-24 was a year of structural strain. <span className="font-black">5 of 13 staff (38%) departed</span> during the year &mdash; including the Director of Policy &amp; Advocacy, the Strategy Lead, and the Senior Advisor. CEO Mohammad Al-Khafaji left Aug 2024; Mary Ann Baquero Geronimo took over the following month. Board Chair shifted from Carlo Carli to Peter Doukas. Total Liabilities <span className="font-black">tripled $1.37M &rarr; $3.82M</span> (mostly grants received in advance &mdash; deferred revenue for future periods). The audit&apos;s Directors&apos; Report still says &ldquo;no significant changes in the Corporation&apos;s state of affairs&rdquo;.
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

      {/* SECTION 2c — AMES Asymmetry */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§2c</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The AMES Asymmetry — Where Federal Multicultural Procurement Actually Goes</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          FECCA holds {money(r.fecca_contracts.reduce((s, c) => s + c.contract_value, 0))} of lifetime Commonwealth procurement (§2). For comparison, here are the largest federal contractors with &quot;multicultural&quot; or &quot;ethnic&quot; in their name. The settlement-services market is dominated by AMES &mdash; mostly the Adult Migrant English Program. The federation&apos;s peak bodies barely register in the federal procurement story.
        </p>
        {r.amesContracts.length === 0 ? (
          <div className="border-4 border-bauhaus-yellow p-6 bg-white">
            <p className="text-bauhaus-black font-medium">No multicultural-sector austender data ingested.</p>
          </div>
        ) : (() => {
          const peak = r.amesContracts[0]?.total || 1;
          return (
            <div className="border-4 border-bauhaus-black p-6 bg-white">
              {r.amesContracts.map((c, i) => {
                const pct = (c.total / peak) * 100;
                return (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-black text-bauhaus-black truncate pr-3">{c.supplier_name}</span>
                      <span className="text-bauhaus-muted whitespace-nowrap">{money(c.total)} · {c.contracts} contracts</span>
                    </div>
                    <div className="relative h-6 bg-bauhaus-canvas border-2 border-bauhaus-black">
                      <div className={`absolute inset-y-0 left-0 ${i === 0 ? 'bg-bauhaus-red' : 'bg-bauhaus-blue'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-xs font-mono text-bauhaus-muted leading-relaxed">
                AMES holds <span className="font-black text-bauhaus-red">{money(r.amesContracts[0]?.total)}</span> across {r.amesContracts[0]?.contracts} federal contracts — roughly{' '}
                <span className="font-black">{r.fecca_contracts.reduce((s, c) => s + c.contract_value, 0) > 0 ? Math.round((r.amesContracts[0]?.total || 0) / r.fecca_contracts.reduce((s, c) => s + c.contract_value, 0)).toLocaleString() : '∞'}×</span>{' '}
                FECCA&apos;s lifetime total. Source: <code className="bg-bauhaus-canvas px-1">austender_contracts</code>.
              </div>
            </div>
          );
        })()}
      </section>

      {/* SECTION 2.5 — Cross-System Power Profile */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§2b</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Cross-System Power Profile</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Where each anchor shows up across CivicGraph&apos;s 7 federal/national systems &mdash; procurement, justice funding, political donations, charity registry, foundations, ALMA evidence, ATO transparency. ECCV&apos;s state-grant flows (now in §6) don&apos;t yet feed this index, which is why the national signal is so thin.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { row: feccaPower, label: 'FECCA — National Peak' },
            { row: eccvPower, label: 'ECCV — VIC State Council' },
          ].map(({ row, label }) => (
            <div key={label} className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{label}</div>
              {!row ? (
                <p className="text-bauhaus-muted font-medium text-sm mt-3">No power-index row.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Power Score</div>
                      <div className={`font-black text-3xl ${(row.power_score ?? 0) >= 6 ? 'text-bauhaus-red' : 'text-bauhaus-black'} tabular-nums`}>
                        {row.power_score ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Systems Hit</div>
                      <div className="font-black text-3xl text-bauhaus-black tabular-nums">
                        {row.system_count ?? 0} <span className="text-base text-bauhaus-muted">/ 7</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {[
                      { hit: row.in_procurement, label: 'Procurement' },
                      { hit: row.in_justice_funding, label: 'Justice $' },
                      { hit: row.in_political_donations, label: 'Donations' },
                      { hit: row.in_charity_registry, label: 'ACNC' },
                      { hit: row.has_board_links, label: 'Board Links' },
                    ].map(s => (
                      <span key={s.label} className={`text-xs font-black uppercase tracking-widest px-2 py-1 ${s.hit ? 'bg-bauhaus-black text-white' : 'bg-bauhaus-canvas text-bauhaus-muted line-through'}`}>
                        {s.label}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <div className="text-bauhaus-muted uppercase tracking-widest font-black mb-1">Total $ Flow</div>
                      <div className="font-black text-bauhaus-black text-lg">{money(row.total_dollar_flow)}</div>
                    </div>
                    <div>
                      <div className="text-bauhaus-muted uppercase tracking-widest font-black mb-1">Contracts</div>
                      <div className="font-black text-bauhaus-black text-lg">{row.contract_count ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-bauhaus-muted uppercase tracking-widest font-black mb-1">Govt Buyers</div>
                      <div className="font-black text-bauhaus-black text-lg">{row.distinct_govt_buyers ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-bauhaus-muted uppercase tracking-widest font-black mb-1">Board Connections</div>
                      <div className="font-black text-bauhaus-black text-lg">{row.board_connections ?? 0}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
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
                        <OrgRef gsId={d.person_id} name={d.person_name} isShare={isShare} />
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
                        <OrgRef gsId={d.person_id} name={d.person_name} isShare={isShare} />
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

                  {(rep.total_beneficiaries != null || rep.programs_delivered != null) && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {rep.total_beneficiaries != null && (
                        <div>
                          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Beneficiaries</div>
                          <div className="font-black text-2xl text-bauhaus-black tabular-nums">{rep.total_beneficiaries.toLocaleString()}</div>
                        </div>
                      )}
                      {rep.programs_delivered != null && (
                        <div>
                          <div className="text-xs uppercase tracking-widest text-bauhaus-muted font-black">Programs</div>
                          <div className="font-black text-2xl text-bauhaus-black tabular-nums">{rep.programs_delivered}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {(rep.total_revenue != null || rep.total_expenses != null || rep.staff_full_time != null) && (
                    <div className="grid grid-cols-3 gap-2 mb-3 border-b-2 border-bauhaus-black pb-3">
                      {rep.total_revenue != null && (
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted font-black">Revenue</div>
                          <div className="font-black text-base text-bauhaus-black tabular-nums">{money(rep.total_revenue)}</div>
                        </div>
                      )}
                      {rep.total_expenses != null && (
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted font-black">Expenses</div>
                          <div className={`font-black text-base tabular-nums ${rep.net_surplus_deficit != null && rep.net_surplus_deficit < 0 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{money(rep.total_expenses)}</div>
                        </div>
                      )}
                      {(rep.staff_full_time != null || rep.staff_fte != null) && (
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted font-black">Staff (FT/FTE)</div>
                          <div className="font-black text-base text-bauhaus-black tabular-nums">{rep.staff_full_time ?? '—'}/{rep.staff_fte ?? '—'}</div>
                        </div>
                      )}
                    </div>
                  )}

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

                  {rep.top_funders_mentioned && rep.top_funders_mentioned.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs uppercase tracking-widest font-black text-bauhaus-muted mb-1">Funders / Agencies Cited</div>
                      <div className="flex flex-wrap gap-1">
                        {rep.top_funders_mentioned.slice(0, 6).map((f, i) => (
                          <span key={i} className="text-xs font-black uppercase tracking-widest bg-bauhaus-blue text-white px-2 py-1">
                            {f}
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

                  {rep.key_quotes && rep.key_quotes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {rep.key_quotes.slice(0, 2).map((q, i) => (
                        <blockquote key={i} className="text-xs italic text-bauhaus-black font-medium leading-relaxed border-l-4 border-bauhaus-red pl-3 py-1">
                          &ldquo;{q}&rdquo;
                        </blockquote>
                      ))}
                    </div>
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
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">VIC State Grants — The Full Picture</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          {(() => {
            const total = r.vicGrants.reduce((s, g) => s + g.amount, 0) + r.siblingGrants.reduce((s, g) => s + g.amount, 0);
            const grandTotal = r.yearMix.reduce((s, y) => s + y.total, 0);
            const recipients = new Set(r.yearMix.map(y => y.dept)).size;
            return <>{r.yearMix.length ? `${money(grandTotal)} across ${r.yearMix.reduce((s, y) => s + y.grants, 0).toLocaleString()} grants from ${recipients} VIC departments — extracted by LLM from annual-report PDFs (DPC, DFFH, DJSIR) via pdftotext → Claude Haiku / MiniMax fallback. ${total > 0 ? `Of that, ${money(total)} touches FECCA, ECCV or sister ECCs.` : ''}` : ''}</>;
          })()}
        </p>

        {/* Year-over-year stacked bars */}
        {r.yearMix.length > 0 && (() => {
          const yearTotals = new Map<string, { total: number; depts: Record<string, number> }>();
          r.yearMix.forEach(y => {
            const e = yearTotals.get(y.financial_year) || { total: 0, depts: {} };
            e.total += y.total;
            e.depts[y.dept] = y.total;
            yearTotals.set(y.financial_year, e);
          });
          const sortedYears = [...yearTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
          const peak = Math.max(...sortedYears.map(([, v]) => v.total), 1);
          const deptColor = { dpc: 'bg-bauhaus-red', dffh: 'bg-bauhaus-blue', djsir: 'bg-bauhaus-yellow', djcs: 'bg-bauhaus-black' } as Record<string, string>;
          return (
            <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">Grant Flow by Year &amp; Department</h3>
              {sortedYears.map(([fy, v]) => {
                const widthPct = (v.total / peak) * 100;
                return (
                  <div key={fy} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-black text-bauhaus-black">FY {fy}</span>
                      <span className="text-bauhaus-muted">{money(v.total)} · {Object.keys(v.depts).map(d => `${d.toUpperCase()} ${money(v.depts[d])}`).join(' · ')}</span>
                    </div>
                    <div className="relative h-7 bg-bauhaus-canvas border-2 border-bauhaus-black flex" style={{ width: `${widthPct}%` }}>
                      {Object.entries(v.depts).map(([dept, val]) => (
                        <div key={dept} className={`${deptColor[dept] || 'bg-bauhaus-muted'} h-full`} style={{ width: `${(val / v.total) * 100}%` }} title={`${dept.toUpperCase()}: ${money(val)}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest mt-4 pt-3 border-t-2 border-bauhaus-black">
                {Object.entries(deptColor).filter(([d]) => sortedYears.some(([, v]) => v.depts[d])).map(([d, c]) => (
                  <span key={d}><span className={`inline-block w-3 h-3 ${c} mr-1 align-middle`} />{d.toUpperCase()}</span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Topic-mix breakdown */}
        {r.topicMix.length > 0 && (() => {
          const peak = Math.max(...r.topicMix.map(t => t.total), 1);
          const total = r.topicMix.reduce((s, t) => s + t.total, 0);
          return (
            <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-1">Topic Mix Across All VIC Grants</h3>
              <p className="text-xs font-mono text-bauhaus-muted mb-4">
                Keyword-classified by program_name. The multicultural sector receives a fraction of what flows to First Peoples / Treaty work via these channels.
              </p>
              {r.topicMix.map((t, i) => {
                const pct = (t.total / peak) * 100;
                const sharePct = total > 0 ? (t.total / total) * 100 : 0;
                const isMulti = t.topic === 'Multicultural / Settlement';
                const isFirstPeoples = t.topic === 'First Peoples / Treaty';
                const barColor = isMulti ? 'bg-bauhaus-yellow' : isFirstPeoples ? 'bg-bauhaus-red' : 'bg-bauhaus-blue';
                return (
                  <div key={i} className="mb-2 last:mb-0">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className={`font-black ${isMulti || isFirstPeoples ? 'text-bauhaus-black' : 'text-bauhaus-muted'} truncate pr-3`}>{t.topic}</span>
                      <span className="text-bauhaus-muted whitespace-nowrap">{money(t.total)} · {t.grants} grants · {sharePct.toFixed(1)}%</span>
                    </div>
                    <div className="relative h-5 bg-bauhaus-canvas border-2 border-bauhaus-black">
                      <div className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-xs font-mono text-bauhaus-muted">
                <span className="inline-block w-3 h-3 bg-bauhaus-red mr-1 align-middle" /> First Peoples · {' '}
                <span className="inline-block w-3 h-3 bg-bauhaus-yellow mr-1 align-middle" /> Multicultural · {' '}
                <span className="inline-block w-3 h-3 bg-bauhaus-blue mr-1 align-middle" /> Other
              </div>
            </div>
          );
        })()}

        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The table below is the existing FECCA / ECCV / cluster cut — top-30 by amount.
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
                      <OrgRef gsId={g.recipient_gs_id} name={g.recipient_name} isShare={isShare} />
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
                      <OrgRef gsId={g.recipient_gs_id} name={g.recipient_name} isShare={isShare} />
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
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">3-year VIC grant time series</span> — DPC + DFFH + DJSIR annual reports for FY2021-22, FY2022-23, FY2023-24 ingested via pdftotext + Claude Haiku / MiniMax fallback → <span className="font-mono">5,202 grants · $484M</span> in <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">vic_grants_awarded</code>.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">Annual report LLM enrichment</span> — funders mentioned, beneficiary counts, programs delivered, key quotes extracted from <span className="font-mono">63 charity reports</span>. Visible in §5 cards.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">Fuzzy entity linker</span> — recipient-name → gs_entities matching via 7-step Postgres normalizer (apostrophes / hyphens / Trustee-for / Inc-vs-Incorporated) plus pg_trgm similarity ≥ 0.85. Linked share <span className="font-mono">27% → 65.5%</span>.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">AMES asymmetry surfaced</span> (§2c) — federal multicultural procurement is <span className="font-mono">$1.85B at AMES vs $0.91M at FECCA</span>, which the prior &ldquo;federation&apos;s anchors&rdquo; framing obscured.</span></li>
          <li className="flex gap-3"><span className="font-black text-bauhaus-blue">✓ DONE</span><span><span className="font-black">Topic-mix + year-over-year visualizations</span> (§6) — show First Peoples / Treaty work receives <span className="font-mono">~10× more</span> than Multicultural / Settlement through these state channels.</span></li>
        </ul>
        <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black mt-6 mb-2">Open Follow-Ups (with signal/effort estimate)</h3>
        <ul className="space-y-2 text-bauhaus-black font-medium text-sm">
          <li>• <span className="font-black">Federal Home Affairs SETS / NMRP / AMEP grants</span> — biggest blind spot; settlement-services federal funding stream we don&apos;t ingest at all.</li>
          <li>• <span className="font-black">Direct entity ingestion for top unlinked recipients</span> — Self-Determination Fund Trust ($35M), Shrine of Remembrance ($16M), VIC LGAs (Cardinia/Bendigo/Macedon/Wangaratta/Shepparton/Nillumbik/Moreland), major Aboriginal trusts. Would push 65% → 80%+.</li>
          <li>• <span className="font-black">VIC Multicultural Commission</span> — separate ~$15-30M/year community-grants stream not in DPC/DFFH/DJSIR.</li>
          <li>• <span className="font-black">NSW + QLD state ECCs</span> — complete the federation picture; <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">DEPT_CONFIG</code> + <code className="bg-bauhaus-black text-bauhaus-yellow px-1 text-xs">vic_grants_awarded.state</code> column ready for them.</li>
          <li>• <span className="font-black">ABS CALD population by LGA</span> — unlocks &ldquo;funding-vs-need&rdquo; geographic story.</li>
        </ul>
      </section>

      {/* Want one of these? CTA */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Want one of these for your sector or org?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
          The same pipeline works for any Australian charity, peak body, sector, network, or funding stream. Audited financials, federal procurement, state grants, board interlocks, foundation flows &mdash; cross-referenced and narrated with sourced citations. <span className="font-black">First 5 reports are free</span> for orgs willing to be a public case study. Standard On-Demand reports are $2,500.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/get-a-report?free=true&src=fecca-eccv-dashboard" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-red text-white border-2 border-bauhaus-black hover:bg-bauhaus-black">★ Apply for First 5 Free →</Link>
          <Link href="/get-a-report?budget=2500&src=fecca-eccv-dashboard" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">Request a paid report →</Link>
          <Link href="/pricing" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-white text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-canvas">See full pricing</Link>
        </div>
      </section>

      <section className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">Last updated: {new Date().toISOString().slice(0, 10)} · CivicGraph</div>
      </section>
    </div>
  );
}
