'use client';

import { useState } from 'react';
import Link from 'next/link';

interface OutcomeEntry {
  metric: string;
  value: string;
  unit: string;
  description: string;
}

const COMMON_METRICS = [
  { metric: 'young_people_diverted', unit: 'people', label: 'Young people diverted from custody' },
  { metric: 'program_participants', unit: 'people', label: 'Program participants' },
  { metric: 'program_hours', unit: 'hours', label: 'Total program delivery hours' },
  { metric: 'community_satisfaction', unit: 'score_out_of_5', label: 'Community satisfaction score' },
  { metric: 'cultural_activities', unit: 'sessions', label: 'Cultural activity sessions delivered' },
  { metric: 'families_supported', unit: 'families', label: 'Families receiving support' },
  { metric: 'referrals_to_services', unit: 'referrals', label: 'Referrals to partner services' },
  { metric: 'employment_outcomes', unit: 'people', label: 'Employment or training placements' },
  { metric: 'reoffending_reduction', unit: 'percent', label: 'Reoffending reduction (%)' },
  { metric: 'school_attendance', unit: 'percent', label: 'School attendance improvement (%)' },
];

const EMPTY_OUTCOME: OutcomeEntry = { metric: '', value: '', unit: '', description: '' };

export default function OutcomeSubmissionPage() {
  const [orgName, setOrgName] = useState('');
  const [orgAbn, setOrgAbn] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [programName, setProgramName] = useState('');
  const [reportingPeriod, setReportingPeriod] = useState('');
  const [outcomes, setOutcomes] = useState<OutcomeEntry[]>([{ ...EMPTY_OUTCOME }]);
  const [narrative, setNarrative] = useState('');
  const [methodology, setMethodology] = useState('');
  const [postcode, setPostcode] = useState('');
  const [state, setState] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addOutcome() {
    setOutcomes([...outcomes, { ...EMPTY_OUTCOME }]);
  }

  function removeOutcome(index: number) {
    setOutcomes(outcomes.filter((_, i) => i !== index));
  }

  function updateOutcome(index: number, field: keyof OutcomeEntry, value: string) {
    const updated = [...outcomes];
    updated[index] = { ...updated[index], [field]: value };
    setOutcomes(updated);
  }

  function prefillMetric(index: number, preset: typeof COMMON_METRICS[0]) {
    const updated = [...outcomes];
    updated[index] = {
      metric: preset.metric,
      unit: preset.unit,
      description: preset.label,
      value: updated[index].value,
    };
    setOutcomes(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      org_name: orgName,
      org_abn: orgAbn || undefined,
      contact_email: contactEmail || undefined,
      program_name: programName,
      reporting_period: reportingPeriod,
      outcomes: outcomes
        .filter(o => o.metric && o.value)
        .map(o => ({
          metric: o.metric,
          value: parseFloat(o.value),
          unit: o.unit,
          description: o.description || undefined,
        })),
      narrative: narrative || undefined,
      methodology: methodology || undefined,
      postcode: postcode || undefined,
      state: state || undefined,
    };

    try {
      const res = await fetch('/api/outcomes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Submission failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="border-4 border-money bg-money-light p-8 text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-black text-bauhaus-black mb-2">Outcomes Submitted</h1>
          <p className="text-sm text-bauhaus-muted mb-6">
            Your outcomes for <strong>{programName}</strong> ({reportingPeriod}) have been submitted for review.
            You&apos;ll receive confirmation at {contactEmail || 'your registered email'} once validated.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setSubmitted(false); setOutcomes([{ ...EMPTY_OUTCOME }]); }}
              className="px-4 py-2 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-yellow transition-colors"
            >
              Submit Another
            </button>
            <Link
              href="/home/watchlist"
              className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; CivicGraph
      </Link>

      <div className="mt-4 mb-8">
        <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-[0.25em] mb-1">Governed Proof</div>
        <h1 className="text-2xl font-black text-bauhaus-black">Submit Program Outcomes</h1>
        <p className="text-sm text-bauhaus-muted mt-2 max-w-xl">
          Report your program&apos;s outcomes to build an evidence-backed proof record. Submissions are reviewed and validated before being incorporated into CivicGraph&apos;s Governed Proof layer.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organisation */}
        <fieldset className="border-4 border-bauhaus-black p-5">
          <legend className="text-xs font-black text-bauhaus-black uppercase tracking-widest px-2">Organisation</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Organisation Name *</label>
              <input type="text" required value={orgName} onChange={e => setOrgName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">ABN</label>
              <input type="text" value={orgAbn} onChange={e => setOrgAbn(e.target.value)} placeholder="e.g. 53658668627"
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Contact Email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Postcode</label>
              <input type="text" value={postcode} onChange={e => setPostcode(e.target.value)} maxLength={4}
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
          </div>
        </fieldset>

        {/* Program */}
        <fieldset className="border-4 border-bauhaus-black p-5">
          <legend className="text-xs font-black text-bauhaus-black uppercase tracking-widest px-2">Program</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Program Name *</label>
              <input type="text" required value={programName} onChange={e => setProgramName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Reporting Period *</label>
              <input type="text" required value={reportingPeriod} onChange={e => setReportingPeriod(e.target.value)}
                placeholder="e.g. Q1 2026, FY 2025-26"
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">State/Territory</label>
              <select value={state} onChange={e => setState(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none bg-white">
                <option value="">Select...</option>
                <option value="NSW">NSW</option>
                <option value="VIC">VIC</option>
                <option value="QLD">QLD</option>
                <option value="WA">WA</option>
                <option value="SA">SA</option>
                <option value="TAS">TAS</option>
                <option value="NT">NT</option>
                <option value="ACT">ACT</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Outcomes */}
        <fieldset className="border-4 border-bauhaus-blue p-5">
          <legend className="text-xs font-black text-bauhaus-blue uppercase tracking-widest px-2">Outcomes</legend>
          <p className="text-xs text-bauhaus-muted mb-4">
            Add one or more measurable outcomes. Select from common metrics or enter your own.
          </p>

          {outcomes.map((outcome, i) => (
            <div key={i} className="border-2 border-gray-200 p-4 mb-3 relative">
              {outcomes.length > 1 && (
                <button type="button" onClick={() => removeOutcome(i)}
                  className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 font-bold">
                  Remove
                </button>
              )}

              {/* Quick-fill buttons */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {COMMON_METRICS.slice(0, 5).map(preset => (
                  <button key={preset.metric} type="button" onClick={() => prefillMetric(i, preset)}
                    className={`text-[10px] px-2 py-1 border transition-colors ${
                      outcome.metric === preset.metric
                        ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue font-bold'
                        : 'border-gray-200 text-gray-500 hover:border-bauhaus-blue'
                    }`}>
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Metric *</label>
                  <input type="text" value={outcome.metric} onChange={e => updateOutcome(i, 'metric', e.target.value)}
                    placeholder="e.g. young_people_diverted"
                    className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Value *</label>
                  <input type="number" value={outcome.value} onChange={e => updateOutcome(i, 'value', e.target.value)}
                    step="any"
                    className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Unit *</label>
                  <input type="text" value={outcome.unit} onChange={e => updateOutcome(i, 'unit', e.target.value)}
                    placeholder="people, hours, %"
                    className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
                </div>
              </div>
              <div className="mt-2">
                <input type="text" value={outcome.description} onChange={e => updateOutcome(i, 'description', e.target.value)}
                  placeholder="Brief description (optional)"
                  className="w-full px-3 py-2 border-2 border-gray-200 text-xs focus:border-bauhaus-black outline-none" />
              </div>
            </div>
          ))}

          <button type="button" onClick={addOutcome}
            className="px-4 py-2 border-2 border-dashed border-bauhaus-blue text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:bg-link-light transition-colors w-full">
            + Add Outcome
          </button>
        </fieldset>

        {/* Context */}
        <fieldset className="border-4 border-bauhaus-black p-5">
          <legend className="text-xs font-black text-bauhaus-black uppercase tracking-widest px-2">Context</legend>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Narrative</label>
              <textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={4}
                placeholder="Describe the outcomes in your own words — context, challenges, community impact..."
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Methodology</label>
              <textarea value={methodology} onChange={e => setMethodology(e.target.value)} rows={2}
                placeholder="How were these outcomes measured? (e.g., administrative data, surveys, case tracking)"
                className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none" />
            </div>
          </div>
        </fieldset>

        {error && (
          <div className="border-4 border-bauhaus-red bg-error-light p-4 text-sm text-bauhaus-red font-bold">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting}
            className="px-6 py-3 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Outcomes'}
          </button>
          <button type="button" disabled={submitting}
            onClick={() => {
              // Save as draft
              handleSubmit({ preventDefault: () => {} } as React.FormEvent);
            }}
            className="px-6 py-3 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-yellow transition-colors disabled:opacity-50">
            Save Draft
          </button>
        </div>

        <p className="text-[10px] text-bauhaus-muted mt-2">
          Submissions are reviewed by the CivicGraph team before being incorporated into Governed Proof bundles.
          Your data remains yours — we validate and present it alongside other evidence sources.
        </p>
      </form>
    </div>
  );
}
