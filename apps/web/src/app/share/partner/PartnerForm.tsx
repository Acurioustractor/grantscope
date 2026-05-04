'use client';

import { useState, useTransition } from 'react';
import { submitPartnership } from './actions';

const PARTNERSHIP_TYPES = [
  { v: 'foundation_cofund', label: 'Foundation co-funding a sector report' },
  { v: 'acco_bespoke', label: 'ACCO / community-controlled org wanting our own version' },
  { v: 'sector_peak', label: 'Sector peak / advocacy body — pitching system change' },
  { v: 'journalist', label: 'Journalist on a story' },
  { v: 'researcher', label: 'Researcher / academic — dataset access' },
  { v: 'gov_oversight', label: 'Government / oversight body' },
  { v: 'philanthropic_advisor', label: 'Philanthropic advisor — diligence on a grantee' },
  { v: 'board_director', label: 'Board director — strategic review' },
  { v: 'other', label: 'Something else (describe below)' },
];

const BUDGET_BANDS = [
  { v: 'unsure', label: 'Not sure yet' },
  { v: 'under_5k', label: 'Under $5k' },
  { v: '5_25k', label: '$5k – $25k' },
  { v: '25_100k', label: '$25k – $100k' },
  { v: '100k_plus', label: '$100k+' },
  { v: 'in_kind', label: 'In-kind / non-financial' },
];

const TIMELINES = [
  { v: 'this_quarter', label: 'This quarter' },
  { v: 'next_quarter', label: 'Next 3–6 months' },
  { v: 'this_year', label: 'Within 12 months' },
  { v: 'exploring', label: 'Just exploring' },
];

const inputCls = 'w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-yellow';
const labelCls = 'text-xs font-black uppercase tracking-widest text-bauhaus-black mb-1 block';
const sectionCls = 'border-4 border-bauhaus-black p-6 bg-white space-y-4';
const legendCls = 'text-sm font-black uppercase tracking-widest text-bauhaus-yellow mb-3 border-b-2 border-bauhaus-yellow pb-2 w-full';

export default function PartnerForm({ sourceArtefact }: { sourceArtefact?: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string; id?: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('source_path', typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');
    fd.set('source_referrer', typeof document !== 'undefined' ? document.referrer : '');
    fd.set('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
    startTransition(async () => {
      const r = await submitPartnership(fd);
      setResult(r);
      if (r.ok) form.reset();
    });
  }

  if (result?.ok) {
    return (
      <div className="border-4 border-bauhaus-blue p-8 bg-white max-w-3xl">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">✓ Inquiry received</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Got it. We&apos;ll reply within 2 business days.</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed mb-3">
          Ben (Benjamin@act.place) reads every partnership inquiry personally. Expect a real reply, not an autoresponder.
        </p>
        {result.id && (
          <p className="text-xs font-mono text-bauhaus-muted">Reference: {result.id.slice(0, 8)}…</p>
        )}
        <div className="mt-6 pt-6 border-t-2 border-bauhaus-black">
          <p className="text-sm text-bauhaus-black font-medium mb-3">In the meantime:</p>
          <div className="flex flex-wrap gap-2">
            {sourceArtefact && (
              <a href={`/share/${sourceArtefact}`} className="inline-block px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas">← Back to the report</a>
            )}
            <a href="/share/qld-youth-justice/long-read" className="inline-block px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas">Read the long-form companion</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      {sourceArtefact && <input type="hidden" name="source_artefact" value={sourceArtefact} />}

      <fieldset className={sectionCls}>
        <legend className={legendCls}>What kind of partnership?</legend>
        <p className="text-xs text-bauhaus-muted font-mono">Tick all that apply. We&apos;ll reply with the right person to talk to.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PARTNERSHIP_TYPES.map(o => (
            <label key={o.v} className="flex items-start gap-2 text-sm font-medium text-bauhaus-black cursor-pointer p-2 border-2 border-bauhaus-black bg-bauhaus-canvas hover:bg-white">
              <input type="checkbox" name="partnership_types" value={o.v} className="mt-1 border-2 border-bauhaus-black w-4 h-4 shrink-0" />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        <div>
          <label className={labelCls} htmlFor="partnership_other">If other, describe</label>
          <input id="partnership_other" name="partnership_other" type="text" className={inputCls} placeholder="e.g. funder collective, university unit, community of practice" />
        </div>
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>What are you trying to do?</legend>
        <p className="text-xs text-bauhaus-muted font-mono">A sentence or two is enough. Specifics help — sectors, geographies, decisions you&apos;re trying to inform.</p>
        <div>
          <label className={labelCls} htmlFor="message">Tell us about it <span className="text-bauhaus-red">*</span></label>
          <textarea id="message" name="message" required rows={5} className={inputCls} placeholder="e.g. We're a foundation with $X to deploy on First Nations youth-justice in QLD. We want a quarterly version of this report tracking ACCO funding share over time so our board can hold a portfolio strategy accountable." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="budget_band">Budget band (optional)</label>
            <select id="budget_band" name="budget_band" className={inputCls}>
              <option value="">Select…</option>
              {BUDGET_BANDS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="timeline">Timeline (optional)</label>
            <select id="timeline" name="timeline" className={inputCls}>
              <option value="">Select…</option>
              {TIMELINES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>How do we reach you?</legend>
        <p className="text-xs text-bauhaus-muted font-mono">Required for partnership inquiries — we need a way to reply.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="contact_name">Your name <span className="text-bauhaus-red">*</span></label>
            <input id="contact_name" name="contact_name" required type="text" className={inputCls} autoComplete="name" />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_email">Email <span className="text-bauhaus-red">*</span></label>
            <input id="contact_email" name="contact_email" required type="email" className={inputCls} autoComplete="email" />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_org">Organisation</label>
            <input id="contact_org" name="contact_org" type="text" className={inputCls} autoComplete="organization" />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_role">Your role</label>
            <input id="contact_role" name="contact_role" type="text" className={inputCls} autoComplete="organization-title" placeholder="e.g. Program Manager, Director, Reporter" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="contact_phone">Phone (optional)</label>
            <input id="contact_phone" name="contact_phone" type="tel" className={inputCls} autoComplete="tel" />
          </div>
        </div>
      </fieldset>

      {result?.error && (
        <div className="border-4 border-bauhaus-red p-4 bg-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">⚠ Submission failed</div>
          <p className="text-sm text-bauhaus-black font-medium">{result.error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="px-6 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-4 border-bauhaus-black hover:bg-bauhaus-red disabled:opacity-50 disabled:cursor-not-allowed">
          {pending ? 'Sending…' : 'Send partnership inquiry →'}
        </button>
        <p className="text-xs font-mono text-bauhaus-muted">Replies within 2 business days from Ben directly.</p>
      </div>
    </form>
  );
}
