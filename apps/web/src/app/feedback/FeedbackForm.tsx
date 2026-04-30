'use client';

import { useState, useTransition } from 'react';
import { submitFeedback } from './actions';

const VALUE_SIGNALS = [
  { v: 'would_pay', label: 'I would pay for this' },
  { v: 'would_recommend', label: 'I would recommend this to colleagues' },
  { v: 'would_change_decision', label: 'This would change a decision I am making' },
  { v: 'want_for_my_org', label: "I'd want this for my organisation" },
  { v: 'want_for_my_sector', label: "I'd want this for my sector" },
  { v: 'interesting_not_actionable', label: 'Interesting but not actionable for me' },
  { v: 'not_sure_what_for', label: "I'm not sure what this is for" },
];

const TOPICS_WANTED = [
  { v: 'more_charities', label: 'More charities profiled' },
  { v: 'sector_mappings', label: 'Sector-level mappings' },
  { v: 'first_peoples', label: 'First Peoples / Treaty organisations' },
  { v: 'foundations', label: 'Foundations + grant-making bodies' },
  { v: 'federal_procurement', label: 'Federal procurement deeper dive' },
  { v: 'state_grants', label: 'State government grant flows' },
  { v: 'local_council', label: 'Local council spend + grants' },
  { v: 'lobbyists', label: 'Lobbyist registers' },
  { v: 'donations', label: 'Political donations' },
  { v: 'director_interlocks', label: 'Director / board interlocks' },
  { v: 'funder_dependency', label: 'Funder dependency stress-testing' },
  { v: 'peer_comparisons', label: 'Comparison reports (org vs peers)' },
  { v: 'geographic_lga', label: 'Geographic / LGA-level views' },
  { v: 'cald_demographics', label: 'CALD / demographic overlays' },
  { v: 'monitoring', label: 'Live monitoring + change alerts' },
  { v: 'director_tenure', label: 'Director tenure + appointment dates' },
];

const USE_CASES = [
  { v: 'board_strategy', label: "I'm on a board doing strategic review" },
  { v: 'foundation_diligence', label: "I'm a foundation doing grantee diligence" },
  { v: 'journalist', label: "I'm a journalist" },
  { v: 'researcher', label: "I'm an academic / researcher" },
  { v: 'peak_body', label: "I'm a peak body / sector secretariat" },
  { v: 'govt_oversight', label: "I'm a government oversight body" },
  { v: 'advocacy', label: "I'm running an advocacy campaign" },
  { v: 'investigation', label: "I'm investigating a specific issue" },
  { v: 'curiosity', label: "I'm just curious / exploring" },
];

const PAY_OPTIONS = [
  { v: 'free_only', label: 'Only if free' },
  { v: 'low_<500', label: 'Up to ~$500' },
  { v: 'mid_500_2500', label: '$500 – $2,500' },
  { v: 'high_2500_10000', label: '$2,500 – $10,000' },
  { v: 'enterprise_10k_plus', label: '$10,000+ (enterprise)' },
  { v: 'depends', label: 'Depends — let me discuss' },
];

const inputCls = 'w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-yellow';
const labelCls = 'text-xs font-black uppercase tracking-widest text-bauhaus-black mb-1 block';
const sectionCls = 'border-4 border-bauhaus-black p-6 bg-white space-y-4';
const legendCls = 'text-sm font-black uppercase tracking-widest text-bauhaus-yellow mb-3 border-b-2 border-bauhaus-yellow pb-2 w-full';

function CheckboxGrid({ name, options, columns = 2 }: { name: string; options: { v: string; label: string }[]; columns?: 1 | 2 | 3 }) {
  const cols = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';
  return (
    <div className={`grid ${cols} gap-2`}>
      {options.map(o => (
        <label key={o.v} className="flex items-start gap-2 text-sm font-medium text-bauhaus-black cursor-pointer p-2 border-2 border-bauhaus-black bg-bauhaus-canvas hover:bg-white">
          <input type="checkbox" name={name} value={o.v} className="mt-1 border-2 border-bauhaus-black w-4 h-4 shrink-0" />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function ValueScore() {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-bauhaus-muted mb-2">1 = no value · 5 = essential</div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} className="flex flex-col items-center gap-1 cursor-pointer border-4 border-bauhaus-black p-3 bg-white hover:bg-bauhaus-canvas has-[:checked]:bg-bauhaus-yellow has-[:checked]:border-bauhaus-red">
            <input type="radio" name="value_score" value={n} className="sr-only" />
            <span className="text-2xl font-black text-bauhaus-black tabular-nums">{n}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackForm({ reportSubject }: { reportSubject?: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string; id?: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('source_path', typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');
    fd.set('source_referrer', typeof document !== 'undefined' ? document.referrer : '');
    fd.set('user_agent', typeof navigator !== 'undefined' ? navigator.userAgent : '');
    startTransition(async () => {
      const r = await submitFeedback(fd);
      setResult(r);
      if (r.ok) (e.currentTarget as HTMLFormElement).reset();
    });
  }

  if (result?.ok) {
    return (
      <div className="border-4 border-bauhaus-blue p-8 bg-white">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">✓ Feedback received</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Thank you.</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed mb-2">
          This is genuinely useful — the structured signals shape what gets built next, and the free-text often surfaces things we wouldn&apos;t think to ask.
        </p>
        <p className="text-sm text-bauhaus-muted">
          {result.id && <>Reference: <span className="font-mono">{result.id.slice(0, 8)}…</span></>}
        </p>
        <p className="text-sm text-bauhaus-black font-medium mt-4">
          Want to talk further? <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue font-black hover:underline">Benjamin@act.place</a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="report_subject" value={reportSubject || ''} />

      <fieldset className={sectionCls}>
        <legend className={legendCls}>How valuable is this?</legend>
        <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">Tick everything that applies. There&apos;s no wrong answer.</p>
        <CheckboxGrid name="value_signals" options={VALUE_SIGNALS} columns={2} />
        <div>
          <label className={labelCls}>Overall value rating</label>
          <ValueScore />
        </div>
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>What would you want more of?</legend>
        <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">CivicGraph already has data across procurement, grants, charities, foundations, donations, lobbyists, ATO transparency, and more. Tick what you&apos;d want surfaced as a report:</p>
        <CheckboxGrid name="topics_wanted" options={TOPICS_WANTED} columns={2} />
        <div>
          <label className={labelCls} htmlFor="topics_wanted_other">Anything else?</label>
          <input id="topics_wanted_other" name="topics_wanted_other" className={inputCls} placeholder="e.g. NDIS provider concentration, religious-charity governance, university spinout grants" />
        </div>
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>How would you use this?</legend>
        <CheckboxGrid name="use_cases" options={USE_CASES} columns={2} />
        <div>
          <label className={labelCls} htmlFor="use_cases_other">Other context?</label>
          <input id="use_cases_other" name="use_cases_other" className={inputCls} placeholder="Tell us how you&apos;d actually use this" />
        </div>
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>What questions would you want answered next?</legend>
        <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">Free text. The most useful feedback is usually here — what wasn&apos;t covered? What would shift it from interesting to essential for you?</p>
        <textarea name="questions_to_answer" rows={4} className={inputCls} placeholder="e.g. How does ECCV's funding compare to the entire VIC ethnic-services sector? Which foundations are quietly funding settlement work? What's the director-overlap pattern across treaty bodies?" />
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>Any general feedback?</legend>
        <textarea name="general_feedback" rows={3} className={inputCls} placeholder="The good, the bad, the &lsquo;wait, what?&rsquo; Tell us what hit and what missed." />
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>Indicative budget signal</legend>
        <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">No commitment — just helps us understand what people would expect to invest in this kind of intelligence.</p>
        <select name="willingness_to_pay" className={inputCls} defaultValue="">
          <option value="">Skip</option>
          {PAY_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </fieldset>

      <fieldset className={sectionCls}>
        <legend className={legendCls}>Optional — leave your contact</legend>
        <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">All anonymous if you skip this. We won&apos;t spam you.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="contact_name">Name</label>
            <input id="contact_name" name="contact_name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_email">Email</label>
            <input id="contact_email" name="contact_email" type="email" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_org">Organisation</label>
            <input id="contact_org" name="contact_org" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_role">Role</label>
            <input id="contact_role" name="contact_role" className={inputCls} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs font-medium text-bauhaus-black cursor-pointer">
          <input type="checkbox" name="follow_up_ok" className="mt-0.5 border-2 border-bauhaus-black w-4 h-4" />
          <span>Yes, send me the next report when it&apos;s published.</span>
        </label>
      </fieldset>

      {result?.error && (
        <div className="border-4 border-bauhaus-red p-3 text-xs font-mono text-bauhaus-red bg-white">✗ {result.error}</div>
      )}

      <button type="submit" disabled={pending} className="inline-block px-6 py-4 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-4 border-bauhaus-black hover:bg-bauhaus-red disabled:opacity-50 disabled:cursor-not-allowed">
        {pending ? 'Submitting…' : 'Submit feedback →'}
      </button>
    </form>
  );
}
