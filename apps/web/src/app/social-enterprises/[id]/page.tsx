import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { money, getEntityEvidencePrograms, type AlmaEvidenceProgram } from '@/lib/services/report-service';
import { matchGrantsForSocialEnterprise, type MatchedGrant } from '@/lib/services/se-grant-match';
import { AddToPackButton } from '@/app/components/add-to-pack-button';
import { isHedgeDescription } from '@/lib/supplier-copy';

export const dynamic = 'force-dynamic';

// Per-supplier title + description so a buyer pasting a profile into a procurement
// email gets a real link preview (and tabs/SEO read the enterprise name, not the root title).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('social_enterprises')
    .select('name, org_type, state, description')
    .eq('id', id)
    .single();
  if (!data) return { title: 'Social Enterprise — CivicGraph' };
  const description =
    data.description && !isHedgeDescription(data.description)
      ? (data.description as string)
      : `${orgTypeLabel(data.org_type as string)}${data.state ? ` in ${data.state}` : ''} on CivicGraph — delivery evidence, government contracts and governance.`;
  return {
    title: `${data.name} — CivicGraph`,
    description: description.slice(0, 160),
  };
}

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
  // Elements are either plain strings ("Supply Nation Certified") or objects
  certifications: Array<string | { body: string; status?: string; since?: string; score?: number }> | null;
  // Two shapes exist in the data: an array of {source, url, scraped_at} or an
  // object keyed by source name with per-source sync payloads.
  sources: Array<{ source: string; url?: string; scraped_at?: string }> | Record<string, { url?: string; synced_at?: string }> | null;
  source_primary: string | null;
  enriched_at: string | null;
  profile_confidence: string;
  verification_tier: string | null;
  verification_basis: string | null;
  verification_computed_at: string | null;
  created_at: string;
  updated_at: string;
}

const TIER_STYLES: Record<string, string> = {
  certified: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
  verified: 'border-money bg-money-light text-money',
  identified: 'border-bauhaus-black/40 bg-bauhaus-canvas text-bauhaus-muted',
};

const TIER_TITLES: Record<string, string> = {
  certified: 'Carries an external certification mark (Social Traders, Supply Nation, BuyAbility, B Corp)',
  verified: 'On a statutory register (ACNC, ORIC) or state SE network, ABN matched',
  identified: 'Directory-identified — no external verification mark yet',
};

function TierBadge({ tier, basis }: { tier: string | null; basis?: string | null }) {
  if (!tier) return null;
  return (
    <span
      title={basis ?? TIER_TITLES[tier]}
      className={`text-[11px] px-2.5 py-1 font-black uppercase tracking-widest border-2 ${TIER_STYLES[tier] ?? TIER_STYLES.identified}`}
    >
      {tier}
    </span>
  );
}

// OP3 — buyer evidence-tier badge family (strongest applicable wins). Mirrors the /suppliers badges.
type EvidenceTier = 'proven_outcomes' | 'triple_proof' | 'proven_govt_delivery';

const EVIDENCE_TIER_META: Record<EvidenceTier, { label: string; title: string; className: string }> = {
  proven_outcomes: {
    label: 'Proven outcomes',
    title: 'Proven outcomes — justice/community delivery, a won federal contract, ACNC governance, PLUS cited evidence and measured outcomes (ALMA). The deepest delivery proof in the registry.',
    className: 'border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black',
  },
  triple_proof: {
    label: 'Triple-proof',
    title: 'Triple-proof — justice/community delivery, a won federal contract, AND ACNC charity governance. The deepest delivery evidence in the registry.',
    className: 'border-bauhaus-black bg-bauhaus-black text-bauhaus-yellow',
  },
  proven_govt_delivery: {
    label: 'Proven govt delivery',
    title: 'Proven govt delivery — both justice/community delivery and a won federal contract: documented capability on two independent registers.',
    className: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
  },
};

function EvidenceTierBadge({ tier }: { tier: EvidenceTier | null }) {
  if (!tier) return null;
  const m = EVIDENCE_TIER_META[tier];
  return (
    <span title={m.title} className={`text-[11px] px-2.5 py-1 font-black uppercase tracking-widest border-2 ${m.className}`}>
      {m.label}
    </span>
  );
}

// OP1 — Indigenous-proven badge. Orthogonal to the evidence-tier family above: a registered Indigenous
// corporation (ORIC) with a won federal contract can ALSO be proven-govt-delivery, so both badges show.
function IndigenousProvenBadge({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <span
      title="Indigenous-proven — a registered Indigenous corporation (ORIC) that has won a federal contract. Verified Indigenous-controlled supply with a proven government delivery record — exactly what a buyer with Indigenous Procurement Policy targets needs."
      className="text-[11px] px-2.5 py-1 font-black uppercase tracking-widest border-2 border-bauhaus-red bg-bauhaus-red text-bauhaus-canvas"
    >
      Indigenous-proven
    </span>
  );
}

// OP8 — the governance-deepened tier within the Indigenous axis: ORIC + federal contract + ACNC charity
// governance. Black-fill = the registry's "deepest" convention; red text/border keeps it on the Indigenous
// axis. Strongest-wins over the basic Indigenous-proven badge.
function IndigenousTripleProofBadge({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <span
      title="Indigenous triple-proof — a registered Indigenous corporation (ORIC) that has won a federal contract AND carries ACNC charity governance. Verified Indigenous-controlled supply with proven federal delivery that also clears a governance bar — the deepest Indigenous-procurement shortlist in the registry."
      className="text-[11px] px-2.5 py-1 font-black uppercase tracking-widest border-2 border-bauhaus-red bg-bauhaus-black text-bauhaus-red"
    >
      Indigenous triple-proof
    </span>
  );
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
  const key = body.replace(/_/g, '-');
  return labels[key] || body.replace(/[_-]/g, ' ');
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

// OP5 — one ALMA-documented program. Leads with the concrete, verifiable proof
// (counts + content of cited studies and measured outcomes); ALMA's evidence-level
// signal is shown as clearly-attributed assessment, never as a hard quality grade.
function EvidenceProgramCard({ program }: { program: AlmaEvidenceProgram }) {
  const { name, type, evidence_level, verification_status, evidence_count, outcome_count, evidence_items, outcome_items } = program;
  const hasDetail = evidence_items.length > 0 || outcome_items.length > 0;
  return (
    <div className="bg-white border-4 border-bauhaus-black p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-black text-bauhaus-black text-[15px] leading-snug">{name}</div>
          {type && <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-wider mt-0.5">{type}</div>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {evidence_count > 0 && (
            <span className="text-[11px] px-2 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue whitespace-nowrap">
              {evidence_count} cited {evidence_count === 1 ? 'study' : 'studies'}
            </span>
          )}
          {outcome_count > 0 && (
            <span className="text-[11px] px-2 py-1 font-black uppercase tracking-wider border-2 border-money bg-money-light text-money whitespace-nowrap">
              {outcome_count} measured {outcome_count === 1 ? 'outcome' : 'outcomes'}
            </span>
          )}
          {evidence_count === 0 && outcome_count === 0 && (
            <span className="text-[11px] px-2 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted">
              Documented
            </span>
          )}
        </div>
      </div>
      {evidence_level && (
        <div className="text-xs text-bauhaus-muted font-medium">
          ALMA assessment: <span className="font-bold text-bauhaus-black">{evidence_level}</span>
          {verification_status === 'verified' && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-money/40 bg-money-light text-money">verified</span>
          )}
        </div>
      )}
      {hasDetail && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
            Show evidence &amp; outcomes
          </summary>
          <div className="mt-3 space-y-3">
            {evidence_items.length > 0 && (
              <div>
                <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-2">Cited Evidence</div>
                <div className="space-y-2.5">
                  {evidence_items.map((e, i) => (
                    <div key={i} className="border-l-4 border-bauhaus-blue pl-3">
                      <div className="text-sm font-bold text-bauhaus-black">
                        {e.evidence_type || 'Study'}{e.methodology ? ` · ${e.methodology}` : ''}
                      </div>
                      <div className="text-xs text-bauhaus-muted font-medium flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {e.sample_size != null && <span>n = {e.sample_size.toLocaleString()}</span>}
                        {e.effect_size && <span>Effect: {e.effect_size}</span>}
                        {e.publication_date && <span>{new Date(e.publication_date).getFullYear()}</span>}
                        {e.author && <span>{e.author}</span>}
                      </div>
                      {e.findings && (
                        <p className="text-xs text-bauhaus-black/80 font-medium mt-1 leading-relaxed">
                          {e.findings}{e.findings.length >= 280 ? '…' : ''}
                        </p>
                      )}
                      {e.source_url && (
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
                          Source &rarr;
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {outcome_items.length > 0 && (
              <div>
                <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-2">Measured Outcomes</div>
                <div className="space-y-2.5">
                  {outcome_items.map((o, i) => (
                    <div key={i} className="border-l-4 border-money pl-3">
                      <div className="text-sm font-bold text-bauhaus-black">{o.outcome_type || o.name}</div>
                      {o.measurement_method && (
                        <p className="text-xs text-bauhaus-muted font-medium mt-0.5 leading-relaxed">{o.measurement_method}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
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

  // Normalise both certification shapes to one list for rendering
  const certEntries: Array<{ body: string; status?: string }> = (Array.isArray(enterprise.certifications) ? enterprise.certifications : [])
    .map((c) => (typeof c === 'string' ? { body: c } : c && typeof c === 'object' ? { body: c.body ?? '', status: c.status } : { body: '' }))
    .filter((c) => c.body);

  // Normalise both source shapes to one list for rendering
  const sourceEntries: Array<{ source: string; url?: string; scraped_at?: string }> = Array.isArray(enterprise.sources)
    ? enterprise.sources
    : enterprise.sources && typeof enterprise.sources === 'object'
      ? Object.entries(enterprise.sources).map(([source, v]) => ({ source: source.replace(/_/g, '-'), url: v?.url, scraped_at: v?.synced_at }))
      : [];

  // Evidence layer — everything joins on ABN
  const cleanAbn = enterprise.abn?.replace(/\s/g, '') ?? null;

  interface GraphEntity { id: string; gs_id: string; remoteness: string | null; seifa_irsd_decile: number | null; is_community_controlled: boolean | null; lga_name: string | null; postcode: string | null }
  interface ContractRow { title: string; contract_value: number; buyer_name: string; contract_start: string | null }
  interface JusticeRow { program_name: string; amount_dollars: number | null; financial_year: string | null; source: string; sector: string | null }

  let matchedCharity: { abn: string; name: string } | null = null;
  let graphEntity: GraphEntity | null = null;
  let contracts: ContractRow[] = [];
  let contractCount = 0;
  let justiceRows: JusticeRow[] = [];
  let evidencePrograms: AlmaEvidenceProgram[] = [];
  // OP3 — strongest applicable proof tier (one lookup; mv_justice_proven_suppliers carries the
  // has_acnc / has_alma_evidence_outcomes flags that distinguish all three tiers).
  let evidenceTier: EvidenceTier | null = null;
  // OP1 — Indigenous-proven: registered ORIC corp + federal contract (orthogonal to the tier above).
  // OP8 — Indigenous triple-proof: the above PLUS ACNC charity governance (deeper tier, strongest-wins).
  let indigenousProven = false;
  let indigenousTripleProof = false;

  // Grant matching runs on sector + place, not ABN — every profile gets it
  const grantMatchPromise = matchGrantsForSocialEnterprise(supabase, enterprise);

  if (cleanAbn) {
    const [charityRes, graphRes, contractRes, justiceRes, provenRes, indigenousRes] = await Promise.all([
      supabase.from('acnc_charities').select('abn, name').eq('abn', cleanAbn).maybeSingle(),
      supabase.from('gs_entities').select('id, gs_id, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, postcode').eq('abn', cleanAbn).not('gs_id', 'is', null).limit(1).maybeSingle(),
      supabase.from('austender_contracts').select('title, contract_value, buyer_name, contract_start', { count: 'exact' }).eq('supplier_abn', cleanAbn).not('contract_value', 'is', null).order('contract_value', { ascending: false }).limit(1000),
      supabase.from('justice_funding').select('program_name, amount_dollars, financial_year, source, sector').eq('recipient_abn', cleanAbn).order('amount_dollars', { ascending: false, nullsFirst: false }).limit(200),
      supabase.from('mv_justice_proven_suppliers').select('has_acnc, has_alma_evidence_outcomes').eq('abn', cleanAbn).maybeSingle(),
      supabase.from('mv_indigenous_proven_suppliers').select('abn, has_acnc').eq('abn', cleanAbn).maybeSingle(),
    ]);
    if (charityRes.data) matchedCharity = charityRes.data as { abn: string; name: string };
    if (graphRes.data) graphEntity = graphRes.data as GraphEntity;
    contracts = (contractRes.data || []) as ContractRow[];
    contractCount = contractRes.count ?? contracts.length;
    justiceRows = (justiceRes.data || []) as JusticeRow[];
    if (provenRes.data) {
      const p = provenRes.data as { has_acnc: boolean | null; has_alma_evidence_outcomes: boolean | null };
      evidenceTier = p.has_alma_evidence_outcomes ? 'proven_outcomes' : p.has_acnc ? 'triple_proof' : 'proven_govt_delivery';
    }
    if (indigenousRes.data) {
      indigenousProven = true;
      // OP8: ACNC governance upgrades it to the deeper Indigenous triple-proof tier.
      indigenousTripleProof = Boolean((indigenousRes.data as { has_acnc: boolean | null }).has_acnc);
    }
    // OP5 — ALMA evidence signals join on the entity UUID, so it runs once the
    // ABN→entity match resolves above.
    if (graphEntity?.id) {
      evidencePrograms = await getEntityEvidencePrograms(supabase, graphEntity.id);
    }
  }

  const { data: matchedGrants } = await grantMatchPromise;

  const contractTotal = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);
  const topBuyers = Object.entries(
    contracts.reduce<Record<string, number>>((acc, c) => {
      acc[c.buyer_name] = (acc[c.buyer_name] || 0) + (c.contract_value || 0);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const justiceTotal = justiceRows.reduce((sum, r) => sum + (r.amount_dollars || 0), 0);
  const justiceYears = [...new Set(justiceRows.map(r => r.financial_year).filter(Boolean))].sort();
  const evStudiesTotal = evidencePrograms.reduce((sum, p) => sum + p.evidence_count, 0);
  const evOutcomesTotal = evidencePrograms.reduce((sum, p) => sum + p.outcome_count, 0);

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
            <EvidenceTierBadge tier={evidenceTier} />
            <IndigenousTripleProofBadge shown={indigenousTripleProof} />
            <IndigenousProvenBadge shown={indigenousProven && !indigenousTripleProof} />
            <TierBadge tier={enterprise.verification_tier} basis={enterprise.verification_basis} />
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${orgTypeBadgeClass(enterprise.org_type)}`}>
              {orgTypeLabel(enterprise.org_type)}
            </span>
            {certEntries.map((cert, i) => (
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

      {/* Buyer action rail — the missing verb: collect this supplier toward a tender pack */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red mb-0.5">
            Buying from suppliers like this?
          </div>
          <p className="text-sm font-medium text-bauhaus-black max-w-xl">
            Shortlist this supplier and turn your picks into a tender-ready evidence pack —
            delivery records, compliance forecast and policy citations.
          </p>
        </div>
        <AddToPackButton
          item={{ se_id: enterprise.id, name: enterprise.name, abn: enterprise.abn, state: enterprise.state }}
          variant="profile"
        />
      </div>

      {/* Stats grid */}
      {(() => {
        const stats: Array<{ label: string; value: string }> = [];
        if (enterprise.legal_structure) stats.push({ label: 'Legal Structure', value: legalStructureLabel(enterprise.legal_structure) });
        if (enterprise.state) stats.push({ label: 'State', value: enterprise.state });
        if (certEntries.length > 0) stats.push({ label: 'Certifications', value: String(certEntries.length) });
        if (sourceEntries.length > 0) stats.push({ label: 'Listed In', value: `${sourceEntries.length} ${sourceEntries.length === 1 ? 'directory' : 'directories'}` });

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
          {(() => {
            // F7: lead with what the evidence proves, not an AI hedge. Suppress
            // descriptions that contradict the delivery record below them.
            const isHedge = isHedgeDescription(enterprise.description);
            const buyerLabel = topBuyers.length === 5 ? '5+ buyers' : `${topBuyers.length} buyer${topBuyers.length === 1 ? '' : 's'}`;
            const evidenceLead = contractCount > 0
              ? `Delivered ${money(contractTotal)}${contractCount > contracts.length ? '+' : ''} across ${contractCount.toLocaleString()} government contract${contractCount === 1 ? '' : 's'}${topBuyers.length > 0 ? ` for ${buyerLabel}` : ''}.`
              : null;
            const showDesc = Boolean(enterprise.description) && !isHedge;
            if (!evidenceLead && !showDesc) return null;
            return (
              <Section title="About">
                {evidenceLead && (
                  <p className="text-bauhaus-black leading-relaxed text-[15px] font-bold mb-2">{evidenceLead}</p>
                )}
                {showDesc && (
                  <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{enterprise.description}</p>
                )}
              </Section>
            );
          })()}

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

          {/* Delivery evidence — government contracts (AusTender) */}
          {cleanAbn && (
            <Section title="Delivery Evidence">
              {contractCount > 0 ? (
                <div className="bg-white border-4 border-bauhaus-black">
                  <div className="grid grid-cols-2 sm:grid-cols-3 border-b-4 border-bauhaus-black">
                    <div className="p-4 border-r-4 border-bauhaus-black">
                      <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-1">Govt Contracts</div>
                      <div className="text-xl font-black text-bauhaus-black">{contractCount.toLocaleString()}</div>
                    </div>
                    <div className="p-4 sm:border-r-4 border-bauhaus-black">
                      <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-1">Total Value</div>
                      <div className="text-xl font-black text-money">{money(contractTotal)}{contractCount > contracts.length ? '+' : ''}</div>
                    </div>
                    <div className="p-4 col-span-2 sm:col-span-1 border-t-4 sm:border-t-0 border-bauhaus-black">
                      <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-1">Buyers</div>
                      <div className="text-xl font-black text-bauhaus-black">{topBuyers.length === 5 ? '5+' : topBuyers.length}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-2">Largest Contracts</div>
                    <div className="space-y-2">
                      {contracts.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="font-bold text-bauhaus-black">{c.title}</span>
                            <span className="text-bauhaus-muted font-medium"> — {c.buyer_name}{c.contract_start ? `, ${new Date(c.contract_start).getFullYear()}` : ''}</span>
                          </div>
                          <span className="font-black text-money whitespace-nowrap">{money(c.contract_value)}</span>
                        </div>
                      ))}
                    </div>
                    {topBuyers.length > 1 && (
                      <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20">
                        <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-2">Top Buyers</div>
                        <div className="flex gap-1.5 flex-wrap">
                          {topBuyers.map(([buyer, value]) => (
                            <span key={buyer} className="text-xs px-2.5 py-1 bg-bauhaus-canvas text-bauhaus-black font-bold border-2 border-bauhaus-black/20">
                              {buyer} · {money(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-bauhaus-muted mt-3 font-medium">
                      Source: AusTender public contract notices. Values can include amendments and may not equal cash paid in a single year.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-bauhaus-muted font-medium">
                  No federal contract history found in AusTender for this ABN. Absence of a record is not absence of delivery — state and local procurement is not fully covered.
                </p>
              )}
            </Section>
          )}

          {/* Program evidence — ALMA-assessed delivery (OP5) */}
          {evidencePrograms.length > 0 && (
            <Section title="Program Evidence">
              <p className="text-xs text-bauhaus-muted font-medium mb-3 -mt-1">
                Programs this organisation runs that the Australian Living Map of Alternatives (ALMA)
                has documented — with the cited studies and measured outcomes behind them. ALMA&apos;s
                evidence assessment, linked by ABN; not a CivicGraph endorsement.
              </p>
              {(evStudiesTotal > 0 || evOutcomesTotal > 0) && (
                <div className="grid grid-cols-3 border-4 border-bauhaus-black mb-3">
                  <div className="p-3 border-r-4 border-bauhaus-black bg-white">
                    <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-1">Programs</div>
                    <div className="text-xl font-black text-bauhaus-black">{evidencePrograms.length}</div>
                  </div>
                  <div className="p-3 border-r-4 border-bauhaus-black bg-white">
                    <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-1">Cited Studies</div>
                    <div className="text-xl font-black text-bauhaus-blue">{evStudiesTotal}</div>
                  </div>
                  <div className="p-3 bg-white">
                    <div className="text-[11px] text-bauhaus-muted uppercase tracking-widest font-black mb-1">Measured Outcomes</div>
                    <div className="text-xl font-black text-money">{evOutcomesTotal}</div>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {evidencePrograms.map((p) => (
                  <EvidenceProgramCard key={p.id} program={p} />
                ))}
              </div>
              <p className="text-xs text-bauhaus-muted mt-3 font-medium">
                Source: Australian Living Map of Alternatives (ALMA), a curated evidence base of
                community programs. Programs are linked to this organisation by ABN; a program may be
                delivered by another part of the organisation.
              </p>
            </Section>
          )}

          {/* Grant funding history */}
          {cleanAbn && justiceRows.length > 0 && (
            <Section title="Grant Funding">
              <div className="bg-white border-4 border-bauhaus-black p-4">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-xl font-black text-money">{money(justiceTotal)}</span>
                  <span className="text-sm text-bauhaus-muted font-medium">
                    across {justiceRows.length}{justiceRows.length === 200 ? '+' : ''} tracked grants
                    {justiceYears.length > 0 && ` (${justiceYears[0]}–${justiceYears[justiceYears.length - 1]})`}
                  </span>
                </div>
                <div className="space-y-2">
                  {justiceRows.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-bold text-bauhaus-black">{r.program_name}</span>
                        <span className="text-bauhaus-muted font-medium">{r.financial_year ? ` — ${r.financial_year}` : ''}{r.sector ? ` · ${r.sector}` : ''}</span>
                      </div>
                      <span className="font-black text-money whitespace-nowrap">{r.amount_dollars ? money(r.amount_dollars) : '—'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-bauhaus-muted mt-3 font-medium">
                  Source: public funding datasets tracked by CivicGraph. Coverage is partial — this is a floor, not a total.
                </p>
              </div>
            </Section>
          )}

          {/* Open funding matched on sector + place */}
          {matchedGrants.length > 0 && (
            <Section title="Open Funding Matches">
              <p className="text-xs text-bauhaus-muted font-medium mb-2 -mt-1">
                For this enterprise — open grants it could apply for. Not part of buyer due diligence.
              </p>
              <div className="bg-white border-4 border-bauhaus-black">
                <div className="p-4 space-y-3">
                  {matchedGrants.map((g: MatchedGrant) => (
                    <div key={g.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <a href={`/grants/${g.id}`} className="font-bold text-bauhaus-blue hover:text-bauhaus-red">{g.name}</a>
                        <span className="text-bauhaus-muted font-medium">
                          {g.provider ? ` — ${g.provider}` : ''}
                          {g.closes_at ? ` · closes ${new Date(g.closes_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        </span>
                        {g.matched_on.length > 0 && (
                          <span className="ml-2 inline-flex gap-1 flex-wrap align-middle">
                            {g.matched_on.slice(0, 3).map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 bg-link-light text-bauhaus-blue font-black uppercase tracking-wider border border-bauhaus-blue/20">{c}</span>
                            ))}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-money whitespace-nowrap">
                        {g.amount_max ? `to ${money(g.amount_max)}` : g.amount_min ? `from ${money(g.amount_min)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-bauhaus-muted px-4 pb-4 font-medium">
                  Automated match on sector and location against open grants tracked by CivicGraph. Eligibility is not assessed — always check each grant&apos;s criteria.
                </p>
              </div>
            </Section>
          )}

          {/* No ABN — evidence layer unavailable */}
          {!cleanAbn && (
            <Section title="Delivery Evidence">
              <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4">
                <p className="text-sm text-bauhaus-muted font-medium">
                  No ABN on record, so this profile cannot be joined to public contract or grant evidence yet.
                </p>
                <a
                  href={`/giving/corrections?target_type=social_enterprise&target_id=${enterprise.id}&claim_url=${encodeURIComponent(`/social-enterprises/${enterprise.id}`)}`}
                  className="text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-widest mt-2 inline-block"
                >
                  Know the ABN? Submit a correction &rarr;
                </a>
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

          {/* Place context from the entity graph */}
          {graphEntity && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Place Context</h3>
              <div className="space-y-2 text-sm">
                {graphEntity.lga_name && (
                  <div className="flex justify-between gap-2">
                    <span className="text-bauhaus-muted font-medium">LGA</span>
                    <span className="font-bold text-bauhaus-black text-right">{graphEntity.lga_name}</span>
                  </div>
                )}
                {graphEntity.remoteness && (
                  <div className="flex justify-between gap-2">
                    <span className="text-bauhaus-muted font-medium">Remoteness</span>
                    <span className="font-bold text-bauhaus-black text-right">{graphEntity.remoteness}</span>
                  </div>
                )}
                {graphEntity.seifa_irsd_decile != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-bauhaus-muted font-medium">SEIFA Decile</span>
                    <span className="font-bold text-bauhaus-black">{graphEntity.seifa_irsd_decile}/10</span>
                  </div>
                )}
                {graphEntity.is_community_controlled && (
                  <div className="text-xs px-2.5 py-1 bg-bauhaus-red/10 text-bauhaus-red font-black border-2 border-bauhaus-red uppercase tracking-widest inline-block">
                    Community Controlled
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20 space-y-1.5">
                {(graphEntity.postcode || enterprise.postcode) && (
                  <a href={`/places/${graphEntity.postcode || enterprise.postcode}`} className="text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-widest block">
                    Place Dossier &rarr;
                  </a>
                )}
                <a href={`/entities/${graphEntity.gs_id}`} className="text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-widest block">
                  Full Entity Dossier &rarr;
                </a>
              </div>
            </div>
          )}

          {/* Verification tier */}
          {enterprise.verification_tier && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Verification</h3>
              <div className="mb-2">
                <TierBadge tier={enterprise.verification_tier} basis={enterprise.verification_basis} />
              </div>
              <p className="text-sm text-bauhaus-black font-medium">
                {enterprise.verification_basis ?? TIER_TITLES[enterprise.verification_tier]}
              </p>
              <p className="text-xs text-bauhaus-muted mt-2 font-medium">
                Tier reflects the strength of external verification, not how &ldquo;social&rdquo; an
                enterprise is. Marks belong to their issuing bodies.
                {enterprise.verification_computed_at && (
                  <> Checked {new Date(enterprise.verification_computed_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'short' })}.</>
                )}
              </p>
              {enterprise.verification_tier === 'identified' && (
                <a
                  href={`/giving/corrections?target_type=social_enterprise&target_id=${enterprise.id}&claim_url=${encodeURIComponent(`/social-enterprises/${enterprise.id}`)}`}
                  className="text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-widest mt-2 inline-block"
                >
                  Claim and strengthen this profile &rarr;
                </a>
              )}
            </div>
          )}

          {/* Certifications detail */}
          {certEntries.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Certifications</h3>
              <div className="space-y-2">
                {certEntries.map((cert, i) => (
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
            {sourceEntries.map((src, i) => (
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

          {/* Claim this profile — owner-facing, demoted below buyer-relevant evidence (F6) */}
          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4">
            <h3 className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Is this your enterprise?</h3>
            <p className="text-sm text-bauhaus-black font-medium leading-relaxed mb-3">
              Claim this profile to correct details, add your ABN or certifications, and strengthen your evidence record.
            </p>
            <a
              href={`/giving/corrections?target_type=social_enterprise&target_id=${enterprise.id}&claim_url=${encodeURIComponent(`/social-enterprises/${enterprise.id}`)}`}
              className="inline-block border-4 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
            >
              Claim this profile &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
