'use client';

import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';

const inputCls = 'w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium text-bauhaus-black focus:outline-none focus:ring-2 focus:ring-bauhaus-yellow';
const labelCls = 'text-xs font-black uppercase tracking-widest text-bauhaus-black mb-1 block';

type Result = {
  ok?: boolean;
  id?: string;
  reference_id?: string;
  error?: string;
  detail?: string;
};

export default function CorrectionForm({
  targetType,
  targetId,
  claimUrl,
}: {
  targetType?: string;
  targetId?: string;
  claimUrl?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      target_type: String(formData.get('target_type') || '').trim(),
      target_id: String(formData.get('target_id') || '').trim() || null,
      claim_url: String(formData.get('claim_url') || '').trim() || null,
      submitter_name: String(formData.get('submitter_name') || '').trim(),
      submitter_email: String(formData.get('submitter_email') || '').trim(),
      submitter_org: String(formData.get('submitter_org') || '').trim() || null,
      requested_change: String(formData.get('requested_change') || '').trim(),
      evidence_url: String(formData.get('evidence_url') || '').trim() || null,
      evidence_text: String(formData.get('evidence_text') || '').trim() || null,
      right_of_reply: formData.get('right_of_reply') === 'on',
    };

    startTransition(async () => {
      const response = await fetch('/api/data/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json() as Result;
      setResult(json);
      if (response.ok && json.ok) form.reset();
    });
  }

  if (result?.ok) {
    return (
      <div className="border-4 border-bauhaus-blue bg-white p-8">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">Submission received</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Reference {result.reference_id?.slice(0, 8)}</h2>
        <p className="text-sm font-medium text-bauhaus-muted leading-relaxed">
          The record is now in the correction queue. If this is a right-of-reply request, keep the reference ID for follow-up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {result?.error && (
        <div className="border-4 border-bauhaus-red bg-white p-4 text-sm font-black text-bauhaus-red">
          {result.error}{result.detail ? `: ${result.detail}` : ''}
        </div>
      )}

      <div className="border-4 border-bauhaus-black bg-white p-5">
        <h2 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-4">What record or claim?</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="target_type">Target type</label>
            <input id="target_type" name="target_type" className={inputCls} defaultValue={targetType || 'dataset'} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="target_id">Target ID</label>
            <input id="target_id" name="target_id" className={inputCls} defaultValue={targetId || ''} placeholder="Record ID, dataset key or insight ID" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="claim_url">Claim URL</label>
            <input id="claim_url" name="claim_url" className={inputCls} defaultValue={claimUrl || ''} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="border-4 border-bauhaus-black bg-white p-5">
        <h2 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-4">Requested change</h2>
        <textarea
          name="requested_change"
          rows={6}
          className={inputCls}
          required
          minLength={20}
          placeholder="What is wrong, incomplete or unfair? What should the public record say instead?"
        />
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="evidence_url">Evidence URL</label>
            <input id="evidence_url" name="evidence_url" className={inputCls} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls} htmlFor="evidence_text">Evidence note</label>
            <input id="evidence_text" name="evidence_text" className={inputCls} placeholder="Source, document title, page, date" />
          </div>
        </div>
        <label className="mt-4 flex items-start gap-3 border-2 border-bauhaus-black bg-bauhaus-canvas p-3 text-sm font-medium text-bauhaus-black">
          <input type="checkbox" name="right_of_reply" className="mt-1 h-4 w-4 border-2 border-bauhaus-black" />
          <span>This is a right-of-reply submission to a public claim.</span>
        </label>
      </div>

      <div className="border-4 border-bauhaus-black bg-white p-5">
        <h2 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-4">Contact for verification</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="submitter_name">Name</label>
            <input id="submitter_name" name="submitter_name" className={inputCls} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="submitter_email">Email</label>
            <input id="submitter_email" name="submitter_email" type="email" className={inputCls} required />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="submitter_org">Organisation</label>
            <input id="submitter_org" name="submitter_org" className={inputCls} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full border-4 border-bauhaus-black bg-bauhaus-red px-6 py-4 text-sm font-black uppercase tracking-widest text-white hover:bg-bauhaus-black disabled:opacity-60"
      >
        {pending ? 'Submitting...' : 'Submit correction'}
      </button>
    </form>
  );
}
