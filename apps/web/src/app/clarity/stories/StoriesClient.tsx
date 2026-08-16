'use client';

import { useState } from 'react';

export interface PublishedStory {
  id: string;
  title: string;
  slug: string | null;
  story_type: string | null;
}

export interface LinkRow {
  story_table: string;
  story_id: string;
  project_code: string;
  declared_by: string;
}

/**
 * Declare "this story is about that project". The link is the ONLY bridge the design allows —
 * a story never links to data, an organisation, or a place. Enforcement is the admin-gated API;
 * this page only shows already-published stories, whose titles are already public.
 */
export default function StoriesClient({
  stories,
  initialLinks,
  codes,
}: {
  stories: PublishedStory[];
  initialLinks: LinkRow[];
  codes: string[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const transcriptLinks = links.filter((l) => l.story_table === 'transcripts').length;

  async function call(action: 'link' | 'unlink', storyId: string, code: string) {
    setBusy(storyId);
    setNote(null);
    try {
      const res = await fetch('/api/clarity/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, story_table: 'stories', story_id: storyId, project_code: code }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setLinks((ls) =>
        action === 'link'
          ? [...ls, { story_table: 'stories', story_id: storyId, project_code: code, declared_by: 'you' }]
          : ls.filter((l) => !(l.story_table === 'stories' && l.story_id === storyId && l.project_code === code)),
      );
    } catch (e) {
      setNote(`${action} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className="border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-mono text-2xl font-black">Stories</h1>
        <p className="mt-2 max-w-[75ch] text-[14px] leading-relaxed text-neutral-700">
          A story links to a <strong>project code</strong> — never to data, an organisation, or a
          place. That is the whole design: &ldquo;here is what we say about Goods, and here is what
          the data says about Goods&rdquo; meet on the project page, and nobody is triangulated.
          Only published stories are listed here; their titles are already public.
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          {stories.length} published stories · {links.length} links
          {transcriptLinks > 0 ? ` (${transcriptLinks} to transcripts, linked by id only)` : ''}
        </p>
        {note ? (
          <p className="mt-2 border-l-4 border-bauhaus-red pl-3 font-mono text-[12px]">{note}</p>
        ) : null}
      </header>

      <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
        <ul>
          {stories.map((s) => {
            const mine = links.filter((l) => l.story_table === 'stories' && l.story_id === s.id);
            return (
              <li key={s.id} className="border-b border-neutral-200 px-4 py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[14px] font-semibold">{s.title}</span>
                  {s.story_type ? (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                      {s.story_type}
                    </span>
                  ) : null}
                  {mine.map((l) => (
                    <button
                      key={l.project_code}
                      disabled={busy === s.id}
                      onClick={() => call('unlink', s.id, l.project_code)}
                      title="click to unlink"
                      className="border-2 border-bauhaus-blue bg-bauhaus-blue px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-white hover:border-bauhaus-red hover:bg-bauhaus-red disabled:opacity-40"
                    >
                      {l.project_code} ×
                    </button>
                  ))}
                  <select
                    disabled={busy === s.id}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) void call('link', s.id, e.target.value);
                    }}
                    className="border-2 border-neutral-300 bg-bauhaus-white px-1 py-0.5 font-mono text-[11px]"
                  >
                    <option value="">link a project…</option>
                    {codes
                      .filter((c) => !mine.some((l) => l.project_code === c))
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
        {stories.length === 0 ? (
          <p className="p-4 font-mono text-[12px] text-neutral-500">No published stories.</p>
        ) : null}
      </section>
    </>
  );
}
