import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { GrantActions } from '@/app/components/grant-actions';

export const dynamic = 'force-dynamic';

interface Grant {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  description: string | null;
  categories: string[];
  status: string;
  sources: unknown;
  discovery_method: string | null;
  last_verified_at: string | null;
  created_at: string;
  embedding: unknown;
}

interface SimilarGrant {
  id: string;
  name: string;
  provider: string;
  amount_max: number | null;
  closes_at: string | null;
  similarity: number;
}

interface RelatedFoundation {
  id: string;
  name: string;
  total_giving_annual: number | null;
  type: string | null;
  thematic_focus: string[];
}

function formatAmount(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return 'Not specified';
}

function formatDate(date: string | null): string {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMoney(n: number | null): string {
  if (!n) return 'Unknown';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default async function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: grant } = await supabase
    .from('grant_opportunities')
    .select('*')
    .eq('id', id)
    .single();

  if (!grant) notFound();
  const g = grant as Grant;

  // Fetch similar grants via embedding similarity
  let similarGrants: SimilarGrant[] = [];
  if (g.embedding) {
    try {
      const { data: similar } = await supabase.rpc('search_grants_semantic', {
        query_embedding: JSON.stringify(g.embedding),
        match_threshold: 0.75,
        match_count: 6,
      });
      if (similar) {
        similarGrants = (similar as SimilarGrant[]).filter(s => s.id !== g.id).slice(0, 5);
      }
    } catch {
      // Embedding search not available
    }
  }

  // Fetch foundations with overlapping thematic focus
  let relatedFoundations: RelatedFoundation[] = [];
  if (g.categories?.length > 0) {
    const { data: foundations } = await supabase
      .from('foundations')
      .select('id, name, total_giving_annual, type, thematic_focus')
      .not('enriched_at', 'is', null)
      .overlaps('thematic_focus', g.categories)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(5);
    relatedFoundations = (foundations || []) as RelatedFoundation[];
  }

  return (
    <div className="max-w-3xl">
      <a href="/grants" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Grants
      </a>

      <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-4 mb-2">{g.name}</h1>
      <div className="text-base text-bauhaus-muted font-medium mb-2">{g.provider}</div>
      <GrantActions grantId={g.id} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Amount</div>
          <div className="text-lg font-black text-bauhaus-blue tabular-nums">{formatAmount(g.amount_min, g.amount_max)}</div>
        </div>
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Closes</div>
          <div className={`text-lg font-black ${g.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>{formatDate(g.closes_at)}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Status</div>
          <div className="text-lg font-black text-money">{g.status || 'Open'}</div>
        </div>
      </div>

      {g.description && (
        <section className="mb-6">
          <h2 className="text-sm font-black text-bauhaus-black mb-2 pb-1.5 border-b-4 border-bauhaus-black uppercase tracking-widest">Description</h2>
          <p className="text-bauhaus-muted leading-relaxed font-medium">{g.description}</p>
        </section>
      )}

      {g.categories?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-black text-bauhaus-black mb-2 pb-1.5 border-b-4 border-bauhaus-black uppercase tracking-widest">Categories</h2>
          <div className="flex gap-2 flex-wrap">
            {g.categories.map(c => (
              <span key={c} className="text-sm px-3 py-1 bg-bauhaus-blue text-white font-black uppercase tracking-wider">{c}</span>
            ))}
          </div>
        </section>
      )}

      {g.url && (
        <a
          href={g.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-bauhaus-red text-white font-black uppercase tracking-widest hover:bg-bauhaus-black bauhaus-shadow-sm border-4 border-bauhaus-black"
        >
          Apply Now &rarr;
        </a>
      )}

      {/* Similar Grants */}
      {similarGrants.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">Similar Grants</h2>
          <div className="space-y-0">
            {similarGrants.map(sg => (
              <a key={sg.id} href={`/grants/${sg.id}`} className="block group">
                <div className="bg-white border-4 border-b-0 last:border-b-4 border-bauhaus-black p-3 transition-all group-hover:bg-bauhaus-blue group-hover:text-white">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-bauhaus-black group-hover:text-white truncate">{sg.name}</div>
                      <div className="text-xs text-bauhaus-muted group-hover:text-white/70">{sg.provider}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {sg.amount_max && <div className="text-xs font-black text-bauhaus-blue tabular-nums group-hover:text-bauhaus-yellow">{formatMoney(sg.amount_max)}</div>}
                      <div className="flex items-center gap-1 mt-0.5 justify-end">
                        <div className="w-10 h-1 bg-bauhaus-canvas border border-bauhaus-black/20 group-hover:border-white/30">
                          <div className="h-full bg-bauhaus-blue group-hover:bg-bauhaus-yellow" style={{ width: `${Math.round(sg.similarity * 100)}%` }}></div>
                        </div>
                        <span className="text-[9px] font-black text-bauhaus-muted group-hover:text-white/50 tabular-nums">{Math.round(sg.similarity * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Related Foundations */}
      {relatedFoundations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">Foundations Supporting This Area</h2>
          <div className="space-y-2">
            {relatedFoundations.map(f => (
              <a key={f.id} href={`/foundations/${f.id}`} className="block group">
                <div className="bg-white border-4 border-bauhaus-black p-3 transition-all group-hover:-translate-y-0.5 bauhaus-shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-bauhaus-black group-hover:text-bauhaus-red">{f.name}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {f.thematic_focus?.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-money-light text-money font-bold border border-money/20">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm font-black text-money tabular-nums flex-shrink-0">{formatMoney(f.total_giving_annual)}/yr</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black text-xs text-bauhaus-muted space-y-1 font-medium">
        <div>Discovery method: {g.discovery_method || 'Unknown'}</div>
        {g.last_verified_at && <div>Last verified: {formatDate(g.last_verified_at)}</div>}
        <div>Added: {formatDate(g.created_at)}</div>
      </div>
    </div>
  );
}
