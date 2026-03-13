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

type PreviewState =
  | { kind: 'grant'; data: GrantPreviewData }
  | { kind: 'foundation'; data: FoundationPreviewData }
  | null;

/* ── Context ── */

const PreviewCtx = createContext<{
  open: (state: PreviewState) => void;
}>({ open: () => {} });

/* ── Provider — wraps a list page, renders the single panel ── */

export function ListPreviewProvider({ children }: { children: React.ReactNode }) {
  const [preview, setPreview] = useState<PreviewState>(null);
  const close = useCallback(() => setPreview(null), []);

  return (
    <PreviewCtx.Provider value={{ open: setPreview }}>
      {children}

      {/* Grant panel */}
      <SlidePanel open={preview?.kind === 'grant'} onClose={close}>
        {preview?.kind === 'grant' && (
          <>
            <SlidePanelHeader onClose={close} href={`/grants/${preview.data.id}`}>
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
  const { open } = useContext(PreviewCtx);
  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer"
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
  const { open } = useContext(PreviewCtx);
  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      onClick={() => open({ kind: 'foundation', data: foundation })}
      onKeyDown={(e) => { if (e.key === 'Enter') open({ kind: 'foundation', data: foundation }); }}
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
            {grant.categories.map(c => (
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
        <SaveToPipelineButton grantId={grant.id} />
        <Link href={`/grants/${grant.id}`} className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
          Full Details
        </Link>
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
            {foundation.thematic_focus.map(t => (
              <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {foundation.geographic_focus.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>Geographic Focus</p>
          <div className="flex flex-wrap gap-1.5">
            {foundation.geographic_focus.map(g => (
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
