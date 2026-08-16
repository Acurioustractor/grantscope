import type { ReactNode } from 'react';
import Link from 'next/link';
import { pinnedViews } from '@/lib/view-registry';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer, hasSupabaseServerEnv } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { unstable_cache } from 'next/cache';
import { ShellHeader } from './shell-header';
import { RailNav } from './rail-nav';
import type { DataEvent } from './shell-menus';
import { Database } from '@phosphor-icons/react/dist/ssr';


const VIEW_DOT: Record<string, string> = {
  red: '#D02020',
  blue: '#1040C0',
  yellow: '#F0C020',
  green: '#059669',
  ink: '#6E6E6E',
};

async function recentDataEvents(): Promise<DataEvent[]> {
  try {
    const supabase = getDirectServiceSupabase();
    const { data, error } = await supabase
      .from('agent_runs')
      .select('id,agent_name,status,items_new,started_at')
      .order('started_at', { ascending: false })
      .limit(6);
    if (error) return [];
    return ((data ?? []) as {
      id: string;
      agent_name: string | null;
      status: string | null;
      items_new: number | null;
      started_at: string | null;
    }[]).map((r) => ({
      id: r.id,
      title: r.agent_name ?? 'agent run',
      detail:
        r.status === 'success' || r.status === 'completed'
          ? `${(r.items_new ?? 0).toLocaleString()} new items`
          : (r.status ?? 'unknown status'),
      at: r.started_at
        ? new Date(r.started_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        : '',
      failed: r.status !== 'success' && r.status !== 'completed' && r.status !== 'running',
    }));
  } catch {
    return [];
  }
}

async function currentUser(): Promise<{ email: string | null; isAdmin: boolean }> {
  if (!hasSupabaseServerEnv()) return { email: null, isAdmin: false };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    return { email, isAdmin: email ? isAdminEmail(email) : false };
  } catch {
    return { email: null, isAdmin: false };
  }
}

export interface ShellProps {
  title: string;
  /** Deprecated (phase 2): the rail derives its own active entry from the pathname. Kept so
   *  existing call sites keep compiling; the value is ignored. */
  activeHref?: string;
  children: ReactNode;
}

/** The softened-Bauhaus app shell: dark rail + header. DESIGN.md `.shell` theme, 2026-08-16. */
/** The rail's row-count chip was hardcoded '52.3M' — chrome without a data source, and it rots.
 *  Now summed daily from the catalogue's per-object row counts; absent on failure, never stale-guessed. */
const graphRows = unstable_cache(
  async () => {
    try {
      const supabase = getDirectServiceSupabase();
      const { data } = await supabase.rpc('clarity_graph_row_total');
      return typeof data === 'number' ? data : null;
    } catch {
      return null;
    }
  },
  ['shell-graph-rows'],
  { revalidate: 86400 },
);

export async function Shell({ title, children }: ShellProps) {
  const [events, user, totalRows] = await Promise.all([
    recentDataEvents(),
    currentUser(),
    graphRows(),
  ]);

  return (
    <div className="shell flex min-h-screen font-sans">
      <aside
        className="flex w-[236px] shrink-0 flex-col gap-1 px-4 py-5"
        style={{ background: 'var(--shell-rail)' }}
      >
        <Link href="/" className="flex items-center gap-2.5 px-1">
          <span
            className="inline-block h-[22px] w-[22px]"
            style={{ background: '#D02020', borderRadius: 'var(--shell-r-sm)' }}
          />
          <span className="font-display text-[15px] font-extrabold tracking-[0.15em] text-white">
            CIVICGRAPH
          </span>
        </Link>
        <div className="h-5" />
        <RailNav />
        <div className="h-6" />
        <div className="px-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A7A7A]">
          Saved views
        </div>
        {pinnedViews().map((v) => (
          <Link
            key={v.id}
            href={v.href}
            title={v.question}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px]"
            style={{ borderRadius: 'var(--shell-r-sm)', color: 'var(--shell-rail-text)' }}
          >
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ background: VIEW_DOT[v.colour], borderRadius: 2 }}
            />
            {v.name}
          </Link>
        ))}
        <div className="flex-1" />
        <Link
          href="/clarity"
          className="flex items-center gap-2.5 px-2.5 py-2"
          style={{
            borderRadius: 'var(--shell-r-sm)',
            background: '#1D1D1D',
            color: 'var(--shell-rail-text)',
          }}
        >
          <Database size={15} weight="bold" />
          <span className="font-mono text-[11.5px]">
            {totalRows ? `${(totalRows / 1e6).toFixed(1)}M rows on the graph` : 'The engine room'}
          </span>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellHeader title={title} events={events} userEmail={user.email} isAdmin={user.isAdmin} />
        <main className="flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
