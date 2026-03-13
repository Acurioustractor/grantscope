import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SupplyRow = {
  report_date: string;
  state_code: string;
  service_district_name: string;
  provider_count: number;
};

type ConcentrationRow = {
  report_date: string;
  state_code: string;
  service_district_name: string;
  support_class: string;
  payment_share_top10_pct: number | null;
  payment_band: string | null;
  source_page_url?: string | null;
  source_file_url?: string | null;
};

type RegisteredSummaryRow = {
  report_date: string;
  registration_status: string;
  provider_count: number;
};

type RegisteredStateRow = {
  report_date: string;
  registration_status: string;
  state_code: string;
  provider_count: number;
};

type RegisteredMatchRow = {
  report_date: string;
  registration_status: string;
  provider_count: number;
  matched_entity_count: number;
  matched_entity_pct: number | null;
};

function fmt(n: number) {
  return n.toLocaleString('en-AU');
}

function pct(n: number | null | undefined) {
  return n == null ? '—' : `${Math.round(n)}%`;
}

function districtLabel(name: string) {
  return name.replace(/~[A-Z]+$/, '');
}

function validDistrict(name: string) {
  return name !== 'ALL' && name !== 'Other' && !/missing/i.test(name);
}

async function getReport() {
  const supabase = getServiceSupabase();

  const [
    { data: nationalSupply },
    { data: stateSupply },
    { data: districtSupply },
    { data: concentrationRows },
    { count: disabilitySocialEnterprises },
    { count: disabilityCommunityOrgs },
    { data: qldDistricts },
    { data: registeredSummaryRows },
    { data: registeredStateRows },
    { data: registeredMatchRow },
  ] = await Promise.all([
    supabase
      .from('v_ndis_provider_supply_summary')
      .select('report_date, state_code, service_district_name, provider_count')
      .eq('state_code', 'ALL')
      .eq('service_district_name', 'ALL')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('v_ndis_provider_supply_summary')
      .select('report_date, state_code, service_district_name, provider_count')
      .neq('state_code', 'ALL')
      .neq('state_code', 'OT')
      .neq('state_code', 'State_Missing')
      .eq('service_district_name', 'ALL')
      .order('provider_count', { ascending: false })
      .limit(8),
    supabase
      .from('v_ndis_provider_supply_summary')
      .select('report_date, state_code, service_district_name, provider_count')
      .neq('state_code', 'ALL')
      .neq('state_code', 'OT')
      .neq('state_code', 'State_Missing')
      .neq('service_district_name', 'ALL')
      .neq('service_district_name', 'Other')
      .not('service_district_name', 'ilike', '%Missing%')
      .order('provider_count', { ascending: true })
      .limit(18),
    supabase
      .from('ndis_market_concentration')
      .select('report_date, state_code, service_district_name, support_class, payment_share_top10_pct, payment_band, source_page_url, source_file_url')
      .neq('state_code', 'ALL')
      .neq('state_code', 'OT')
      .neq('state_code', 'State_Missing')
      .eq('support_class', 'Core')
      .neq('service_district_name', 'ALL')
      .neq('service_district_name', 'Other')
      .not('service_district_name', 'ilike', '%Missing%')
      .not('payment_share_top10_pct', 'is', null)
      .neq('payment_band', '< 1m')
      .order('payment_share_top10_pct', { ascending: false })
      .limit(250),
    supabase
      .from('social_enterprises')
      .select('id', { count: 'exact', head: true })
      .contains('target_beneficiaries', ['people_with_disability']),
    supabase
      .from('community_orgs')
      .select('id', { count: 'exact', head: true })
      .contains('domain', ['disability']),
    supabase
      .from('v_ndis_provider_supply_summary')
      .select('service_district_name, provider_count')
      .eq('state_code', 'QLD')
      .neq('service_district_name', 'ALL')
      .neq('service_district_name', 'Other')
      .not('service_district_name', 'ilike', '%Missing%')
      .order('provider_count', { ascending: true })
      .limit(10),
    supabase
      .from('v_ndis_registered_provider_status_summary')
      .select('report_date, registration_status, provider_count')
      .order('provider_count', { ascending: false }),
    supabase
      .from('v_ndis_registered_provider_state_supply')
      .select('report_date, registration_status, state_code, provider_count')
      .eq('registration_status', 'Approved')
      .order('provider_count', { ascending: false })
      .limit(8),
    supabase
      .from('v_ndis_registered_provider_graph_match')
      .select('report_date, registration_status, provider_count, matched_entity_count, matched_entity_pct')
      .eq('registration_status', 'Approved')
      .maybeSingle(),
  ]);

  const national = nationalSupply as SupplyRow | null;
  const states = (stateSupply || []) as SupplyRow[];
  const districts = (districtSupply || []) as SupplyRow[];
  const concentrations = (concentrationRows || []) as ConcentrationRow[];
  const qld = (qldDistricts || []) as Array<{ service_district_name: string; provider_count: number }>;
  const registeredSummary = (registeredSummaryRows || []) as RegisteredSummaryRow[];
  const registeredStates = (registeredStateRows || []) as RegisteredStateRow[];
  const registeredMatch = (registeredMatchRow || null) as RegisteredMatchRow | null;

  const latestReportDate =
    national?.report_date ||
    states[0]?.report_date ||
    registeredSummary[0]?.report_date ||
    null;

  const coreConcentrationByDistrict = new Map<string, ConcentrationRow>();
  for (const row of concentrations) {
    if (!validDistrict(row.service_district_name)) continue;
    const key = `${row.state_code}:${districtLabel(row.service_district_name)}`;
    const current = coreConcentrationByDistrict.get(key);
    if (!current || (row.payment_share_top10_pct || 0) > (current.payment_share_top10_pct || 0)) {
      coreConcentrationByDistrict.set(key, row);
    }
  }

  const hotspots = districts
    .map((district) => {
      const concentration = coreConcentrationByDistrict.get(`${district.state_code}:${district.service_district_name}`);
      const squeezeScore =
        concentration?.payment_share_top10_pct != null
          ? Number(((concentration.payment_share_top10_pct * 100) / Math.max(district.provider_count, 1)).toFixed(2))
          : null;

      return {
        ...district,
        payment_share_top10_pct: concentration?.payment_share_top10_pct ?? null,
        payment_band: concentration?.payment_band ?? null,
        squeeze_score: squeezeScore,
      };
    })
    .filter((row) => row.payment_share_top10_pct != null)
    .sort((a, b) => (b.squeeze_score ?? 0) - (a.squeeze_score ?? 0))
    .slice(0, 12);

  const cleanDistricts = districts.filter((row) => validDistrict(row.service_district_name));
  const qldClean = qld.filter((row) => validDistrict(row.service_district_name));
  const sourceLink =
    concentrations.find((row) => row.source_file_url || row.source_page_url)?.source_file_url ||
    concentrations.find((row) => row.source_page_url)?.source_page_url ||
    null;
  const veryThinDistricts = cleanDistricts.filter((row) => row.provider_count < 50).length;
  const thinDistricts = cleanDistricts.filter((row) => row.provider_count < 100).length;
  const approvedRegistered = registeredSummary.find((row) => row.registration_status === 'Approved') || null;
  const revokedRegistered = registeredSummary.find((row) => row.registration_status === 'Revoked') || null;
  const bannedRegistered = registeredSummary.find((row) => row.registration_status === 'Banned') || null;

  return {
    latestReportDate,
    national,
    states,
    districts: cleanDistricts,
    hotspots,
    qld: qldClean,
    disabilitySocialEnterprises: disabilitySocialEnterprises || 0,
    disabilityCommunityOrgs: disabilityCommunityOrgs || 0,
    veryThinDistricts,
    thinDistricts,
    sourceLink,
    approvedRegistered,
    revokedRegistered,
    bannedRegistered,
    registeredStates,
    registeredMatch,
  };
}

export default async function NdisMarketPage() {
  const report = await getReport();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          NDIS Market Power and Service Coverage
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          The NDIS is one of the largest social service markets in the country, but most people still cannot see
          where provider supply is thin, where top providers dominate payments, and where disability-focused social
          enterprises or community organisations are barely visible in the money flow.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <Link href="/funding-workspace?theme=disability_ndis" className="px-3 py-2 border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
            Open funding workspace
          </Link>
          <Link href="/funding-workspace?lens=pressure&theme=disability_ndis" className="px-3 py-2 border-2 border-bauhaus-red text-bauhaus-red bg-bauhaus-red/5 hover:bg-bauhaus-red hover:text-white transition-colors">
            Search pressure points
          </Link>
          <Link href="/funding-workspace?lens=captured&theme=disability_ndis" className="px-3 py-2 border-2 border-bauhaus-red/20 text-bauhaus-red hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors">
            Search captured markets
          </Link>
          <Link href="/funding-workspace?lens=alternatives&theme=disability_ndis" className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light hover:bg-bauhaus-blue hover:text-white transition-colors">
            Back alternatives
          </Link>
          <Link href="/reports/youth-justice" className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            Compare with youth justice
          </Link>
          <Link href="/places" className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            Open place coverage
          </Link>
          {report.sourceLink && (
            <a
              href={report.sourceLink}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light hover:bg-bauhaus-blue hover:text-white transition-colors"
            >
              Source dataset
            </a>
          )}
        </div>
      </div>

      <section className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Active Providers</div>
            <div className="text-4xl font-black">{fmt(report.national?.provider_count || 0)}</div>
            <div className="text-white/60 text-xs font-bold mt-2">
              {report.latestReportDate ? new Date(report.latestReportDate).toLocaleDateString('en-AU') : 'Latest official dataset'}
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Very Thin Districts</div>
            <div className="text-4xl font-black text-bauhaus-red">{fmt(report.veryThinDistricts)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">districts with fewer than 50 providers</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Thin Districts</div>
            <div className="text-4xl font-black text-bauhaus-blue">{fmt(report.thinDistricts)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">districts with fewer than 100 providers</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Disability Delivery Graph</div>
            <div className="text-4xl font-black">{fmt(report.disabilitySocialEnterprises + report.disabilityCommunityOrgs)}</div>
            <div className="text-white/70 text-xs font-bold mt-2">
              {fmt(report.disabilitySocialEnterprises)} social enterprises + {fmt(report.disabilityCommunityOrgs)} community orgs
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Official Register</p>
            <h2 className="text-2xl font-black">Who is formally registered</h2>
            <p className="text-sm text-white/80 font-medium mt-2">
              This is the NDIS Commission provider register, not just the aggregate payment-market data.
            </p>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Approved providers</p>
              <p className="mt-2 text-4xl font-black text-bauhaus-black">{fmt(report.approvedRegistered?.provider_count || 0)}</p>
              <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                currently visible in the official register
              </p>
            </div>
            <div className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Graph matched by ABN</p>
              <p className="mt-2 text-4xl font-black text-bauhaus-red">{pct(report.registeredMatch?.matched_entity_pct)}</p>
              <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                {fmt(report.registeredMatch?.matched_entity_count || 0)} of {fmt(report.registeredMatch?.provider_count || 0)} approved providers already link to CivicGraph entities
              </p>
            </div>
            <div className="border-2 border-bauhaus-black p-4 bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Revoked</p>
              <p className="mt-2 text-3xl font-black text-bauhaus-black">{fmt(report.revokedRegistered?.provider_count || 0)}</p>
            </div>
            <div className="border-2 border-bauhaus-black p-4 bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Banned</p>
              <p className="mt-2 text-3xl font-black text-bauhaus-black">{fmt(report.bannedRegistered?.provider_count || 0)}</p>
            </div>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-canvas border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Registered Supply</p>
            <h2 className="text-2xl font-black text-bauhaus-black">Where approved providers are concentrated</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Approved providers</th>
                </tr>
              </thead>
              <tbody>
                {report.registeredStates.map((row, index) => (
                  <tr key={`${row.registration_status}-${row.state_code}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{row.state_code}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.provider_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-5 border-t-4 border-bauhaus-black bg-bauhaus-yellow/20">
            <p className="text-sm font-medium text-bauhaus-black/80">
              The register shows formal market presence. The payment-market layer above shows where those markets are still brittle or captured.
              The gap between the two is where surface-level “provider availability” hides real power concentration.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-yellow border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Power Read</p>
            <h2 className="text-2xl font-black text-bauhaus-black">Where service markets are easiest to capture</h2>
            <p className="text-sm text-bauhaus-black/70 font-medium mt-2 max-w-2xl">
              This view combines thin provider supply with Core support concentration. High squeeze scores mean
              relatively few providers and a very large payment share captured by the top 10 operators.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">District</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Top 10 Share</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Spend Band</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Squeeze</th>
                </tr>
              </thead>
              <tbody>
                {report.hotspots.map((row, index) => (
                  <tr key={`${row.state_code}-${row.service_district_name}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{row.service_district_name}</td>
                    <td className="p-3 font-mono text-bauhaus-muted">{row.state_code}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.provider_count)}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{pct(row.payment_share_top10_pct)}</td>
                    <td className="p-3 text-right font-mono text-bauhaus-muted">{row.payment_band || '—'}</td>
                    <td className="p-3 text-right font-mono font-black">{row.squeeze_score?.toFixed(0) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">What This Means</p>
            <ul className="space-y-3 text-sm font-medium text-bauhaus-black/80">
              <li>Barkly, East Arnhem, Katherine, Goldfields-Esperance, and Far West NSW are all markets where supply is thin and the top 10 providers take an outsized share of payments.</li>
              <li>This is exactly the kind of hidden power pattern that does not show up in ordinary service directories or philanthropy databases.</li>
              <li>For disability, youth justice, and community investment work, the point is not just to find providers. It is to see where markets are brittle, captured, or missing community-owned alternatives.</li>
            </ul>
          </div>

          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-3">Queensland Read</p>
            <p className="text-sm text-bauhaus-muted font-medium mb-4">
              Queensland has major metro supply in Brisbane, Ipswich, and Beenleigh, but regional districts like Mackay,
              Bundaberg, Maryborough, Cairns, and Rockhampton have far thinner provider bases and materially higher Core concentration.
            </p>
            <div className="space-y-2">
              {report.qld.map((row) => (
                <div key={row.service_district_name} className="flex items-center justify-between text-sm border-b border-bauhaus-black/10 pb-2">
                  <span className="font-bold text-bauhaus-black">{row.service_district_name}</span>
                  <span className="font-mono text-bauhaus-muted">{fmt(row.provider_count)} providers</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">National Supply</p>
            <h2 className="text-2xl font-black">Where the providers are</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                </tr>
              </thead>
              <tbody>
                {report.states.map((row, index) => (
                  <tr key={row.state_code} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{row.state_code}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.provider_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Thin Coverage</p>
            <h2 className="text-2xl font-black">Where supply drops away first</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">District</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                </tr>
              </thead>
              <tbody>
                {report.districts.slice(0, 12).map((row, index) => (
                  <tr key={`${row.state_code}-${row.service_district_name}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{row.service_district_name}</td>
                    <td className="p-3 font-mono text-bauhaus-muted">{row.state_code}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.provider_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-bauhaus-yellow/20 p-6">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Cross-System Next Move</p>
        <h2 className="text-2xl font-black text-bauhaus-black mb-3">This is not just an NDIS report</h2>
        <p className="text-sm text-bauhaus-black/80 font-medium max-w-4xl leading-relaxed">
          The point of adding this layer is to connect disability market power to the rest of CivicGraph:
          justice funding, philanthropy, community-controlled organisations, social enterprises, and place-based disadvantage.
          Once those layers are ranked together, users can search for where service markets are thin, who is dominating them,
          and which community-rooted organisations could be backed instead.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Link href="/funding-workspace" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Funding move</p>
            <h3 className="mt-2 text-lg font-black">Find who could fill the gap</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted">
              Jump into the funding workspace and line up disability funders, charities, and social enterprises against thin markets.
            </p>
          </Link>
          <Link href="/reports/youth-justice" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Systems comparison</p>
            <h3 className="mt-2 text-lg font-black">Compare disability and justice</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted">
              Use the youth justice layer to see where high social need and thin disability markets overlap.
            </p>
          </Link>
          <Link href="/social-enterprises" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-money">Delivery scan</p>
            <h3 className="mt-2 text-lg font-black">Search disability-capable delivery</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted">
              Pressure-test whether community-rooted or social-enterprise providers exist before accepting incumbent dominance as normal.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
