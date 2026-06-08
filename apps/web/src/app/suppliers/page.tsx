import type { Metadata } from 'next';
import Link from 'next/link';
import { searchSuppliers, type SupplierResult } from '@/lib/services/supplier-search';
import { money } from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Find a Supplier — CivicGraph',
  description:
    'Need-first search across Australia\'s social and Indigenous enterprise supply base. Free and open — ranked by what each enterprise has actually delivered, not by membership.',
};

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

const SOURCE_LABELS: Record<string, string> = {
  'supply-nation': 'Supply Nation',
  'oric': 'ORIC',
  'social-traders': 'Social Traders',
  'buyability': 'BuyAbility',
  'acnc-classified': 'ACNC',
  'b-corp': 'B Corp',
  'self-registered': 'Self-registered',
};

const TIER_STYLES: Record<string, string> = {
  certified: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
  verified: 'border-money bg-money-light text-money',
  identified: 'border-bauhaus-black/40 bg-bauhaus-canvas text-bauhaus-muted',
};

const TIER_TITLES: Record<string, string> = {
  certified: 'Carries an external certification mark (Social Traders, Supply Nation, BuyAbility, B Corp)',
  verified: 'On a statutory register (ACNC, ORIC) or state SE network, ABN matched',
  identified: 'Directory-identified — no external verification mark yet',
};

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  return (
    <span
      title={TIER_TITLES[tier]}
      className={`text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 ${TIER_STYLES[tier] ?? TIER_STYLES.identified}`}
    >
      {tier}
    </span>
  );
}

function TripleProofBadge() {
  return (
    <span
      title="Triple-proof — this supplier has justice/community delivery, a won federal contract, AND ACNC charity governance. The deepest delivery evidence in the registry."
      className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-black text-bauhaus-yellow"
    >
      Triple-proof
    </span>
  );
}

function EvidenceLine({ r }: { r: SupplierResult }) {
  if (r.contract_count === 0) return null;
  const lastYear = r.last_contract_end ? new Date(r.last_contract_end).getFullYear() : null;
  return (
    <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-money bg-money-light text-money">
      {r.contract_count.toLocaleString()} govt contract{r.contract_count === 1 ? '' : 's'} · {money(r.contract_value)}
      {r.buyer_count > 1 ? ` · ${r.buyer_count} buyers` : ''}
      {lastYear ? ` · to ${lastYear}` : ''}
    </span>
  );
}

function safeTerm(value: string) {
  return value.replace(/[,%()]/g, ' ').trim().slice(0, 120);
}

export default async function SupplierSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string }>;
}) {
  const params = await searchParams;
  const q = safeTerm(params.q ?? '');
  const state = STATES.includes((params.state ?? '').toUpperCase() as (typeof STATES)[number])
    ? (params.state ?? '').toUpperCase()
    : '';
  const searched = Boolean(q || state);
  const results = searched ? await searchSuppliers(q, state) : [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Hero */}
      <header className="mb-8">
        <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red mb-2">
          The open supply base
        </div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-bauhaus-black leading-none mb-3">
          What do you need?
        </h1>
        <p className="text-sm font-medium text-bauhaus-muted max-w-2xl">
          Search 11,800+ social and Indigenous enterprises by what you need to buy. Free and open —
          ranked by <strong className="text-bauhaus-black">what each enterprise has actually delivered</strong>{' '}
          (public contract records), not by membership or a single badge.
        </p>
      </header>

      {/* Search form — plain GET, no client JS */}
      <form method="get" className="border-4 border-bauhaus-black bg-white p-5 mb-10 flex flex-wrap gap-3 items-end shadow-[6px_6px_0_#121212]">
        <label className="flex-1 min-w-[240px]">
          <span className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1.5">
            I need…
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="beds, catering, landscaping, IT support, recruitment…"
            className="w-full border-2 border-bauhaus-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:bg-bauhaus-yellow/20"
          />
        </label>
        <label>
          <span className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1.5">
            State
          </span>
          <select name="state" defaultValue={state} className="border-2 border-bauhaus-black px-3 py-2.5 text-sm font-bold bg-white">
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

      {searched ? (
        <section className="mb-10">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">
            {results.length === 30 ? 'Top 30' : results.length.toLocaleString()} result{results.length === 1 ? '' : 's'}
            {q && <> for &ldquo;{q}&rdquo;</>}{state && <> in {state}</>}
            {' '}· ranked by delivery evidence
          </div>

          {results.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
              <p className="text-sm font-medium text-bauhaus-black">
                Nothing matched. Try a broader need (&ldquo;furniture&rdquo; instead of &ldquo;standing desks&rdquo;), or browse the{' '}
                <Link href="/social-enterprises" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">full directory</Link>.
                Run an enterprise that should be here?{' '}
                <Link href="/giving/corrections" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Add it</Link>.
              </p>
            </div>
          ) : (
            <div className="border-4 border-bauhaus-black">
              {results.map((r, i) => (
                <div key={r.se_id} className={`bg-white p-5 ${i < results.length - 1 ? 'border-b-4 border-bauhaus-black' : ''}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                    <Link href={`/social-enterprises/${r.se_id}`} className="text-lg font-black text-bauhaus-black hover:text-bauhaus-red">
                      {r.name}
                    </Link>
                    <div className="flex gap-1.5 flex-wrap">
                      {r.triple_proof && <TripleProofBadge />}
                      <TierBadge tier={r.verification_tier} />
                      {r.source_primary && (
                        <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-bauhaus-black/40 text-bauhaus-muted">
                          {SOURCE_LABELS[r.source_primary] ?? r.source_primary}
                        </span>
                      )}
                      <EvidenceLine r={r} />
                    </div>
                  </div>
                  <div className="text-xs text-bauhaus-muted font-medium mt-1">
                    {[r.city, r.state].filter(Boolean).join(', ')}
                    {r.sectors && r.sectors.length > 0 && <> · {r.sectors.slice(0, 4).join(' · ')}</>}
                  </div>
                  {r.description && (
                    <p className="text-sm text-bauhaus-muted font-medium mt-2 line-clamp-2">{r.description}</p>
                  )}
                  {r.verification_tier === 'identified' && (
                    <p className="text-[11px] font-bold text-bauhaus-muted mt-2">
                      Run this enterprise?{' '}
                      <Link href="/giving/corrections" className="text-bauhaus-blue hover:text-bauhaus-red">
                        Claim and complete this profile
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Buyer CTA */}
          <div className="mt-6 border-4 border-bauhaus-black bg-bauhaus-black text-white p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">
                Government or corporate buyer?
              </div>
              <p className="text-sm font-medium text-white/80 max-w-xl">
                Turn this shortlist into a tender pack — supplier evidence, policy citations and
                weighting support for your procurement.
              </p>
            </div>
            <Link
              href="/procurement/tender-pack"
              className="px-6 py-2.5 bg-bauhaus-yellow text-bauhaus-black text-xs font-black uppercase tracking-widest border-2 border-white hover:bg-white"
            >
              Build a tender pack
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid sm:grid-cols-3 gap-0 border-4 border-bauhaus-black mb-10">
          <div className="bg-white p-6 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1.5">1 · Search by need</div>
            <p className="text-sm font-medium text-bauhaus-black">
              &ldquo;Beds&rdquo;, &ldquo;catering&rdquo;, &ldquo;civil works&rdquo; — matched against
              names, sectors AND what government actually bought from each enterprise.
            </p>
          </div>
          <div className="bg-white p-6 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1.5">2 · Ranked by evidence</div>
            <p className="text-sm font-medium text-bauhaus-black">
              Public contract history beats badges. Verification marks (Social Traders, Supply
              Nation, ACNC, ORIC) appear as signals — never as gates.
            </p>
          </div>
          <div className="bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1.5">3 · Free and open</div>
            <p className="text-sm font-medium text-bauhaus-black">
              11,800+ enterprises, no membership wall. Indigenous business registries are part of
              the supply base; not every record is a certified social enterprise.
            </p>
          </div>
        </section>
      )}

      <p className="text-xs text-bauhaus-muted font-medium">
        Certification marks belong to their issuing bodies — CivicGraph aggregates them with
        attribution and does not verify enterprises itself.{' '}
        <Link href="/giving/sources" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Sources and method</Link>.
      </p>
    </div>
  );
}
