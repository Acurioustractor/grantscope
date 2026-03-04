'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Claim {
  id: string;
  abn: string;
  status: string;
  contact_email: string;
  contact_name: string;
  created_at: string;
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto py-16 flex items-center justify-center min-h-[40vh]"><div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div></div>}>
      <ClaimForm />
    </Suspense>
  );
}

function ClaimForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abn = searchParams.get('abn') || '';

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingClaim, setExistingClaim] = useState<Claim | null>(null);
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) {
        setContactEmail(u.email || '');
        // Check for existing claims
        fetch('/api/charities/claim')
          .then(r => r.json())
          .then((claims: Claim[]) => {
            const match = claims.find(c => c.abn === abn);
            if (match) setExistingClaim(match);
          })
          .catch(() => {});
      }
      setLoading(false);
    });
  }, [abn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const res = await fetch('/api/charities/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abn, contact_email: contactEmail, contact_name: contactName, organisation_name: orgName }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to submit claim');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
          <div className="w-12 h-12 bg-bauhaus-yellow border-3 border-bauhaus-black flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="square" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Sign In Required</p>
          <h1 className="text-2xl font-black text-bauhaus-black mb-4">Claim Your Profile</h1>
          <p className="text-bauhaus-muted font-medium leading-relaxed mb-6">
            Sign in to claim your charity&apos;s profile on GrantScope. You&apos;ll be able to update your description, share your story, and request to be featured.
          </p>
          {abn && (
            <div className="bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-4 py-3 mb-6">
              <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</div>
              <div className="text-sm font-black text-bauhaus-black">{abn}</div>
            </div>
          )}
          <div className="flex gap-3">
            <a
              href={`/login?redirect=${encodeURIComponent(`/charities/claim?abn=${abn}`)}`}
              className="inline-block px-5 py-2.5 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors border-4 border-bauhaus-black"
            >
              Sign In
            </a>
            <a
              href={`/register?redirect=${encodeURIComponent(`/charities/claim?abn=${abn}`)}`}
              className="inline-block px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Has existing claim
  if (existingClaim) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
          <div className={`w-12 h-12 border-3 border-bauhaus-black flex items-center justify-center mb-6 ${
            existingClaim.status === 'verified' ? 'bg-green-500' :
            existingClaim.status === 'rejected' ? 'bg-bauhaus-red' : 'bg-bauhaus-yellow'
          }`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              {existingClaim.status === 'verified' ? (
                <path strokeLinecap="square" d="M5 13l4 4L19 7" />
              ) : existingClaim.status === 'rejected' ? (
                <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="square" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.3em] mb-2" style={{
            color: existingClaim.status === 'verified' ? '#22c55e' :
                   existingClaim.status === 'rejected' ? '#ef4444' : '#eab308'
          }}>
            {existingClaim.status === 'verified' ? 'Verified' :
             existingClaim.status === 'rejected' ? 'Rejected' : 'Pending Verification'}
          </p>
          <h1 className="text-2xl font-black text-bauhaus-black mb-4">
            {existingClaim.status === 'verified' ? 'Profile Claimed' :
             existingClaim.status === 'rejected' ? 'Claim Rejected' : 'Claim Pending'}
          </h1>

          <div className="bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-4 py-3 mb-6">
            <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</div>
            <div className="text-sm font-black text-bauhaus-black">{existingClaim.abn}</div>
            <div className="text-xs text-bauhaus-muted mt-1">
              Submitted {new Date(existingClaim.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {existingClaim.status === 'pending' && (
            <p className="text-bauhaus-muted font-medium leading-relaxed mb-6">
              Your claim is being reviewed. We&apos;ll verify your connection to this charity and update the status.
            </p>
          )}

          {existingClaim.status === 'rejected' && (
            <p className="text-bauhaus-muted font-medium leading-relaxed mb-6">
              Your claim was not approved. If you believe this was in error, please contact us at{' '}
              <a href="mailto:hello@grantscope.au" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">hello@grantscope.au</a>
            </p>
          )}

          <div className="flex gap-3">
            {existingClaim.status === 'verified' && (
              <a
                href={`/charities/${existingClaim.abn}/edit`}
                className="inline-block px-5 py-2.5 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors border-4 border-bauhaus-black"
              >
                Edit Profile
              </a>
            )}
            <a
              href={`/charities/${existingClaim.abn}`}
              className="inline-block px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              View Profile
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
          <div className="w-12 h-12 bg-bauhaus-yellow border-3 border-bauhaus-black flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="square" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs font-black text-money uppercase tracking-[0.3em] mb-2">Submitted</p>
          <h1 className="text-2xl font-black text-bauhaus-black mb-4">Claim Submitted</h1>
          <p className="text-bauhaus-muted font-medium leading-relaxed mb-6">
            Your claim has been submitted for verification. We&apos;ll review it and get back to you.
          </p>
          <a
            href={abn ? `/charities/${abn}` : '/charities'}
            className="inline-block px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
          >
            &larr; Back to Profile
          </a>
        </div>
      </div>
    );
  }

  // Claim form
  return (
    <div className="max-w-xl mx-auto py-16">
      <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
        <div className="w-12 h-12 bg-bauhaus-yellow border-3 border-bauhaus-black flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="square" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Verification</p>
        <h1 className="text-2xl font-black text-bauhaus-black mb-4">Claim Your Profile</h1>
        <p className="text-bauhaus-muted font-medium leading-relaxed mb-6">
          Submit a claim to manage this charity&apos;s profile on GrantScope. We&apos;ll verify your connection to the organisation.
        </p>

        {error && (
          <div className="bg-danger-light border-4 border-bauhaus-red p-3 text-sm font-bold text-bauhaus-red mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              ABN
            </label>
            <input
              type="text"
              value={abn}
              disabled
              className="w-full border-4 border-bauhaus-black/30 bg-bauhaus-canvas px-3 py-2 text-sm font-bold text-bauhaus-muted"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              Organisation Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              required
              placeholder="e.g. A Curious Tractor Foundation"
              className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              required
              placeholder="Your full name"
              className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              required
              className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !abn}
            className="w-full bg-bauhaus-red text-white font-black uppercase tracking-widest py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t-2 border-bauhaus-black/10">
          <a
            href={abn ? `/charities/${abn}` : '/charities'}
            className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
          >
            &larr; Back to {abn ? 'Profile' : 'Charities'}
          </a>
        </div>
      </div>
    </div>
  );
}
