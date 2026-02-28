import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

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

  return (
    <div className="max-w-3xl">
      <a href="/grants" className="text-sm text-navy-500 hover:text-navy-900 transition-colors">
        &larr; Back to grants
      </a>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-4 mb-2">{g.name}</h1>
      <div className="text-base text-navy-500 mb-6">{g.provider}</div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-white border border-navy-200 rounded-lg p-4">
          <div className="text-xs text-navy-400 mb-1">Amount</div>
          <div className="text-lg font-bold text-link tabular-nums">{formatAmount(g.amount_min, g.amount_max)}</div>
        </div>
        <div className="bg-white border border-navy-200 rounded-lg p-4">
          <div className="text-xs text-navy-400 mb-1">Closes</div>
          <div className={`text-lg font-bold ${g.closes_at ? 'text-warning' : 'text-navy-500'}`}>{formatDate(g.closes_at)}</div>
        </div>
        <div className="bg-white border border-navy-200 rounded-lg p-4">
          <div className="text-xs text-navy-400 mb-1">Status</div>
          <div className="text-lg font-bold text-money">{g.status || 'Open'}</div>
        </div>
      </div>

      {g.description && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-2 pb-1.5 border-b border-navy-100">Description</h2>
          <p className="text-navy-600 leading-relaxed">{g.description}</p>
        </section>
      )}

      {g.categories?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-navy-900 mb-2 pb-1.5 border-b border-navy-100">Categories</h2>
          <div className="flex gap-2 flex-wrap">
            {g.categories.map(c => (
              <span key={c} className="text-sm px-3 py-1 bg-link-light text-link rounded-full">{c}</span>
            ))}
          </div>
        </section>
      )}

      {g.url && (
        <a
          href={g.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-link text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Apply Now &rarr;
        </a>
      )}

      <div className="mt-10 p-4 bg-navy-100 rounded-lg text-xs text-navy-500 space-y-1">
        <div>Discovery method: {g.discovery_method || 'Unknown'}</div>
        {g.last_verified_at && <div>Last verified: {formatDate(g.last_verified_at)}</div>}
        <div>Added: {formatDate(g.created_at)}</div>
      </div>
    </div>
  );
}
