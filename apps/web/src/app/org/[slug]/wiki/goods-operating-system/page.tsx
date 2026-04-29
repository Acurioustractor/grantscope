import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  goodsCapitalRows,
  goodsGovernanceRows,
  goodsImpactRows,
  goodsOperatingFacts,
  goodsOperatingOutputs,
  goodsPeopleRows,
  goodsRiskRows,
  goodsRoadmap,
  goodsSourceDocuments,
  goodsSupportRoutes,
  goodsSystemsRows,
  goodsWikiOutputs,
} from '@/lib/services/goods-operating-system';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  getWikiSupportIndex,
  getWikiSupportProject,
  wikiSupportSourceSlug,
} from '@/lib/services/wiki-support-index';

export const revalidate = 3600;

function sourcePathLabel(path: string) {
  return path
    .replace('/Users/benknight/Code/', '')
    .replace(/^act-global-infrastructure\//, 'act-global-infrastructure / ')
    .replace(/^Goods Asset Register\//, 'Goods Asset Register / ');
}

function goodsSurfaceHref(orgSlug: string, href: string) {
  if (href.startsWith('#')) return `/org/${orgSlug}/goods${href}`;
  return href;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (shouldUseFastLocalOrg() && isActSlug(slug)) {
    return {
      title: `Goods Operating System - ${ACT_FAST_PROFILE.name} - CivicGraph`,
      description: 'Goods strategic wiki for grants, foundations, procurement, governance, operations, and capital readiness.',
    };
  }
  const profile = await getOrgProfileBySlug(slug);
  return {
    title: profile ? `Goods Operating System - ${profile.name} - CivicGraph` : 'Goods Operating System - CivicGraph',
    description: 'Goods strategic wiki for grants, foundations, procurement, governance, operations, and capital readiness.',
  };
}

export default async function GoodsOperatingSystemWikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const wikiSupportIndex = getWikiSupportIndex();
  const goodsProject = getWikiSupportProject('goods');
  const sourceByLabel = new Map(
    wikiSupportIndex.source_inventory
      .filter((source) => source.exists)
      .map((source) => [source.label, source]),
  );

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">
              {profile.name}
            </Link>
            <span>/</span>
            <Link href={`/org/${slug}/wiki/workshop-alignment`} className="hover:text-white">
              Workshop operating board
            </Link>
            <span>/</span>
            <span className="text-white">Goods operating system</span>
          </nav>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">
                Goods strategic wiki
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black uppercase tracking-wider">
                The current Goods operating system
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
                This is not a checklist. It is the reusable strategy, evidence, route model, risk register,
                governance frame, and source pack for making Goods fundable, contractable, operational, and investable.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={`/org/${slug}/goods#goods-readiness`}
                className="border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
              >
                Goods workspace
              </Link>
              <Link
                href="/grants?type=open_opportunity&sort=closing_asc&project=goods&quality=ready"
                className="border border-bauhaus-red bg-bauhaus-red px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
              >
                Goods grant feed
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="border-4 border-bauhaus-black bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.76fr_1.24fr]">
            <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                Operating purpose
              </p>
              <h2 className="mt-2 text-2xl font-black text-bauhaus-black">
                Use this as the Goods memory and packaging system
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                The dashboard helps you act. This wiki page holds the stable operating logic. When a funder,
                buyer, advisor, or board member asks what Goods is, what proof exists, what the risks are, or
                what capital unlocks, start here and then open the source files.
              </p>
              {goodsProject ? (
                <div className="mt-5 border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                    Indexed project
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-bauhaus-black">{goodsProject.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {goodsProject.themes.slice(0, 8).map((theme) => (
                      <span
                        key={theme}
                        className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2">
              {goodsWikiOutputs.map((output) => (
                <article key={output.label} className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">{output.label}</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{output.use}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {output.sections.map((section) => (
                      <span
                        key={`${output.label}-${section}`}
                        className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {goodsOperatingFacts.map((fact) => (
            <div key={fact.label} className="border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-3xl font-black tabular-nums text-bauhaus-black">{fact.value}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{fact.label}</div>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{fact.detail}</p>
            </div>
          ))}
        </section>

        <nav className="sticky top-0 z-20 mt-6 border-4 border-bauhaus-black bg-white/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['strategy', 'Strategy'],
              ['roadmap', 'Roadmap'],
              ['routes', 'Routes'],
              ['impact', 'Impact'],
              ['risk', 'Risk'],
              ['governance', 'Governance'],
              ['people', 'People'],
              ['systems', 'Systems'],
              ['capital', 'Capital'],
              ['sources', 'Sources'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={`#${href}`}
                className="border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light hover:text-bauhaus-blue"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section id="strategy" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Strategy spine</p>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Reusable operating language</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {goodsOperatingOutputs.map((item) => (
              <article key={item.label} className="border border-gray-200 bg-gray-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{item.label}</div>
                <p className="mt-2 text-sm leading-relaxed text-bauhaus-black">{item.output}</p>
                <p className="mt-3 text-xs leading-relaxed text-gray-600">
                  <span className="font-black text-bauhaus-black">Use:</span> {item.use}
                </p>
                <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Source: {item.source}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="roadmap" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Scale path</p>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Funder and operator roadmap</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {goodsRoadmap.map((stage) => (
              <div key={stage.stage} className="border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-black text-bauhaus-black">{stage.stage}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-700">{stage.now}</p>
                <p className="mt-3 text-xs leading-relaxed text-gray-600">
                  <span className="font-black text-bauhaus-black">Operating use:</span> {stage.operatingUse}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="routes" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Support routes</p>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">How Goods becomes supported</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {goodsSupportRoutes.map((route) => (
              <Link
                key={route.lane}
                href={goodsSurfaceHref(slug, route.nextSurface)}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="text-sm font-black text-bauhaus-black">{route.lane}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{route.use}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="impact" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Impact register</p>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Claims, evidence, and measures</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {goodsImpactRows.map((row) => (
              <div key={row.signal} className="border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-black text-bauhaus-black">{row.signal}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  <span className="font-black text-bauhaus-black">Evidence:</span> {row.evidence}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  <span className="font-black text-bauhaus-black">Measure:</span> {row.metric}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section id="risk" className="scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Risk register</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Known constraints and response</h2>
            <div className="mt-4 space-y-3">
              {goodsRiskRows.map((row) => (
                <div key={row.risk} className="border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-black text-bauhaus-black">{row.risk}</div>
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                      {row.owner}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{row.response}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="governance" className="scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
              Governance and entity
            </p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Structure decisions</h2>
            <div className="mt-4 space-y-3">
              {goodsGovernanceRows.map((row) => (
                <div key={row.area} className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">{row.area}</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{row.position}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    <span className="font-black text-bauhaus-black">Decision frame:</span> {row.decision}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section id="people" className="scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
              People and relationships
            </p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Who moves the work</h2>
            <div className="mt-4 space-y-3">
              {goodsPeopleRows.map((row) => (
                <div key={row.role} className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">{row.role}</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{row.who}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    <span className="font-black text-bauhaus-black">Use:</span> {row.use}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="systems" className="scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Systems map</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">What each system owns</h2>
            <div className="mt-4 space-y-3">
              {goodsSystemsRows.map((row) => (
                <div key={row.system} className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">{row.system}</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    <span className="font-black text-bauhaus-black">Owns:</span> {row.owns}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    <span className="font-black text-bauhaus-black">Mirror:</span> {row.mirror}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section id="capital" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Capital stack</p>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Named capital routes and proof needs</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {goodsCapitalRows.map((row) => (
              <div key={row.source} className="border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-black text-bauhaus-black">{row.source}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  <span className="font-black text-bauhaus-black">Ask/use:</span> {row.ask}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  <span className="font-black text-bauhaus-black">Proof:</span> {row.proof}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="sources" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Evidence library</p>
              <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Source-backed building blocks</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                These are not tasks. They are the proof and reusable source material behind Goods. Open a source when
                you need to pull language, verify a claim, build a budget, explain the operating model, or prepare a
                grant, procurement, foundation, board, or capital pack.
              </p>
            </div>
            <Link
              href={`/org/${slug}/wiki/workshop-alignment#source-documents`}
              className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              Full source inventory
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {goodsSourceDocuments.map((doc) => {
              const source = sourceByLabel.get(doc.source);
              const content = (
                <>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1 text-sm font-black text-bauhaus-black">{doc.label}</div>
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      {doc.output}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {doc.kind}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{doc.use}</p>
                  <p className="mt-2 text-xs leading-relaxed text-bauhaus-black">
                    <span className="font-black">Best use:</span> {doc.bestFor}
                  </p>
                  {source ? (
                    <div className="mt-3 line-clamp-1 font-mono text-[11px] leading-relaxed text-gray-500">
                      {sourcePathLabel(source.path)}
                    </div>
                  ) : null}
                </>
              );

              return source ? (
                <Link
                  key={doc.label}
                  href={`/org/${slug}/wiki/sources/${wikiSupportSourceSlug(source)}`}
                  className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  {content}
                </Link>
              ) : (
                <div key={doc.label} className="border border-gray-200 bg-gray-50 p-4">
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
