import { ImageResponse } from 'next/og';
import { getServiceSupabase } from '@/lib/supabase';

// Per-supplier social card. Next wires this as BOTH og:image and twitter:image,
// so a buyer pasting a profile link into an email / Slack / Teams gets a card that
// leads with the delivery evidence — not a generic CivicGraph logo.
export const runtime = 'nodejs';
export const alt = 'CivicGraph social enterprise profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BLACK = '#121212';
const RED = '#D02020';
const BLUE = '#1040C0';
const MONEY = '#059669';
const MUTED = '#9A9A9A';

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function orgTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    social_enterprise: 'Social Enterprise',
    b_corp: 'B Corp',
    indigenous_business: 'Indigenous Business',
    disability_enterprise: 'Disability Enterprise',
    cooperative: 'Cooperative',
  };
  if (!type) return 'Social Enterprise';
  return labels[type] || type.replace(/_/g, ' ');
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: se } = await supabase
    .from('social_enterprises')
    .select('name, org_type, state, abn, verification_tier')
    .eq('id', id)
    .single();

  const name = se?.name ?? 'Social Enterprise';
  const cleanAbn = (se?.abn as string | null)?.replace(/\s/g, '') ?? null;

  let contractTotal = 0;
  let contractCount = 0;
  if (cleanAbn) {
    const { data: rows, count } = await supabase
      .from('austender_contracts')
      .select('contract_value', { count: 'exact' })
      .eq('supplier_abn', cleanAbn)
      .not('contract_value', 'is', null)
      .limit(1000);
    contractTotal = (rows || []).reduce((sum, r) => sum + ((r.contract_value as number) || 0), 0);
    contractCount = count ?? (rows?.length ?? 0);
  }

  const hasEvidence = contractCount > 0;
  const tier = (se?.verification_tier as string | null) ?? null;
  const meta = [orgTypeLabel(se?.org_type as string | null), se?.state]
    .filter(Boolean)
    .join('  ·  ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: BLACK,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, backgroundColor: RED }} />
          <div
            style={{
              color: '#FFFFFF',
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 6,
            }}
          >
            CIVICGRAPH
          </div>
          {tier && (
            <div
              style={{
                marginLeft: 12,
                color: tier === 'certified' ? '#7AA2FF' : tier === 'verified' ? '#4ADE80' : MUTED,
                border: `2px solid ${tier === 'certified' ? BLUE : tier === 'verified' ? MONEY : MUTED}`,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 3,
                padding: '4px 12px',
                textTransform: 'uppercase',
              }}
            >
              {tier}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: '#FFFFFF',
              fontSize: name.length > 42 ? 64 : 80,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: -1,
            }}
          >
            {name.length > 80 ? `${name.slice(0, 78)}…` : name}
          </div>
          {meta && (
            <div style={{ color: MUTED, fontSize: 30, fontWeight: 600, marginTop: 20, letterSpacing: 1 }}>
              {meta}
            </div>
          )}
        </div>

        {/* Evidence line — the thing we built, front and centre */}
        {hasEvidence ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: MONEY, fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
                {`${formatMoney(contractTotal)}+`}
              </div>
              <div style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, marginTop: 10, letterSpacing: 1 }}>
                {`across ${contractCount.toLocaleString()} government ${contractCount === 1 ? 'contract' : 'contracts'}`}
              </div>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                color: '#FFFFFF',
                backgroundColor: BLUE,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 3,
                padding: '12px 20px',
                textTransform: 'uppercase',
              }}
            >
              Proven Deliverer
            </div>
          </div>
        ) : (
          <div
            style={{
              color: MUTED,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Delivery evidence · Government contracts · Governance
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
