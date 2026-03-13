import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createGovernedProofService } from '@/lib/governed-proof/service';
import { getProofPack } from '@/lib/governed-proof/presentation';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getJusticeHubUrl(): string {
  return process.env.NEXT_PUBLIC_JUSTICEHUB_URL || 'http://localhost:3004';
}

function getEmpathyLedgerUrl(): string {
  return process.env.NEXT_PUBLIC_EMPATHY_LEDGER_URL || 'http://localhost:3001';
}

function bucketCounts(records: Awaited<ReturnType<ReturnType<typeof createGovernedProofService>['listBundleRecords']>>) {
  return records.reduce<Record<string, number>>((acc, record) => {
    const key = `${String(record.recordSystem).toLowerCase()}:${String(record.recordType).toLowerCase()}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export default async function GovernedProofSystemMapPage({
  params,
}: {
  params: Promise<{ placeKey: string }>;
}) {
  const { placeKey } = await params;
  if (!/^\d{4}$/.test(placeKey)) notFound();

  const governedProofService = createGovernedProofService();
  const bundle = await governedProofService.getBundleByKey(`place:${placeKey}`);

  if (!bundle || !['partner', 'public'].includes(bundle.promotionStatus)) {
    notFound();
  }

  const [records, entityRows] = await Promise.all([
    governedProofService.listBundleRecords(bundle.id),
    getServiceSupabase()
      .from('gs_entities')
      .select('id, gs_id, canonical_name')
      .eq('postcode', placeKey)
      .order('latest_revenue', { ascending: false, nullsFirst: false })
      .limit(4),
  ]);

  const proofPack = getProofPack(bundle);
  const counts = bucketCounts(records);
  const justiceHubUrl = getJusticeHubUrl();
  const empathyLedgerUrl = getEmpathyLedgerUrl();
  const entities = entityRows.data ?? [];
  const sampleStories = Array.isArray(proofPack.voiceSnapshot.sampleStoryTitles)
    ? proofPack.voiceSnapshot.sampleStoryTitles
    : [];

  const linkedStoryCount =
    typeof proofPack.voiceSnapshot.publishableStoryCount === 'number'
      ? proofPack.voiceSnapshot.publishableStoryCount
      : counts['empathy_ledger:story'] || 0;
  const linkedStorytellerCount =
    typeof proofPack.voiceSnapshot.storytellerCount === 'number'
      ? proofPack.voiceSnapshot.storytellerCount
      : counts['empathy_ledger:storyteller'] || 0;
  const linkedVoiceOrganizationCount =
    typeof proofPack.voiceSnapshot.linkedOrganizationCount === 'number'
      ? proofPack.voiceSnapshot.linkedOrganizationCount
      : counts['empathy_ledger:organization'] || 0;

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <section className="bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-xs font-black px-3 py-1 border-2 border-bauhaus-blue text-bauhaus-blue uppercase tracking-[0.25em]">
              System Map
            </span>
            <span className="text-xs font-black px-3 py-1 border-2 border-bauhaus-black/20 text-bauhaus-black uppercase tracking-widest">
              {bundle.promotionStatus}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] text-bauhaus-black mb-4">
            SEE THE FULL STACK
            <br />
            <span className="text-bauhaus-blue">PLACE {placeKey}</span>
          </h1>
          <p className="max-w-4xl text-lg text-bauhaus-muted leading-relaxed">
            {proofPack.headline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/for/funders/proof/${placeKey}`}
              className="px-5 py-3 border-4 border-bauhaus-black bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-yellow hover:text-bauhaus-black hover:border-bauhaus-yellow transition-colors"
            >
              Back to Place Proof
            </Link>
            <Link
              href={`/places/${placeKey}`}
              className="px-5 py-3 border-4 border-bauhaus-black bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-canvas transition-colors"
            >
              Open Place Context
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">GrantScope</div>
            <h2 className="text-2xl font-black text-bauhaus-black mb-3">Front door</h2>
            <p className="text-sm text-bauhaus-muted leading-relaxed mb-4">
              Public place context, entity dossiers, funding signals, and the outward-facing proof page.
            </p>
            <div className="space-y-3">
              <Link href={`/places/${placeKey}`} className="block text-sm font-black text-bauhaus-blue hover:text-bauhaus-red">
                Open place context
              </Link>
              <Link href={`/for/funders/proof/${placeKey}`} className="block text-sm font-black text-bauhaus-blue hover:text-bauhaus-red">
                Open public proof page
              </Link>
              {entities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.gs_id}`}
                  className="block text-sm text-bauhaus-black hover:text-bauhaus-red"
                >
                  {entity.canonical_name}
                </Link>
              ))}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-link-light p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-2">JusticeHub</div>
            <h2 className="text-2xl font-black text-bauhaus-black mb-3">Workbench</h2>
            <p className="text-sm text-bauhaus-black/75 leading-relaxed mb-4">
              Internal bundle assembly, review, repair, briefing, and promotion.
            </p>
            <div className="space-y-3">
              <a
                href={`${justiceHubUrl}/admin/governed-proof`}
                className="block text-sm font-black text-bauhaus-blue hover:text-bauhaus-red"
              >
                Open governed-proof control room
              </a>
              <a
                href={`${justiceHubUrl}/admin/governed-proof/${placeKey}/brief`}
                className="block text-sm font-black text-bauhaus-blue hover:text-bauhaus-red"
              >
                Open internal brief
              </a>
              <a
                href={`${justiceHubUrl}/for-funders/proof/${placeKey}`}
                className="block text-sm font-black text-bauhaus-blue hover:text-bauhaus-red"
              >
                Open JusticeHub proof surface
              </a>
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-money-light p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-money mb-2">Empathy Ledger</div>
            <h2 className="text-2xl font-black text-bauhaus-black mb-3">Governed voice</h2>
            <p className="text-sm text-bauhaus-black/75 leading-relaxed mb-4">
              Story ownership, consent, storyteller context, and publishability sit upstream here.
            </p>
            <div className="space-y-2 text-sm text-bauhaus-black">
              <div>{linkedStoryCount} linked stories</div>
              <div>{linkedStorytellerCount} linked storytellers</div>
              <div>{linkedVoiceOrganizationCount} linked organizations</div>
            </div>
            <a
              href={empathyLedgerUrl}
              className="inline-block mt-4 text-sm font-black text-money hover:text-bauhaus-red"
            >
              Open Empathy Ledger
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 mb-10">
          <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-black mb-3">
              User Journey
            </div>
            <ol className="space-y-4 text-sm text-bauhaus-black">
              <li>1. Start in GrantScope to understand place context, who is active, and where money is flowing.</li>
              <li>2. Open the place proof page to see the governed summary across capital, evidence, and voice.</li>
              <li>3. Move into JusticeHub if you need to review bundle quality, fix gaps, or prepare an internal brief.</li>
              <li>4. Trust that Empathy Ledger is governing what community voice can be shown and at what promotion level.</li>
            </ol>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-muted mb-3">
              Bundle Coverage
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="border-2 border-bauhaus-black/10 p-4">
                <div className="font-black text-bauhaus-black mb-2">Capital layer</div>
                <div className="text-bauhaus-muted">{proofPack.capitalStory}</div>
              </div>
              <div className="border-2 border-bauhaus-black/10 p-4">
                <div className="font-black text-bauhaus-black mb-2">Evidence layer</div>
                <div className="text-bauhaus-muted">{proofPack.evidenceStory}</div>
              </div>
              <div className="border-2 border-bauhaus-black/10 p-4">
                <div className="font-black text-bauhaus-black mb-2">Voice layer</div>
                <div className="text-bauhaus-muted">{proofPack.voiceStory}</div>
              </div>
              <div className="border-2 border-bauhaus-black/10 p-4">
                <div className="font-black text-bauhaus-black mb-2">Readiness</div>
                <div className="text-bauhaus-muted">{proofPack.readiness.replace(/_/g, ' ')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-blue mb-3">
              Who this is for
            </div>
            <h3 className="text-lg font-black text-bauhaus-black mb-2">Funders and commissioners</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Start in GrantScope, scan the place, then use the proof layer to decide whether this place deserves deeper diligence or relationship-building.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-blue mb-3">
              Internal users
            </div>
            <h3 className="text-lg font-black text-bauhaus-black mb-2">Analysts and partnership leads</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Use JusticeHub to repair weak bundles, prepare internal briefs, and decide what is safe and strong enough to promote.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-money mb-3">
              Community-facing role
            </div>
            <h3 className="text-lg font-black text-bauhaus-black mb-2">Practice and community partners</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              See how voice is being represented alongside money and evidence, without losing governance or turning lived experience into marketing garnish.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-money mb-3">
              What is already here
            </div>
            <div className="space-y-2 text-sm text-bauhaus-black">
              {proofPack.strengths.length > 0 ? (
                proofPack.strengths.map((strength) => <div key={strength}>{'\u25CF'} {strength}</div>)
              ) : (
                <div className="text-bauhaus-muted">No strengths have been surfaced yet.</div>
              )}
            </div>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-red mb-3">
              What still needs work
            </div>
            <div className="space-y-2 text-sm text-bauhaus-black">
              {proofPack.gaps.length > 0 ? (
                proofPack.gaps.map((gap) => <div key={gap}>{'\u25CF'} {gap}</div>)
              ) : (
                <div className="text-bauhaus-muted">No major gaps are currently flagged.</div>
              )}
            </div>
          </div>
        </div>

        {sampleStories.length > 0 && (
          <div className="mt-10 border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-money mb-3">
              Story layer preview
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-bauhaus-black">
              {sampleStories.map((storyTitle) => (
                <div key={String(storyTitle)} className="border-2 border-bauhaus-black/10 p-4">
                  {String(storyTitle)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 border-4 border-bauhaus-black bg-bauhaus-black text-white p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-yellow mb-3">
            Next move
          </div>
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <p className="text-sm text-white/70 leading-relaxed">
              Use the public proof page for first-pass diligence. If this place is relevant to a live funding, commissioning, or partnership decision, request an internal briefing and move into the JusticeHub workbench.
            </p>
            <a
              href={`mailto:hello@civicgraph.au?subject=Governed%20Proof%20briefing%20for%20${placeKey}`}
              className="inline-block px-5 py-3 border-4 border-bauhaus-yellow text-bauhaus-yellow font-black text-xs uppercase tracking-widest hover:bg-bauhaus-yellow hover:text-bauhaus-black transition-colors"
            >
              Request briefing
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
