'use client';

import { useState } from 'react';

export function DatasetEmailGate({ reportSlug, entityCount }: { reportSlug: string; entityCount: number }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/reports/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, report_slug: reportSlug, source: 'dataset_download' }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="border-4 border-bauhaus-black p-8 bg-white text-center">
        <div className="text-2xl font-black text-bauhaus-black mb-2">Dataset Access Requested</div>
        <p className="text-sm text-bauhaus-muted max-w-lg mx-auto">
          We&apos;ll send the full {entityCount}-entity dataset to <strong>{email}</strong> within 24 hours,
          including ABN-linked donation and contract records in CSV format.
        </p>
      </div>
    );
  }

  return (
    <div className="border-4 border-bauhaus-black p-8 bg-white">
      <div className="max-w-xl mx-auto text-center">
        <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Full Dataset</div>
        <h3 className="text-xl font-black text-bauhaus-black mb-2">
          Get all {entityCount} donor-contractor records
        </h3>
        <p className="text-sm text-bauhaus-muted mb-6">
          CSV export with ABN, donation amounts by party, contract values by department,
          and year-by-year breakdowns. Free for journalists and researchers.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-0 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@organisation.com"
            required
            className="flex-1 px-4 py-3 border-4 border-bauhaus-black text-sm font-bold focus:outline-none focus:border-bauhaus-red"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-3 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50 border-4 border-bauhaus-black border-l-0"
          >
            {status === 'loading' ? 'Sending...' : 'Request'}
          </button>
        </form>
        {status === 'error' && (
          <p className="text-xs text-bauhaus-red mt-2 font-bold">Something went wrong. Try again.</p>
        )}
      </div>
    </div>
  );
}

export function ShareButtons({ title, entityCount }: { title: string; entityCount: number }) {
  const [copied, setCopied] = useState(false);

  function getUrl() {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  function shareTwitter() {
    const text = `${entityCount} Australian entities donate to political parties AND hold government contracts. ${title} — live data analysis from CivicGraph.`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getUrl())}`,
      '_blank'
    );
  }

  function shareLinkedIn() {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getUrl())}`,
      '_blank'
    );
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Share</span>
      <button
        onClick={shareTwitter}
        className="px-3 py-1.5 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
      >
        X / Twitter
      </button>
      <button
        onClick={shareLinkedIn}
        className="px-3 py-1.5 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
      >
        LinkedIn
      </button>
      <button
        onClick={copyLink}
        className="px-3 py-1.5 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
      >
        {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>
  );
}
