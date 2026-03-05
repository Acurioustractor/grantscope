import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { GrantActions } from '@/app/components/grant-actions';
import { GrantNotes } from '@/app/components/grant-notes';
import { PartnerPicker } from '@/app/components/partner-picker';

export const dynamic = 'force-dynamic';

interface Grant {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  program_type: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  description: string | null;
  categories: string[];
  focus_areas: string[];
  target_recipients: string[];
  status: string;
  sources: unknown;
  discovery_method: string | null;
  last_verified_at: string | null;
  created_at: string;
  embedding: unknown;
  eligibility_criteria: Record<string, unknown> | null;
  assessment_criteria: Record<string, unknown> | null;
  timeline_stages: Record<string, unknown> | null;
  grant_structure: Record<string, unknown> | null;
  funder_info: Record<string, unknown> | null;
  requirements_summary: string | null;
  foundation_id: string | null;
  grant_type: string | null;
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-black text-bauhaus-black mb-2 pb-1.5 border-b-4 border-bauhaus-black uppercase tracking-widest">{title}</h2>
      {children}
    </section>
  );
}

function programTypeBadge(type: string | null) {
  switch (type) {
    case 'fellowship': return { cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue', label: 'Fellowship' };
    case 'scholarship': return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Scholarship' };
    case 'historical_award': return { cls: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted', label: 'Historical Award' };
    default: return null;
  }
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

  const eligibility = g.eligibility_criteria as Array<{ criterion: string; description: string; category: string }> | null;
  const assessment = g.assessment_criteria as Array<{ name: string; description: string; weight_pct: number }> | null;
  const timeline = g.timeline_stages as Array<{ stage: string; description: string; date: string; is_completed: boolean }> | null;
  const structure = g.grant_structure as { total_amount?: number; duration_years?: number; priority_cohorts?: string[] } | null;
  const funder = g.funder_info as { org_name?: string; about?: string; website?: string; contact_email?: string } | null;
  const ptBadge = programTypeBadge(g.program_type);

  return (
    <div className="max-w-3xl">
      <a href="/grants" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Grants
      </a>

      <div className="mt-4 mb-2 flex items-start gap-3">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{g.name}</h1>
        {ptBadge && (
          <span className={`text-[11px] font-black px-2.5 py-1 flex-shrink-0 border-2 uppercase tracking-widest mt-1 ${ptBadge.cls}`}>
            {ptBadge.label}
          </span>
        )}
      </div>
      <div className="text-base text-bauhaus-muted font-medium mb-2">
        {g.provider}{g.program ? ` — ${g.program}` : ''}
      </div>
      <GrantActions grantId={g.id} />
      <GrantNotes grantId={g.id} />
      <PartnerPicker
        grantId={g.id}
        grant={{
          name: g.name,
          amount: formatAmount(g.amount_min, g.amount_max),
          closes: formatDate(g.closes_at),
          description: g.description || '',
          url: g.url || '',
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Amount</div>
          <div className="text-lg font-black text-bauhaus-blue tabular-nums">{formatAmount(g.amount_min, g.amount_max)}</div>
        </div>
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Closes</div>
          <div className={`text-lg font-black ${g.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>{formatDate(g.closes_at)}</div>
        </div>
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Status</div>
          <div className="text-lg font-black text-money">{g.status || 'Open'}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Type</div>
          <div className="text-lg font-black text-bauhaus-black capitalize">{(g.grant_type || 'grant').replace('_', ' ')}</div>
        </div>
      </div>

      {/* Apply button — prominent at top */}
      {g.url && (
        <a
          href={g.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 mb-8 bg-bauhaus-red text-white font-black uppercase tracking-widest hover:bg-bauhaus-black bauhaus-shadow-sm border-4 border-bauhaus-black"
        >
          Apply Now &rarr;
        </a>
      )}

      {/* Two-column layout for enriched grants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {g.description && (
            <Section title="Description">
              <p className="text-bauhaus-muted leading-relaxed font-medium whitespace-pre-line">{g.description}</p>
            </Section>
          )}

          {g.requirements_summary && (
            <Section title="Requirements Summary">
              <div className="bg-money-light border-4 border-money p-4 bauhaus-shadow-sm">
                <p className="text-bauhaus-black leading-relaxed font-medium">{g.requirements_summary}</p>
              </div>
            </Section>
          )}

          {eligibility && eligibility.length > 0 && (
            <Section title="Eligibility Criteria">
              <div className="space-y-2">
                {eligibility.map((e, i) => (
                  <div key={i} className="bg-white border-4 border-bauhaus-black px-4 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-money font-black mt-0.5">&#10003;</span>
                      <div>
                        <span className="font-black text-bauhaus-black text-sm">{e.criterion}</span>
                        {e.description && <p className="text-sm text-bauhaus-muted mt-0.5 font-medium">{e.description}</p>}
                      </div>
                    </div>
                    {e.category && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted/50 ml-6">{e.category}</span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {assessment && assessment.length > 0 && (
            <Section title="Assessment Criteria">
              <div className="space-y-2">
                {assessment.map((a, i) => (
                  <div key={i} className="bg-white border-4 border-bauhaus-black px-4 py-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-bauhaus-black text-sm">{a.name}</span>
                      {a.weight_pct && (
                        <span className="text-xs font-black text-bauhaus-blue bg-link-light px-2 py-0.5 border-2 border-bauhaus-blue/20 flex-shrink-0 tabular-nums">
                          {a.weight_pct}%
                        </span>
                      )}
                    </div>
                    {a.description && <p className="text-sm text-bauhaus-muted mt-1 font-medium">{a.description}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {timeline && timeline.length > 0 && (
            <Section title="Timeline">
              <div className="space-y-0">
                {timeline.map((t, i) => (
                  <div key={i} className="flex gap-3 pb-3 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 border-4 ${t.is_completed ? 'bg-money border-money' : 'bg-white border-bauhaus-black'}`} />
                      {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-bauhaus-black/20 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <div className="font-black text-bauhaus-black text-sm">{t.stage}</div>
                      {t.date && t.date !== 'descriptive' && (
                        <div className="text-xs font-bold text-bauhaus-red mt-0.5">{t.date}</div>
                      )}
                      {t.description && <p className="text-sm text-bauhaus-muted mt-0.5 font-medium">{t.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {structure?.priority_cohorts && structure.priority_cohorts.length > 0 && (
            <Section title="Priority Cohorts">
              <div className="space-y-1.5">
                {structure.priority_cohorts.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm font-medium text-bauhaus-muted">
                    <span className="text-bauhaus-red font-black mt-0.5">&#9632;</span>
                    {p}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {(g.categories?.length > 0 || g.focus_areas?.length > 0 || g.target_recipients?.length > 0) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              {g.categories?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Categories</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {g.categories.map(c => (
                      <span key={c} className="text-[11px] px-2 py-0.5 bg-bauhaus-blue text-white font-black uppercase tracking-wider">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {g.focus_areas?.length > 0 && (
                <div className="mb-3 pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs font-black text-bauhaus-muted mb-2 uppercase tracking-widest">Focus Areas</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {g.focus_areas.map(f => (
                      <span key={f} className="text-[11px] px-2 py-0.5 bg-money-light text-money font-black border-2 border-money/20">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {g.target_recipients?.length > 0 && (
                <div className="pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs font-black text-bauhaus-muted mb-2 uppercase tracking-widest">Target Recipients</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {g.target_recipients.map(r => (
                      <span key={r} className="text-[11px] px-2 py-0.5 bg-warning-light text-bauhaus-black font-black border-2 border-bauhaus-yellow/30">{r.replace('_', ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {structure && (structure.total_amount || structure.duration_years) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <div className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Grant Structure</div>
              <div className="space-y-2 text-sm">
                {structure.total_amount && (
                  <div>
                    <div className="text-xs text-bauhaus-muted font-black uppercase tracking-wider">Total Pool</div>
                    <div className="text-bauhaus-black font-black tabular-nums">{formatMoney(structure.total_amount)}</div>
                  </div>
                )}
                {structure.duration_years && (
                  <div>
                    <div className="text-xs text-bauhaus-muted font-black uppercase tracking-wider">Duration</div>
                    <div className="text-bauhaus-black font-medium">{structure.duration_years} year{structure.duration_years !== 1 ? 's' : ''}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {funder && (funder.org_name || funder.about) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <div className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Funder</div>
              {funder.org_name && <div className="font-black text-bauhaus-black text-sm">{funder.org_name}</div>}
              {funder.about && <p className="text-sm text-bauhaus-muted mt-1 font-medium">{funder.about}</p>}
              {funder.website && (
                <a href={funder.website.startsWith('http') ? funder.website : `https://${funder.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-bauhaus-blue hover:text-bauhaus-red font-black uppercase tracking-wider mt-2 block">
                  Website &rarr;
                </a>
              )}
              {funder.contact_email && (
                <a href={`mailto:${funder.contact_email}`} className="text-xs text-bauhaus-blue hover:text-bauhaus-red font-black mt-1 block">
                  {funder.contact_email}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

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
