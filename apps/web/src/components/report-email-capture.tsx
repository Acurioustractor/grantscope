'use client';

import { useState } from 'react';

/**
 * Email capture for report pages — top-of-funnel for journalism distribution
 * and audience-building. Posts to /api/reports/leads (existing infra),
 * dedups by (email, report_slug), records source for attribution.
 *
 * Drop into any report page:
 *   <ReportEmailCapture reportSlug="indigenous-proxy" />
 *
 * Optional props let you override the headline and source attribution if a
 * specific report wants different framing.
 */

interface Props {
  reportSlug: string;
  source?: string;
  headline?: string;
  description?: string;
}

export function ReportEmailCapture({
  reportSlug,
  source = 'report-inline',
  headline = 'Get the next investigation when it drops',
  description = 'CivicGraph publishes new investigations into Australian power and procurement on an irregular cadence. No spam. Unsubscribe anytime.',
}: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'already' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/reports/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), report_slug: reportSlug, source }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus(data?.status === 'already_registered' ? 'already' : 'success');
      } else {
        setStatus('error');
        setErrorMsg(data?.error || 'Something went wrong. Try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Try again.');
    }
  }

  if (status === 'success' || status === 'already') {
    return (
      <section className="my-10 border-4 border-bauhaus-black bg-bauhaus-yellow/20 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
          {status === 'already' ? "You're already on the list" : 'Subscribed'}
        </p>
        <h3 className="mt-2 text-xl font-black uppercase text-bauhaus-black">
          {status === 'already' ? "We've got your email." : 'Welcome.'}
        </h3>
        <p className="mt-2 text-sm text-bauhaus-black">
          You&apos;ll hear from us when the next investigation lands. In the meantime, the full atlas is open
          — explore <a href="/reports" className="font-black underline hover:text-bauhaus-red">all investigations</a>{' '}
          or read the <a href="/about/curious-tractor" className="font-black underline hover:text-bauhaus-red">project thesis</a>.
        </p>
      </section>
    );
  }

  return (
    <section className="my-10 border-4 border-bauhaus-black bg-bauhaus-canvas p-6 sm:p-8">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
            Subscribe — free
          </p>
          <h3 className="mt-2 text-xl font-black uppercase text-bauhaus-black">{headline}</h3>
          <p className="mt-3 text-sm text-bauhaus-muted leading-relaxed">{description}</p>
          <p className="mt-3 text-[11px] font-medium text-bauhaus-muted">
            Also available as <a href="/reports/feed.xml" className="font-black text-bauhaus-black underline hover:text-bauhaus-red">RSS</a>.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor={`email-${reportSlug}`} className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
            Email
          </label>
          <input
            id={`email-${reportSlug}`}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={status === 'submitting'}
            className="border-4 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium text-bauhaus-black placeholder:text-bauhaus-muted focus:outline-none focus:bg-bauhaus-yellow/10 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === 'submitting' || !email}
            className="border-4 border-bauhaus-black bg-bauhaus-black px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-red disabled:opacity-50"
          >
            {status === 'submitting' ? 'Subscribing...' : 'Subscribe'}
          </button>
          {status === 'error' && (
            <p className="text-xs font-bold text-bauhaus-red">{errorMsg}</p>
          )}
          <p className="text-[10px] text-bauhaus-muted">
            One email per investigation. We never share your address.
          </p>
        </form>
      </div>
    </section>
  );
}
