import Link from 'next/link';
import { getRemoteCouncils } from '@/lib/services/council-place-report';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Every remote council — CivicGraph',
  description:
    'What we can and cannot tell you about public money in each remote council area in Australia, and an invitation to correct it.',
};

export default async function CouncilIndexPage() {
  const councils = await getRemoteCouncils();
  const totalCommunityControlled = councils.reduce((total, council) => total + council.communityControlled, 0);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <header className="border-b-4 border-bauhaus-black bg-white px-5 py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Where the money goes
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight lg:text-5xl">
            Every remote council
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7">
            {councils.length} remote and very remote council areas hold{' '}
            {totalCommunityControlled.toLocaleString('en-AU')} community-controlled organisations
            between them. Four of these places have been gone through by hand. The rest have this
            page instead: an honest account of where our records run out, generated the same way for
            all of them.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7">
            It is deliberately the smaller claim. A machine can find where a register stops. It
            cannot tell you which organisation belongs to which community, so these pages ask rather
            than assert.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {councils.map(council => (
            <Link
              key={council.slug}
              href={`/place/council/${council.slug}`}
              className="block border-4 border-bauhaus-black bg-white p-4 transition-colors hover:bg-bauhaus-yellow"
            >
              <p className="text-base font-black uppercase leading-tight">{council.lgaName}</p>
              <p className="mt-1 font-mono text-[11px]">
                {council.state ? `${council.state} · ` : ''}
                {council.remoteness?.replace(' Australia', '') ?? ''}
              </p>
              <p className="mt-3 font-mono text-[11px]">
                {council.orgCount.toLocaleString('en-AU')} organisations ·{' '}
                <strong>{council.communityControlled.toLocaleString('en-AU')}</strong>{' '}
                community-controlled
              </p>
            </Link>
          ))}
        </div>

        <section className="mt-10 border-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
          <h2 className="text-xl font-black uppercase tracking-widest text-bauhaus-yellow">
            The four done by hand
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6">
            These go further, because someone read the organisation names one at a time and knew
            which community each belonged to. That is the part no query does.
          </p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {[
              ['Central Australia', '/place/central-australia'],
              ['Far West Coast', '/place/far-west-coast'],
              ['The Kimberley', '/place/kimberley'],
              ['Cape York', '/place/cape-york'],
            ].map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-block border-4 border-bauhaus-yellow px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-yellow"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
