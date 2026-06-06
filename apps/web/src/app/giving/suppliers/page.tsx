import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { money } from '@/lib/services/report-service';
import { GivingHeader, GivingSubnav, MethodBand } from '../_components';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Find a Supplier — Giving Data Commons | CivicGraph',
  description:
    'Search Australia\'s social and Indigenous enterprise supply base — free, open, ranked by public delivery evidence, not membership.',
};

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

const SOURCE_LABELS: Record<string, string> = {
  'supply-nation': 'Supply Nation',
  'oric': 'ORIC',
  'social-traders': 'Social Traders',
  'buyability': 'BuyAbility',
  'acnc-classified': 'ACNC',
  'b-corp': 'B Corp',
  'kinaway': 'Kinaway',
};

function safeTerm(value: string) {
  return value.replace(/[,%()]/g, ' ').trim().slice(0, 120);
}

interface ResultRow {
  id: string;
  name: string;
  abn: string | null;
  state: string | null;
  city: string | null;
  sector: string[] | null;
  source_primary: string | null;
  description: string | null;
}

export default async function SupplierFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string }>;
}) {
  const params = await searchParams;
  const q = safeTerm(params.q ?? '');
  const state = STATES.includes((params.state ?? '').toUpperCase() as (typeof STATES)[number])
    ? (params.state ?? '').toUpperCase()
    : '';

  const supabase = getServiceSupabase();

  let results: ResultRow[] = [];
  let evidenceByAbn = new Map<string, { count: number; total_value: number }>();
  let total: number | null = null;

  if (q || state) {
    let query = supabase
      .from('social_enterprises')
      .select('id, name, abn, state, city, sector, source_primary, description', { count: 'exact' })
      .limit(30);
    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    if (state) query = query.eq('state', state);
    const { data, count } = await query;
    results = (data ?? []) as ResultRow[];
    total = count ?? results.length;

    const abns = results.map((r) => r.abn).filter(Boolean) as string[];
    if (abns.length > 0) {
      const { data: contracts } = await supabase
        .from('austender_contracts')
        .select('supplier_abn, contract_value')
        .in('supplier_abn', abns)
        .not('contract_value', 'is', null)
        .limit(1000);
      evidenceByAbn = new Map();
      for (const c of contracts ?? []) {
        const abn = c.supplier_abn as string;
        const ev = evidenceByAbn.get(abn) ?? { count: 0, total_value: 0 };
        ev.count++;
        ev.total_value += (c.contract_value as number) || 0;
        evidenceByAbn.set(abn, ev);
      }
      // Delivery evidence first, then alphabetical
      results = [...results].sort((a, b) => {
        const evA = a.abn ? evidenceByAbn.get(a.abn) : undefined;
        const evB = b.abn ? evidenceByAbn.get(b.abn) : undefined;
        return (evB?.total_value ?? 0) - (evA?.total_value ?? 0) || a.name.localeCompare(b.name);
      });
    }
  }

  return (
    <div className="max-w-6xl">
      <GivingHeader kicker="Buy for impact" title="Find a Supplier">
        Search Australia&apos;s social and Indigenous enterprise supply base. Free and open — no
        membership wall, no single badge. Results are ranked by public delivery evidence, because
        proof of delivery beats proof of membership.
      </GivingHeader>

      <GivingSubnav />

      {/* Search form — plain GET, no client JS */}
      <form method="get" className="border-4 border-bauhaus-black bg-white p-5 mb-10 flex flex-wrap gap-3 items-end">
        <label className="flex-1 min-w-[220px]">
          <span className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1.5">
            What do you need?
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="catering, cleaning, construction, design…"
            className="w-full border-2 border-bauhaus-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:bg-bauhaus-yellow/20"
          />
        </label>
        <label>
          <span className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1.5">
            State
          </span>
          <select
            name="state"
            defaultValue={state}
            className="border-2 border-bauhaus-black px-3 py-2.5 text-sm font-bold bg-white"
          >
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="px-6 py-2.5 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-bauhaus-black"
        >
          Search
        </button>
      </form>

      {(q || state) ? (
        <section className="mb-10">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">
            {total?.toLocaleString() ?? 0} enterprises{total && total > results.length ? ` (showing ${results.length})` : ''}
            {q && <> matching &ldquo;{q}&rdquo;</>}{state && <> in {state}</>}
          </div>
          {results.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
              <p className="text-sm font-medium text-bauhaus-black">
                No enterprises matched. Try a broader term, or browse the{' '}
                <Link href="/social-enterprises" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">full directory</Link>.
                Know an enterprise that should be here?{' '}
                <Link href="/giving/corrections" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Submit it as a correction</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-0 border-4 border-bauhaus-black">
              {results.map((r, i) => {
                const ev = r.abn ? evidenceByAbn.get(r.abn) : undefined;
                return (
                  <div key={r.id} className={`bg-white p-5 ${i < results.length - 1 ? 'border-b-4 border-bauhaus-black' : ''}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <Link href={`/social-enterprises/${r.id}`} className="text-lg font-black text-bauhaus-black hover:text-bauhaus-red">
                        {r.name}
                      </Link>
                      <div className="flex gap-1.5 flex-wrap">
                        {r.source_primary && (
                          <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">
                            {SOURCE_LABELS[r.source_primary] ?? r.source_primary}
                          </span>
                        )}
                        {ev && ev.count > 0 && (
                          <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-money bg-money-light text-money">
                            {ev.count} govt contract{ev.count === 1 ? '' : 's'} · {money(ev.total_value)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-bauhaus-muted font-medium mt-1">
                      {[r.city, r.state].filter(Boolean).join(', ')}
                      {r.sector && r.sector.length > 0 && <> · {r.sector.slice(0, 4).join(' · ')}</>}
                    </div>
                    {r.description && (
                      <p className="text-sm text-bauhaus-muted font-medium mt-2 line-clamp-2">{r.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <MethodBand>
          <h2 className="text-xl font-black uppercase tracking-tight text-bauhaus-black mb-3">
            How this works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 text-sm font-medium text-bauhaus-black">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1.5">1 · One registry</div>
              Federated from Supply Nation, ORIC, Social Traders, BuyAbility, ACNC and more —
              over 10,000 enterprises, no membership wall.
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1.5">2 · Evidence, not badges</div>
              Each profile joins to public contract and grant records by ABN. You see what an
              enterprise has actually delivered, and for whom.
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1.5">3 · Buy with meaning</div>
              Government buyer, business, or household — the same open data shows where your
              money builds community control, local jobs and country.
            </div>
          </div>
          <p className="text-xs text-bauhaus-muted font-medium mt-5">
            Certification marks belong to their issuing bodies — CivicGraph aggregates them and does
            not verify enterprises itself. Indigenous business registries (Supply Nation, ORIC) are
            included as part of the supply base; not every record is a certified social enterprise.{' '}
            <Link href="/giving/sources" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Read the sources</Link>.
          </p>
        </MethodBand>
      )}
    </div>
  );
}
