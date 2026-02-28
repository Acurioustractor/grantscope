import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

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

function confidenceClasses(c: string) {
  if (c === 'high') return 'text-money bg-money-light';
  if (c === 'medium') return 'text-warning bg-warning-light';
  return 'text-navy-500 bg-navy-100';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-lg font-semibold text-navy-900 mb-2.5 pb-1.5 border-b border-navy-100">{title}</h2>
      {children}
    </section>
  );
}

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
    <div className="max-w-3xl">
      <a href="/foundations" className="text-sm text-navy-500 hover:text-navy-900 transition-colors">
        &larr; Back to foundations
      </a>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-4 mb-1">{f.name}</h1>
      <div className="text-sm text-navy-500 mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{typeLabel(f.type)}</span>
        <span className="text-navy-300">|</span>
        <span>ABN: {f.acnc_abn}</span>
        {f.website && (
          <>
            <span className="text-navy-300">|</span>
            <a href={f.website.startsWith('http') ? f.website : `https://${f.website}`} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">{f.website}</a>
          </>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-navy-200 rounded-lg p-3.5">
          <div className="text-[11px] text-navy-400 mb-1">Annual Giving</div>
          <div className="text-xl font-bold text-money tabular-nums">{formatMoney(f.total_giving_annual)}</div>
        </div>
        <div className="bg-white border border-navy-200 rounded-lg p-3.5">
          <div className="text-[11px] text-navy-400 mb-1">Grant Range</div>
          <div className="text-sm font-semibold text-navy-900 tabular-nums">
            {f.grant_range_min || f.grant_range_max
              ? `${formatMoney(f.grant_range_min)} – ${formatMoney(f.grant_range_max)}`
              : 'Unknown'}
          </div>
        </div>
        <div className="bg-white border border-navy-200 rounded-lg p-3.5">
          <div className="text-[11px] text-navy-400 mb-1">Giving Ratio</div>
          <div className={`text-xl font-bold tabular-nums ${f.giving_ratio ? 'text-link' : 'text-navy-300'}`}>
            {f.giving_ratio ? `${f.giving_ratio}%` : '\u2014'}
          </div>
        </div>
        <div className="bg-white border border-navy-200 rounded-lg p-3.5">
          <div className="text-[11px] text-navy-400 mb-1">Profile Quality</div>
          <div className={`text-sm font-semibold inline-block px-2 py-0.5 rounded ${confidenceClasses(f.profile_confidence)}`}>
            {f.profile_confidence.charAt(0).toUpperCase() + f.profile_confidence.slice(1)}
          </div>
        </div>
      </div>

      {f.description && (
        <Section title="About">
          <p className="text-navy-600 leading-relaxed">{f.description}</p>
        </Section>
      )}

      {f.giving_philosophy && (
        <Section title="Giving Philosophy">
          <p className="text-navy-600 leading-relaxed italic">{f.giving_philosophy}</p>
        </Section>
      )}

      {f.wealth_source && (
        <Section title="Source of Wealth">
          <p className="text-navy-600 leading-relaxed">{f.wealth_source}</p>
        </Section>
      )}

      {f.application_tips && (
        <Section title="Tips for Applicants">
          <div className="bg-money-light border border-emerald-200 rounded-lg p-4">
            <p className="text-emerald-800 leading-relaxed">{f.application_tips}</p>
          </div>
        </Section>
      )}

      {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0 || f.target_recipients?.length > 0) && (
        <Section title="Focus Areas">
          <div className="flex gap-2 flex-wrap">
            {f.thematic_focus?.map(t => (
              <span key={t} className="text-sm px-3 py-1 bg-money-light text-money rounded-full">{t}</span>
            ))}
            {f.geographic_focus?.map(g => (
              <span key={g} className="text-sm px-3 py-1 bg-link-light text-link rounded-full">{g}</span>
            ))}
            {f.target_recipients?.map(r => (
              <span key={r} className="text-sm px-3 py-1 bg-warning-light text-warning rounded-full">{r}</span>
            ))}
          </div>
        </Section>
      )}

      {f.notable_grants && f.notable_grants.length > 0 && (
        <Section title="Notable Grants">
          <ul className="list-disc pl-5 text-navy-600 leading-loose">
            {f.notable_grants.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Section>
      )}

      {f.board_members && f.board_members.length > 0 && (
        <Section title="Board & Leadership">
          <div className="flex gap-2 flex-wrap">
            {f.board_members.map((m, i) => (
              <span key={i} className="text-sm px-3 py-1 bg-navy-100 text-navy-600 rounded-full">{m}</span>
            ))}
          </div>
        </Section>
      )}

      {f.giving_history && f.giving_history.length > 0 && (
        <Section title="Giving History">
          <div className="flex gap-3 flex-wrap">
            {f.giving_history.map(entry => (
              <div key={entry.year} className="bg-white border border-navy-200 rounded-lg px-4 py-2 text-center">
                <div className="text-xs text-navy-400">{entry.year}</div>
                <div className="text-base font-semibold text-navy-900 tabular-nums">{formatMoney(entry.amount)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(programs as ProgramRow[] || []).length > 0 && (
        <Section title="Open Programs">
          <div className="space-y-2">
            {(programs as ProgramRow[]).map(p => (
              <div key={p.id} className="bg-white border border-navy-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-[15px] text-navy-900">{p.name}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${p.status === 'open' ? 'bg-money-light text-money' : 'bg-navy-100 text-navy-500'}`}>{p.status}</span>
                </div>
                {p.description && <p className="text-sm text-navy-500 mt-1">{p.description}</p>}
                <div className="text-xs text-navy-400 mt-2 flex gap-3 flex-wrap">
                  {p.amount_max && <span>Up to {formatMoney(p.amount_max)}</span>}
                  {p.deadline && <span>Closes {new Date(p.deadline).toLocaleDateString('en-AU')}</span>}
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">Apply</a>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {f.open_programs && f.open_programs.length > 0 && !(programs as ProgramRow[] || []).length && (
        <Section title="Programs (from website)">
          <div className="space-y-2">
            {f.open_programs.map((p, i) => (
              <div key={i} className="bg-white border border-navy-200 rounded-lg p-4">
                <h3 className="font-semibold text-[15px] text-navy-900">{p.name}</h3>
                {p.description && <p className="text-sm text-navy-500 mt-1">{p.description}</p>}
                <div className="text-xs text-navy-400 mt-2 flex gap-3 flex-wrap">
                  {p.amount && <span>Up to {formatMoney(p.amount)}</span>}
                  {p.deadline && <span>Deadline: {p.deadline}</span>}
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">More info</a>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(f.parent_company || f.asx_code || f.endowment_size || f.revenue_sources?.length > 0) && (
        <Section title="Financial Transparency">
          <div className="bg-white border border-navy-200 rounded-lg p-4 space-y-2 text-sm">
            {f.parent_company && <div><span className="text-navy-400">Parent company:</span> <strong className="text-navy-900">{f.parent_company}</strong></div>}
            {f.asx_code && <div><span className="text-navy-400">ASX code:</span> <strong className="text-navy-900 font-mono">{f.asx_code}</strong></div>}
            {f.endowment_size && <div><span className="text-navy-400">Endowment:</span> <strong className="text-navy-900 tabular-nums">{formatMoney(f.endowment_size)}</strong></div>}
            {f.investment_returns && <div><span className="text-navy-400">Investment returns:</span> <strong className="text-navy-900 tabular-nums">{formatMoney(f.investment_returns)}</strong></div>}
            {f.revenue_sources?.length > 0 && <div><span className="text-navy-400">Revenue sources:</span> {f.revenue_sources.join(', ')}</div>}
          </div>
        </Section>
      )}

      <div className="mt-10 p-4 bg-navy-100 rounded-lg text-xs text-navy-500 space-y-1">
        <div>Profile confidence: <span className={`font-semibold ${f.profile_confidence === 'high' ? 'text-money' : f.profile_confidence === 'medium' ? 'text-warning' : 'text-navy-500'}`}>{f.profile_confidence}</span></div>
        {f.enriched_at && <div>Last profiled: {new Date(f.enriched_at).toLocaleDateString('en-AU')}</div>}
        {f.scraped_urls && f.scraped_urls.length > 0 && <div>Sources scraped: {f.scraped_urls.length} pages</div>}
        <div>Added to GrantScope: {new Date(f.created_at).toLocaleDateString('en-AU')}</div>
      </div>
    </div>
  );
}
