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
  organisation_name: string | null;
  admin_notes: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto py-16 flex items-center justify-center min-h-[40vh]"><div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div></div>}>
      <ClaimContent />
    </Suspense>
  );
}

function ClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abn = searchParams.get('abn') || '';

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) {
        setContactEmail(u.email || '');
        fetch('/api/charities/claim')
          .then(r => r.json())
          .then((data: Claim[]) => {
            setClaims(data);
            // If ABN provided and no existing claim for it, show form
            if (abn && !data.find(c => c.abn === abn)) {
              setShowForm(true);
            }
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
      body: JSON.stringify({ abn, contact_email: contactEmail, contact_name: contactName, organisation_name: orgName, message }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to submit claim');
      setSubmitting(false);
      return;
    }

    const newClaim = await res.json();
    setClaims(prev => [newClaim, ...prev]);
    setSuccess(true);
    setSubmitting(false);
    setShowForm(false);
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
            Sign in to claim your charity&apos;s profile on CivicGraph. You&apos;ll be able to update your description, share your story, and request to be featured.
          </p>
          {abn && (
            <div className="bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-4 py-3 mb-6">
              <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</div>
              <div className="text-sm font-black text-bauhaus-black">{abn}</div>
            </div>
          )}
          <div className="flex gap-3">
            <a
              href={`/login?redirect=${encodeURIComponent(`/charities/claim${abn ? `?abn=${abn}` : ''}`)}`}
              className="inline-block px-5 py-2.5 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors border-4 border-bauhaus-black"
            >
              Sign In
            </a>
            <a
              href={`/register?redirect=${encodeURIComponent(`/charities/claim${abn ? `?abn=${abn}` : ''}`)}`}
              className="inline-block px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Success toast after submission
  const successBanner = success && (
    <div className="border-4 border-green-600 bg-green-50 p-4 mb-6 bauhaus-shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-500 border-2 border-bauhaus-black flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="square" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-black text-green-800 uppercase tracking-widest">Claim Submitted</div>
          <div className="text-sm text-green-700 font-medium">We&apos;ll review it and get back to you.</div>
        </div>
      </div>
    </div>
  );

  // Show claim form (when ABN provided and no existing claim)
  if (showForm && abn) {
    return (
      <div className="max-w-xl mx-auto py-16">
        {successBanner}
        <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
          <div className="w-12 h-12 bg-bauhaus-yellow border-3 border-bauhaus-black flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="square" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Verification</p>
          <h1 className="text-2xl font-black text-bauhaus-black mb-4">Claim Your Profile</h1>
          <p className="text-bauhaus-muted font-medium leading-relaxed mb-6">
            Submit a claim to manage this charity&apos;s profile on CivicGraph. We&apos;ll verify your connection to the organisation.
          </p>

          {error && (
            <div className="bg-danger-light border-4 border-bauhaus-red p-3 text-sm font-bold text-bauhaus-red mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">ABN</label>
              <input type="text" value={abn} disabled className="w-full border-4 border-bauhaus-black/30 bg-bauhaus-canvas px-3 py-2 text-sm font-bold text-bauhaus-muted" />
            </div>
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Organisation Name</label>
              <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} required placeholder="e.g. A Curious Tractor Foundation" className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue" />
            </div>
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Your Name</label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} required placeholder="Your full name" className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue" />
            </div>
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Contact Email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue" />
            </div>
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Message (Optional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Tell us about your connection to this organisation..." className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y" />
            </div>
            <button type="submit" disabled={submitting || !abn} className="w-full bg-bauhaus-red text-white font-black uppercase tracking-widest py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm">
              {submitting ? 'Submitting...' : 'Submit Claim'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-bauhaus-black/10">
            <a href={`/charities/${abn}`} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
              &larr; Back to Profile
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Claims list view (main view for /charities/claim)
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      {successBanner}

      <div className="mb-8">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Account</p>
        <h1 className="text-2xl font-black text-bauhaus-black">My Claims</h1>
      </div>

      {claims.length === 0 ? (
        <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm text-center">
          <div className="w-12 h-12 bg-bauhaus-canvas border-3 border-bauhaus-black/20 flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-bauhaus-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="square" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-bauhaus-muted font-medium mb-4">You haven&apos;t claimed any charity profiles yet.</p>
          <a
            href="/charities"
            className="inline-block px-5 py-2.5 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors border-4 border-bauhaus-black"
          >
            Find Your Charity
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}

          <div className="pt-4">
            <a
              href="/charities"
              className="inline-block px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Claim Another Charity
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    verified: { bg: 'bg-green-500', text: 'text-white', label: 'Verified' },
    rejected: { bg: 'bg-bauhaus-red', text: 'text-white', label: 'Rejected' },
    pending: { bg: 'bg-bauhaus-yellow', text: 'text-bauhaus-black', label: 'Pending' },
  }[status] ?? { bg: 'bg-bauhaus-canvas', text: 'text-bauhaus-muted', label: status };

  return (
    <span className={`inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${config.bg} ${config.text} border-2 border-bauhaus-black`}>
      {config.label}
    </span>
  );
}

function ClaimCard({ claim }: { claim: Claim }) {
  const decisionDate = claim.verified_at || claim.rejected_at;
  return (
    <div className={`border-4 bg-white p-5 bauhaus-shadow-sm hover:translate-y-[-1px] transition-transform ${
      claim.status === 'rejected' ? 'border-bauhaus-red' : 'border-bauhaus-black'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-sm font-black text-bauhaus-black truncate">
              {claim.organisation_name || `ABN ${claim.abn}`}
            </h3>
            <StatusBadge status={claim.status} />
          </div>
          <div className="text-xs text-bauhaus-muted font-medium">
            ABN {claim.abn}
          </div>
          <div className="text-xs text-bauhaus-muted font-medium mt-1">
            Submitted {new Date(claim.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
            {decisionDate && (
              <> &middot; {claim.status === 'verified' ? 'Verified' : 'Reviewed'} {new Date(decisionDate).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {claim.status === 'verified' && (
            <a
              href={`/charities/${claim.abn}/edit`}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-red text-white hover:bg-bauhaus-black transition-colors border-2 border-bauhaus-black"
            >
              Edit Profile
            </a>
          )}
          <a
            href={`/charities/${claim.abn}`}
            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-red transition-colors"
          >
            View
          </a>
        </div>
      </div>
      {/* Admin feedback visible to claimant */}
      {claim.admin_notes && (
        <div className={`mt-3 pt-3 border-t-2 ${claim.status === 'rejected' ? 'border-bauhaus-red/20' : 'border-bauhaus-black/10'}`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
            {claim.status === 'verified' ? 'Reviewer Note' : claim.status === 'rejected' ? 'Reason' : 'Note'}
          </div>
          <p className="text-sm text-bauhaus-black font-medium">{claim.admin_notes}</p>
        </div>
      )}
      {/* Verified next steps */}
      {claim.status === 'verified' && !claim.admin_notes && (
        <div className="mt-3 pt-3 border-t-2 border-money/20">
          <p className="text-xs text-money font-bold">
            Your claim is verified. You can now edit your charity&apos;s profile, story, and description.
          </p>
        </div>
      )}
      {/* Rejected guidance */}
      {claim.status === 'rejected' && !claim.admin_notes && (
        <div className="mt-3 pt-3 border-t-2 border-bauhaus-red/20">
          <p className="text-xs text-bauhaus-red font-bold">
            This claim was not approved. If you believe this is an error, please contact hello@civicgraph.au.
          </p>
        </div>
      )}
    </div>
  );
}
