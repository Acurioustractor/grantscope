'use client';

import { useState, useTransition } from 'react';
import { submitReportRequest } from './actions';

export default function SubmissionForm({ defaultBudget, defaultFree, defaultSource }: { defaultBudget?: string | null; defaultFree?: boolean; defaultSource?: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string; id?: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await submitReportRequest(fd);
      setResult(r);
      if (r.ok) (e.currentTarget as HTMLFormElement).reset();
    });
  }

  if (result?.ok) {
    return (
      <div className="border-4 border-bauhaus-blue p-8 bg-white">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">✓ Submitted</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Got it.</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed mb-4">
          Your submission landed. We&apos;ll triage within 48 hours and either confirm scoping or come back with questions. If you applied for the First 5 Free campaign, selection is complete by end of next week.
        </p>
        <p className="text-xs font-mono text-bauhaus-muted">Reference: {result.id?.slice(0, 8)}…</p>
        <p className="text-sm text-bauhaus-black font-medium mt-4">
          Reply directly to <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue font-black hover:underline">Benjamin@act.place</a> if you want to flag anything urgently.
        </p>
      </div>
    );
  }

  const inputCls = 'w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-yellow';
  const labelCls = 'text-xs font-black uppercase tracking-widest text-bauhaus-black mb-1 block';

  return (
    <form onSubmit={onSubmit} className="border-4 border-bauhaus-black p-6 bg-white space-y-5">
      <input type="hidden" name="source" value={defaultSource || 'direct'} />
      <input type="hidden" name="raw_referrer" value={typeof window !== 'undefined' ? document.referrer : ''} />

      <fieldset>
        <legend className="text-sm font-black uppercase tracking-widest text-bauhaus-yellow mb-3 border-b-2 border-bauhaus-yellow pb-2 w-full">About you</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="contact_name">Your name</label>
            <input id="contact_name" name="contact_name" className={inputCls} placeholder="e.g. Tharini Rouwette" />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_email">Email *</label>
            <input id="contact_email" name="contact_email" type="email" required className={inputCls} placeholder="you@org.com" />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_org">Your organisation</label>
            <input id="contact_org" name="contact_org" className={inputCls} placeholder="e.g. Allies in Colour" />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_role">Your role</label>
            <input id="contact_role" name="contact_role" className={inputCls} placeholder="e.g. CEO" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-black uppercase tracking-widest text-bauhaus-yellow mb-3 border-b-2 border-bauhaus-yellow pb-2 w-full">What you want investigated</legend>
        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="target_subject">Organisation, network, or sector *</label>
            <input id="target_subject" name="target_subject" required className={inputCls} placeholder="e.g. Multicultural sector peak bodies; or specifically: Migrant Resource Centre Australia" />
          </div>
          <div>
            <label className={labelCls} htmlFor="target_type">Type</label>
            <select id="target_type" name="target_type" className={inputCls} defaultValue="">
              <option value="">Select…</option>
              <option value="charity">Single charity / NFP</option>
              <option value="peak_body">Peak body or sector council</option>
              <option value="sector">Whole sector or sub-sector</option>
              <option value="network">Funder / grantee network</option>
              <option value="program">Government program or funding stream</option>
              <option value="individual">Individual (board overlap, influence map)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="target_abn">ABN(s) (if known)</label>
              <input id="target_abn" name="target_abn" className={inputCls} placeholder="e.g. 23684792947, 65071572705" />
            </div>
            <div>
              <label className={labelCls} htmlFor="target_geography">Geography / state focus</label>
              <input id="target_geography" name="target_geography" className={inputCls} placeholder="e.g. QLD, regional NSW, national, Greater Western Sydney" />
            </div>
            <div>
              <label className={labelCls} htmlFor="target_timeframe">Timeframe of interest</label>
              <input id="target_timeframe" name="target_timeframe" className={inputCls} placeholder="e.g. last 5 years, FY2020 onwards, since the org was founded" />
            </div>
            <div>
              <label className={labelCls} htmlFor="target_topic">Sector / topic tag</label>
              <input id="target_topic" name="target_topic" className={inputCls} placeholder="e.g. youth-justice, settlement-services, philanthropy, lobbying" />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="target_sources">Source documents / URLs already on your radar</label>
            <textarea id="target_sources" name="target_sources" className={inputCls} rows={2} placeholder="e.g. their annual report PDF, an ABC news article, a Senate submission you found, a sector strategy document — paste the URLs (one per line)" />
          </div>

          <div>
            <label className={labelCls} htmlFor="research_questions">Questions you want answered *</label>
            <textarea id="research_questions" name="research_questions" required className={inputCls} rows={5} placeholder="The more specific, the better the report. e.g.&#10;&#10;1. How financially fragile is FECCA? Two years of deficits — sustainable or not?&#10;2. Who are FECCA's directors and what other boards do they sit on?&#10;3. What % of state vs federal funding flows through FECCA + ECCV vs sister state ECCs?&#10;4. Are there foundations quietly funding settlement work we should know about?" />
          </div>

          <div>
            <label className={labelCls} htmlFor="decision_driving">What decision will this inform? *</label>
            <input id="decision_driving" name="decision_driving" required className={inputCls} placeholder="e.g. Board strategy review next month; foundation grantee diligence for a $500K grant; public-interest media piece; advocacy submission to the next federal budget" />
          </div>

          <div>
            <label className={labelCls} htmlFor="data_priorities">Which data layers matter most? (tick all)</label>
            <div className="grid sm:grid-cols-2 gap-1 text-xs">
              {[
                { v: 'audited_financials', l: 'Audited financials + cash-flow' },
                { v: 'federal_procurement', l: 'Federal procurement (Austender)' },
                { v: 'state_grants', l: 'State / territory grant flows' },
                { v: 'foundation_giving', l: 'Foundation giving' },
                { v: 'donations', l: 'Political donations' },
                { v: 'lobbyists', l: 'Lobbyist register' },
                { v: 'board_interlocks', l: 'Board / director interlocks' },
                { v: 'staff_workforce', l: 'Staff / workforce stats' },
                { v: 'evidence_base', l: 'Programs + evidence (ALMA)' },
                { v: 'geographic', l: 'Geographic / LGA overlay' },
                { v: 'demographics', l: 'CALD / demographic context' },
                { v: 'monitoring', l: 'Live monitoring + change alerts' },
              ].map(o => (
                <label key={o.v} className="flex items-start gap-2 font-medium text-bauhaus-black cursor-pointer p-2 border-2 border-bauhaus-black bg-bauhaus-canvas hover:bg-white">
                  <input type="checkbox" name="data_priorities" value={o.v} className="mt-0.5 border-2 border-bauhaus-black w-3 h-3 shrink-0" />
                  <span>{o.l}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="prior_work">What's already been tried / what existing knowledge do you have?</label>
            <textarea id="prior_work" name="prior_work" className={inputCls} rows={2} placeholder="Saves us repeating work. e.g. 'I've read their last 3 annual reports', 'I know they restructured in 2021', 'their CEO is X', 'I've already mapped X via Y tool'" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-black uppercase tracking-widest text-bauhaus-yellow mb-3 border-b-2 border-bauhaus-yellow pb-2 w-full">Timeline &amp; budget signal</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="timeline_pref">Timeline</label>
            <select id="timeline_pref" name="timeline_pref" className={inputCls} defaultValue="">
              <option value="">Select…</option>
              <option value="urgent">Urgent (1–2 weeks)</option>
              <option value="4_weeks">4 weeks</option>
              <option value="8_weeks">8 weeks</option>
              <option value="no_rush">No rush</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="budget_signal">Budget you have in mind</label>
            <select id="budget_signal" name="budget_signal" className={inputCls} defaultValue={defaultBudget || ''}>
              <option value="">Select…</option>
              <option value="0">$0 — applying for First 5 Free</option>
              <option value="500">$500 — Verified snapshot</option>
              <option value="1500">$1,500</option>
              <option value="2500">$2,500 — On-demand report (standard)</option>
              <option value="5000">$5,000</option>
              <option value="7500">$7,500 — Sector Subscription (annual)</option>
              <option value="10000_plus">$10K+</option>
              <option value="25000_plus">$25K+ — Strategic Engagement (project)</option>
              <option value="not_sure">Not sure yet — want to discuss</option>
            </select>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-start gap-2 text-xs font-medium text-bauhaus-black cursor-pointer">
            <input type="checkbox" name="free_5_apply" defaultChecked={defaultFree} className="mt-0.5 border-2 border-bauhaus-black w-4 h-4" />
            <span>I&apos;m applying for the <span className="font-black">First 5 Free</span> campaign and willing to be a public case study.</span>
          </label>
          <label className="flex items-start gap-2 text-xs font-medium text-bauhaus-black cursor-pointer">
            <input type="checkbox" name="permission_to_publish" className="mt-0.5 border-2 border-bauhaus-black w-4 h-4" />
            <span>I give permission for the resulting report to be published publicly on civicgraph.com.au.</span>
          </label>
        </div>
      </fieldset>

      {result?.error && (
        <div className="border-4 border-bauhaus-red p-3 text-xs font-mono text-bauhaus-red bg-white">
          ✗ {result.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="inline-block px-6 py-4 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-4 border-bauhaus-black hover:bg-bauhaus-red disabled:opacity-50 disabled:cursor-not-allowed">
        {pending ? 'Submitting…' : 'Submit request →'}
      </button>
    </form>
  );
}
