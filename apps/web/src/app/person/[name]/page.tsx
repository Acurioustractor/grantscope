import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc } from '@/lib/sql';
import { money } from '@/lib/format';
import { entityHref } from '@/lib/entity-href';
import { Section, StatRow, Stat, DataTable, Callout, SourceLine } from '@/components/data';

export const revalidate = 3600;

// One disambiguated identity under a (possibly shared) name — from mv_person_identity_influence_v2.
// The dollar fields are the ATTRIBUTED columns: each organisation's money split evenly across its
// directors. v1 gave every director the organisation's whole total, so eight co-directors each
// "held" the same 7.57bn. Neither version is money the person received; the labels say so.
interface Identity {
  identity_key: string;
  person_name: string;
  board_count: number;
  acco_boards: number;
  entity_types: string[];
  total_procurement: number;
  total_contracts: number;
  total_justice: number;
  total_donations: number;
  influence_score: number;
  financial_system_count: number;
  is_nominee_block: boolean;
}

// An entity belonging to one identity — from mv_person_identity_network. Used to
// make the picker cards distinguishable (same name, different orgs).
interface IdentityEntity {
  identity_key: string;
  entity_name: string;
  entity_type: string;
  is_community_controlled: boolean;
  justice_dollars: number;
  procurement_dollars: number;
  donation_dollars: number;
}

interface Position {
  person_name_display: string;
  entity_name: string;
  entity_abn: string | null;
  entity_type: string;
  is_community_controlled: boolean;
  role_type: string;
  source: string;
  appointment_date: string | null;
  board_count: number;
  procurement_dollars: number;
  contract_count: number;
  justice_dollars: number;
  justice_count: number;
  donation_dollars: number;
  donation_count: number;
  influence_score: number;
  gs_id: string;
}

const entMoney = (e: IdentityEntity) =>
  Number(e.justice_dollars || 0) + Number(e.procurement_dollars || 0) + Number(e.donation_dollars || 0);

const CHIP = 'inline-block border-2 px-2 py-0.5 text-[11px] font-black uppercase tracking-widest';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name).replace(/-/g, ' ');
  return {
    title: `${decoded} — CivicGraph Person Profile`,
  };
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { name } = await params;
  const { id } = await searchParams;
  const decoded = decodeURIComponent(name);
  const normalised = decoded.replace(/-/g, ' ').toUpperCase();
  const displayName = decoded.replace(/-/g, ' ');

  const supabase = getServiceSupabase();

  // All disambiguated identities sharing this name. Real identities first, nominee
  // blocks last, then by cross-system breadth + influence.
  const identities = (await safe(supabase.rpc('exec_sql', {
    query: `SELECT identity_key, person_name, board_count, acco_boards, entity_types,
              attributed_procurement AS total_procurement, total_contracts,
              attributed_justice AS total_justice, attributed_donations AS total_donations,
              influence_score_attributed AS influence_score, financial_system_count, is_nominee_block
       FROM mv_person_identity_influence_v2
       WHERE person_name_normalised = '${esc(normalised)}'
       ORDER BY is_nominee_block ASC, financial_system_count DESC NULLS LAST, influence_score DESC NULLS LAST`,
  }))) as Identity[] | null;

  const ids = identities ?? [];
  if (ids.length === 0) notFound();

  // Selected identity: explicit ?id, else the only one, else null → show picker.
  const selected = id ? ids.find((i) => i.identity_key === id) : ids.length === 1 ? ids[0] : null;

  // ---- PICKER: a shared name resolving to multiple identities ----
  if (!selected) {
    const entities = (await safe(supabase.rpc('exec_sql', {
      query: `SELECT identity_key, entity_name, entity_type, is_community_controlled,
                justice_dollars, procurement_dollars, donation_dollars
         FROM mv_person_identity_network
         WHERE person_name_normalised = '${esc(normalised)}'`,
    }))) as IdentityEntity[] | null;

    const entByIdentity = new Map<string, IdentityEntity[]>();
    for (const e of entities ?? []) {
      if (!entByIdentity.has(e.identity_key)) entByIdentity.set(e.identity_key, []);
      entByIdentity.get(e.identity_key)!.push(e);
    }

    return (
      <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            {ids.length} people share this name
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-bauhaus-black">{displayName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-bauhaus-muted">
            Board records under this name split into {ids.length} separate people, grouped by who they sit on
            boards with. Trustee and nominee blocks (one firm&apos;s officers listed across many charities it
            administers) are marked and kept out of individual rankings. Choose a person to see their profile.
          </p>

          <div className="mt-6 space-y-3">
            {ids.map((iden) => {
              const ents = (entByIdentity.get(iden.identity_key) ?? []).sort((a, b) => entMoney(b) - entMoney(a));
              const topOrgs = ents.slice(0, 3);
              const totalMoney =
                Number(iden.total_procurement || 0) + Number(iden.total_justice || 0) + Number(iden.total_donations || 0);
              return (
                <Link
                  key={iden.identity_key}
                  href={`/person/${encodeURIComponent(name)}?id=${encodeURIComponent(iden.identity_key)}`}
                  className={`block border-4 p-4 transition-colors ${
                    iden.is_nominee_block
                      ? 'border-bauhaus-muted bg-bauhaus-canvas hover:bg-white'
                      : 'border-bauhaus-black bg-white hover:bg-link-light'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-bauhaus-black">{displayName}</span>
                        {iden.is_nominee_block ? (
                          <span className={`${CHIP} border-bauhaus-muted text-bauhaus-muted`}>Trustee or nominee block</span>
                        ) : iden.financial_system_count > 0 ? (
                          <span className={`${CHIP} border-bauhaus-black text-bauhaus-black`}>
                            {iden.financial_system_count} of 3 money systems
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-bauhaus-muted">
                        {topOrgs.map((o) => o.entity_name).join(' · ') || 'No linked organisations'}
                        {ents.length > 3 && <span> +{ents.length - 3} more</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-lg font-black leading-none tabular-nums">{iden.board_count}</p>
                      <p className="mt-0.5 text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">boards</p>
                      {totalMoney > 0 && (
                        <p className="mt-1 font-mono text-xs tabular-nums text-money">{money(totalMoney)} their share</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // ---- PROFILE: a single chosen identity ----
  const positions = (await safe(supabase.rpc('exec_sql', {
    query: `SELECT pen.person_name_display, pen.entity_name, pen.entity_abn, pen.entity_type,
              pen.is_community_controlled, pen.role_type, pen.source,
              pen.appointment_date, pen.board_count,
              pen.procurement_dollars, pen.contract_count,
              pen.justice_dollars, pen.justice_count,
              pen.donation_dollars, pen.donation_count,
              pen.influence_score, ge.gs_id
       FROM mv_person_identity_network pin
       JOIN mv_person_entity_network pen
         ON pen.person_name_normalised = pin.person_name_normalised AND pen.entity_id = pin.entity_id
       JOIN gs_entities ge ON ge.id = pin.entity_id
       WHERE pin.identity_key = '${esc(selected.identity_key)}'
       ORDER BY pen.influence_score DESC NULLS LAST`,
  }))) as Position[] | null;

  const positionList = (positions as Position[] | null) ?? [];
  const totalFinancial =
    Number(selected.total_procurement) + Number(selected.total_justice) + Number(selected.total_donations);
  const communityControlled = positionList.filter((p) => p.is_community_controlled);
  const entityTypes = new Set((selected.entity_types ?? []).filter(Boolean));
  const dataSources = [...new Set(positionList.map((p) => p.source).filter(Boolean))];

  // Headline figures. The money ones are "their share": each board's money divided evenly among
  // its directors (v2 attributed columns), never money this person received.
  const stats = [
    <Stat
      key="influence"
      label="Influence score"
      value={Number(selected.influence_score).toFixed(0)}
      sub={`in ${selected.financial_system_count} of 3 money systems: contracts, justice funding, donations`}
    />,
    <Stat
      key="boards"
      label="Board seats"
      value={selected.board_count}
      sub={selected.acco_boards > 0 ? `${selected.acco_boards} community-controlled` : undefined}
    />,
  ];
  if (Number(selected.total_procurement) > 0) {
    stats.push(
      <Stat
        key="contracts"
        label="Contracts, their share"
        value={money(Number(selected.total_procurement))}
        tone="money"
        sub={`${Number(selected.total_contracts).toLocaleString()} ${Number(selected.total_contracts) === 1 ? 'contract' : 'contracts'} across their boards`}
      />,
    );
  }
  if (Number(selected.total_justice) > 0) {
    stats.push(
      <Stat key="justice" label="Justice funding, their share" value={money(Number(selected.total_justice))} tone="money" />,
    );
  }
  if (Number(selected.total_donations) > 0) {
    stats.push(
      <Stat key="donations" label="Donations, their share" value={money(Number(selected.total_donations))} tone="red" />,
    );
  }
  const cols = Math.min(5, Math.max(2, stats.length)) as 2 | 3 | 4 | 5;

  const orgMoney = (n: number, tone?: 'red') =>
    Number(n) > 0 ? <span className={tone === 'red' ? 'text-bauhaus-red' : undefined}>{money(Number(n))}</span> : '—';

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/search" className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black">
            &larr; Search
          </Link>
          {ids.length > 1 && (
            <Link href={`/person/${encodeURIComponent(name)}`} className="text-xs font-bold text-bauhaus-blue hover:underline">
              1 of {ids.length} people named &ldquo;{displayName}&rdquo;: see all
            </Link>
          )}
        </div>

        <div className="mt-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{selected.person_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`${CHIP} border-bauhaus-black text-bauhaus-black`}>Person</span>
            {[...entityTypes].map((t) => (
              <span key={t} className={`${CHIP} border-bauhaus-black/30 text-bauhaus-muted`}>{t}</span>
            ))}
          </div>
        </div>

        {selected.is_nominee_block && (
          <div className="mb-6">
            <Callout tone="caution" title="Trustee or nominee block, not one person">
              These {selected.board_count} board seats belong to a trustee firm&apos;s officers, listed as responsible
              persons across many charities it administers. They are kept out of individual influence rankings.
            </Callout>
          </div>
        )}

        <StatRow cols={cols}>{stats}</StatRow>
        {totalFinancial > 0 && (
          <p className="mt-2 mb-6 text-xs text-bauhaus-muted">
            &ldquo;Their share&rdquo; is each organisation&rsquo;s public money divided evenly among its
            directors. It shows the scale of what their boards control, not money this person received.
          </p>
        )}

        {!selected.is_nominee_block && selected.board_count > 3 && (
          <div className="mt-6 mb-8">
            <Callout tone="alert" title={`Board interlock: ${selected.board_count} seats`}>
              Holds positions across {selected.board_count} organisations
              {communityControlled.length > 0 && `, including ${communityControlled.length} community-controlled`}.
              {totalFinancial > 0 && ` Their even share of those organisations' public money: ${money(totalFinancial)}.`}
            </Callout>
          </div>
        )}

        {positionList.length > 0 && (
          <div className="mt-8">
            <Section title={`Board positions (${positionList.length})`}>
              <DataTable
                caption="Board positions"
                rows={positionList}
                rowKey={(p, i) => `${p.gs_id}-${i}`}
                columns={[
                  {
                    key: 'org',
                    label: 'Organisation',
                    cell: (p) => (
                      <>
                        <Link
                          href={entityHref({ gsId: p.gs_id, abn: p.entity_abn, name: p.entity_name })}
                          className="font-bold text-bauhaus-blue hover:underline"
                        >
                          {p.entity_name}
                        </Link>
                        {p.is_community_controlled && (
                          <span className={`${CHIP} ml-2 border-bauhaus-red text-bauhaus-red`} title="Community-controlled">CC</span>
                        )}
                      </>
                    ),
                  },
                  { key: 'type', label: 'Type', cell: (p) => <span className="text-xs uppercase tracking-wider text-bauhaus-muted">{p.entity_type}</span> },
                  { key: 'role', label: 'Role', cell: (p) => <span className="text-xs text-bauhaus-muted">{(p.role_type ?? '').replace(/_/g, ' ')}</span> },
                  { key: 'contracts', label: 'Org contracts', align: 'right', cell: (p) => orgMoney(p.procurement_dollars) },
                  { key: 'justice', label: 'Org justice funding', align: 'right', cell: (p) => orgMoney(p.justice_dollars) },
                  { key: 'donations', label: 'Org donations', align: 'right', cell: (p) => orgMoney(p.donation_dollars, 'red') },
                  { key: 'influence', label: 'Influence', align: 'right', cell: (p) => <span className="font-bold">{Number(p.influence_score).toFixed(0)}</span> },
                ]}
              />
              <p className="mt-2 text-xs text-bauhaus-muted">
                The money columns are each organisation&rsquo;s own totals, not this person&rsquo;s.
              </p>
            </Section>
          </div>
        )}

        <footer className="mt-8 border-t-4 border-bauhaus-black pt-4 pb-8">
          <SourceLine
            sources={[
              ...dataSources,
              'mv_person_identity_influence_v2',
              'mv_person_identity_network',
              'mv_person_entity_network',
            ]}
          />
          <p className="mt-3 flex flex-wrap gap-4 text-xs font-bold">
            <Link href="/person" className="text-bauhaus-blue hover:underline">All people</Link>
            <Link href="/search" className="text-bauhaus-blue hover:underline">Search</Link>
            <Link href="/entity/top" className="text-bauhaus-blue hover:underline">Power index</Link>
            <Link href="/graph" className="text-bauhaus-blue hover:underline">Graph</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
