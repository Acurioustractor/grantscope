'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Claim {
  id: string;
  abn: string;
  status: string;
  profile_description: string | null;
  profile_story: string | null;
  feature_narrative: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const params = useParams();
  const abn = params.abn as string;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [story, setStory] = useState('');
  const [featureNarrative, setFeatureNarrative] = useState('');

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(`/charities/${abn}/edit`)}`);
        return;
      }
      fetch('/api/charities/claim')
        .then(r => {
          if (r.status === 401) { router.push('/login'); return null; }
          return r.json();
        })
        .then((claims: Claim[] | null) => {
          if (!claims) return;
          const match = claims.find(c => c.abn === abn && c.status === 'verified');
          if (!match) {
            router.push(`/charities/${abn}`);
            return;
          }
          setClaim(match);
          setDescription(match.profile_description || '');
          setStory(match.profile_story || '');
          setFeatureNarrative(match.feature_narrative || '');
        })
        .catch(() => setError('Failed to load claim'))
        .finally(() => setLoading(false));
    });
  }, [abn, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!claim) return;
    setSaving(true);
    setError('');
    setSaved(false);

    const res = await fetch(`/api/charities/claim/${claim.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_description: description || null,
        profile_story: story || null,
        feature_narrative: featureNarrative || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to save');
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div>
      </div>
    );
  }

  if (!claim) return null;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <a href={`/charities/${abn}`} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Profile
      </a>

      <div className="mt-4 border-4 border-bauhaus-black bg-white p-8">
        <h1 className="text-2xl font-black text-bauhaus-black mb-2">Edit Profile</h1>
        <p className="text-sm text-bauhaus-muted font-medium mb-6">
          Update your charity&apos;s profile information. This will be shown on your public profile page.
        </p>

        {error && (
          <div className="bg-danger-light border-4 border-bauhaus-red p-3 text-sm font-bold text-bauhaus-red mb-4">
            {error}
          </div>
        )}

        {saved && (
          <div className="bg-money-light border-4 border-money p-3 text-sm font-bold text-money mb-4">
            Profile saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              Description
            </label>
            <p className="text-xs text-bauhaus-muted mb-2">
              A brief description of your organisation and what you do.
            </p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
              placeholder="Tell people about your organisation..."
            />
          </div>

          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              Your Story
            </label>
            <p className="text-xs text-bauhaus-muted mb-2">
              Share your experience navigating the grants system. What challenges have you faced?
            </p>
            <textarea
              value={story}
              onChange={e => setStory(e.target.value)}
              rows={6}
              className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
              placeholder="Share your story..."
            />
          </div>

          <div>
            <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
              Feature Request
            </label>
            <p className="text-xs text-bauhaus-muted mb-2">
              Want to be featured in our directory? Tell us why your work should be highlighted.
            </p>
            <textarea
              value={featureNarrative}
              onChange={e => setFeatureNarrative(e.target.value)}
              rows={4}
              className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
              placeholder="Why should your organisation be featured?"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-bauhaus-red text-white font-black uppercase tracking-widest py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
