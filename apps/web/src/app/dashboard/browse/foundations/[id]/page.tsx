import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Foundation — CivicGraph' };

/** One foundation, everything we know: what it is, its giving, who it funds, its people, and
 *  where it connects. Every link states its method and confidence — a string-matched board path
 *  is a lead, not a fact. */

function money(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

async function load(id: string) {
  const supabase = getDirectServiceSupabase();
  const [{ data: fs }, { data: grantees }, { data: board }, { data: chains }] = await Promise.all([
    supabase
      .from('foundations')
      .select('id,name,acnc_abn,type,total_giving_annual,avg_grant_size,thematic_focus,geographic_focus,website')
      .eq('id', id)
      .limit(1),
    supabase
      .from('mv_foundation_grantees')
      .select('grantee_gs_id,grantee_name,grantee_type,grantee_state,grantee_community_controlled,grant_amount,grant_year,link_method')
      .eq('foundation_id', id)
      .order('grant_year', { ascending: false })
      .limit(200),
    supabase
      .from('funder_board_paths')
      .select('person_name,role_at_funder,connected_entity_name,connected_entity_type,role_at_connected,identity_confidence,collision_risk')
      .eq('foundation_id', id)
      .limit(100),
    supabase
      .from('mv_foundation_regranting')
      .select('source_foundation,regranter_name,ultimate_grantee,downstream_amount,downstream_year')
      .eq('foundation_id', id)
      .limit(0)
      .then(async (r) => r), // regranting keys by name below
  ]);
  void chains;
  if (!fs?.length) return null;
  const f = fs[0];
  const { data: regrant } = await supabase
    .from('mv_foundation_regranting')
    .select('regranter_name,ultimate_grantee,downstream_amount,downstream_year')
    .eq('source_abn', f.acnc_abn ?? '—')
    .limit(10);
  const { data: entity } = f.acnc_abn
    ? await supabase.from('gs_entities').select('gs_id').eq('abn', f.acnc_abn).limit(1)
    : { data: null };
  return { f, grantees: grantees ?? [], board: board ?? [], regrant: regrant ?? [], gsId: entity?.[0]?.gs_id ?? null };
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 shell-card">
      <h2
        className="flex flex-wrap items-baseline gap-2 px-4 py-2 font-display text-[14px] font-bold"
        style={{ borderBottom: '1px solid var(--shell-line)' }}
      >
        {title}
        {note ? (
          <span className="font-mono text-[10px] font-normal uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
            {note}
          </span>
        ) : null}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function FoundationProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { f, grantees, board, regrant, gsId } = data;

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <Link href="/dashboard/browse/foundations" className="font-mono text-[11px] font-black uppercase tracking-widest" style={{ color: '#1040C0' }}>
        ◂ Foundations
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-[22px] font-extrabold">{f.name}</h1>
        {gsId ? (
          <Link href={`/entity/${gsId}`} className="font-mono text-[11px] font-black uppercase tracking-widest hover:underline" style={{ color: '#1040C0' }}>
            atlas page ↗
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        {f.type ? `${String(f.type).replace(/_/g, ' ')} · ` : ''}
        {f.acnc_abn ? `ABN ${f.acnc_abn} · ` : ''}
        giving {money(f.total_giving_annual)} / yr
        {f.avg_grant_size ? ` · average grant ${money(f.avg_grant_size)}` : ''}
        {Array.isArray(f.thematic_focus) && f.thematic_focus.length ? ` · focus: ${f.thematic_focus.slice(0, 5).join(', ')}` : ''}
      </p>

      <Section title="Who it funds" note={`${grantees.length} linked grantees${grantees.length === 200 ? ' (first 200)' : ''}${grantees.filter((g) => !g.grant_amount).length > 0 ? ` · ${grantees.filter((g) => !g.grant_amount).length} with no amount on record` : ''} · each link states its method`}>
        {grantees.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--shell-muted)' }}>
            No grantee links recorded. That is a statement about our data, not about the foundation.
          </p>
        ) : (
          <div className="grid gap-1">
            {grantees.map((g, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 py-1" style={{ borderBottom: '1px solid var(--shell-line)' }}>
                {g.grantee_gs_id ? (
                  <Link href={`/entity/${g.grantee_gs_id}`} className="min-w-0 flex-1 truncate text-[13px] font-semibold hover:underline" style={{ color: '#1040C0' }}>
                    {g.grantee_name}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{g.grantee_name}</span>
                )}
                {g.grantee_community_controlled ? (
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider" style={{ color: '#1E8E3E' }}>
                    community-controlled
                  </span>
                ) : null}
                <span className="font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
                  {g.grantee_type ?? '—'} · {g.grantee_state ?? '—'} · {g.grant_year ?? '—'}
                  {g.grant_amount ? ` · ${money(Number(g.grant_amount))}` : ''} · via {g.link_method}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Its people, and where else they sit" note="string-matched identities — a lead, not a fact; confidence shown">
        {board.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--shell-muted)' }}>No board paths recorded.</p>
        ) : (
          <div className="grid gap-1">
            {board.map((b, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 py-1 text-[13px]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
                <span className="font-semibold">{b.person_name}</span>
                <span style={{ color: 'var(--shell-muted)' }}>
                  {String(b.role_at_funder ?? '').replace(/_/g, ' ')} here · also {String(b.role_at_connected ?? '').replace(/_/g, ' ')} at
                </span>
                <span className="font-semibold">{b.connected_entity_name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: b.identity_confidence === 'high' ? '#1E8E3E' : 'var(--shell-muted)' }}>
                  {b.identity_confidence} confidence{b.collision_risk && b.collision_risk !== 'low' ? ` · ${b.collision_risk} collision risk` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {regrant.length > 0 ? (
        <Section title="Money that travels through intermediaries" note="reconstructed from published grants">
          <ul className="grid gap-1.5">
            {regrant.map((c, i) => (
              <li key={i} className="text-[13px]" style={{ borderLeft: '3px solid var(--shell-line)', paddingLeft: 10 }}>
                → {c.regranter_name} → <span className="font-semibold">{c.ultimate_grantee}</span>
                <span className="font-mono" style={{ color: 'var(--shell-muted)' }}>
                  {' '}· {c.downstream_amount ? money(Number(c.downstream_amount)) : '—'} in {c.downstream_year}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
