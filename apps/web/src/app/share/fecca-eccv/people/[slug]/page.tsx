import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';

type BoardRow = {
  entity_id: string;
  entity_name: string;
  entity_gs_id: string | null;
  abn: string | null;
  entity_type: string | null;
  relationship_type: string;
  dataset: string | null;
  role: string | null;
};

type InfluenceRow = {
  board_count: number | null;
  total_procurement: number | null;
  total_contracts: number | null;
  total_justice: number | null;
  total_donations: number | null;
  max_influence_score: number | null;
  financial_system_count: number | null;
  entity_types: string[] | null;
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

// Allowed-list: only persons who sit on FECCA / ECCV boards can be drilled into
// from /share/fecca-eccv/. Prevents anyone from reusing the share URL pattern
// to look up arbitrary people.
async function getAllowedPersonIds() {
  const supabase = getLiveReportSupabase();
  const data = await safe(supabase.rpc('exec_sql', {
    query: `
      SELECT DISTINCT src.gs_id
      FROM public.gs_relationships r
      JOIN public.gs_entities src ON src.id = r.source_entity_id
      JOIN public.gs_entities tgt ON tgt.id = r.target_entity_id
      WHERE tgt.abn IN ('23684792947','65071572705')
        AND r.relationship_type = 'directorship'
        AND src.gs_id LIKE 'GS-PERSON-%'
    `,
  })) as Array<{ gs_id: string }> | null;
  return new Set((data ?? []).map(r => r.gs_id));
}

async function getPersonProfile(gsId: string) {
  const supabase = getLiveReportSupabase();
  const safeId = gsId.replace(/'/g, "''");
  const [boards, influence] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT te.id::text AS entity_id,
               te.canonical_name AS entity_name,
               te.gs_id AS entity_gs_id,
               te.abn,
               te.entity_type,
               r.relationship_type,
               r.dataset,
               r.properties->>'role' AS role
        FROM public.gs_relationships r
        JOIN public.gs_entities src ON src.id = r.source_entity_id
        JOIN public.gs_entities te ON te.id = r.target_entity_id
        WHERE src.gs_id = '${safeId}'
          AND r.relationship_type IN ('directorship', 'shared_director', 'trustee_of', 'affiliated_with')
        ORDER BY te.canonical_name
      `,
    })) as Promise<BoardRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `
        SELECT pi.board_count, pi.total_procurement::bigint, pi.total_contracts,
               pi.total_justice::bigint, pi.total_donations::bigint,
               pi.max_influence_score::int, pi.financial_system_count::int,
               pi.entity_types
        FROM public.mv_person_influence pi
        JOIN public.gs_entities e ON LOWER(e.canonical_name) = LOWER(pi.person_name)
        WHERE e.gs_id = '${safeId}'
        LIMIT 1
      `,
    })) as Promise<InfluenceRow[] | null>,
  ]);
  return { boards: boards ?? [], influence: influence?.[0] || null };
}

async function getPersonName(gsId: string) {
  const supabase = getLiveReportSupabase();
  const safeId = gsId.replace(/'/g, "''");
  const data = await safe(supabase.rpc('exec_sql', {
    query: `SELECT canonical_name FROM public.gs_entities WHERE gs_id = '${safeId}' LIMIT 1`,
  })) as Array<{ canonical_name: string }> | null;
  return data?.[0]?.canonical_name || null;
}

export default async function SharePersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const allowed = await getAllowedPersonIds();
  if (!allowed.has(slug)) notFound();

  const [name, profile] = await Promise.all([getPersonName(slug), getPersonProfile(slug)]);
  if (!name) notFound();

  // Group boards by relationship type
  const directorships = profile.boards.filter(b => b.relationship_type === 'directorship' || b.relationship_type === 'shared_director');
  const otherRoles = profile.boards.filter(b => !['directorship', 'shared_director'].includes(b.relationship_type));
  const inf = profile.influence;

  return (
    <div>
      {/* breadcrumb back to dashboard */}
      <div className="mb-6">
        <Link href="/share/fecca-eccv" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          ← Dashboard
        </Link>
      </div>

      <div className="mb-10">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-1">Director Profile</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-3 uppercase tracking-tight leading-tight">{name}</h1>
        <p className="text-base text-bauhaus-muted leading-relaxed font-medium max-w-3xl">
          Connected to FECCA or ECCV via at least one current directorship. Below is what CivicGraph has on this person across {profile.boards.length} board / advisory positions in our dataset.
        </p>
      </div>

      {/* Influence stats */}
      {inf && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <div className="border-4 border-bauhaus-black p-4 bg-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Board Count</div>
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{inf.board_count ?? profile.boards.length}</div>
          </div>
          <div className="border-4 border-bauhaus-black p-4 bg-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">$ in Network — Procurement</div>
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{money(inf.total_procurement)}</div>
          </div>
          <div className="border-4 border-bauhaus-black p-4 bg-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">$ in Network — Justice</div>
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{money(inf.total_justice)}</div>
          </div>
          <div className="border-4 border-bauhaus-black p-4 bg-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Influence Score</div>
            <div className="text-2xl font-black text-bauhaus-red tabular-nums">{inf.max_influence_score ?? '—'}</div>
          </div>
        </div>
      )}

      {/* Directorships */}
      <section className="mb-10">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Boards &amp; Directorships ({directorships.length})</h2>
        {directorships.length === 0 ? (
          <p className="text-bauhaus-muted font-medium">No directorships in dataset.</p>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Type</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Role</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Source</th>
                </tr>
              </thead>
              <tbody>
                {directorships.map((b, i) => (
                  <tr key={`${b.entity_id}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{b.entity_name}</td>
                    <td className="p-3 text-xs uppercase tracking-widest text-bauhaus-muted whitespace-nowrap">{b.entity_type ?? '—'}</td>
                    <td className="p-3 text-xs">{b.role ?? 'Director'}</td>
                    <td className="p-3 text-xs font-mono text-bauhaus-muted whitespace-nowrap">{b.dataset ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {otherRoles.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Other Roles ({otherRoles.length})</h2>
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Relationship</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Source</th>
                </tr>
              </thead>
              <tbody>
                {otherRoles.map((b, i) => (
                  <tr key={`${b.entity_id}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{b.entity_name}</td>
                    <td className="p-3 text-xs uppercase tracking-widest text-bauhaus-muted whitespace-nowrap">{b.relationship_type.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs font-mono text-bauhaus-muted whitespace-nowrap">{b.dataset ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-4 border-bauhaus-black p-6 bg-bauhaus-yellow mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Want this depth on every director in your sector?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed text-sm mb-4 max-w-3xl">
          CivicGraph has profiles like this for thousands of Australian board members. Map an entire sector&apos;s shadow network, surface conflicts, see who&apos;s on whose pipeline. Tell us what would be most useful and how you&apos;d use it.
        </p>
        <Link href="/feedback?subject=fecca-eccv" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback →</Link>
      </section>
    </div>
  );
}
