'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import Link from 'next/link';
import { SlidePanel, SlidePanelHeader, SlidePanelBody } from './slide-panel';

/* ── Preview data shapes (serializable) ── */

export interface GrantPreviewData {
  id: string;
  name: string;
  provider: string | null;
  description?: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  url?: string | null;
  source?: string | null;
}

export interface FoundationPreviewData {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  website?: string | null;
}

export interface EntityPreviewData {
  gs_id: string;
  name: string;
  entity_type: string | null;
  abn: string | null;
  description?: string | null;
  website?: string | null;
  state: string | null;
  postcode?: string | null;
  lga_name?: string | null;
  remoteness?: string | null;
  seifa_irsd_decile?: number | null;
  sector: string | null;
  sub_sector?: string | null;
  tags?: string[];
  source_datasets?: string[];
  confidence?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  is_community_controlled?: boolean | null;
  source_count: number | null;
  latest_revenue: number | null;
  latest_assets: number | null;
  total_donated?: number | null;
  total_contract_value?: number | null;
  donation_count?: number | null;
  contract_count?: number | null;
  foundation_profile?: EntityFoundationProfile | null;
}

export interface EntityFoundationProfile {
  id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  total_giving_annual?: number | null;
  avg_grant_size?: number | null;
  grant_range_min?: number | null;
  grant_range_max?: number | null;
  thematic_focus?: string[];
  geographic_focus?: string[];
  target_recipients?: string[];
  application_tips?: string | null;
  profile_confidence?: string | null;
  last_scraped_at?: string | null;
}

type PreviewState =
  | { kind: 'grant'; data: GrantPreviewData }
  | { kind: 'foundation'; data: FoundationPreviewData }
  | { kind: 'entity'; data: EntityPreviewData }
  | null;

/* ── Context ── */

const PreviewCtx = createContext<{
  open: (state: PreviewState) => void;
  activeKey: string | null;
}>({ open: () => {}, activeKey: null });

function previewKey(state: PreviewState): string | null {
  if (!state) return null;
  if (state.kind === 'grant') return `grant:${state.data.id}`;
  if (state.kind === 'foundation') return `foundation:${state.data.id}`;
  return `entity:${state.data.gs_id}`;
}

/* ── Provider — wraps a list page, renders the single panel ── */

export function ListPreviewProvider({ children }: { children: React.ReactNode }) {
  const [preview, setPreview] = useState<PreviewState>(null);
  const close = useCallback(() => setPreview(null), []);
  const activeKey = previewKey(preview);

  return (
    <PreviewCtx.Provider value={{ open: setPreview, activeKey }}>
      {children}

      {/* Grant panel */}
      <SlidePanel open={preview?.kind === 'grant'} onClose={close}>
        {preview?.kind === 'grant' && (
          <>
            <SlidePanelHeader
              onClose={close}
              href={preview.data.source === 'act_pipeline' ? '/org/act#project-pipeline' : `/grants/${preview.data.id}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Grant Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <GrantPanelContent grant={preview.data} />
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>

      {/* Foundation panel */}
      <SlidePanel open={preview?.kind === 'foundation'} onClose={close}>
        {preview?.kind === 'foundation' && (
          <>
            <SlidePanelHeader onClose={close} href={`/foundations/${preview.data.id}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Foundation Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <FoundationPanelContent foundation={preview.data} />
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>

      {/* Entity panel */}
      <SlidePanel open={preview?.kind === 'entity'} onClose={close}>
        {preview?.kind === 'entity' && (
          <>
            <SlidePanelHeader onClose={close} href={`/entities/${preview.data.gs_id}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Entity Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <EntityPanelContent entity={preview.data} />
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>
    </PreviewCtx.Provider>
  );
}

/* ── Trigger components — replace <a> around list items ── */

export function GrantPreviewTrigger({
  grant,
  children,
}: {
  grant: GrantPreviewData;
  children: React.ReactNode;
}) {
  const { open, activeKey } = useContext(PreviewCtx);
  const active = activeKey === `grant:${grant.id}`;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className="cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bauhaus-black"
      style={active ? { background: '#F5F3F0', boxShadow: 'inset 4px 0 0 #111111' } : undefined}
      onClick={() => open({ kind: 'grant', data: grant })}
      onKeyDown={(e) => { if (e.key === 'Enter') open({ kind: 'grant', data: grant }); }}
    >
      {children}
    </div>
  );
}

export function FoundationPreviewTrigger({
  foundation,
  children,
}: {
  foundation: FoundationPreviewData;
  children: React.ReactNode;
}) {
  const { open, activeKey } = useContext(PreviewCtx);
  const active = activeKey === `foundation:${foundation.id}`;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className="cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bauhaus-black"
      style={active ? { background: '#F5F3F0', boxShadow: 'inset 4px 0 0 #111111' } : undefined}
      onClick={() => open({ kind: 'foundation', data: foundation })}
      onKeyDown={(e) => { if (e.key === 'Enter') open({ kind: 'foundation', data: foundation }); }}
    >
      {children}
    </div>
  );
}

export function EntityPreviewTrigger({
  entity,
  children,
}: {
  entity: EntityPreviewData;
  children: React.ReactNode;
}) {
  const { open, activeKey } = useContext(PreviewCtx);
  const active = activeKey === `entity:${entity.gs_id}`;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className="cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bauhaus-black"
      style={active ? { background: '#F5F3F0', boxShadow: 'inset 4px 0 0 #111111' } : undefined}
      onClick={() => open({ kind: 'entity', data: entity })}
      onKeyDown={(e) => { if (e.key === 'Enter') open({ kind: 'entity', data: entity }); }}
    >
      {children}
    </div>
  );
}

/* ── Panel content ── */

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Ongoing';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactTextParts(values: Array<string | number | boolean | null | undefined>): string {
  return values
    .filter((value): value is string | number | boolean => value !== null && value !== undefined && value !== '')
    .map(String)
    .join(' ');
}

function entitySignalText(entity: EntityPreviewData): string {
  return compactTextParts([
    entity.name,
    entity.description,
    entity.entity_type,
    entity.sector,
    entity.sub_sector,
    entity.state,
    entity.remoteness,
    entity.lga_name,
    ...(entity.tags || []),
    ...(entity.source_datasets || []),
    entity.foundation_profile?.description,
    ...(entity.foundation_profile?.thematic_focus || []),
    ...(entity.foundation_profile?.geographic_focus || []),
    ...(entity.foundation_profile?.target_recipients || []),
    entity.foundation_profile?.application_tips,
  ]).toLowerCase();
}

function matchAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

function entityActLenses(entity: EntityPreviewData): Array<{ label: string; reason: string }> {
  const text = entitySignalText(entity);
  const lenses: Array<{ label: string; reason: string }> = [];

  if (matchAny(text, ['indigenous', 'first nations', 'aboriginal', 'torres strait', 'remote', 'rural_remote', 'regional', 'equipment', 'health', 'disability', 'housing', 'supplies', 'procurement'])) {
    lenses.push({ label: 'Goods', reason: 'Remote, health, equipment, disability, or First Nations signal.' });
  }
  if (matchAny(text, ['youth', 'justice', 'community safety', 'disadvantaged', 'indigenous', 'first nations', 'rehabilitation', 'diversion', 'police'])) {
    lenses.push({ label: 'JusticeHub', reason: 'Youth, justice, safety, disadvantaged, or First Nations signal.' });
  }
  if (matchAny(text, ['story', 'storytelling', 'lived experience', 'advocacy', 'arts', 'language', 'culture', 'community voice', 'narrative'])) {
    lenses.push({ label: 'Empathy Ledger', reason: 'Narrative, advocacy, culture, or lived-experience signal.' });
  }
  if (entity.contract_count || entity.total_contract_value || matchAny(text, ['government', 'contract', 'tender', 'supplier', 'procurement'])) {
    lenses.push({ label: 'CivicGraph', reason: 'Relationship, procurement, or public-money due diligence signal.' });
  }

  return lenses.slice(0, 4);
}

function profileEvidence(entity: EntityPreviewData): { label: string; tone: 'good' | 'watch' | 'thin'; detail: string } {
  const foundation = entity.foundation_profile;
  if (foundation?.profile_confidence === 'high' || (entity.source_count || 0) >= 4) {
    return { label: 'Good evidence', tone: 'good', detail: 'Enough data to qualify before opening the full dossier.' };
  }
  if (foundation || (entity.source_count || 0) >= 2) {
    return { label: 'Scout before ask', tone: 'watch', detail: 'Useful signals exist, but profile confidence is still thin.' };
  }
  return { label: 'Thin profile', tone: 'thin', detail: 'Treat as a lead until source pages or public records are checked.' };
}

function recommendedNextStep(entity: EntityPreviewData): { title: string; detail: string } {
  const lenses = entityActLenses(entity);
  const foundation = entity.foundation_profile;

  if (!foundation && (entity.entity_type === 'foundation' || entity.entity_type === 'trust')) {
    return {
      title: 'Scout source first',
      detail: 'Find the public website, ACNC context, giving focus, and a contact path before progressing.',
    };
  }
  if (foundation?.profile_confidence === 'low') {
    return {
      title: 'Qualify, do not pitch yet',
      detail: 'The foundation profile is low confidence. Use it to decide whether a deeper source check is worth it.',
    };
  }
  if (lenses.length > 0) {
    return {
      title: `Check ${lenses[0].label} fit`,
      detail: `Open the dossier if this could support ${lenses.map(lens => lens.label).join(', ')}.`,
    };
  }
  if (entity.contract_count || entity.total_contract_value) {
    return {
      title: 'Review money trail',
      detail: 'This has contract or donation signal. Check relationships before outreach.',
    };
  }
  return {
    title: 'Park unless strategically named',
    detail: 'No clear ACT lens yet. Keep it searchable, but do not spend human review time unless it appears in a current pathway.',
  };
}

function DetailCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--ws-surface-2)' }}>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>{label}</p>
      <p className="text-sm font-medium capitalize" style={{ color: highlight ? 'var(--ws-red)' : 'var(--ws-text)' }}>{value}</p>
    </div>
  );
}

function SaveToPipelineButton({ grantId }: { grantId: string }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async () => {
    setStatus('saving');
    try {
      const res = await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'discovered' }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setStatus('saved');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  if (status === 'saved') {
    return (
      <span
        className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-1.5"
        style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--ws-green, #16a34a)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Saved to Pipeline
      </span>
    );
  }

  return (
    <button
      onClick={save}
      disabled={status === 'saving'}
      className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border cursor-pointer disabled:opacity-50"
      style={{ borderColor: 'var(--ws-accent)', color: 'var(--ws-accent)' }}
    >
      {status === 'saving' ? 'Saving\u2026' : status === 'error' ? 'Failed \u2014 Retry' : 'Save to Pipeline'}
    </button>
  );
}

function GrantPanelContent({ grant }: { grant: GrantPreviewData }) {
  const closing = grant.closes_at ? daysUntil(grant.closes_at) : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>{grant.name}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--ws-text-secondary)' }}>{grant.provider}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailCell label="Amount" value={
          grant.amount_min && grant.amount_max
            ? `${formatMoney(grant.amount_min)} \u2013 ${formatMoney(grant.amount_max)}`
            : grant.amount_max ? `Up to ${formatMoney(grant.amount_max)}`
            : grant.amount_min ? `From ${formatMoney(grant.amount_min)}`
            : 'Not specified'
        } />
        <DetailCell label="Closes" value={formatDate(grant.closes_at)} highlight={closing != null && closing <= 7} />
      </div>

      {grant.description && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--ws-text-tertiary)' }}>Description</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ws-text-secondary)' }}>
            {grant.description.length > 400 ? grant.description.slice(0, 400) + '\u2026' : grant.description}
          </p>
        </div>
      )}

      {grant.categories.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueLabels(grant.categories).map(c => (
              <span key={c} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {closing != null && closing <= 14 && (
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-3"
          style={{ background: closing <= 7 ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)' }}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: closing <= 7 ? 'var(--ws-red)' : 'var(--ws-amber)' }} />
          <p className="text-sm font-medium" style={{ color: closing <= 7 ? 'var(--ws-red)' : 'var(--ws-amber)' }}>
            {closing === 0 ? 'Closes today' : `${closing} days remaining`}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {grant.source === 'act_pipeline' ? (
          <Link href="/org/act#project-pipeline" className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
            Open ACT Pipeline
          </Link>
        ) : (
          <>
            <SaveToPipelineButton grantId={grant.id} />
            <Link href={`/grants/${grant.id}`} className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
              Full Details
            </Link>
          </>
        )}
        {grant.url && (
          <a href={grant.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
            Source
          </a>
        )}
      </div>
    </div>
  );
}

function FoundationPanelContent({ foundation }: { foundation: FoundationPreviewData }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>{foundation.name}</h2>
        {foundation.type && (
          <p className="text-sm mt-1 capitalize" style={{ color: 'var(--ws-text-secondary)' }}>
            {foundation.type.replace(/_/g, ' ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailCell label="Annual Giving" value={
          foundation.total_giving_annual ? `${formatMoney(foundation.total_giving_annual)}/yr` : 'Unknown'
        } />
        <DetailCell label="Type" value={foundation.type ? foundation.type.replace(/_/g, ' ') : 'Foundation'} />
      </div>

      {foundation.description && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--ws-text-tertiary)' }}>About</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ws-text-secondary)' }}>
            {foundation.description.length > 400 ? foundation.description.slice(0, 400) + '\u2026' : foundation.description}
          </p>
        </div>
      )}

      {foundation.thematic_focus.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>Thematic Focus</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueLabels(foundation.thematic_focus).map(t => (
              <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {foundation.geographic_focus.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>Geographic Focus</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueLabels(foundation.geographic_focus).map(g => (
              <span key={g} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}>{g}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href={`/foundations/${foundation.id}`} className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
          View Full Profile
        </Link>
        {foundation.website && (
          <a href={foundation.website} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
            Website
          </a>
        )}
      </div>
    </div>
  );
}

function EntityPanelContent({ entity }: { entity: EntityPreviewData }) {
  const entityType = entity.entity_type ? entity.entity_type.replace(/_/g, ' ') : 'Entity';
  const foundation = entity.foundation_profile;
  const lenses = entityActLenses(entity);
  const evidence = profileEvidence(entity);
  const nextStep = recommendedNextStep(entity);
  const relationshipSignals = [
    entity.donation_count ? `${entity.donation_count} political donation${entity.donation_count === 1 ? '' : 's'}` : null,
    entity.contract_count ? `${entity.contract_count} government contract${entity.contract_count === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  const place = compactTextParts([entity.lga_name, entity.state, entity.remoteness]).replaceAll(' ', ' ');
  const focusTags = uniqueLabels([
    ...(entity.tags || []),
    ...(foundation?.thematic_focus || []),
    ...(foundation?.target_recipients || []),
  ]);
  const grantRange = foundation?.grant_range_min || foundation?.grant_range_max
    ? foundation.grant_range_min && foundation.grant_range_max
      ? `${formatMoney(foundation.grant_range_min)} - ${formatMoney(foundation.grant_range_max)}`
      : foundation.grant_range_max
        ? `Up to ${formatMoney(foundation.grant_range_max)}`
        : `From ${formatMoney(foundation.grant_range_min || null)}`
    : null;
  const evidenceColors = {
    good: { bg: 'rgba(22,163,74,0.09)', border: 'rgba(22,163,74,0.35)', text: 'var(--ws-green)' },
    watch: { bg: 'rgba(217,119,6,0.09)', border: 'rgba(217,119,6,0.35)', text: 'var(--ws-amber)' },
    thin: { bg: 'var(--ws-surface-2)', border: 'var(--ws-border)', text: 'var(--ws-text-secondary)' },
  }[evidence.tone];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>{entity.name}</h2>
        <p className="text-sm mt-1 capitalize" style={{ color: 'var(--ws-text-secondary)' }}>
          {entityType}
          {entity.state ? ` · ${entity.state}` : ''}
          {entity.sector ? ` · ${entity.sector}` : ''}
        </p>
      </div>

      <div className="border px-3 py-3" style={{ borderColor: evidenceColors.border, background: evidenceColors.bg }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: evidenceColors.text }}>
              {evidence.label}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>
              {nextStep.title}
            </p>
          </div>
          <span className="shrink-0 border px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ borderColor: evidenceColors.border, color: evidenceColors.text }}>
            Decide
          </span>
        </div>
        <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
          {nextStep.detail} {evidence.detail}
        </p>
      </div>

      {lenses.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>ACT lenses</p>
          <div className="space-y-2">
            {lenses.map(lens => (
              <div key={lens.label} className="border px-3 py-2" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-2)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>{lens.label}</p>
                <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{lens.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <DetailCell label="ABN" value={entity.abn || 'Not recorded'} />
        <DetailCell label="Sources" value={entity.source_count != null ? String(entity.source_count) : 'Unknown'} />
        <DetailCell label={foundation ? 'Annual Giving' : 'Revenue'} value={
          foundation?.total_giving_annual ? `${formatMoney(foundation.total_giving_annual)}/yr` : entity.latest_revenue ? formatMoney(entity.latest_revenue) : 'Unknown'
        } />
        <DetailCell label={grantRange ? 'Grant Range' : 'Assets'} value={grantRange || (entity.latest_assets ? formatMoney(entity.latest_assets) : 'Unknown')} />
      </div>

      {(foundation?.application_tips || foundation?.description || entity.description) && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--ws-text-tertiary)' }}>
            Decision notes
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ws-text-secondary)' }}>
            {(foundation?.application_tips || foundation?.description || entity.description || '').slice(0, 520)}
            {(foundation?.application_tips || foundation?.description || entity.description || '').length > 520 ? '...' : ''}
          </p>
        </div>
      )}

      {focusTags.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>Focus and recipients</p>
          <div className="flex flex-wrap gap-1.5">
            {focusTags.slice(0, 10).map(tag => (
              <span key={tag} className="text-xs font-medium px-2.5 py-1" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}>
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <DetailCell label="Confidence" value={foundation?.profile_confidence || entity.confidence || 'Unknown'} />
        <DetailCell label="Place" value={place || entity.postcode || 'Not recorded'} />
      </div>

      {(entity.total_donated || entity.total_contract_value || relationshipSignals.length > 0) && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>Power and Money Signals</p>
          <div className="grid grid-cols-2 gap-3">
            <DetailCell label="Donated" value={entity.total_donated ? formatMoney(entity.total_donated) : 'None visible'} />
            <DetailCell label="Contracts" value={entity.total_contract_value ? formatMoney(entity.total_contract_value) : 'None visible'} />
          </div>
          {relationshipSignals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {relationshipSignals.map(signal => (
                <span key={signal} className="text-xs font-medium px-2.5 py-1" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}>
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--ws-text-tertiary)' }}>Source trail</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ws-text-secondary)' }}>
          {(entity.source_datasets || []).length > 0
            ? `Seen in ${(entity.source_datasets || []).slice(0, 4).join(', ')}${(entity.source_datasets || []).length > 4 ? '...' : ''}.`
            : 'Source datasets are not recorded on this row.'}
          {foundation?.last_scraped_at ? ` Foundation profile refreshed ${formatDate(foundation.last_scraped_at)}.` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Link href={`/entities/${entity.gs_id}`} className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
          Open Dossier
        </Link>
        <Link href={`/entities/${entity.gs_id}/due-diligence`} className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
          Due Diligence
        </Link>
        {(foundation?.website || entity.website) && (
          <a href={foundation?.website || entity.website || '#'} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
            Website
          </a>
        )}
      </div>
    </div>
  );
}
