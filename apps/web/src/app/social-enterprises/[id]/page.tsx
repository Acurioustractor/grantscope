import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface SocialEnterprise {
  id: string;
  name: string;
  abn: string | null;
  acn: string | null;
  icn: string | null;
  website: string | null;
  description: string | null;
  org_type: string;
  legal_structure: string | null;
  sector: string[];
  state: string | null;
  city: string | null;
  postcode: string | null;
  geographic_focus: string[];
  certifications: Array<{ body: string; status?: string; since?: string; score?: number }>;
  sources: Array<{ source: string; url?: string; scraped_at?: string }>;
  source_primary: string | null;
  enriched_at: string | null;
  profile_confidence: string;
  created_at: string;
  updated_at: string;
}

function orgTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    social_enterprise: 'Social Enterprise',
    b_corp: 'B Corp',
    indigenous_business: 'Indigenous Business',
    disability_enterprise: 'Disability Enterprise',
    cooperative: 'Cooperative',
  };
  return labels[type] || type.replace(/_/g, ' ');
}

function orgTypeBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    social_enterprise: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    b_corp: 'border-money bg-money-light text-money',
    indigenous_business: 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red',
    disability_enterprise: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    cooperative: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted',
  };
  return classes[type] || 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
}

function legalStructureLabel(ls: string | null): string {
  if (!ls) return 'Unknown';
  const labels: Record<string, string> = {
    charity: 'Registered Charity',
    pty_ltd: 'Pty Ltd',
    cooperative: 'Cooperative',
    indigenous_corp: 'Indigenous Corporation (CATSI)',
    unincorporated: 'Unincorporated',
  };
  return labels[ls] || ls.replace(/_/g, ' ');
}

function certBodyLabel(body: string): string {
  const labels: Record<string, string> = {
    'social-traders': 'Social Traders',
    'b-corp': 'B Corp',
    'buyability': 'BuyAbility',
    'supply-nation': 'Supply Nation',
  };
  return labels[body] || body;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'oric': 'ORIC Register',
    'social-traders': 'Social Traders',
    'b-corp': 'B Corp Directory',
    'buyability': 'BuyAbility',
    'supply-nation': 'Supply Nation',
    'kinaway': 'Kinaway (VIC)',
    'black-business-finder': 'Black Business Finder',
    'senvic': 'SENVIC (VIC)',
    'qsec': 'QSEC (QLD)',
    'secna': 'SECNA (NSW)',
    'sasec': 'SASEC (SA)',
    'wasec': 'WASEC (WA)',
    'sentas': 'SENTAS (TAS)',
    'gov-procurement-nsw': 'buy.nsw',
    'gov-procurement-vic': 'buyingfor.vic.gov.au',
  };
  return labels[source] || source;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SocialEnterpriseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: se } = await supabase
    .from('social_enterprises')
    .select('*')
    .eq('id', id)
    .single();

  if (!se) notFound();

  const enterprise = se as SocialEnterprise;

  // Check if this SE has a matched ACNC charity
  let matchedCharity: { abn: string; name: string } | null = null;
  if (enterprise.abn) {
    const { data: charity } = await supabase
      .from('acnc_charities')
      .select('abn, name')
      .eq('abn', enterprise.abn.replace(/\s/g, ''))
      .maybeSingle();
    if (charity) matchedCharity = charity as { abn: string; name: string };
  }

  return (
    <div className="max-w-4xl">
      <a href="/social-enterprises" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Social Enterprises
      </a>

      {/* Header */}
      <div className="mt-4 mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{enterprise.name}</h1>
          <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${orgTypeBadgeClass(enterprise.org_type)}`}>
              {orgTypeLabel(enterprise.org_type)}
            </span>
            {enterprise.certifications?.map((cert, i) => (
              <span key={i} className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-money bg-money-light text-money">
                {certBodyLabel(cert.body)}
              </span>
            ))}
          </div>
        </div>
        <div className="text-sm text-bauhaus-muted flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
          {enterprise.abn && <span className="font-bold text-bauhaus-black">ABN {enterprise.abn}</span>}
          {enterprise.icn && (
            <>
              {enterprise.abn && <span className="text-bauhaus-muted/30">|</span>}
              <span className="font-bold text-bauhaus-black">ICN {enterprise.icn}</span>
            </>
          )}
          {enterprise.city && enterprise.state && (
            <>
              <span className="text-bauhaus-muted/30">|</span>
              <span>{enterprise.city}, {enterprise.state} {enterprise.postcode}</span>
            </>
          )}
          {!enterprise.city && enterprise.state && (
            <>
              <span className="text-bauhaus-muted/30">|</span>
              <span>{enterprise.state}</span>
            </>
          )}
          {enterprise.website && (
            <>
              <span className="text-bauhaus-muted/30">|</span>
              <a href={enterprise.website.startsWith('http') ? enterprise.website : `https://${enterprise.website}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                {enterprise.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {(() => {
        const stats: Array<{ label: string; value: string }> = [];
        if (enterprise.legal_structure) stats.push({ label: 'Legal Structure', value: legalStructureLabel(enterprise.legal_structure) });
        if (enterprise.state) stats.push({ label: 'State', value: enterprise.state });
        if (enterprise.certifications?.length > 0) stats.push({ label: 'Certifications', value: String(enterprise.certifications.length) });
        if (enterprise.sources?.length > 0) stats.push({ label: 'Listed In', value: `${enterprise.sources.length} ${enterprise.sources.length === 1 ? 'directory' : 'directories'}` });

        if (stats.length === 0) return null;
        return (
          <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(stats.length, 4)} gap-0 mb-8 border-4 border-bauhaus-black`}>
            {stats.map((s, i) => (
              <div key={s.label} className={`bg-white p-4 ${i < stats.length - 1 ? 'border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black' : ''}`}>
                <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">{s.label}</div>
                <div className="text-lg font-black text-bauhaus-black">{s.value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {enterprise.description && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{enterprise.description}</p>
            </Section>
          )}

          {/* ACNC Link */}
          {matchedCharity && (
            <Section title="Registered Charity">
              <div className="bg-white border-4 border-bauhaus-black p-4">
                <p className="text-sm text-bauhaus-muted font-medium mb-2">
                  This social enterprise is also a registered charity with the ACNC:
                </p>
                <a href={`/charities/${matchedCharity.abn}`} className="text-bauhaus-blue hover:text-bauhaus-red font-bold text-[15px]">
                  {matchedCharity.name} &rarr;
                </a>
                <div className="text-xs text-bauhaus-muted mt-1">ABN {matchedCharity.abn}</div>
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Sectors */}
          {enterprise.sector?.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Sectors</h3>
              <div className="flex gap-1.5 flex-wrap">
                {enterprise.sector.map(s => (
                  <a key={s} href={`/social-enterprises?sector=${s}`} className="text-xs px-2.5 py-1 bg-money-light text-money font-black border-2 border-money/20 capitalize hover:bg-money hover:text-white transition-colors">
                    {s}
                  </a>
                ))}
              </div>
              {enterprise.geographic_focus?.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs text-bauhaus-muted mb-1.5 font-black uppercase tracking-wider">Geographic Focus</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {enterprise.geographic_focus.map(g => (
                      <span key={g} className="text-xs px-2.5 py-1 bg-link-light text-bauhaus-blue font-black border-2 border-bauhaus-blue/20">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Certifications detail */}
          {enterprise.certifications?.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Certifications</h3>
              <div className="space-y-2">
                {enterprise.certifications.map((cert, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-bauhaus-black">{certBodyLabel(cert.body)}</span>
                    <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-money bg-money-light text-money">
                      {cert.status || 'certified'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Sources */}
          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4 text-xs text-bauhaus-muted space-y-1.5 font-medium">
            <h3 className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Data Sources</h3>
            {enterprise.sources?.map((src, i) => (
              <div key={i}>
                {src.url ? (
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                    {sourceLabel(src.source)}
                  </a>
                ) : (
                  <span className="font-bold">{sourceLabel(src.source)}</span>
                )}
                {src.scraped_at && (
                  <span className="text-bauhaus-muted/60 ml-1">
                    ({new Date(src.scraped_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'short' })})
                  </span>
                )}
              </div>
            ))}
            {enterprise.enriched_at && (
              <div className="mt-2 pt-2 border-t border-bauhaus-black/10">
                Enriched: {new Date(enterprise.enriched_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
                <span className={`ml-2 font-black ${enterprise.profile_confidence === 'high' ? 'text-money' : enterprise.profile_confidence === 'medium' ? 'text-bauhaus-black' : 'text-bauhaus-muted'}`}>
                  ({enterprise.profile_confidence})
                </span>
              </div>
            )}
            {enterprise.abn && (
              <a href={`https://www.acnc.gov.au/charity/charities?search=${encodeURIComponent(enterprise.abn)}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red block mt-2 font-black uppercase tracking-wider">
                Search ACNC &rarr;
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
