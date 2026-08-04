import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { CLAIM_LABEL_MEANINGS, type ClaimLabel } from '@/lib/services/goods-canonical-numbers';
import {
  PITCH_SPINE,
  PITCH_SPINE_FACTS,
  COST_STORY,
  DECISION_BAND,
  DECISION_BAND_NOTE,
  CAPEX_HONESTY_RULE,
  CAPITAL_ARCHITECTURE,
  CAPITAL_STAGE_NOTE,
  AUDIENCE_SHAPES,
  NEVER_SAY,
} from '@/lib/services/goods-pitch-content';
import { GoodsSubNav } from '../_components/goods-sub-nav';
import { ClaimChip } from '../_components/claim-chip';

// Static content only — no DB. Safe to render at the edge.
export const dynamic = 'force-static';

export async function generateMetadata() {
  return { title: 'Goods — Pitch' };
}

const LEGEND_ORDER: ClaimLabel[] = ['verified', 'modelled', 'target', 'future'];

function ClaimLegend() {
  return (
    <div className="border-4 border-bauhaus-black bg-white px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
        Claim taxonomy (QBE Diagnostic Area 01/04)
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        {LEGEND_ORDER.map((label) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <ClaimChip label={label} />
            <span className="text-[11px] font-bold text-bauhaus-black">{CLAIM_LABEL_MEANINGS[label]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionHead({ kicker, title, blurb }: { kicker: string; title: string; blurb: string }) {
  return (
    <div className="mb-4 border-l-8 border-bauhaus-black pl-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{kicker}</div>
      <h2 className="text-2xl font-black uppercase tracking-widest text-bauhaus-black">{title}</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-bauhaus-black">{blurb}</p>
    </div>
  );
}

const ACCENT_BORDER: Record<'blue' | 'yellow' | 'red' | 'black', string> = {
  blue: 'border-bauhaus-blue',
  yellow: 'border-bauhaus-yellow',
  red: 'border-bauhaus-red',
  black: 'border-bauhaus-black',
};

const ACCENT_BG: Record<'blue' | 'yellow' | 'red' | 'black', string> = {
  blue: 'bg-bauhaus-blue text-white',
  yellow: 'bg-bauhaus-yellow text-bauhaus-black',
  red: 'bg-bauhaus-red text-white',
  black: 'bg-bauhaus-black text-white',
};

export default async function GoodsPitchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Pitch</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Pitch</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The canonical, QBE-grade proposition. Every deck, email and one-pager should derive from this one governed
            surface. Each numeric claim carries its claim label, so a reviewer can see at a glance how solid it is. This is
            the source of truth: do not invent past it.
          </p>
          <div className="print:hidden">
            <GoodsSubNav slug={slug} active="pitch" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] space-y-10 px-4 py-8">
        <ClaimLegend />

        {/* ---------------- THE SPINE ---------------- */}
        <section>
          <SectionHead
            kicker="Use everywhere"
            title="The spine"
            blurb="The one-paragraph proposition. Verified asset metrics first, the honest margin frame second, the matched-capital ask third. Quote it whole."
          />
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <p className="text-lg font-bold leading-relaxed text-bauhaus-black">{PITCH_SPINE}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PITCH_SPINE_FACTS.map((f) => (
                <div key={f.label} className="border-4 border-bauhaus-black bg-bauhaus-canvas p-3">
                  <div className="text-2xl font-black text-bauhaus-black">{f.value}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{f.label}</span>
                    <ClaimChip label={f.claimLabel} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- THE COST STORY ---------------- */}
        <section>
          <SectionHead
            kicker="The part QBE will not move without"
            title="The cost story"
            blurb="The delivered unit cost, read top to bottom: current fabricated cost, kit cost, delivered by route, the price bands, the in-house transition states, and the fully-loaded volume curve down to the scale target."
          />
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b-4 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted sm:grid-cols-[1.4fr_1.4fr_auto]">
              <span>Claim</span>
              <span className="hidden sm:block">Number</span>
              <span className="text-right">Label</span>
            </div>
            {COST_STORY.map((r) => (
              <div
                key={r.claim}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-bauhaus-black/10 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1.4fr_1.4fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <span className="font-black">{r.claim}</span>
                  <div className="mt-0.5 text-[11px] text-bauhaus-muted">{r.source}</div>
                </div>
                <div className="font-black text-bauhaus-black sm:order-none">{r.number}</div>
                <div className="text-right">
                  <ClaimChip label={r.claimLabel} />
                </div>
              </div>
            ))}
          </div>

          {/* Decision band — investor language, state it plainly. */}
          <div className="mt-4 border-4 border-bauhaus-black bg-white">
            <div className="border-b-4 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              Decision band (investor language)
            </div>
            <div className="grid grid-cols-1 gap-px bg-bauhaus-black/10 sm:grid-cols-4">
              {DECISION_BAND.map((b) => (
                <div key={b.margin} className={`p-4 ${ACCENT_BG[b.accent]}`}>
                  <div className="text-lg font-black">{b.margin}</div>
                  <div className="mt-1 text-[11px] font-black uppercase tracking-widest opacity-90">{b.verdict}</div>
                </div>
              ))}
            </div>
            <p className="border-t-2 border-bauhaus-black/10 px-3 py-3 text-[13px] font-bold text-bauhaus-black">
              {DECISION_BAND_NOTE}
            </p>
          </div>

          <div className="mt-3 border-4 border-bauhaus-yellow bg-bauhaus-yellow p-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">
                Capex honesty rule (Area 11)
              </span>
              <ClaimChip label="modelled" />
            </div>
            <p className="mt-1 text-[13px] font-bold text-bauhaus-black">{CAPEX_HONESTY_RULE}</p>
          </div>
        </section>

        {/* ---------------- CAPITAL ARCHITECTURE ---------------- */}
        <section>
          <SectionHead
            kicker="Which money does which job"
            title="Capital architecture"
            blurb="The right-type-of-finance story, which is also the DGR story. Four instruments, in order: philanthropy buys the community side, the matched grant buys the transition, repayable capital is serviced by the transition margin, procurement revenue makes it finite."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CAPITAL_ARCHITECTURE.map((c, i) => (
              <div key={c.name} className={`border-4 bg-white ${ACCENT_BORDER[c.accent]}`}>
                <div className={`flex items-baseline justify-between px-4 py-2 ${ACCENT_BG[c.accent]}`}>
                  <span className="text-[11px] font-black uppercase tracking-widest">{i + 1}. {c.name}</span>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{c.job}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-bauhaus-black">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-4 border-bauhaus-black bg-bauhaus-black p-4 text-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">The ask, stated honestly</div>
            <p className="mt-1 text-[13px] font-bold">{CAPITAL_STAGE_NOTE}</p>
          </div>
        </section>

        {/* ---------------- AUDIENCE SHAPES ---------------- */}
        <section>
          <SectionHead
            kicker="Order the moves by who is listening"
            title="Pitch shapes per audience"
            blurb="Same evidence, different sequence. Lead with what each audience underwrites against."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {AUDIENCE_SHAPES.map((a) => (
              <div key={a.audience} className={`border-4 bg-white ${ACCENT_BORDER[a.accent]}`}>
                <div className={`px-4 py-2 ${ACCENT_BG[a.accent]}`}>
                  <div className="text-[12px] font-black uppercase tracking-widest">{a.audience}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">{a.examples}</div>
                </div>
                <ol className="space-y-2 p-4">
                  {a.moves.map((m, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-bauhaus-black">
                      <span className="font-black text-bauhaus-muted">{i + 1}.</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- NEVER SAY ---------------- */}
        <section>
          <SectionHead
            kicker="QBE diagnostic guardrails"
            title="Never say, to anyone"
            blurb="Hard rules. Each of these dresses up pipeline, aspiration or unconsented data as fact. Breaking one costs credibility with the reviewer."
          />
          <div className="border-4 border-bauhaus-red bg-white">
            <div className="border-b-4 border-bauhaus-red bg-bauhaus-red px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white">
              Do not present any of these as fact
            </div>
            <ul className="divide-y divide-bauhaus-black/10">
              {NEVER_SAY.map((rule) => (
                <li key={rule} className="flex items-start gap-2 px-4 py-2.5 text-[13px] font-bold text-bauhaus-black">
                  <span className="mt-0.5 text-bauhaus-red">✕</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <strong>Provenance.</strong> Content lifted near-verbatim from the engagement review section 5
          (<code>thoughts/shared/analysis/2026-06-10-goods-engagement-review.md</code>), built strictly from the QBE
          diagnostic claim taxonomy and the bed-cost-model v3. Verified figures are Xero-checked; modelled figures are the
          cost-model planning bands; target figures are stated goals. No claim on this page is invented.
        </div>
      </div>
    </main>
  );
}
