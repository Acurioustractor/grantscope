import { getServiceSupabase } from '@/lib/supabase';

async function getStats() {
  const supabase = getServiceSupabase();

  const [grantsResult, foundationsResult, profiledResult] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
  ]);

  return {
    totalGrants: grantsResult.count || 0,
    totalFoundations: foundationsResult.count || 0,
    profiledFoundations: profiledResult.count || 0,
  };
}

export default async function HomePage() {
  let stats = { totalGrants: 0, totalFoundations: 0, profiledFoundations: 0 };
  try {
    stats = await getStats();
  } catch {
    // DB not yet configured
  }

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px', fontWeight: 800 }}>
          GrantScope Australia
        </h1>
        <p style={{ fontSize: '20px', color: '#666', maxWidth: '600px', margin: '0 auto 40px' }}>
          Open-source funding transparency. Every government grant, every foundation,
          every corporate giving program — searchable, current, and free.
        </p>

        <form action="/grants" method="get" style={{ maxWidth: '600px', margin: '0 auto 40px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            name="q"
            placeholder="Search grants, foundations, programs..."
            style={{
              flex: 1, padding: '14px 20px', fontSize: '16px',
              border: '2px solid #e0e0e0', borderRadius: '8px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '14px 28px', fontSize: '16px', fontWeight: 600,
              background: '#1a1a2e', color: '#fff', border: 'none',
              borderRadius: '8px', cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <a href="/grants" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#2563eb' }}>{stats.totalGrants.toLocaleString()}</div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>Government Grants</div>
          </div>
        </a>
        <a href="/foundations" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#059669' }}>{stats.totalFoundations.toLocaleString()}</div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>Foundations &amp; Trusts</div>
            {stats.profiledFoundations > 0 && (
              <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>{stats.profiledFoundations} with AI profiles</div>
            )}
          </div>
        </a>
        <a href="/corporate" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#d97706' }}>ASX200</div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>Corporate Giving</div>
          </div>
        </a>
      </div>

      <div style={{ textAlign: 'center', marginTop: '60px', padding: '40px 20px', borderTop: '1px solid #e0e0e0' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Three layers of funding intelligence</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '900px', margin: '0 auto' }}>
          <div>
            <h3 style={{ color: '#2563eb' }}>Government Grants</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Federal, state, and local grants from GrantConnect, data.gov.au,
              QLD Grants Finder, and business.gov.au. Updated daily.
            </p>
          </div>
          <div>
            <h3 style={{ color: '#059669' }}>Philanthropic Foundations</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              ACNC register data on every Australian foundation, PAF, and trust.
              Giving profiles, open programs, and focus areas.
            </p>
          </div>
          <div>
            <h3 style={{ color: '#d97706' }}>Corporate Transparency</h3>
            <p style={{ color: '#666', fontSize: '14px' }}>
              ASX200 company foundations mapped to giving vs revenue.
              Who gives what, and is it enough?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
