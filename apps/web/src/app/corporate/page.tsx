import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface CorporateFoundation {
  id: string;
  name: string;
  parent_company: string | null;
  asx_code: string | null;
  total_giving_annual: number | null;
  giving_ratio: number | null;
  revenue_sources: string[];
  thematic_focus: string[];
}

function formatMoney(amount: number | null): string {
  if (!amount) return '—';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

export default async function CorporatePage() {
  const supabase = getServiceSupabase();

  const { data: foundations, count } = await supabase
    .from('foundations')
    .select('id, name, parent_company, asx_code, total_giving_annual, giving_ratio, revenue_sources, thematic_focus', { count: 'exact' })
    .eq('type', 'corporate_foundation')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <div>
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Corporate Giving Transparency</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        How much do Australia's biggest companies give back? {count || 0} corporate foundations tracked.
      </p>

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <strong>Phase E — Coming Soon</strong>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
          We're building ASX200 company-to-foundation mapping, sustainability report scraping,
          and revenue-vs-giving ratio calculations. The data below is from ACNC foundations
          identified as corporate foundations.
        </p>
      </div>

      {(foundations as CorporateFoundation[] || []).length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>Foundation</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>Parent</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>ASX</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#888', textAlign: 'right' }}>Annual Giving</th>
              <th style={{ padding: '12px 16px', fontSize: '13px', color: '#888', textAlign: 'right' }}>Giving Ratio</th>
            </tr>
          </thead>
          <tbody>
            {(foundations as CorporateFoundation[]).map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 16px' }}>
                  <a href={`/foundations/${f.id}`} style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 500 }}>{f.name}</a>
                </td>
                <td style={{ padding: '10px 16px', color: '#666', fontSize: '14px' }}>{f.parent_company || '—'}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px' }}>{f.asx_code || '—'}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>{formatMoney(f.total_giving_annual)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: f.giving_ratio ? '#2563eb' : '#ccc' }}>
                  {f.giving_ratio ? `${f.giving_ratio}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <p>No corporate foundations loaded yet.</p>
          <p style={{ fontSize: '14px' }}>Run the ACNC import to populate foundation data.</p>
        </div>
      )}
    </div>
  );
}
