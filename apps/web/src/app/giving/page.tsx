import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { COMMONS_INSIGHTS, PUBLIC_DATASET_KEYS, PUBLIC_DATASETS, PUBLIC_SNAPSHOT_DATE } from '@/lib/giving-commons';
import { DownloadLinks, GivingHeader, GivingSubnav, InsightCard, MethodBand } from './_components';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Australian Giving Data Commons | CivicGraph',
  description: 'Free public search, downloads, API, source metadata, quality dashboard and correction flow for Australian giving data.',
};

type SearchResult = {
  type: string;
  label: string;
  href: string;
  detail: string;
  source: string;
};

function money(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('en-AU')}K`;
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

function safeQ(value: string) {
  return value.replace(/[,%]/g, ' ').trim().slice(0, 120);
}

async function searchCommons(rawQuery: string): Promise<SearchResult[]> {
  const q = safeQ(rawQuery);
  if (q.length < 2) return [];

  const db = getServiceSupabase();
  const [
    grants,
    foundations,
    programs,
    entities,
    relationships,
    places,
    reports,
  ] = await Promise.all([
    db.from('grant_opportunities')
      .select('id, name, provider, amount_max, closes_at, url')
      .or(`name.ilike.%${q}%,provider.ilike.%${q}%,program.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('foundations')
      .select('id, name, type, total_giving_annual, website')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(5),
    db.from('foundation_programs')
      .select('id, name, foundation_id, status, deadline, url')
      .ilike('name', `%${q}%`)
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(5),
    db.from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, state, abn')
      .ilike('canonical_name', `%${q}%`)
      .order('canonical_name', { ascending: true })
      .limit(5),
    db.from('gs_relationships')
      .select('id, relationship_type, amount, year, dataset, source_url')
      .or(`relationship_type.ilike.%${q}%,dataset.ilike.%${q}%`)
      .order('amount', { ascending: false, nullsFirst: false })
      .limit(5),
    /^\d{4}$/.test(q)
      ? db.from('mv_funding_by_postcode')
        .select('postcode, state, locality, total_funding, entity_count')
        .eq('postcode', q)
        .limit(5)
      : db.from('mv_funding_by_postcode')
        .select('postcode, state, locality, total_funding, entity_count')
        .ilike('locality', `%${q}%`)
        .order('total_funding', { ascending: false, nullsFirst: false })
        .limit(5),
    db.from('reports')
      .select('slug, title, description, domain')
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const row of grants.data ?? []) {
    results.push({
      type: 'Grant',
      label: String(row.name),
      href: row.url || '/grants',
      detail: [row.provider, money(row.amount_max), row.closes_at ? `closes ${row.closes_at}` : null].filter(Boolean).join(' | '),
      source: 'grant_opportunities',
    });
  }

  for (const row of foundations.data ?? []) {
    results.push({
      type: 'Foundation',
      label: String(row.name),
      href: `/foundations/${row.id}`,
      detail: [row.type, money(row.total_giving_annual)].filter(Boolean).join(' | '),
      source: 'foundations',
    });
  }

  for (const row of programs.data ?? []) {
    results.push({
      type: 'Program',
      label: String(row.name),
      href: row.url || `/foundations/${row.foundation_id}`,
      detail: [row.status, row.deadline ? `deadline ${row.deadline}` : null].filter(Boolean).join(' | '),
      source: 'foundation_programs',
    });
  }

  for (const row of entities.data ?? []) {
    results.push({
      type: 'Entity',
      label: String(row.canonical_name),
      href: `/entity/${row.gs_id || row.id}`,
      detail: [row.entity_type, row.state, row.abn ? `ABN ${row.abn}` : null].filter(Boolean).join(' | '),
      source: 'gs_entities',
    });
  }

  for (const row of relationships.data ?? []) {
    results.push({
      type: 'Relationship',
      label: `${row.relationship_type} ${row.year || ''}`.trim(),
      href: row.source_url || '/graph',
      detail: [row.dataset, money(row.amount)].filter(Boolean).join(' | '),
      source: 'gs_relationships',
    });
  }

  for (const row of places.data ?? []) {
    results.push({
      type: 'Place',
      label: [row.locality, row.postcode, row.state].filter(Boolean).join(' '),
      href: `/places/${row.postcode}`,
      detail: [`${Number(row.entity_count || 0).toLocaleString('en-AU')} entities`, money(row.total_funding)].filter(Boolean).join(' | '),
      source: 'mv_funding_by_postcode',
    });
  }

  for (const row of reports.data ?? []) {
    results.push({
      type: 'Report',
      label: String(row.title),
      href: `/reports/${row.slug}`,
      detail: String(row.description || row.domain || ''),
      source: 'reports',
    });
  }

  return results;
}

export default async function GivingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q || '';
  const results = await searchCommons(q);

  return (
    <div>
      <GivingHeader kicker="Australian Giving Data Commons" title="Free public giving data, not a brochure.">
        Search the graph, download the rows, inspect the source and challenge the record. Snapshot date: <span className="font-mono text-bauhaus-black">{PUBLIC_SNAPSHOT_DATE}</span>.
      </GivingHeader>
      <GivingSubnav />

      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white p-6 sm:p-8 mb-10">
        <form action="/giving" className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
          <div>
            <label htmlFor="giving-search" className="block text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">
              Search foundations, grants, entities, places, relationships and reports
            </label>
            <input
              id="giving-search"
              name="q"
              defaultValue={q}
              placeholder="Try Snow Foundation, youth justice, 4000, contract, donation"
              className="w-full border-4 border-white bg-white px-4 py-3 text-lg font-black text-bauhaus-black placeholder:text-bauhaus-muted focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow"
            />
          </div>
          <button className="border-4 border-bauhaus-yellow bg-bauhaus-yellow px-6 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-black hover:bg-white">
            Search
          </button>
        </form>
      </section>

      {q && (
        <section className="mb-12">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Search results</div>
              <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">{results.length} public matches</h2>
            </div>
            <Link href="/giving/downloads" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
              Download datasets
            </Link>
          </div>
          <div className="border-4 border-bauhaus-black bg-white divide-y-4 divide-bauhaus-black/10">
            {results.length ? results.map((result, index) => (
              <a key={`${result.source}-${index}`} href={result.href} className="block p-4 hover:bg-bauhaus-canvas">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-1 border-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                    {result.type}
                  </span>
                  <span className="text-[10px] font-mono text-bauhaus-muted">{result.source}</span>
                </div>
                <div className="text-lg font-black text-bauhaus-black">{result.label}</div>
                {result.detail && <div className="text-sm font-medium text-bauhaus-muted mt-1">{result.detail}</div>}
              </a>
            )) : (
              <div className="p-6 text-sm font-medium text-bauhaus-muted">
                No public matches yet. Try a broader term or use the API and downloads.
              </div>
            )}
          </div>
        </section>
      )}

      <MethodBand>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ['Search', 'Query practical records across the giving graph.'],
            ['Download', 'Pull CSV or JSON without logging in.'],
            ['Inspect', 'Read source, licence, caveat and quality metadata.'],
            ['Challenge', 'Submit corrections or right-of-reply against any claim.'],
          ].map(([title, body]) => (
            <div key={title} className="border-4 border-bauhaus-black bg-white p-4">
              <div className="text-xl font-black text-bauhaus-black uppercase tracking-tight">{title}</div>
              <p className="text-sm font-medium text-bauhaus-muted leading-relaxed mt-2">{body}</p>
            </div>
          ))}
        </div>
      </MethodBand>

      <section className="mb-12">
        <div className="mb-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Investigative insight cards</div>
          <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">What the public graph can show</h2>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {COMMONS_INSIGHTS.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Public datasets</div>
          <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">Allowed exports only</h2>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {PUBLIC_DATASET_KEYS.map((key) => {
            const dataset = PUBLIC_DATASETS[key];
            return (
              <article key={key} className="border-4 border-bauhaus-black bg-white p-5 flex flex-col">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">{dataset.domain}</div>
                <h3 className="text-xl font-black text-bauhaus-black uppercase tracking-tight">{dataset.label}</h3>
                <p className="text-sm font-medium text-bauhaus-muted leading-relaxed mt-2 flex-1">{dataset.description}</p>
                <div className="mt-4">
                  <DownloadLinks type={key} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
