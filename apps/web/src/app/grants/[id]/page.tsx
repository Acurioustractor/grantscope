import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

interface Grant {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
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
    <div style={{ maxWidth: '800px' }}>
      <a href="/grants" style={{ color: '#666', fontSize: '14px' }}>Back to grants</a>

      <h1 style={{ fontSize: '28px', marginTop: '16px', marginBottom: '8px' }}>{g.name}</h1>
      <div style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>{g.provider}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Amount</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>{formatAmount(g.amount_min, g.amount_max)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Closes</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: g.closes_at ? '#d97706' : '#666' }}>{formatDate(g.closes_at)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Status</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>{g.status || 'Open'}</div>
        </div>
      </div>

      {g.description && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Description</h2>
          <p style={{ color: '#444', lineHeight: 1.6 }}>{g.description}</p>
        </div>
      )}

      {g.categories?.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Categories</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {g.categories.map(c => (
              <span key={c} style={{ fontSize: '13px', padding: '4px 12px', background: '#e8f4fd', borderRadius: '16px', color: '#2563eb' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {g.url && (
        <a
          href={g.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block', padding: '12px 24px', background: '#2563eb',
            color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600,
          }}
        >
          Apply Now
        </a>
      )}

      <div style={{ marginTop: '40px', padding: '16px', background: '#f5f5f5', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
        <div>Discovery method: {g.discovery_method || 'Unknown'}</div>
        {g.last_verified_at && <div>Last verified: {formatDate(g.last_verified_at)}</div>}
        <div>Added: {formatDate(g.created_at)}</div>
      </div>
    </div>
  );
}
