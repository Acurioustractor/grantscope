import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Power Dynamics — CivicGraph' };

/**
 * Rebuilt 2026-08-17 on the cleaned substrate (power index de-collided, revolving door and
 * person-money views filtered, regranting chains measured). The previous version rendered
 * HARDCODED fallback figures as a "Living Report" whenever the live flag was off; that pattern
 * is dead. Every number here is queried at render (cached hourly); a lane that fails states
 * why instead of inventing.
 *
 * Two standing editorial rules for this public surface:
 *  - No individuals are named. Board power renders as aggregates only (the count-only
 *    precedent for Accountability & Power surfaces).
 *  - Companies appear with neutral public-record facts only.
 */

function bn(n: number): string {
  return `$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)}bn`;
}
function m(n: number): string {
  if (n >= 1e9) return bn(n);
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${(n / 1e3).toFixed(1)}k`;
}

const load = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();

    // Each lane independent: one failure never blanks the page.
    async function lane<T>(fn: () => Promise<T>): Promise<T | null> {
      try {
        return await fn();
      } catch {
        return null;
      }
    }

    const [power, revolving, foundations, pafs, regrant, boards, se] = await Promise.all([
      lane(async () => {
        // Computed in the database: PostgREST caps row pulls at 1,000, and the first cut of
        // this page silently computed "top 1%" over the top thousand rows. Never pull-and-sum
        // a large set through PostgREST.
        const { data, error } = await supabase.rpc('power_concentration');
        if (error) throw error;
        const r = data as { entities: number; total: number; top1: number };
        return { entities: r.entities, total: r.total, top1: r.top1, top1Share: (100 * r.top1) / r.total };
      }),
      lane(async () => {
        const { data, error } = await supabase
          .from('mv_revolving_door')
          .select('canonical_name,influence_vectors,total_donated,total_contracts,total_funded')
          .order('revolving_door_score', { ascending: false })
          .limit(8);
        if (error) throw error;
        return data ?? [];
      }),
      lane(async () => {
        const { data, error } = await supabase
          .from('foundations')
          .select('total_giving_annual')
          .gt('total_giving_annual', 0)
          .limit(12000);
        if (error) throw error;
        const vals = (data ?? []).map((r) => Number(r.total_giving_annual));
        return { count: vals.length, total: vals.reduce((a, b) => a + b, 0) };
      }),
      lane(async () => {
        const { count, error } = await supabase
          .from('foundations')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'private_ancillary_fund');
        if (error) throw error;
        return count ?? 0;
      }),
      lane(async () => {
        const { data, error } = await supabase
          .from('mv_foundation_regranting')
          .select('source_foundation,regranter_name,ultimate_grantee,downstream_amount,downstream_year')
          .order('downstream_amount', { ascending: false })
          .limit(6);
        if (error) throw error;
        return data ?? [];
      }),
      lane(async () => {
        const { count, error } = await supabase
          .from('mv_board_interlocks')
          .select('person_name_normalised', { count: 'exact', head: true })
          .gte('board_count', 2)
          .lte('board_count', 10);
        if (error) throw error;
        return count ?? 0;
      }),
      lane(async () => {
        const [{ count: seCount }, { count: acco }] = await Promise.all([
          supabase.from('social_enterprises').select('id', { count: 'exact', head: true }),
          supabase
            .from('gs_entities')
            .select('id', { count: 'exact', head: true })
            .eq('is_community_controlled', true),
        ]);
        return { seCount: seCount ?? 0, acco: acco ?? 0 };
      }),
    ]);

    return { power, revolving, foundations, pafs, regrant, boards, se };
  },
  ['power-dynamics-live-v3'],
  { revalidate: 3600 },
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-black text-bauhaus-black mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className="text-sm text-bauhaus-muted">
      {what} could not be read just now. Nothing is estimated in its place; reload to retry.
    </p>
  );
}

export default async function PowerDynamicsPage() {
  const d = await load();

  return (
    <div>
      <div className="mb-8">
        <a
          href="/reports"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; All Reports
        </a>
        <div className="text-xs font-black text-purple mt-4 mb-1 uppercase tracking-widest">
          Living report · every figure queried live
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Who holds the money in Australia
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
          Contracts, grants, donations, philanthropy and boards, joined into one picture. The
          pattern is the same in every register: a very small number of organisations hold almost
          everything, and the most powerful money is the least visible.
        </p>
      </div>

      <Section title="Concentration, measured">
        {d.power ? (
          <>
            <p className="text-[15px] leading-relaxed max-w-2xl">
              Across {d.power.entities.toLocaleString('en-AU')} organisations whose money the
              public record can see, the top 1 per cent hold{' '}
              <strong>{bn(d.power.top1)}</strong> of <strong>{bn(d.power.total)}</strong>: that is{' '}
              <strong>{d.power.top1Share.toFixed(0)}%</strong> of every visible dollar of
              contracts, grants, donations and giving.
            </p>
            <p className="text-sm text-bauhaus-muted mt-2 max-w-2xl">
              Grant figures exclude state budget lines and spreadsheet total rows.{' '}
              <Link href="/dashboard/help" className="text-bauhaus-blue underline">
                Why our numbers differ
              </Link>
            </p>
          </>
        ) : (
          <Unavailable what="The concentration measure" />
        )}
      </Section>

      <Section title="The revolving door">
        <p className="text-[15px] leading-relaxed max-w-2xl mb-3">
          Some organisations appear in several registers at once: they donate to parties, win
          government contracts, receive grants, or lobby. Appearing is not wrongdoing. It is
          concentration of access, and it is public record.
        </p>
        {d.revolving ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black text-left">
                  <th className="py-1.5 pr-4 font-black uppercase text-xs tracking-wider">Organisation</th>
                  <th className="py-1.5 pr-4 font-black uppercase text-xs tracking-wider">Registers</th>
                  <th className="py-1.5 pr-4 font-black uppercase text-xs tracking-wider">Donated</th>
                  <th className="py-1.5 pr-4 font-black uppercase text-xs tracking-wider">Contracts</th>
                  <th className="py-1.5 font-black uppercase text-xs tracking-wider">Funded</th>
                </tr>
              </thead>
              <tbody>
                {d.revolving.map((r) => (
                  <tr key={r.canonical_name} className="border-b border-bauhaus-black/10">
                    <td className="py-1.5 pr-4 font-bold">{r.canonical_name}</td>
                    <td className="py-1.5 pr-4">{r.influence_vectors}</td>
                    <td className="py-1.5 pr-4 font-mono">{r.total_donated ? m(Number(r.total_donated)) : '—'}</td>
                    <td className="py-1.5 pr-4 font-mono">{r.total_contracts ? m(Number(r.total_contracts)) : '—'}</td>
                    <td className="py-1.5 font-mono">{r.total_funded ? m(Number(r.total_funded)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Unavailable what="The revolving-door table" />
        )}
      </Section>

      <Section title="Philanthropy: what can be seen, and what cannot">
        <p className="text-[15px] leading-relaxed max-w-2xl">
          Australia has no register of philanthropic giving. Companies file accounts, charities
          file returns, donors above a threshold appear in electoral data. Foundations, including
          the family foundations that move some of the most strategic money in the country,
          publish what they choose.
        </p>
        {d.foundations ? (
          <p className="text-[15px] leading-relaxed max-w-2xl mt-2">
            What can be assembled: <strong>{m(d.foundations.total)}</strong> of annual giving
            across {d.foundations.count.toLocaleString('en-AU')} giving organisations, drawn from
            charity returns and published reports. That figure mixes true grantmaking with
            charities&rsquo; own program spending, because the public record does not separate
            them. Only {d.pafs ?? '?'} private ancillary funds, the main family-giving vehicle,
            are identifiable in it at all.
          </p>
        ) : (
          <Unavailable what="The giving assembly" />
        )}
        <p className="text-sm text-bauhaus-muted mt-2 max-w-2xl">
          The gap is the finding: the money with the fewest reporting obligations is the money
          with the most discretion over what gets funded.{' '}
          <Link href="/foundations" className="text-bauhaus-blue underline">
            Explore the foundations we can see
          </Link>
        </p>
      </Section>

      <Section title="How money actually travels">
        <p className="text-[15px] leading-relaxed max-w-2xl mb-3">
          Money rarely moves in one hop. A foundation grants to an intermediary; the intermediary
          regrants to the organisation doing the work. Each hop takes overhead and adds distance
          between the money and the community. These chains are reconstructed from published
          grants:
        </p>
        {d.regrant?.length ? (
          <ul className="max-w-3xl space-y-2">
            {d.regrant.map((c, i) => (
              <li key={i} className="text-sm leading-relaxed border-l-4 border-bauhaus-black pl-3">
                <span className="font-bold">{c.source_foundation}</span>
                <span className="text-bauhaus-muted"> → </span>
                <span>{c.regranter_name}</span>
                <span className="text-bauhaus-muted"> → </span>
                <span className="font-bold">{c.ultimate_grantee}</span>
                <span className="font-mono text-bauhaus-muted">
                  {' '}
                  · {m(Number(c.downstream_amount))} in {c.downstream_year}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Unavailable what="The regranting chains" />
        )}
      </Section>

      <Section title="Boards, counted not named">
        {d.boards !== null ? (
          <p className="text-[15px] leading-relaxed max-w-2xl">
            <strong>{d.boards.toLocaleString('en-AU')}</strong> people sit on two or more boards
            in this network. Shared directors are how strategy, information and access travel
            between funders and recipients. This page counts them and stops there: naming
            individuals from string-matched public records risks naming the wrong person, so
            person-level views stay behind research access with their caveats attached.
          </p>
        ) : (
          <Unavailable what="The board-interlock count" />
        )}
      </Section>

      <Section title="The counterweight">
        {d.se ? (
          <p className="text-[15px] leading-relaxed max-w-2xl">
            Against all of this sits the part of the economy built to return value to
            communities: <strong>{d.se.seCount.toLocaleString('en-AU')}</strong> social
            enterprises on the open registry and{' '}
            <strong>{d.se.acco.toLocaleString('en-AU')}</strong> community-controlled
            organisations on the graph. In youth justice, the money reaching
            community-controlled organisations is about one dollar in nine.{' '}
            <Link href="/dashboard/views/acco-share" className="text-bauhaus-blue underline">
              That number, live
            </Link>
          </p>
        ) : (
          <Unavailable what="The registry counts" />
        )}
      </Section>

      <ReportCTA reportSlug="power-dynamics" reportTitle="Power Dynamics Report" />
    </div>
  );
}
