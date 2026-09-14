import { notFound } from 'next/navigation';
import { isAdminEmail } from '@/lib/admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getActGrantsDesk, type DeskGrant } from '@/lib/services/act-grants-desk';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'ACT — Grants Desk' };
}

function money(min: number | null, max: number | null): string {
  const f = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`);
  if (max && max > 0) return min && min > 0 && min !== max ? `${f(min)}–${f(max)}` : f(max);
  if (min && min > 0) return `from ${f(min)}`;
  return 'Not published';
}

function ClosePill({ grant }: { grant: DeskGrant }) {
  if (grant.daysToClose == null) return <span className="text-[11px] font-bold uppercase tracking-wider text-bauhaus-muted">No close date</span>;
  const d = grant.daysToClose;
  const cls = d <= 14 ? 'bg-bauhaus-red text-white' : d <= 45 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'border-2 border-bauhaus-black bg-white text-bauhaus-black';
  return <span className={`px-2 py-0.5 font-mono text-[11px] font-black uppercase tracking-wider ${cls}`}>{d === 0 ? 'Today' : `${d}d`}</span>;
}

export default async function ActGrantsDeskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();

  // Middleware only checks for a session and signup is open, so this page checks who is looking.
  // act_private_grant_rounds is ACT-internal (migration 20260914170000): nobody else may see it.
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const { grants, generatedAt } = await getActGrantsDesk();
  const dated = grants.filter((g) => g.daysToClose != null);
  const within30 = dated.filter((g) => (g.daysToClose ?? 99) <= 30).length;
  const privateCount = grants.filter((g) => g.origin === 'act-private').length;

  return (
    <main className="min-h-screen bg-bauhaus-canvas px-4 py-8 text-bauhaus-black lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">ACT only · not public</p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight">Grants desk</h1>
        <p className="mt-2 max-w-3xl text-sm">
          Every live grant, soonest close first. Eligibility per ACT entity and project fit come next; nothing here says ACT can apply yet.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-0 border-4 border-bauhaus-black bg-white sm:grid-cols-4">
          {[
            ['Live grants', grants.length],
            ['Close within 30 days', within30],
            ['No close date', grants.length - dated.length],
            ['Private SmartyGrants rounds', privateCount],
          ].map(([label, value]) => (
            <div key={label} className="border-bauhaus-black p-4 [&:not(:last-child)]:border-r-4">
              <dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</dt>
              <dd className="mt-1 text-3xl font-black tabular-nums">{value.toLocaleString('en-AU')}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 overflow-x-auto border-4 border-bauhaus-black bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr className="text-[11px] font-black uppercase tracking-widest">
                <th className="px-3 py-2">Closes</th>
                <th className="px-3 py-2">Grant</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Where</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={`${g.origin}-${g.id}`} className="border-t-2 border-bauhaus-black/10 align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    <ClosePill grant={g} />
                    {g.closeDate ? <div className="mt-1 font-mono text-[11px]">{g.closeDate}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    {g.url ? <a href={g.url} target="_blank" rel="noreferrer" className="font-bold text-bauhaus-blue hover:underline">{g.name}</a> : <span className="font-bold">{g.name}</span>}
                    <div className="text-xs text-bauhaus-muted">{g.provider ?? 'Funder not recorded'}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{money(g.amountMin, g.amountMax)}</td>
                  <td className="px-3 py-2 text-xs">{g.geography ?? 'Unknown'}</td>
                  <td className="px-3 py-2">
                    {g.origin === 'act-private'
                      ? <span className="bg-bauhaus-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Private</span>
                      : <span className="font-mono text-[11px]">{g.source ?? '—'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[11px] text-bauhaus-muted">Generated {new Date(generatedAt).toLocaleString('en-AU')}</p>
      </div>
    </main>
  );
}
