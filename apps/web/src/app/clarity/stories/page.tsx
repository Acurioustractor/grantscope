import type { Metadata } from 'next';
import { getDirectServiceSupabase } from '@/lib/supabase';
import StoriesClient, { type LinkRow, type PublishedStory } from './StoriesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Stories · Clarity',
  description: 'Story ↔ project links. Project-mediated only; published titles only.',
};

/**
 * The linking surface shows ONLY published stories — already public elsewhere, so listing their
 * titles discloses nothing new. Transcripts (the consent-governed corpus) are linkable through
 * the same API but are never browsed here: declaring a transcript's project happens by id, from
 * the system that already holds the right to see it.
 */
async function load(): Promise<{ stories: PublishedStory[]; links: LinkRow[]; codes: string[] }> {
  const supabase = getDirectServiceSupabase();
  const [{ data: stories, error: e1 }, { data: links, error: e2 }, { data: codes, error: e3 }] =
    await Promise.all([
      supabase.from('stories').select('id,title,slug,story_type').eq('status', 'published').order('title'),
      supabase.from('clarity_story_project_link').select('story_table,story_id,project_code,declared_by'),
      supabase.from('clarity_project_code').select('code').order('code'),
    ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);
  return {
    stories: (stories ?? []) as unknown as PublishedStory[],
    links: (links ?? []) as unknown as LinkRow[],
    codes: ((codes ?? []) as { code: string }[]).map((c) => c.code),
  };
}

export default async function StoriesPage() {
  let stories: PublishedStory[] = [];
  let links: LinkRow[] = [];
  let codes: string[] = [];
  let error: string | null = null;
  try {
    ({ stories, links, codes } = await load());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      {error ? (
        <p className="border-4 border-bauhaus-red bg-bauhaus-white p-4 font-mono text-[13px]">
          Stories failed to load: {error}
        </p>
      ) : (
        <StoriesClient stories={stories} initialLinks={links} codes={codes} />
      )}
    </main>
  );
}
