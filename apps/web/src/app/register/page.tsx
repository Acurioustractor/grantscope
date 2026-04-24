'use client';

import { Suspense, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveAuthRedirect } from '@/lib/auth-redirect';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div></div>}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = resolveAuthRedirect(searchParams);
  const plan = searchParams.get('plan');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowser();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${redirectPath}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Sync to GHL (fire-and-forget)
    fetch('/api/contacts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {});

    if (data.session) {
      router.push(redirectPath);
      router.refresh();
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  const loginHref = redirectPath !== '/continue'
    ? `/login?redirect=${encodeURIComponent(redirectPath)}`
    : '/login';

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="border-4 border-bauhaus-black bg-white p-8">
            <div className="w-12 h-12 bg-money border-3 border-bauhaus-black flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="square" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-bauhaus-black mb-3">Check Your Email</h1>
            <p className="text-sm text-bauhaus-muted font-medium leading-relaxed mb-4">
              We&apos;ve sent a confirmation link to <span className="font-black text-bauhaus-black">{email}</span>. Click the link to activate your account.
            </p>
            <p className="text-xs text-bauhaus-muted font-medium leading-relaxed mb-4">
              After confirmation, we&apos;ll take you straight into profile setup and matched grants.
            </p>
            <a
              href={loginHref}
              className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red"
            >
              Back to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black px-6 py-4">
            <h1 className="text-lg font-black text-white uppercase tracking-widest">
              Create Account
            </h1>
            <p className="text-xs text-bauhaus-muted mt-1 uppercase tracking-wider">
              Start your funding pipeline
            </p>
          </div>

          <form onSubmit={handleRegister} className="p-6 space-y-4">
            {plan && (
              <div className="bg-link-light border-4 border-bauhaus-blue p-3 text-xs font-black text-bauhaus-blue uppercase tracking-widest">
                Selected plan: {plan}
              </div>
            )}
            {error && (
              <div className="bg-danger-light border-4 border-bauhaus-red p-3 text-sm font-bold text-bauhaus-red">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
              />
              <p className="text-xs text-bauhaus-muted mt-1">At least 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-bauhaus-red text-white font-black uppercase tracking-widest py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-bauhaus-muted font-medium">
              Already have an account?{' '}
              <a href={loginHref} className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                Sign in
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
