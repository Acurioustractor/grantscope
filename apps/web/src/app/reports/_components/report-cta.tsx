'use client';

import { useState } from 'react';

interface ReportCTAProps {
  reportSlug: string;
  reportTitle: string;
  /** Short description of what the PDF contains */
  pdfDescription?: string;
  /** 'full' = bottom-of-page CTA (default), 'inline' = lighter mid-report banner */
  variant?: 'full' | 'inline';
}

/**
 * Email-gated CTA for report PDF downloads.
 * Drop this at the bottom of any public report page.
 * Stores leads in `report_leads` via /api/reports/leads.
 */
export function ReportCTA({ reportSlug, reportTitle, pdfDescription, variant = 'full' }: ReportCTAProps) {
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/reports/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          report_slug: reportSlug,
          source: 'report_pdf_download',
          metadata: org ? { organisation: org } : undefined,
        }),
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
    if (variant === 'inline') {
      return (
        <div className="border-2 border-bauhaus-black/20 bg-green-50 p-4 text-center my-8">
          <span className="text-sm font-bold text-green-700">Sent to {email}</span>
        </div>
      );
    }
    return (
      <div className="border-4 border-bauhaus-black p-8 bg-white text-center my-12">
        <div className="text-2xl font-black text-bauhaus-black mb-2">Report Requested</div>
        <p className="text-sm text-bauhaus-muted max-w-lg mx-auto">
          We&apos;ll send the full PDF of <strong>{reportTitle}</strong> to <strong>{email}</strong> within 24 hours.
          Want to explore the live data now?
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <a
            href="/entities"
            className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
          >
            Explore Entities
          </a>
          <a
            href="/support"
            className="px-4 py-2 border-2 border-bauhaus-black text-bauhaus-black text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
          >
            See Plans
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas p-5 my-8">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto">
          <div className="text-sm font-black text-bauhaus-black whitespace-nowrap">
            Get the full PDF
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@organisation.com"
            required
            className="flex-1 w-full sm:w-auto px-3 py-2 border-2 border-bauhaus-black text-sm font-bold focus:outline-none focus:border-bauhaus-red"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {status === 'loading' ? 'Sending...' : 'Send PDF'}
          </button>
        </form>
        {status === 'error' && (
          <p className="text-xs text-bauhaus-red mt-2 font-bold text-center">Something went wrong. Try again.</p>
        )}
      </div>
    );
  }

  return (
    <div className="border-4 border-bauhaus-black p-8 bg-white my-12">
      <div className="max-w-xl mx-auto text-center">
        <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">
          Full Report
        </div>
        <h3 className="text-xl font-black text-bauhaus-black mb-2">
          Download: {reportTitle}
        </h3>
        <p className="text-sm text-bauhaus-muted mb-6">
          {pdfDescription || 'Get the complete report as a formatted PDF with all charts, tables, and data — ready to attach to board papers or share with colleagues.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-0 max-w-md mx-auto">
          <div className="flex gap-0">
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
              className="px-6 py-3 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50 border-4 border-bauhaus-black border-l-0 whitespace-nowrap"
            >
              {status === 'loading' ? 'Sending...' : 'Get PDF'}
            </button>
          </div>
          <input
            type="text"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="Organisation (optional)"
            className="w-full px-4 py-2.5 border-4 border-bauhaus-black border-t-0 text-sm focus:outline-none focus:border-bauhaus-red"
          />
        </form>
        {status === 'error' && (
          <p className="text-xs text-bauhaus-red mt-2 font-bold">Something went wrong. Try again.</p>
        )}
        <p className="text-[10px] text-bauhaus-muted mt-3">
          Free for researchers, journalists, and community organisations. No spam, ever.
        </p>
      </div>
    </div>
  );
}
