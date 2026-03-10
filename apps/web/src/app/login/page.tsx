'use client';

import { Suspense, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirect || '/tracker');
    router.refresh();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black px-6 py-4">
            <h1 className="text-lg font-black text-white uppercase tracking-widest">
              CivicGraph
            </h1>
            <p className="text-xs text-bauhaus-muted mt-1 uppercase tracking-wider">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
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
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-bauhaus-red text-white font-black uppercase tracking-widest py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-center text-sm text-bauhaus-muted font-medium">
              Don&apos;t have an account?{' '}
              <a href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'} className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                Create one
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
