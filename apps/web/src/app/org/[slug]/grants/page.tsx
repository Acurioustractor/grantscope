import { notFound, redirect } from 'next/navigation';
import { isAdminEmail } from '@/lib/admin';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isActSlug } from '@/lib/services/fast-local-org';
import Link from 'next/link';
import { getActGrantsDesk, type DeskGrant } from '@/lib/services/act-grants-desk';
import { ACT_PROJECTS, ENTITY_LABEL, type ActProject, type Verdict } from '@/lib/act-grant-eligibility';

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

const VERDICT_CLS: Record<Verdict, string> = {
  yes: 'bg-money text-white',
  no: 'bg-bauhaus-red text-white',
  unknown: 'border-2 border-bauhaus-black/30 bg-white text-bauhaus-muted',
};

function VerdictTag({ verdict, children }: { verdict: Verdict; children: React.ReactNode }) {
  return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${VERDICT_CLS[verdict]}`}>{children}</span>;
}

function isProject(v: string | undefined): v is ActProject {
  return !!v && v in ACT_PROJECTS;
}

function FitPill({ score }: { score: number }) {
  const cls = score >= 60 ? 'bg-money text-white' : score >= FIT_THRESHOLD ? 'bg-bauhaus-yellow text-bauhaus-black' : 'border-2 border-bauhaus-black/30 bg-white text-bauhaus-muted';
  return <span className={`inline-block px-2 py-0.5 font-mono text-[11px] font-black tabular-nums ${cls}`}>{score}</span>;
}

const FIT_THRESHOLD = 20;

function ClosePill({ grant }: { grant: DeskGrant }) {
  if (grant.daysToClose == null) return <span className="text-[11px] font-bold uppercase tracking-wider text-bauhaus-muted">No close date</span>;
  const d = grant.daysToClose;
  const cls = d <= 14 ? 'bg-bauhaus-red text-white' : d <= 45 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'border-2 border-bauhaus-black bg-white text-bauhaus-black';
  return <span className={`px-2 py-0.5 font-mono text-[11px] font-black uppercase tracking-wider ${cls}`}>{d === 0 ? 'Today' : `${d}d`}</span>;
}

export default async function ActGrantsDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ project?: string; show?: string; limit?: string }>;
}) {
  const { slug } = await params;
  // Folded into the One Desk (Ben, 2026-09-26) now that private SmartyGrants rounds and who-can-apply show
  // there. The page is kept: it is the only view of every live round, tagged or not.
  if (isActSlug(slug)) redirect(`/org/${slug}/desk?kind=grant`);
  const sp = await searchParams;
  const project = isProject(sp.project) ? sp.project : null;
  const showRuledOut = sp.show === 'all';
  if (!isActSlug(slug)) notFound();

  // Middleware only checks for a session and signup is open, so this page checks who is looking.
  // act_private_grant_rounds is ACT-internal (migration 20260914170000): nobody else may see it.
  // "Continue locally as A Curious Tractor" signs nobody in; it relies on the same dev-only escape hatch as
  // middleware, which NODE_ENV hard-guards against production.
  const localBypass = process.env.NODE_ENV !== 'production' && process.env.SKIP_AUTH_LOCAL === '1';
  if (!localBypass) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) notFound();
  }

  const desk = await getActGrantsDesk();
  const { generatedAt } = desk;
  const elig = (g: DeskGrant) => (project ? g.eligibility.find((e) => e.project === project) ?? null : null);
  const fit = (g: DeskGrant) => (project ? g.fitScore[project] ?? 0 : null);
  // "show all" reveals both filters a project view hides by default: ruled out (can't apply)
  // and below-threshold fit (no signal it matches this project). Same one toggle, two reasons.
  const ruledOut = project ? desk.grants.filter((g) => elig(g)?.overall === 'no').length : 0;
  const eligibleForFit = project ? desk.grants.filter((g) => elig(g)?.overall !== 'no') : desk.grants;
  const lowFit = project ? eligibleForFit.filter((g) => (fit(g) ?? 0) < FIT_THRESHOLD).length : 0;
  const grants = project && !showRuledOut
    ? eligibleForFit.filter((g) => (fit(g) ?? 0) >= FIT_THRESHOLD)
    : desk.grants;
  if (project) {
    grants.sort((a, b) => {
      const fa = fit(a) ?? 0;
      const fb = fit(b) ?? 0;
      if (fa !== fb) return fb - fa;
      if (a.closeDate && b.closeDate) return a.closeDate.localeCompare(b.closeDate) || a.name.localeCompare(b.name);
      if (a.closeDate) return -1;
      if (b.closeDate) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  const base = `/org/${slug}/grants`;
  // ~3,700 rows of tags is a slow page on any machine: render the soonest 300, more on request.
  const limit = Math.max(300, Number(sp.limit) || 300);
  const shown = grants.slice(0, limit);
  const moreHref = `${base}?${new URLSearchParams({ ...(project ? { project } : {}), ...(showRuledOut ? { show: 'all' } : {}), limit: String(limit + 500) })}`;
  const dated = grants.filter((g) => g.daysToClose != null);
  const within30 = dated.filter((g) => (g.daysToClose ?? 99) <= 30).length;
  const privateCount = grants.filter((g) => g.origin === 'act-private').length;

  return (
    <main className="min-h-screen bg-bauhaus-canvas px-4 py-8 text-bauhaus-black lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">ACT only · not public</p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight">Grants desk</h1>
        <p className="mt-2 max-w-3xl text-sm">
          Pick a project to rank grants by fit and see which ACT entity can apply and whether it operates where the grant is limited to.
          With no project picked there is no fit signal, so the list falls back to soonest close first.
          Most grants do not record DGR or company rules, so most eligibility answers are unknown: read the guidelines before applying.
        </p>

        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Project">
          <Link href={base} className={`border-2 border-bauhaus-black px-3 py-1.5 text-xs font-black uppercase tracking-widest ${!project ? 'bg-bauhaus-black text-white' : 'bg-white'}`}>All grants</Link>
          {(Object.keys(ACT_PROJECTS) as ActProject[]).map((p) => (
            <Link key={p} href={`${base}?project=${p}`} className={`border-2 border-bauhaus-black px-3 py-1.5 text-xs font-black uppercase tracking-widest ${project === p ? 'bg-bauhaus-black text-white' : 'bg-white'}`}>{ACT_PROJECTS[p].label}</Link>
          ))}
        </nav>
        {project ? (
          <p className="mt-3 text-sm">
            <strong>{ACT_PROJECTS[project].label}</strong> applies through {ACT_PROJECTS[project].entities.map((e) => ENTITY_LABEL[e]).join(' or ')}. Ranked by fit, soonest close breaks ties.{' '}
            {ruledOut.toLocaleString('en-AU')} ruled out by entity or place, {lowFit.toLocaleString('en-AU')} with no fit signal for this project hidden{' '}
            {showRuledOut
              ? <Link className="font-bold text-bauhaus-blue underline" href={`${base}?project=${project}`}>hide them</Link>
              : <Link className="font-bold text-bauhaus-blue underline" href={`${base}?project=${project}&show=all`}>show everything</Link>}.
          </p>
        ) : null}

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
                {project ? <th className="px-3 py-2">Fit</th> : null}
                <th className="px-3 py-2">Closes</th>
                <th className="px-3 py-2">Grant</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Where</th>
                {project ? <th className="px-3 py-2">Can apply</th> : null}
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={`${g.origin}-${g.id}`} className="border-t-2 border-bauhaus-black/10 align-top">
                  {project ? <td className="whitespace-nowrap px-3 py-2"><FitPill score={fit(g) ?? 0} /></td> : null}
                  <td className="whitespace-nowrap px-3 py-2">
                    <ClosePill grant={g} />
                    {g.closeDate ? <div className="mt-1 font-mono text-[11px]">{g.closeDate}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    {g.url ? <a href={g.url} target="_blank" rel="noreferrer" className="font-bold text-bauhaus-blue hover:underline">{g.name}</a> : <span className="font-bold">{g.name}</span>}
                    <div className="text-xs text-bauhaus-muted">{g.provider ?? 'Funder not recorded'}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{money(g.amountMin, g.amountMax)}</td>
                  <td className="px-3 py-2 text-xs">{g.geography || 'Unknown'}</td>
                  {project ? (() => {
                    const e = elig(g)!;
                    return (
                      <td className="px-3 py-2">
                        <VerdictTag verdict={e.overall}>{e.overall}</VerdictTag>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <VerdictTag verdict={e.location}>place {e.location}</VerdictTag>
                          {e.entities.map((x) => <VerdictTag key={x.entity} verdict={x.verdict}>{x.entity === 'pty' ? 'Pty' : x.entity === 'butterfly' ? 'Butterfly' : 'AKT'} {x.verdict}</VerdictTag>)}
                        </div>
                      </td>
                    );
                  })() : null}
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
        {shown.length < grants.length ? (
          <p className="mt-3 text-sm">
            Showing the soonest {shown.length.toLocaleString('en-AU')} of {grants.length.toLocaleString('en-AU')}.{' '}
            <Link className="font-bold text-bauhaus-blue underline" href={moreHref}>Show 500 more</Link>
          </p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] text-bauhaus-muted">Generated {new Date(generatedAt).toLocaleString('en-AU')}</p>
      </div>
    </main>
  );
}
