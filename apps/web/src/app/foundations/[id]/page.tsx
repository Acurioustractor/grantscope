import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

interface FoundationDetail {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  description: string | null;
  acnc_abn: string;
  total_giving_annual: number | null;
  giving_history: Array<{ year: number; amount: number }> | null;
  avg_grant_size: number | null;
  grant_range_min: number | null;
  grant_range_max: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  target_recipients: string[];
  endowment_size: number | null;
  investment_returns: number | null;
  giving_ratio: number | null;
  revenue_sources: string[];
  parent_company: string | null;
  asx_code: string | null;
  open_programs: Array<{ name: string; url?: string; amount?: number; deadline?: string; description?: string }> | null;
  profile_confidence: string;
  giving_philosophy: string | null;
  wealth_source: string | null;
  application_tips: string | null;
  notable_grants: string[] | null;
  board_members: string[] | null;
  enriched_at: string | null;
  scraped_urls: string[] | null;
  created_at: string;
}

interface ProgramRow {
  id: string;
  name: string;
  url: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  status: string;
  categories: string[];
}

function formatMoney(amount: number | null): string {
  if (!amount) return 'Unknown';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function typeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    private_ancillary_fund: 'Private Ancillary Fund',
    public_ancillary_fund: 'Public Ancillary Fund',
    trust: 'Trust',
    corporate_foundation: 'Corporate Foundation',
  };
  return type ? labels[type] || type : 'Foundation';
}

const confidenceColor = (c: string) =>
  c === 'high' ? '#059669' : c === 'medium' ? '#d97706' : '#999';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '28px' }}>
    <h2 style={{ fontSize: '18px', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>{title}</h2>
    {children}
  </div>
);

export default async function FoundationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: foundation } = await supabase
    .from('foundations')
    .select('*')
    .eq('id', id)
    .single();

  if (!foundation) notFound();
  const f = foundation as FoundationDetail;

  const { data: programs } = await supabase
    .from('foundation_programs')
    .select('*')
    .eq('foundation_id', id)
    .order('deadline', { ascending: true, nullsFirst: false });

  return (
    <div style={{ maxWidth: '800px' }}>
      <a href="/foundations" style={{ color: '#666', fontSize: '14px' }}>Back to foundations</a>

      <h1 style={{ fontSize: '28px', marginTop: '16px', marginBottom: '4px' }}>{f.name}</h1>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
        {typeLabel(f.type)} | ABN: {f.acnc_abn}
        {f.website && (
          <> | <a href={f.website.startsWith('http') ? f.website : `https://${f.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{f.website}</a></>
        )}
      </div>

      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Annual Giving</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>{formatMoney(f.total_giving_annual)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Grant Range</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {f.grant_range_min || f.grant_range_max
              ? `${formatMoney(f.grant_range_min)} – ${formatMoney(f.grant_range_max)}`
              : 'Unknown'}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Giving Ratio</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: f.giving_ratio ? '#2563eb' : '#ccc' }}>
            {f.giving_ratio ? `${f.giving_ratio}%` : '—'}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Profile Quality</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: confidenceColor(f.profile_confidence) }}>
            {f.profile_confidence.charAt(0).toUpperCase() + f.profile_confidence.slice(1)}
          </div>
        </div>
      </div>

      {/* Description */}
      {f.description && (
        <Section title="About">
          <p style={{ color: '#444', lineHeight: 1.6, margin: 0 }}>{f.description}</p>
        </Section>
      )}

      {/* Giving Philosophy */}
      {f.giving_philosophy && (
        <Section title="Giving Philosophy">
          <p style={{ color: '#444', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{f.giving_philosophy}</p>
        </Section>
      )}

      {/* Wealth Source */}
      {f.wealth_source && (
        <Section title="Source of Wealth">
          <p style={{ color: '#444', lineHeight: 1.6, margin: 0 }}>{f.wealth_source}</p>
        </Section>
      )}

      {/* Application Tips */}
      {f.application_tips && (
        <Section title="Tips for Applicants">
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
            <p style={{ color: '#166534', lineHeight: 1.6, margin: 0 }}>{f.application_tips}</p>
          </div>
        </Section>
      )}

      {/* Focus areas */}
      {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0 || f.target_recipients?.length > 0) && (
        <Section title="Focus Areas">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {f.thematic_focus?.map(t => (
              <span key={t} style={{ fontSize: '13px', padding: '4px 12px', background: '#ecfdf5', borderRadius: '16px', color: '#059669' }}>{t}</span>
            ))}
            {f.geographic_focus?.map(g => (
              <span key={g} style={{ fontSize: '13px', padding: '4px 12px', background: '#f0f4ff', borderRadius: '16px', color: '#2563eb' }}>{g}</span>
            ))}
            {f.target_recipients?.map(r => (
              <span key={r} style={{ fontSize: '13px', padding: '4px 12px', background: '#fef3c7', borderRadius: '16px', color: '#d97706' }}>{r}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Notable Grants */}
      {f.notable_grants && f.notable_grants.length > 0 && (
        <Section title="Notable Grants">
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#444', lineHeight: 1.8 }}>
            {f.notable_grants.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Board Members */}
      {f.board_members && f.board_members.length > 0 && (
        <Section title="Board & Leadership">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {f.board_members.map((m, i) => (
              <span key={i} style={{ fontSize: '13px', padding: '4px 12px', background: '#f5f5f5', borderRadius: '16px', color: '#555' }}>{m}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Giving history */}
      {f.giving_history && f.giving_history.length > 0 && (
        <Section title="Giving History">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {f.giving_history.map(entry => (
              <div key={entry.year} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#888' }}>{entry.year}</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatMoney(entry.amount)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Open programs from foundation_programs table */}
      {(programs as ProgramRow[] || []).length > 0 && (
        <Section title="Open Programs">
          {(programs as ProgramRow[]).map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px 18px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '15px' }}>{p.name}</h3>
                <span style={{ fontSize: '13px', color: p.status === 'open' ? '#059669' : '#999' }}>{p.status}</span>
              </div>
              {p.description && <p style={{ fontSize: '13px', color: '#555', margin: '4px 0' }}>{p.description}</p>}
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                {p.amount_max && <span>Up to {formatMoney(p.amount_max)}</span>}
                {p.deadline && <span> | Closes {new Date(p.deadline).toLocaleDateString('en-AU')}</span>}
                {p.url && <> | <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Apply</a></>}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Open programs from JSON (scraped, not yet in separate table) */}
      {f.open_programs && f.open_programs.length > 0 && !(programs as ProgramRow[] || []).length && (
        <Section title="Programs (from website)">
          {f.open_programs.map((p, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px 18px', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>{p.name}</h3>
              {p.description && <p style={{ fontSize: '13px', color: '#555', margin: '4px 0' }}>{p.description}</p>}
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                {p.amount && <span>Up to {formatMoney(p.amount)}</span>}
                {p.deadline && <span> | Deadline: {p.deadline}</span>}
                {p.url && <> | <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>More info</a></>}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Transparency */}
      {(f.parent_company || f.asx_code || f.endowment_size || f.revenue_sources?.length > 0) && (
        <Section title="Financial Transparency">
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', display: 'grid', gap: '8px' }}>
            {f.parent_company && <div><span style={{ color: '#888', fontSize: '13px' }}>Parent company:</span> <strong>{f.parent_company}</strong></div>}
            {f.asx_code && <div><span style={{ color: '#888', fontSize: '13px' }}>ASX code:</span> <strong>{f.asx_code}</strong></div>}
            {f.endowment_size && <div><span style={{ color: '#888', fontSize: '13px' }}>Endowment:</span> <strong>{formatMoney(f.endowment_size)}</strong></div>}
            {f.investment_returns && <div><span style={{ color: '#888', fontSize: '13px' }}>Investment returns:</span> <strong>{formatMoney(f.investment_returns)}</strong></div>}
            {f.revenue_sources?.length > 0 && <div><span style={{ color: '#888', fontSize: '13px' }}>Revenue sources:</span> {f.revenue_sources.join(', ')}</div>}
          </div>
        </Section>
      )}

      {/* Metadata footer */}
      <div style={{ marginTop: '40px', padding: '16px', background: '#f5f5f5', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
        <div>Profile confidence: <span style={{ color: confidenceColor(f.profile_confidence), fontWeight: 600 }}>{f.profile_confidence}</span></div>
        {f.enriched_at && <div>Last profiled: {new Date(f.enriched_at).toLocaleDateString('en-AU')}</div>}
        {f.scraped_urls && f.scraped_urls.length > 0 && <div>Sources scraped: {f.scraped_urls.length} pages</div>}
        <div>Added to GrantScope: {new Date(f.created_at).toLocaleDateString('en-AU')}</div>
      </div>
    </div>
  );
}
