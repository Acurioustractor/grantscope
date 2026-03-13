import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createGovernedProofService } from '@/lib/governed-proof/service';
import { getProofPack } from '@/lib/governed-proof/presentation';

export const dynamic = 'force-dynamic';

type PublicProofPageProps = {
  params: Promise<{
    placeKey: string;
  }>;
};

export const metadata: Metadata = {
  title: 'Governed Proof | CivicGraph for Funders',
  description:
    'A governed proof summary connecting allocation context, intervention evidence, and community voice for a specific place.',
};

function formatCurrency(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString('en-AU')}`;
}

export default async function FunderProofPage({ params }: PublicProofPageProps) {
  const { placeKey } = await params;
  if (!/^\d{4}$/.test(placeKey)) {
    notFound();
  }

  const governedProofService = createGovernedProofService();
  const bundle = await governedProofService.getBundleByKey(`place:${placeKey}`);

  if (!bundle || !['partner', 'public'].includes(bundle.promotionStatus)) {
    notFound();
  }

  const proofPack = getProofPack(bundle);
  const fundingSnapshot = proofPack.fundingSnapshot;
  const evidenceSnapshot = proofPack.evidenceSnapshot;
  const voiceSnapshot = proofPack.voiceSnapshot;
  const strengths = proofPack.strengths;
  const gaps = proofPack.gaps;
  const dominantThemes = Array.isArray(voiceSnapshot.dominantThemes) ? voiceSnapshot.dominantThemes : [];
  const sampleStoryTitles = Array.isArray(voiceSnapshot.sampleStoryTitles) ? voiceSnapshot.sampleStoryTitles : [];
  const topOrganizationNames = Array.isArray(evidenceSnapshot.topOrganizationNames) ? evidenceSnapshot.topOrganizationNames : [];

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <section className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-xs font-black px-3 py-1 border-2 border-bauhaus-yellow text-bauhaus-yellow uppercase tracking-[0.3em]">
              Governed Proof
            </span>
            <span className="text-xs font-black px-3 py-1 border-2 border-white/30 text-white uppercase tracking-widest">
              {bundle.promotionStatus}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] mb-5">
            PLACE PROOF
            <br />
            <span className="text-bauhaus-yellow">{placeKey}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-4xl leading-relaxed">
            {typeof proofPack.headline === 'string'
              ? proofPack.headline
              : `A governed proof summary for postcode ${placeKey}.`}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/places/${placeKey}`}
              className="px-5 py-3 border-4 border-white text-white font-black text-xs uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors"
            >
              Open Place Context
            </Link>
            <Link
              href="/for/funders"
              className="px-5 py-3 border-4 border-white/30 text-white font-black text-xs uppercase tracking-widest hover:border-white transition-colors"
            >
              Back to Funders
            </Link>
            <Link
              href={`/for/funders/proof/${placeKey}/system`}
              className="px-5 py-3 border-4 border-bauhaus-yellow text-bauhaus-yellow font-black text-xs uppercase tracking-widest hover:bg-bauhaus-yellow hover:text-bauhaus-black transition-colors"
            >
              Open System Map
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-4 border-bauhaus-black bg-white mb-12">
          <div className="p-5 border-r-2 border-b-2 lg:border-b-0 border-bauhaus-black/10">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Capital</div>
            <div className="text-3xl font-black text-bauhaus-black">
              {formatCurrency(fundingSnapshot.totalFunding)}
            </div>
          </div>
          <div className="p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-bauhaus-black/10">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Evidence</div>
            <div className="text-3xl font-black text-bauhaus-black">
              {typeof evidenceSnapshot.interventionCount === 'number' ? evidenceSnapshot.interventionCount : 0}
            </div>
          </div>
          <div className="p-5 border-r-2 border-bauhaus-black/10">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Voice</div>
            <div className="text-3xl font-black text-bauhaus-black">
              {typeof voiceSnapshot.publishableStoryCount === 'number' ? voiceSnapshot.publishableStoryCount : 0}
            </div>
          </div>
          <div className="p-5">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Confidence</div>
            <div className="text-3xl font-black text-bauhaus-black">{bundle.overallConfidence.toFixed(2)}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest mb-3">Capital Layer</div>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              {typeof proofPack.capitalStory === 'string' ? proofPack.capitalStory : 'Capital context not available.'}
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-3">Evidence Layer</div>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              {typeof proofPack.evidenceStory === 'string' ? proofPack.evidenceStory : 'Evidence context not available.'}
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black text-money uppercase tracking-widest mb-3">Voice Layer</div>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              {typeof proofPack.voiceStory === 'string' ? proofPack.voiceStory : 'Voice context not available.'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-12">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black text-money uppercase tracking-widest mb-3">What this place is showing</div>
            <div className="space-y-2 text-sm text-bauhaus-black">
              {strengths.length > 0 ? strengths.map((strength) => (
                <div key={String(strength)}>{'\u25CF'} {String(strength)}</div>
              )) : <div className="text-bauhaus-muted">No strengths have been surfaced yet.</div>}
            </div>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-3">What still needs work</div>
            <div className="space-y-2 text-sm text-bauhaus-black">
              {gaps.length > 0 ? gaps.map((gap) => (
                <div key={String(gap)}>{'\u25CF'} {String(gap)}</div>
              )) : <div className="text-bauhaus-muted">No major gaps are currently flagged.</div>}
            </div>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
          <div className="text-[10px] font-black text-bauhaus-black uppercase tracking-[0.3em] mb-3">
            How this fits the system
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-black text-bauhaus-black mb-2">GrantScope</div>
              <p className="text-sm text-bauhaus-black/80 leading-relaxed">
                Entry point for place, entity, and funding context.
              </p>
            </div>
            <div>
              <div className="text-sm font-black text-bauhaus-black mb-2">JusticeHub</div>
              <p className="text-sm text-bauhaus-black/80 leading-relaxed">
                Evidence and review workbench where the proof bundle is assembled and promoted.
              </p>
            </div>
            <div>
              <div className="text-sm font-black text-bauhaus-black mb-2">Empathy Ledger</div>
              <p className="text-sm text-bauhaus-black/80 leading-relaxed">
                Governed story and voice layer controlling what can be safely shown.
              </p>
            </div>
          </div>
          {dominantThemes.length > 0 && (
            <div className="mt-6 text-sm text-bauhaus-black">
              <span className="font-black uppercase tracking-widest text-[10px] mr-2">Themes</span>
              {dominantThemes.join(' · ')}
            </div>
          )}
        </div>

        {(topOrganizationNames.length > 0 || sampleStoryTitles.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-6 mt-12">
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest mb-3">
                Linked Organizations
              </div>
              <div className="space-y-2 text-sm text-bauhaus-black">
                {topOrganizationNames.map((name) => (
                  <div key={String(name)}>{String(name)}</div>
                ))}
              </div>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <div className="text-[10px] font-black text-money uppercase tracking-widest mb-3">
                Governed Stories
              </div>
              <div className="space-y-2 text-sm text-bauhaus-black">
                {sampleStoryTitles.map((title) => (
                  <div key={String(title)}>{String(title)}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 border-4 border-bauhaus-black bg-bauhaus-black text-white p-6">
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-[0.25em] mb-3">
                Who uses this
              </div>
              <p className="text-sm text-white/75 leading-relaxed">
                This page is for funders, commissioners, and serious partners making an early diligence call. Use it to decide whether this place warrants deeper internal review, then move to the system map or request a briefing.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href={`/for/funders/proof/${placeKey}/system`}
                className="px-5 py-3 border-4 border-white text-white font-black text-xs uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors text-center"
              >
                Open System Map
              </Link>
              <a
                href={`mailto:hello@civicgraph.au?subject=Governed%20Proof%20briefing%20for%20${placeKey}`}
                className="px-5 py-3 border-4 border-bauhaus-yellow text-bauhaus-yellow font-black text-xs uppercase tracking-widest hover:bg-bauhaus-yellow hover:text-bauhaus-black transition-colors text-center"
              >
                Request briefing
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
