import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsCommunityDetail } from '@/lib/services/goods-community-detail';
import { PushToGhlButton } from './push-to-ghl-button';
import { RecordDeploymentButton } from './record-deployment';

export const revalidate = 300;

function money(n: number | null | undefined) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

function relDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'closed';
  if (days === 0) return 'today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export async function generateMetadata({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const detail = await getGoodsCommunityDetail(communityId);
  return {
    title: detail ? `${detail.community.community_name} — Goods Community — CivicGraph` : 'Community — CivicGraph',
  };
}

export default async function GoodsCommunityPage({
  params,
}: {
  params: Promise<{ slug: string; communityId: string }>;
}) {
  const { slug, communityId } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const detail = await getGoodsCommunityDetail(communityId);
  if (!detail) notFound();

  const { community, mappedBuyers, localEntities, signals, matchedGrants, matchedFoundations, assets, deploymentBatches, timeline } = detail;

  const totalDemand = community.demand_beds + community.demand_washers;
  const activeSignals = signals.filter(s => ['new', 'reviewing'].includes(s.status));
  const actionedSignals = signals.filter(s => s.status === 'actioned');

  const priorityBg = community.priority === 'lead' ? 'bg-bauhaus-red text-white' :
    community.priority === 'active' ? 'bg-bauhaus-yellow' :
    community.priority === 'warm' ? 'bg-bauhaus-canvas' : 'bg-gray-200';

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <Link href={`/org/${slug}/wiki/goods-signals`} className="hover:text-white">Signals</Link>
            <span>/</span>
            <span className="text-white">{community.community_name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black uppercase tracking-widest">{community.community_name}</h1>
            {community.priority && <span className={`${priorityBg} px-2 py-1 text-xs font-black uppercase tracking-widest`}>{community.priority}</span>}
          </div>
          <p className="mt-2 text-sm text-gray-300">
            {[community.region_label, community.state, community.postcode].filter(Boolean).join(' · ')}
            {community.land_council && <> · {community.land_council}</>}
            {community.main_language && <> · {community.main_language}</>}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Operating snapshot */}
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCell label="Beds demanded" value={community.demand_beds.toString()} />
          <StatCell label="Washers demanded" value={community.demand_washers.toString()} />
          <StatCell label="Assets deployed" value={community.assets_deployed.toString()} accent={community.assets_deployed === 0 && totalDemand > 0} />
          <StatCell label="Active signals" value={activeSignals.length.toString()} />
          <StatCell label="Mapped buyers" value={mappedBuyers.length.toString()} />
          <StatCell label="Local orgs" value={localEntities.length.toString()} />
        </section>

        {/* Logistics + money */}
        <section className="grid gap-3 md:grid-cols-2">
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Logistics</h2>
            <dl className="space-y-1 text-sm">
              <Row label="Staging hub" value={community.nearest_staging_hub} />
              <Row label="Freight corridor" value={community.freight_corridor} />
              <Row label="Last-mile method" value={community.last_mile_method} />
              <Row label="Local government" value={community.local_government} />
            </dl>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Money footprint (region)</h2>
            <dl className="space-y-1 text-sm">
              <Row label="Govt contract value" value={community.total_govt_contract_value ? money(community.total_govt_contract_value) : '—'} />
              <Row label="Justice funding" value={community.total_justice_funding ? money(community.total_justice_funding) : '—'} />
              <Row label="Foundation grants" value={community.total_foundation_grants ? money(community.total_foundation_grants) : '—'} />
            </dl>
          </div>
        </section>

        {community.proof_line && (
          <section className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-sm">
            <div className="text-[10px] font-black uppercase tracking-widest">Proof line</div>
            <p className="mt-1">{community.proof_line}</p>
          </section>
        )}

        {/* Deployed assets */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-600">
              Deployed assets ({assets.total})
              {assets.total_funded_aud > 0 && <span className="ml-2 text-gray-500">· {money(assets.total_funded_aud)} attributed</span>}
            </h2>
            <RecordDeploymentButton communityId={community.id} communityName={community.community_name} />
          </div>
          {assets.total === 0 ? (
            <div className="border-4 border-bauhaus-black bg-white p-4 text-sm italic text-gray-500">
              No deployments recorded yet. Record one above to track beds/washers + the funder that paid for them.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="border-4 border-bauhaus-black bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">By product</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {Object.entries(assets.by_product).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                    <li key={p} className="flex justify-between"><span>{p}</span><span className="font-black">{n}</span></li>
                  ))}
                </ul>
              </div>
              <div className="border-4 border-bauhaus-black bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">By funder</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {Object.entries(assets.by_funder).sort((a, b) => b[1] - a[1]).map(([f, n]) => (
                    <li key={f} className="flex justify-between"><span>{f}</span><span className="font-black">{n}</span></li>
                  ))}
                </ul>
              </div>
              <div className="border-4 border-bauhaus-black bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Recent batches ({deploymentBatches.length})</div>
                {deploymentBatches.length === 0 ? (
                  <div className="mt-2 text-xs italic text-gray-500">No batch records (assets from earlier CSV import)</div>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs">
                    {deploymentBatches.slice(0, 5).map(b => (
                      <li key={b.id}>
                        <div className="font-black">{b.unit_count} × {b.product_type || b.product_slug}</div>
                        <div className="text-gray-600 text-[11px]">{relDate(b.deployed_at)} · {b.funded_by_label || '—'}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Mapped procurement entities */}
        <section>
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Mapped buyers ({mappedBuyers.length})</h2>
          {mappedBuyers.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-white p-4 text-sm italic text-gray-500">
              No procurement entities mapped yet. Promote any local org below to a buyer.
            </div>
          ) : (
            <div className="space-y-2">
              {mappedBuyers.map(b => (
                <div key={b.id} className="border-4 border-bauhaus-black bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-base font-black">{b.entity_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {b.buyer_role && <span className="bg-bauhaus-canvas px-2 py-0.5 font-black uppercase tracking-wider">{b.buyer_role}</span>}
                        {b.procurement_method && <span className="bg-bauhaus-canvas px-2 py-0.5 uppercase tracking-wider">{b.procurement_method}</span>}
                        {b.relationship_status && <span className="border border-bauhaus-black px-2 py-0.5 uppercase tracking-wider">{b.relationship_status}</span>}
                        {b.is_community_controlled && <span className="bg-bauhaus-black text-white px-2 py-0.5 uppercase tracking-wider">community-controlled</span>}
                      </div>
                      <div className="mt-1 text-xs text-gray-700">
                        {b.govt_contract_value ? `${money(b.govt_contract_value)} govt contracts · ` : ''}
                        {b.estimated_annual_spend ? `${money(b.estimated_annual_spend)} est. spend · ` : ''}
                        {b.abn ? `ABN ${b.abn} · ` : ''}
                        {b.postcode ? `${b.postcode}` : ''}
                      </div>
                      {b.website && <a href={b.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline hover:text-bauhaus-red">{b.website}</a>}
                    </div>
                    <PushToGhlButton
                      payload={{
                        entityName: b.entity_name,
                        buyerRole: b.buyer_role,
                        abn: b.abn,
                        website: b.website,
                        communityName: community.community_name,
                        communityState: community.state,
                        isCommunityControlled: b.is_community_controlled || false,
                        relationshipStatus: b.relationship_status,
                        govtContractValue: b.govt_contract_value,
                        buyerEntityRowId: b.id,
                        entityId: b.entity_id,
                        communityId: community.id,
                      }}
                      linked={b.ghl_contact_id ? {
                        contactId: b.ghl_contact_id,
                        opportunityId: b.ghl_opportunity_id || undefined,
                        stageName: b.ghl_stage_name || undefined,
                        lastPushedAt: b.ghl_last_pushed_at || undefined,
                      } : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Local entities not yet mapped */}
        {localEntities.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Other local orgs in {community.postcode} ({localEntities.length})</h2>
            <p className="mb-2 text-xs text-gray-700">Community-controlled orgs first. Push any of these to GHL to start a contact thread.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {localEntities.slice(0, 30).map(e => (
                <div key={e.id} className="border-2 border-bauhaus-black bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-black">{e.canonical_name}</div>
                      <div className="mt-0.5 text-[11px] text-gray-700">
                        {e.entity_type} · {e.sector || '—'} {e.abn ? `· ABN ${e.abn}` : ''}
                        {e.is_community_controlled && <span className="ml-1 bg-bauhaus-black text-white px-1 uppercase tracking-wider text-[9px]">CC</span>}
                      </div>
                    </div>
                    <PushToGhlButton
                      compact
                      payload={{
                        entityName: e.canonical_name,
                        buyerRole: e.entity_type,
                        abn: e.abn,
                        website: null,
                        communityName: community.community_name,
                        communityState: community.state,
                        isCommunityControlled: e.is_community_controlled || false,
                        relationshipStatus: 'prospect',
                        govtContractValue: null,
                        entityId: e.id,
                        communityId: community.id,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {localEntities.length > 30 && (
              <div className="mt-2 text-xs text-gray-600">Showing top 30 of {localEntities.length}.</div>
            )}
          </section>
        )}

        {/* Matched grants */}
        {matchedGrants.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Matched grants ({matchedGrants.length})</h2>
            <div className="space-y-2">
              {matchedGrants.slice(0, 8).map(g => (
                <div key={g.id} className="border-2 border-bauhaus-black bg-white p-3">
                  <Link href={`/grants/${g.id}`} className="text-sm font-black hover:underline">
                    {g.name}
                  </Link>
                  <div className="mt-1 text-xs text-gray-700">
                    {g.provider || '—'} · {g.geography || '—'} · {money(g.amount_max)} · closes {relDate(g.closes_at)} · score {g.goods_relevance_score}
                  </div>
                  {g.url && <a href={g.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">Open grant page</a>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Matched foundations */}
        {matchedFoundations.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Matched foundations ({matchedFoundations.length})</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {matchedFoundations.slice(0, 8).map(f => (
                <div key={f.id} className="border-2 border-bauhaus-black bg-white p-3">
                  <div className="text-sm font-black">{f.name}</div>
                  <div className="mt-1 text-xs text-gray-700">
                    {money(f.total_giving_annual)} annual giving · {(f.geographic_focus || []).slice(0, 3).join(', ') || '—'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    Themes: {(f.thematic_focus || []).slice(0, 4).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">All signals ({signals.length})</h2>
            <ul className="space-y-1 text-sm">
              {signals.map(s => (
                <li key={s.id} className="border-2 border-bauhaus-black bg-white p-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-black uppercase tracking-wider">{s.status}</span>
                    <span className="text-gray-600">{s.signal_type.replace('_', ' ')}</span>
                    <span className="text-gray-600">conf: {s.funding_confidence || 'none'}</span>
                    {s.estimated_value && <span className="text-gray-600">est. {money(s.estimated_value)}</span>}
                  </div>
                  <div className="mt-0.5">{s.title}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Comms + activity timeline */}
        {timeline.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-gray-600">Activity timeline ({timeline.length})</h2>
            <ol className="border-4 border-bauhaus-black bg-white divide-y divide-gray-300">
              {timeline.slice(0, 50).map((e, i) => {
                const kindBg = e.kind === 'deployment' ? 'bg-bauhaus-yellow'
                  : e.kind === 'ghl_push' ? 'bg-bauhaus-red text-white'
                  : e.kind === 'signal_action' ? 'bg-bauhaus-blue text-white'
                  : 'bg-bauhaus-canvas';
                return (
                  <li key={`${e.kind}-${i}`} className="flex flex-wrap items-start gap-3 p-3">
                    <span className={`${kindBg} px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider shrink-0`}>{e.kind.replace('_', ' ')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black">{e.summary}</div>
                      {e.detail && <div className="mt-0.5 text-xs text-gray-700">{e.detail}</div>}
                    </div>
                    <span className="font-mono text-[10px] text-gray-500 shrink-0">{relDate(e.at)}</span>
                  </li>
                );
              })}
            </ol>
            {timeline.length > 50 && (
              <div className="mt-2 text-xs text-gray-600">+ {timeline.length - 50} older events</div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border-4 border-bauhaus-black ${accent ? 'bg-bauhaus-red text-white' : 'bg-white'} p-3`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-black">{value || '—'}</dd>
    </div>
  );
}
