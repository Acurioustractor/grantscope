import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import {
  getGoodsCapitalWorkspace,
  matterRoute,
  money,
  moneyRange,
} from '@/lib/services/goods-capital-workspace';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  GoodsWorkspaceHeader,
  Metric,
  SectionTitle,
  StatusPill,
} from '../_components/goods-capital-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Capital', description: 'GOODS capital requirements, targets, allocations, commitments and cash.' };
}

function percent(amount: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, (amount / max) * 100)) : 0;
}

export default async function GoodsCapitalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const workspace = await getGoodsCapitalWorkspace();

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="capital"
        eyebrow="Need → route → evidence → cash"
        title="Capital"
        description={(
          <>
            One authoritative view of what GOODS needs and what is genuinely covered. Targets, asks, written commitments
            and received cash stay separate so the QBE story can never outrun the evidence.
          </>
        )}
        aside={(
          <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Current requirement</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{moneyRange(workspace.summary.needMinAud, workspace.summary.needMaxAud)}</div>
            <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">Across five capital blocks</div>
          </div>
        )}
      />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="CRM targets" value={money(workspace.summary.targetAud)} detail="Six targets; not capital yet" tone="blue" />
          <Metric label="Ask actually made" value={money(workspace.summary.askMadeAud)} detail="Requires an explicit ask date" />
          <Metric label="Offered" value={money(workspace.summary.offeredAud)} detail="Offer state, before evidence gate" />
          <Metric label="Evidence-backed" value={money(workspace.summary.committedAud)} detail="Accepted + letter/agreement" tone="yellow" />
          <Metric label="Cash received" value={money(workspace.summary.receivedAud)} detail="Linked Xero tranches only" tone="dark" />
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Five uses of capital"
            title="Coverage by block"
            description="A target covers nothing until a human allocates it to a concrete use. Written commitments, not target totals, reduce the funding gap."
          />
          <div className="space-y-3">
            {workspace.coverage.map((block) => {
              const committedPct = percent(block.committedAud, block.amountMaxAud);
              const targetedPct = percent(block.targetedAud, block.amountMaxAud);
              return (
                <article key={block.id} className="border-4 border-bauhaus-black bg-white p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={block.receivingEntityKind === 'charity' ? 'info' : 'dark'}>{block.receivingEntityKind}</StatusPill>
                        <StatusPill>{block.allowedInstruments.map((item) => item.replaceAll('_', ' ')).join(' · ')}</StatusPill>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-bauhaus-black">{block.name}</h3>
                      <div className="mt-1 text-2xl font-black tabular-nums text-bauhaus-blue">{moneyRange(block.amountMinAud, block.amountMaxAud)}</div>
                      <p className="mt-2 text-sm leading-6 text-bauhaus-muted">{block.purpose}</p>
                      <p className="mt-2 text-[11px] leading-5 text-bauhaus-muted"><strong>Recipient:</strong> {block.receivingEntityName}</p>
                    </div>
                    <div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="border-2 border-bauhaus-black/20 p-2"><div className="text-[9px] font-black uppercase tracking-wider text-bauhaus-muted">Allocated target</div><div className="mt-1 text-sm font-black">{money(block.targetedAud)}</div></div>
                        <div className="border-2 border-bauhaus-black/20 p-2"><div className="text-[9px] font-black uppercase tracking-wider text-bauhaus-muted">Committed</div><div className="mt-1 text-sm font-black">{money(block.committedAud)}</div></div>
                        <div className="border-2 border-bauhaus-black/20 p-2"><div className="text-[9px] font-black uppercase tracking-wider text-bauhaus-muted">Received</div><div className="mt-1 text-sm font-black">{money(block.receivedAud)}</div></div>
                      </div>
                      <div className="relative mt-3 h-5 overflow-hidden border-2 border-bauhaus-black bg-bauhaus-canvas" aria-label={`${block.name}: ${Math.round(committedPct)} percent of maximum requirement committed`}>
                        <div className="absolute inset-y-0 left-0 bg-blue-200" style={{ width: `${targetedPct}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-bauhaus-blue" style={{ width: `${committedPct}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-bauhaus-muted">
                        <span>Remaining from {money(block.remainingMinAud)}</span>
                        <span>to {money(block.remainingMaxAud)}</span>
                      </div>
                      {block.allocations.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-xs text-bauhaus-muted">
                          {block.allocations.map(({ allocation, matter }) => (
                            <li key={allocation.id}><Link className="font-bold text-bauhaus-blue underline" href={`/org/${slug}/goods/matters/${matter.slug}`}>{matter.counterpartyName}</Link> · {money(allocation.proposedAmountAud)}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-3 border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">No target has been explicitly allocated to this block.</div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Six CRM targets"
            title={`${money(workspace.summary.targetAud)} under examination`}
            description={`${money(workspace.summary.unallocatedTargetAud)} remains unallocated. The existence of a GHL record does not prove an ask, an offer, match eligibility or commitment.`}
            action={<Link href={`/org/${slug}/goods/applications`} className="text-xs font-black uppercase tracking-widest text-bauhaus-blue underline">Application rooms →</Link>}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspace.matters.filter((matter) => matterRoute(workspace, matter)).map((matter) => {
              const route = matterRoute(workspace, matter)!;
              return (
                <article key={matter.id} className="flex flex-col border-4 border-bauhaus-black bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone="info">{route.routeType.replaceAll('_', ' ')}</StatusPill>
                    <StatusPill tone={route.commitmentState === 'none' ? 'neutral' : route.commitmentEvidenceForm === 'letter' || route.commitmentEvidenceForm === 'executed_agreement' ? 'good' : 'warn'}>{route.commitmentState}</StatusPill>
                    <StatusPill tone={route.matchAssessment === 'eligible' ? 'good' : route.matchAssessment === 'ineligible' ? 'bad' : 'warn'}>QBE {route.matchAssessment}</StatusPill>
                  </div>
                  <h3 className="mt-3 text-base font-black">{matter.counterpartyName}</h3>
                  <div className="mt-1 text-3xl font-black tabular-nums text-bauhaus-blue">{money(route.targetAmountAud)}</div>
                  <div className="mt-2 text-xs leading-5 text-bauhaus-muted">
                    <strong>Named route:</strong> {route.namedRoute ?? 'Not verified'}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-bauhaus-muted">
                    <strong>Recipient:</strong> {route.legalRecipientName ?? 'Unknown'}
                  </div>
                  <div className="mt-auto flex gap-2 pt-4">
                    <Link href={`/org/${slug}/goods/matters/${matter.slug}`} className="inline-flex min-h-11 flex-1 items-center justify-center border-2 border-bauhaus-black px-3 text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-canvas">Matter</Link>
                    <Link href={`/org/${slug}/goods/applications/${route.routeCode}`} className="inline-flex min-h-11 flex-1 items-center justify-center border-2 border-bauhaus-black bg-bauhaus-black px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue">Open room</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {[
            ['Target', 'A desired amount recorded for exploration. It covers no cost block.'],
            ['Ask made', 'A real request was sent or stated, with a date and route.'],
            ['Committed', 'An accepted amount supported by a letter or executed agreement.'],
            ['Cash', 'Money received and reconciled through Xero.'],
          ].map(([title, detail]) => (
            <div key={title} className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4">
              <div className="text-xs font-black uppercase tracking-widest">{title}</div>
              <p className="mt-2 text-xs leading-5 text-bauhaus-muted">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
