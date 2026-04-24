import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmt } from '@/lib/services/report-service';
import { TRACKER_STATE_META, sentenceCaseTracker } from '../../../tracker-meta';
import { formatSiteDate, getSiteDossierBySlug } from '../site-dossier';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; siteSlug: string }>;
}) {
  const { state, siteSlug } = await params;
  const meta = TRACKER_STATE_META[state.toLowerCase()];
  if (!meta) return { title: 'Not Found' };
  const fallbackTitle = siteSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return {
    title: `${fallbackTitle} — ${meta.name} Site Dossier`,
    description: `Cross-tracker youth justice accountability dossier for ${fallbackTitle}, ${meta.name}.`,
  };
}

export default async function StateYouthJusticeSiteDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ state: string; siteSlug: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { state, siteSlug } = await params;
  const { format } = await searchParams;
  const stateKey = state.toLowerCase();
  const meta = TRACKER_STATE_META[stateKey];
  if (!meta) notFound();
  const dossier = await getSiteDossierBySlug({
    stateKey,
    stateAbbr: meta.abbr,
    stateName: meta.name,
    siteSlug,
  });
  if (!dossier) notFound();

  const {
    siteName,
    trackerSummaries,
    siteRows,
    officialCount,
    mirroredRows,
    gapRows,
    providerSummaries,
    mirroredProviders,
    communityLinkedProviders,
    latestEventDate,
    accountabilityQuestions,
    nextDataAsks,
    markdownBrief,
  } = dossier;

  if (format === 'md') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <pre className="whitespace-pre-wrap rounded-sm border-4 border-bauhaus-black bg-white p-6 font-mono text-sm leading-relaxed text-bauhaus-black">
          {markdownBrief}
        </pre>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href={`/reports/youth-justice/${stateKey}/trackers`}
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; {meta.abbr} trackers
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Site Dossier</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">
          {siteName} <span className="text-bauhaus-red">({meta.abbr})</span>
        </h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          Cross-tracker accountability brief for {siteName}. This turns the site matrix into a usable operating surface: tracker families,
          named providers, mirrored footprint, missing process links, and copy-ready questions for the next round of scrutiny.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/reports/youth-justice/${stateKey}/trackers`}
            className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open state registry
          </Link>
          <Link
            href={`/reports/youth-justice/${stateKey}/sites/${siteSlug}/brief`}
            className="border-2 border-bauhaus-blue bg-bauhaus-blue px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-800"
          >
            Download markdown brief
          </Link>
          {stateKey === 'qld' ? (
            <Link
              href={`/reports/youth-justice/qld/tracker?site=${encodeURIComponent(siteName)}`}
              className="border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-black"
            >
              Open QLD specialist tracker
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(trackerSummaries.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Tracker families</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">{fmt(siteRows.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Evidence events</div>
        </div>
        <div className="rounded-xl border border-bauhaus-black bg-bauhaus-black p-5 text-center text-white">
          <div className="text-2xl font-black text-bauhaus-red sm:text-3xl">{fmt(mirroredRows.length)}</div>
          <div className="mt-1 text-xs text-white/70">Mirrored rows</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">{fmt(gapRows.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Gap rows</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <div className="text-2xl font-black text-red-700 sm:text-3xl">{fmt(providerSummaries.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Named providers</div>
        </div>
      </div>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Tracker families touching this site</div>
          <h2 className="text-2xl font-black text-bauhaus-black">How the stories stack at {siteName}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {trackerSummaries.map((tracker) => (
              <Link
                key={tracker.trackerKey}
                href={`/reports/youth-justice/${stateKey}/trackers/${tracker.trackerKey}?site=${encodeURIComponent(siteName)}`}
                className="block rounded-sm border-2 border-bauhaus-black/10 p-4 transition-colors hover:border-bauhaus-black"
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  {sentenceCaseTracker(tracker.trackerKey)}
                </div>
                <div className="mt-2 text-lg font-black text-bauhaus-black">
                  {tracker.firstTitle || sentenceCaseTracker(tracker.trackerKey)}
                </div>
                <div className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                  {tracker.firstSummary || 'Structured site chain available.'}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-bauhaus-muted">
                  <div>{fmt(tracker.eventCount)} events</div>
                  <div>{fmt(tracker.officialCount)} official</div>
                  <div>{fmt(tracker.mirroredCount)} mirrored</div>
                  <div>{fmt(tracker.gapCount)} gaps</div>
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                  Latest {formatSiteDate(tracker.latestEventDate)}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border-2 border-blue-200 bg-blue-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Mirrored footprint</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">
              {mirroredProviders[0]?.name || 'No mirrored provider named yet'}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              {fmt(mirroredProviders.length)} provider{mirroredProviders.length === 1 ? '' : 's'} already have mirrored site-linked traces.
            </div>
          </div>
          <div className="rounded-sm border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Community-linked alternatives</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">
              {communityLinkedProviders[0]?.name || 'No community-linked provider explicitly named yet'}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              {fmt(communityLinkedProviders.length)} provider{communityLinkedProviders.length === 1 ? '' : 's'} show community, Aboriginal, cultural, or local language in the current chain.
            </div>
          </div>
          <div className="rounded-sm border-2 border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Process pressure</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">
              {gapRows.length > 0 ? `${fmt(gapRows.length)} unresolved gap row${gapRows.length === 1 ? '' : 's'}` : 'No visible unresolved gap rows'}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              Latest site evidence: {formatSiteDate(latestEventDate)}. The dossier keeps the missing tender, contract, or provider steps separate from mirrored rows so the process holes stay visible.
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-2">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Named providers</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Who is already visible at {siteName}</h2>
          <div className="mt-5 space-y-3">
            {providerSummaries.length > 0 ? (
              providerSummaries.slice(0, 10).map((provider) => (
                <div key={provider.name} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-black text-bauhaus-black">{provider.name}</div>
                      <div className="mt-1 text-xs text-bauhaus-muted">
                        {fmt(provider.eventCount)} event references • {fmt(provider.trackerCount)} tracker family
                        {provider.trackerCount === 1 ? '' : 'ies'} • latest {formatSiteDate(provider.latestEventDate)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-sm bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        {fmt(provider.mirroredCount)} mirrored
                      </span>
                      <span className="rounded-sm bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                        {fmt(provider.gapCount)} gaps
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border-2 border-dashed border-bauhaus-black/20 p-4 text-sm text-bauhaus-muted">
                No named providers are visible in the current site-filtered chain yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Current accountability questions</div>
            <h2 className="text-2xl font-black text-bauhaus-black">What to press on next</h2>
            <div className="mt-5 space-y-3">
              {accountabilityQuestions.map((question) => (
                <div key={question} className="rounded-sm border-2 border-bauhaus-black/10 bg-bauhaus-muted/5 p-4 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {question}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Next data asks</div>
            <div className="space-y-3">
              {nextDataAsks.length > 0 ? (
                nextDataAsks.map((ask) => (
                  <div key={ask} className="rounded-sm border-2 border-bauhaus-black/10 p-4 text-sm leading-relaxed text-bauhaus-muted">
                    {ask}
                  </div>
                ))
              ) : (
                <div className="rounded-sm border-2 border-dashed border-bauhaus-black/20 p-4 text-sm text-bauhaus-muted">
                  No immediate data asks are generated from the current site chain.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Copy-ready brief</div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-bauhaus-black">Markdown export for {siteName}</h2>
          <Link
            href={`/reports/youth-justice/${stateKey}/sites/${siteSlug}/brief`}
            className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Download .md file
          </Link>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-sm bg-bauhaus-black p-5 font-mono text-xs leading-relaxed text-white">
          {markdownBrief}
        </pre>
      </section>
    </div>
  );
}
