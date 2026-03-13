'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  GoodsBuyerTarget,
  GoodsCapitalTarget,
  GoodsCommunityProof,
  GoodsLifecycleProductStat,
  GoodsPartnerTarget,
  GoodsTrackedIdentityRole,
  GoodsTrackedIdentity,
  GoodsTargetType,
  GoodsWorkspaceData,
  GoodsWorkspaceMode,
} from '@/lib/goods-workspace-data';

type GoodsWorkspaceClientProps = {
  initialData: GoodsWorkspaceData;
};

type ExportFormat = 'notion' | 'csv' | 'json';
type CommunityStateFilter = 'all' | 'NT' | 'QLD';
type GoodsPushResultEntry = {
  targetId: string;
  organizationName: string;
  success: boolean;
  simulated?: boolean;
  contactId?: string | null;
  opportunityId?: string | null;
  opportunityCreated?: boolean;
  pipelineConfigured?: boolean;
  error?: string | null;
};

type GoodsPushResult = {
  targetType: GoodsTargetType;
  totalTargets: number;
  successful: number;
  failed: number;
  opportunitiesCreated: number;
  results: GoodsPushResultEntry[];
};

const MODE_LABELS: Record<GoodsWorkspaceMode, string> = {
  need: 'Need-led',
  buyer: 'Buyer-led',
  capital: 'Capital-led',
  partner: 'Partner-led',
};

const TARGET_TYPE_LABELS: Record<GoodsTargetType, string> = {
  buyer: 'Buyer targets',
  capital: 'Capital targets',
  partner: 'Partner targets',
};

function downloadBlob(filename: string, contentType: string, content: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function badgeTone(score: number) {
  if (score >= 82) return 'border-money bg-money-light text-money';
  if (score >= 68) return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  return 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red';
}

function modeDescription(mode: GoodsWorkspaceMode) {
  switch (mode) {
    case 'need':
      return 'Start from remote communities where bed access, washer support, and community-controlled delivery are under pressure.';
    case 'buyer':
      return 'Rank the buyers most likely to move 100+ beds and repeat household-goods orders into community.';
    case 'capital':
      return 'Blend grant, philanthropic, and catalytic capital pathways that can fund production, working capital, and remote distribution.';
    case 'partner':
      return 'Find the organisations that can host, deliver, or legitimise community-owned production on the ground.';
  }
}

function scoreLabel(mode: GoodsWorkspaceMode) {
  switch (mode) {
    case 'need':
      return 'Need + leverage score';
    case 'buyer':
      return 'Buyer plausibility score';
    case 'capital':
      return 'Capital fit score';
    case 'partner':
      return 'Partner fit score';
  }
}

function CommunityCard({ community }: { community: GoodsCommunityProof }) {
  return (
    <article className="border-4 border-bauhaus-black bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">
            {community.state} · {community.regionLabel}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight">{community.community}</h3>
          <p className="mt-2 text-sm text-bauhaus-muted">{community.proofLine}</p>
        </div>
        <div className={`shrink-0 border-2 px-3 py-2 text-sm font-black uppercase tracking-[0.25em] ${badgeTone(community.needLeverageScore)}`}>
          {community.needLeverageScore}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">Assets + requests</div>
          <div className="mt-3 text-xl font-black">{community.totalAssets} live</div>
          <div className="mt-1 text-sm text-bauhaus-muted">
            {community.demandBeds} bed demand · {community.demandWashers} washer demand
          </div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">Local pressure</div>
          <div className="mt-3 text-xl font-black">{community.stateThinDistricts} thin</div>
          <div className="mt-1 text-sm text-bauhaus-muted">
            {community.stateCapturedDistricts} captured districts in {community.state}
          </div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">Community proof</div>
          <div className="mt-3 text-sm font-medium text-bauhaus-black">{community.story}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-bauhaus-muted">
        <li>Local community-controlled entities: <span className="font-black text-bauhaus-black">{community.localCommunityControlledCount}</span></li>
        <li>NDIS providers in state context: <span className="font-black text-bauhaus-black">{community.localNdisProviders ?? 'Unknown'}</span></li>
        <li>Youth jobs case: <span className="text-bauhaus-black">{community.youthJobs}</span></li>
      </ul>
    </article>
  );
}

type TargetCardProps = {
  targetType: GoodsTargetType;
  target: GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget;
  selected: boolean;
  onToggle: () => void;
};

function TargetCard({ targetType, target, selected, onToggle }: TargetCardProps) {
  const score =
    targetType === 'buyer'
      ? (target as GoodsBuyerTarget).buyerPlausibilityScore
      : targetType === 'capital'
        ? (target as GoodsCapitalTarget).capitalFitScore
        : (target as GoodsPartnerTarget).partnerScore;

  return (
    <article
      className={`border-4 p-5 transition-colors ${
        selected ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-muted">
            {targetType === 'buyer'
              ? (target as GoodsBuyerTarget).role
              : targetType === 'capital'
                ? (target as GoodsCapitalTarget).instrumentType
                : (target as GoodsPartnerTarget).role}
          </p>
          <h3 className="mt-2 text-xl font-black tracking-tight">{target.name}</h3>
          <p className="mt-2 text-sm text-bauhaus-muted">
            {targetType === 'buyer'
              ? (target as GoodsBuyerTarget).contactSurface
              : targetType === 'capital'
                ? (target as GoodsCapitalTarget).contactSurface
                : (target as GoodsPartnerTarget).contactSurface}
          </p>
        </div>
        <div className={`shrink-0 border-2 px-3 py-2 text-sm font-black uppercase tracking-[0.25em] ${badgeTone(score)}`}>
          {score}
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-bauhaus-black">
        {(target.reasons || []).slice(0, 3).map((reason) => (
          <li key={reason} className="flex gap-2">
            <span className="font-black text-bauhaus-red">•</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">Relationship status</div>
          <div className="mt-2 text-sm font-black uppercase tracking-[0.25em]">{target.relationshipStatus}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">Next move</div>
          <div className="mt-2 text-sm text-bauhaus-black">{target.nextAction}</div>
        </div>
      </div>

      {targetType === 'buyer' ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="border-2 border-bauhaus-black p-3">
            <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">NT community reach</div>
            <div className="mt-2 text-sm text-bauhaus-black">
              {(target as GoodsBuyerTarget).ntOfficialCommunityReach > 0
                ? `${(target as GoodsBuyerTarget).ntOfficialCommunityReach} official NT communities already matched`
                : 'No direct NT community crosswalk yet'}
            </div>
          </div>
          <div className="border-2 border-bauhaus-black p-3">
            <div className="text-[11px] font-black uppercase tracking-[0.25em] text-bauhaus-muted">Procurement lane</div>
            <div className="mt-2 text-sm text-bauhaus-black">{(target as GoodsBuyerTarget).procurementPath}</div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        className={`mt-4 inline-flex items-center border-4 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] ${
          selected ? 'border-bauhaus-blue text-bauhaus-blue' : 'border-bauhaus-black text-bauhaus-black'
        }`}
      >
        {selected ? 'Selected for outreach' : 'Select for outreach'}
      </button>
    </article>
  );
}

function buildTargetDownloadName(targetType: GoodsTargetType, format: ExportFormat) {
  const stamp = new Date().toISOString().slice(0, 10);
  const ext = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'md';
  return `goods-${targetType}-targets-${stamp}.${ext}`;
}

function trackedFromLabel(value: GoodsTrackedIdentity['trackedFrom']) {
  switch (value) {
    case 'org_profile_abn':
      return 'Org ABN';
    case 'org_profile_name':
      return 'Org name';
    case 'env_abn':
      return 'Tracked ABN';
    case 'env_name':
      return 'Tracked entity';
  }
}

function identityRoleLabel(value: GoodsTrackedIdentityRole) {
  switch (value) {
    case 'commercial':
      return 'Commercial';
    case 'philanthropic':
      return 'Philanthropy';
    case 'community':
      return 'Community';
    case 'general':
      return 'General';
  }
}

function targetSetPurpose(targetType: GoodsTargetType) {
  switch (targetType) {
    case 'buyer':
      return 'Use the identity that should front sales, procurement, and repeat bed orders.';
    case 'capital':
      return 'Use the identity that should front grants, philanthropy, catalytic capital, and blended finance.';
    case 'partner':
      return 'Use the identity that should front local partnership, production, and community-delivery conversations.';
  }
}

function formatAgeDays(days: number | null) {
  if (days == null) return 'Unknown';
  if (days >= 365) return `${(days / 365).toFixed(1)} years`;
  if (days >= 30) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}

function LifecycleProductCard({ stat }: { stat: GoodsLifecycleProductStat }) {
  return (
    <article className="border-4 border-bauhaus-black bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-blue">
            {stat.productFamily === 'beds' ? 'Beds + mattress system' : 'Washing machines'}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight">{stat.assetCount} tracked</h3>
          <p className="mt-2 text-sm text-bauhaus-muted">{stat.insight}</p>
          {stat.topFailureCause ? (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.24em] text-bauhaus-red">
              Top failure cause: {stat.topFailureCause.replace(/_/g, ' ')}
            </p>
          ) : null}
        </div>
        <div className={`shrink-0 border-2 px-3 py-2 text-sm font-black uppercase tracking-[0.25em] ${badgeTone(Math.min(100, Math.max(45, stat.dumpRiskCount * 12 + stat.safetyRiskCount * 18 + stat.failureSignalCount * 4)))}`}>
          {stat.dumpRiskCount} dump risk
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Median observed age</div>
          <div className="mt-2 text-lg font-black">{formatAgeDays(stat.medianObservedAgeDays)}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">P90 observed age</div>
          <div className="mt-2 text-lg font-black">{formatAgeDays(stat.p90ObservedAgeDays)}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Older than 12 months</div>
          <div className="mt-2 text-lg font-black">{stat.staleOver365Count}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Older than 24 months</div>
          <div className="mt-2 text-lg font-black">{stat.staleOver730Count}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Structured incidents</div>
          <div className="mt-2 text-lg font-black">{stat.supportSignalCount}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Failure events</div>
          <div className="mt-2 text-lg font-black">{stat.failureSignalCount}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Affected assets</div>
          <div className="mt-2 text-lg font-black">{stat.affectedAssetCount}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Repair requests</div>
          <div className="mt-2 text-lg font-black">{stat.repairRequestCount}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Replacement requests</div>
          <div className="mt-2 text-lg font-black">{stat.replacementRequestCount}</div>
        </div>
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Safety-critical</div>
          <div className="mt-2 text-lg font-black">{stat.safetyRiskCount}</div>
        </div>
      </div>
      {stat.embodiedPlasticKg ? (
        <div className="mt-4 border-2 border-money bg-money-light p-3 text-sm text-money">
          Current tracked fleet embodies roughly {(Math.round(stat.embodiedPlasticKg / 100) / 10).toFixed(1)} tonnes of recycled plastic.
        </div>
      ) : null}
    </article>
  );
}

function targetTypeForMode(mode: GoodsWorkspaceMode): GoodsTargetType | null {
  if (mode === 'buyer') return 'buyer';
  if (mode === 'capital') return 'capital';
  if (mode === 'partner') return 'partner';
  return null;
}

function targetState(target: GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget) {
  if ('state' in target) return target.state;
  return null;
}

function targetHasState(target: GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget, stateFilter: CommunityStateFilter) {
  if (stateFilter === 'all') return true;
  if ('state' in target) {
    return target.state === stateFilter;
  }
  if ('geographicFocus' in target) {
    return target.geographicFocus.some((entry) => entry.toUpperCase().includes(stateFilter));
  }
  return true;
}

function targetRelevanceToCommunity(
  target: GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget,
  community: GoodsCommunityProof | null,
) {
  if (!community) return 0;
  const haystack = [
    target.name,
    target.contactSurface,
    target.nextAction,
    target.relationshipNote,
    ...target.reasons,
    'remoteFootprint' in target ? target.remoteFootprint : '',
    'productFit' in target ? target.productFit : '',
    'procurementPath' in target ? target.procurementPath : '',
    'geographicFocus' in target ? target.geographicFocus.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  if ('state' in target && target.state === community.state) score += 12;
  if (haystack.includes(community.community.toLowerCase())) score += 30;
  if (haystack.includes(community.regionLabel.toLowerCase())) score += 12;
  if (community.knownBuyer && target.name.toLowerCase().includes(community.knownBuyer.toLowerCase())) score += 40;
  if (community.keyPartnerNames.some((name) => target.name.toLowerCase().includes(name.toLowerCase()))) score += 18;
  if (haystack.includes(community.state.toLowerCase())) score += 6;
  return score;
}

function procurementPlayerLabel(target: GoodsBuyerTarget | GoodsPartnerTarget) {
  const text = `${target.name} ${target.role}`.toLowerCase();
  if (/(council|regional council|shire|government|authority)/.test(text)) return 'Government / regional authority';
  if (/(aboriginal|community|health|corporation|homelands)/.test(text)) return 'Community-controlled / Aboriginal organisation';
  if (/(pty ltd|retail|supplier|intermediary|distribution|stores)/.test(text)) return 'For-profit / intermediary';
  return 'Mission-led / partner pathway';
}

export default function GoodsWorkspaceClient({ initialData }: GoodsWorkspaceClientProps) {
  const [mode, setMode] = useState<GoodsWorkspaceMode>(initialData.defaultMode);
  const [outreachType, setOutreachType] = useState<GoodsTargetType>('buyer');
  const [communityStateFilter, setCommunityStateFilter] = useState<CommunityStateFilter>('NT');
  const [communitySearch, setCommunitySearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Record<GoodsTargetType, string[]>>({
    buyer: initialData.buyerTargets.slice(0, 4).map((target) => target.id),
    capital: initialData.capitalTargets.slice(0, 4).map((target) => target.id),
    partner: initialData.partnerTargets.slice(0, 4).map((target) => target.id),
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'push' | 'push-test' | null>(null);
  const [selectedSourceIdentityIds, setSelectedSourceIdentityIds] = useState<Record<GoodsTargetType, string | null>>({
    buyer: initialData.outboundIdentityRecommendations.buyer.identityId,
    capital: initialData.outboundIdentityRecommendations.capital.identityId,
    partner: initialData.outboundIdentityRecommendations.partner.identityId,
  });
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [lastPushResult, setLastPushResult] = useState<GoodsPushResult | null>(null);

  useEffect(() => {
    setSelectedSourceIdentityIds({
      buyer: initialData.outboundIdentityRecommendations.buyer.identityId,
      capital: initialData.outboundIdentityRecommendations.capital.identityId,
      partner: initialData.outboundIdentityRecommendations.partner.identityId,
    });
  }, [initialData]);

  const filteredCommunities = useMemo(() => {
    const query = communitySearch.trim().toLowerCase();
    return initialData.communities.filter((community) => {
      if (communityStateFilter !== 'all' && community.state !== communityStateFilter) {
        return false;
      }
      if (!query) return true;
      const haystack = [community.community, community.postcode, community.regionLabel, community.lgaName || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [communitySearch, communityStateFilter, initialData.communities]);

  useEffect(() => {
    if (!filteredCommunities.length) {
      setSelectedCommunityId(null);
      return;
    }
    if (!selectedCommunityId || !filteredCommunities.some((community) => community.id === selectedCommunityId)) {
      setSelectedCommunityId(filteredCommunities[0].id);
    }
  }, [filteredCommunities, selectedCommunityId]);

  const selectedCommunity =
    filteredCommunities.find((community) => community.id === selectedCommunityId) || filteredCommunities[0] || null;

  const filteredBuyerTargets = useMemo(() => {
    return [...initialData.buyerTargets]
      .filter((target) => targetHasState(target, communityStateFilter))
      .sort(
        (left, right) =>
          targetRelevanceToCommunity(right, selectedCommunity) - targetRelevanceToCommunity(left, selectedCommunity) ||
          right.buyerPlausibilityScore - left.buyerPlausibilityScore,
      );
  }, [communityStateFilter, initialData.buyerTargets, selectedCommunity]);

  const filteredCapitalTargets = useMemo(() => {
    return [...initialData.capitalTargets]
      .filter((target) => targetHasState(target, communityStateFilter))
      .sort(
        (left, right) =>
          targetRelevanceToCommunity(right, selectedCommunity) - targetRelevanceToCommunity(left, selectedCommunity) ||
          right.capitalFitScore - left.capitalFitScore,
      );
  }, [communityStateFilter, initialData.capitalTargets, selectedCommunity]);

  const filteredPartnerTargets = useMemo(() => {
    return [...initialData.partnerTargets]
      .filter((target) => targetHasState(target, communityStateFilter))
      .sort(
        (left, right) =>
          targetRelevanceToCommunity(right, selectedCommunity) - targetRelevanceToCommunity(left, selectedCommunity) ||
          right.partnerScore - left.partnerScore,
      );
  }, [communityStateFilter, initialData.partnerTargets, selectedCommunity]);

  const rankedTargets = useMemo(() => {
    if (mode === 'buyer') return filteredBuyerTargets;
    if (mode === 'capital') return filteredCapitalTargets;
    if (mode === 'partner') return filteredPartnerTargets;
    return [];
  }, [filteredBuyerTargets, filteredCapitalTargets, filteredPartnerTargets, mode]);

  const outreachTargets = useMemo(() => {
    if (outreachType === 'buyer') return filteredBuyerTargets;
    if (outreachType === 'capital') return filteredCapitalTargets;
    return filteredPartnerTargets;
  }, [filteredBuyerTargets, filteredCapitalTargets, filteredPartnerTargets, outreachType]);

  const selectedCount = selectedIds[outreachType].length;
  const currentSourceRecommendation = initialData.outboundIdentityRecommendations[outreachType];
  const currentSourceIdentity = initialData.trackedIdentities.find(
    (identity) => identity.id === selectedSourceIdentityIds[outreachType],
  ) || null;
  const reviewBuyer = filteredBuyerTargets[0] || null;
  const reviewCapital = filteredCapitalTargets[0] || null;
  const reviewCommunity = selectedCommunity;
  const procurementPlayers = filteredBuyerTargets.slice(0, 4);
  const communityPartners = filteredPartnerTargets.slice(0, 4);

  function toggleSelection(targetType: GoodsTargetType, id: string) {
    setSelectedIds((current) => {
      const bucket = current[targetType];
      const exists = bucket.includes(id);
      return {
        ...current,
        [targetType]: exists ? bucket.filter((value) => value !== id) : [...bucket, id],
      };
    });
  }

  function selectTop(targetType: GoodsTargetType, count: number) {
    const source =
      targetType === 'buyer'
        ? filteredBuyerTargets
        : targetType === 'capital'
          ? filteredCapitalTargets
          : filteredPartnerTargets;
    setSelectedIds((current) => ({
      ...current,
      [targetType]: source.slice(0, count).map((target) => target.id),
    }));
  }

  async function exportTargets(format: ExportFormat) {
    setBusy('export');
    setStatus(null);
    setLastPushResult(null);
    try {
      const params = new URLSearchParams({
        targetType: outreachType,
        format,
      });
      if (selectedIds[outreachType].length) {
        params.set('ids', selectedIds[outreachType].join(','));
      }
      if (selectedSourceIdentityIds[outreachType]) {
        params.set('sourceIdentityId', selectedSourceIdentityIds[outreachType] || '');
      }
      if (selectedCommunity?.id) {
        params.set('focusCommunityId', selectedCommunity.id);
      }
      const response = await fetch(`/api/goods-workspace/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const content = await response.text();
      const contentType = response.headers.get('content-type') || 'text/plain';
      downloadBlob(buildTargetDownloadName(outreachType, format), contentType, content);
      setStatus(
        `Exported ${selectedCount || outreachTargets.length} ${TARGET_TYPE_LABELS[outreachType].toLowerCase()} as ${format.toUpperCase()} using ${currentSourceIdentity?.name || initialData.orgName}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  async function pushTargets(idsOverride?: string[], pushMode: 'push' | 'push-test' = 'push') {
    const idsToPush =
      idsOverride && idsOverride.length
        ? idsOverride
        : selectedIds[outreachType].length
          ? selectedIds[outreachType]
          : outreachTargets.slice(0, 3).map((target) => target.id);

    if (!idsToPush.length) {
      setStatus(`No ${TARGET_TYPE_LABELS[outreachType].toLowerCase()} available to push yet.`);
      setLastPushResult(null);
      return;
    }

    setBusy(pushMode);
    setStatus(null);
    setLastPushResult(null);
    try {
      const response = await fetch('/api/goods-workspace/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetType: outreachType,
          ids: idsToPush,
          sourceIdentityId: selectedSourceIdentityIds[outreachType],
          focusCommunityId: selectedCommunity?.id || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'CRM push failed.');
      }
      const pipelineConfiguredCount = Array.isArray(result?.results)
        ? result.results.filter((entry: { pipelineConfigured?: boolean }) => entry.pipelineConfigured).length
        : 0;
      const opportunitySummary =
        pipelineConfiguredCount > 0
          ? `${result.opportunitiesCreated || 0} pipeline opportunities`
          : 'contacts only (strategic GHL pipelines not configured yet)';
      setLastPushResult({
        targetType: outreachType,
        totalTargets: result.totalTargets ?? idsToPush.length,
        successful: result.successful ?? 0,
        failed: result.failed ?? 0,
        opportunitiesCreated: result.opportunitiesCreated ?? 0,
        results: Array.isArray(result.results) ? result.results : [],
      });
      setStatus(
        `Pushed ${result.totalTargets} ${TARGET_TYPE_LABELS[outreachType].toLowerCase()} into Goods CRM with ${result.successful} successful contacts and ${opportunitySummary} using ${currentSourceIdentity?.name || initialData.orgName}.`,
      );
    } catch (error) {
      setLastPushResult(null);
      setStatus(error instanceof Error ? error.message : 'CRM push failed.');
    } finally {
      setBusy(null);
    }
  }

  const testTarget = outreachTargets[0] || null;

  return (
    <div className="min-h-screen bg-bauhaus-canvas pb-20">
      <section className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1520px] px-6 py-14">
          <p className="text-xs font-black uppercase tracking-[0.38em] text-bauhaus-yellow">
            Goods on Country x CivicGraph
          </p>
          <div className="mt-6 grid gap-10 xl:grid-cols-[1.25fr_0.9fr]">
            <div>
              <h1 className="text-5xl font-black tracking-tight md:text-6xl">
                {initialData.workspaceTitle}
              </h1>
              <p className="mt-5 max-w-3xl text-lg text-white/70">{initialData.thesis.summary}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {initialData.workflow.map((step) => (
                  <div
                    key={step.id}
                    className="border-2 border-white/25 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.24em]"
                  >
                    {step.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-4 border-bauhaus-yellow bg-bauhaus-canvas p-6 text-bauhaus-black">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">Goods thesis</div>
              <div className="mt-4 space-y-4">
                {initialData.thesis.pillars.map((pillar) => (
                  <div key={pillar.title}>
                    <div className="text-sm font-black uppercase tracking-[0.24em]">{pillar.title}</div>
                    <p className="mt-2 text-sm text-bauhaus-muted">{pillar.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t-4 border-bauhaus-black pt-5">
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">Claimed identities</div>
                <div className="mt-4 space-y-3">
                  {initialData.trackedIdentities.length ? initialData.trackedIdentities.map((identity) => (
                    <div key={`${identity.trackedFrom}-${identity.id}`} className="border-2 border-bauhaus-black bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black uppercase tracking-[0.2em]">{identity.name}</div>
                          <div className="mt-1 text-sm text-bauhaus-muted">
                            {identity.abn ? `ABN ${identity.abn}` : 'ABN pending'}
                            {identity.state ? ` · ${identity.state}` : ''}
                          </div>
                        </div>
                        <div className={`border-2 px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${
                          identity.matchStatus === 'matched'
                            ? 'border-money bg-money-light text-money'
                            : 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red'
                        }`}>
                          {identity.matchStatus === 'matched' ? 'Claimed in graph' : 'Needs claiming'}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">
                        <span>{trackedFromLabel(identity.trackedFrom)}</span>
                        {identity.gsId ? <span>GS {identity.gsId}</span> : null}
                      </div>
                    </div>
                  )) : (
                    <div className="border-2 border-bauhaus-red bg-bauhaus-red/10 p-3 text-sm text-bauhaus-black">
                      No tracked Goods identity is connected yet. Add your ABN to the org profile or set `GOODS_TRACKED_ABNS`.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {initialData.thesis.currentStats.map((stat) => (
              <div key={stat.label} className="border-4 border-white/15 bg-white/5 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-white/60">{stat.label}</div>
                <div className="mt-3 text-4xl font-black">{stat.value}</div>
                <p className="mt-2 text-sm text-white/60">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1520px] space-y-8 px-6 pt-10">
        <section className="border-4 border-bauhaus-black bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Community and postcode first</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Start with one community, then work the buyers, partners, and capital around it</h2>
              <p className="mt-3 text-sm text-bauhaus-muted">
                This is the practical operating view for Goods: choose the NT or QLD community you are trying to support, then see who is moving procurement, who is community-controlled, and who can fund community-owned production.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[auto_auto]">
              <div className="flex flex-wrap gap-2">
                {(['NT', 'QLD', 'all'] as CommunityStateFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setCommunityStateFilter(filter)}
                    className={`border-4 px-4 py-3 text-xs font-black uppercase tracking-[0.28em] ${
                      communityStateFilter === filter
                        ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                        : 'border-bauhaus-black bg-white text-bauhaus-black'
                    }`}
                  >
                    {filter === 'all' ? 'All states' : filter}
                  </button>
                ))}
              </div>
              <input
                value={communitySearch}
                onChange={(event) => setCommunitySearch(event.target.value)}
                placeholder="Search postcode or community"
                className="min-w-[260px] border-4 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium outline-none"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
            <div className="border-2 border-bauhaus-black p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.26em] text-bauhaus-muted">Focus community</div>
              <div className="mt-4 grid gap-3">
                {filteredCommunities.slice(0, 8).map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    onClick={() => setSelectedCommunityId(community.id)}
                    className={`border-4 p-3 text-left ${
                      selectedCommunity?.id === community.id
                        ? 'border-bauhaus-red bg-bauhaus-red/10'
                        : 'border-bauhaus-black bg-white'
                    }`}
                  >
                    <div className="text-sm font-black uppercase tracking-[0.18em]">{community.community}</div>
                    <div className="mt-1 text-sm text-bauhaus-muted">{community.postcode} · {community.state} · {community.regionLabel}</div>
                    <div className="mt-2 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-blue">
                      Need score {community.needLeverageScore}
                    </div>
                  </button>
                ))}
                {!filteredCommunities.length ? (
                  <div className="border-2 border-bauhaus-red bg-bauhaus-red/10 p-4 text-sm text-bauhaus-black">
                    No communities match this state/search filter yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-2 border-bauhaus-black p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.26em] text-bauhaus-muted">Procurement picture</div>
              {selectedCommunity ? (
                <>
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">{selectedCommunity.community}</h3>
                      <p className="mt-2 text-sm text-bauhaus-muted">
                        {selectedCommunity.postcode} · {selectedCommunity.state} · {selectedCommunity.regionLabel}
                      </p>
                      <p className="mt-3 max-w-3xl text-sm text-bauhaus-black">{selectedCommunity.story}</p>
                    </div>
                    <div className={`border-2 px-3 py-2 text-sm font-black uppercase tracking-[0.25em] ${badgeTone(selectedCommunity.needLeverageScore)}`}>
                      Need score {selectedCommunity.needLeverageScore}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className="border-2 border-bauhaus-black p-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Known procurement lane</div>
                      <div className="mt-2 text-lg font-black">{selectedCommunity.knownBuyer || 'No buyer mapped yet'}</div>
                      <p className="mt-2 text-sm text-bauhaus-muted">{selectedCommunity.proofLine}</p>
                    </div>
                    <div className="border-2 border-bauhaus-black p-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Community-controlled presence</div>
                      <div className="mt-2 text-lg font-black">{selectedCommunity.localCommunityControlledCount}</div>
                      <p className="mt-2 text-sm text-bauhaus-muted">Local community-controlled organisations in the graph for this postcode.</p>
                    </div>
                    <div className="border-2 border-bauhaus-black p-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Demand and proof</div>
                      <div className="mt-2 text-lg font-black">{selectedCommunity.demandBeds} beds · {selectedCommunity.demandWashers} washers</div>
                      <p className="mt-2 text-sm text-bauhaus-muted">{selectedCommunity.totalAssets} tracked Goods assets already active here.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="border-2 border-bauhaus-black p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Main buyer and procurement players</div>
                      <div className="mt-3 space-y-3">
                        {procurementPlayers.slice(0, 4).map((player) => (
                          <div key={player.id} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-black uppercase tracking-[0.16em]">{player.name}</div>
                                <div className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">{procurementPlayerLabel(player)}</div>
                              </div>
                              <div className={`border-2 px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${badgeTone(player.buyerPlausibilityScore)}`}>
                                {player.buyerPlausibilityScore}
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-bauhaus-muted">{player.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-2 border-bauhaus-black p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Aboriginal, community, and delivery partners</div>
                      <div className="mt-3 space-y-3">
                        {communityPartners.slice(0, 4).map((partner) => (
                          <div key={partner.id} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-black uppercase tracking-[0.16em]">{partner.name}</div>
                                <div className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">{procurementPlayerLabel(partner)}</div>
                              </div>
                              <div className={`border-2 px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${badgeTone(partner.partnerScore)}`}>
                                {partner.partnerScore}
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-bauhaus-muted">{partner.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border-2 border-bauhaus-red bg-bauhaus-red/10 p-4 text-sm text-bauhaus-black">
                  Pick a community to see the buyer, partner, and capital picture for that place.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-bauhaus-blue p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">NT remote community sweep</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">See every NT community we can already map and where the buyer data still breaks down</h2>
              <p className="mt-3 text-sm text-white/80">
                This is the practical audit layer for Goods. It shows which official NT remote communities already have buyer or service anchors in the graph, which still need postcode enrichment, and which local organisations are already visible as stores, health services, housing providers, or councils.
              </p>
            </div>
            <div className="border-2 border-white/40 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.26em]">
              {initialData.ntSweep.officialCoveredCount}/{initialData.ntSweep.officialCommunityCount} official communities with buyer/service coverage
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="border-4 border-white/20 bg-white/10 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">Official NT communities</div>
              <div className="mt-3 text-4xl font-black">{initialData.ntSweep.officialCommunityCount}</div>
              <p className="mt-2 text-sm text-white/70">The official NT remote community baseline now in CivicGraph.</p>
            </div>
            <div className="border-4 border-white/20 bg-white/10 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">Covered now</div>
              <div className="mt-3 text-4xl font-black">{initialData.ntSweep.officialCoveredCount}</div>
              <p className="mt-2 text-sm text-white/70">Communities with at least one buyer or service anchor already linked.</p>
            </div>
            <div className="border-4 border-white/20 bg-white/10 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">Still uncovered</div>
              <div className="mt-3 text-4xl font-black">{initialData.ntSweep.officialUncoveredCount}</div>
              <p className="mt-2 text-sm text-white/70">Communities where we still need stronger procurement or service mapping.</p>
            </div>
            <div className="border-4 border-white/20 bg-white/10 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">Postcode gaps</div>
              <div className="mt-3 text-4xl font-black">{initialData.ntSweep.officialMissingPostcodeCount}</div>
              <p className="mt-2 text-sm text-white/70">Official NT communities that still need postcode enrichment before place-level funding works properly.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="border-4 border-white/20 bg-white text-bauhaus-black">
              <div className="border-b-4 border-bauhaus-black px-5 py-4">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Weakest coverage</div>
                <h3 className="mt-2 text-2xl font-black tracking-tight">Communities we still need to map properly</h3>
              </div>
              <div className="divide-y-2 divide-bauhaus-black/10">
                {initialData.ntSweep.weakCoverage.slice(0, 8).map((community) => (
                  <div key={community.community} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <div className="text-sm font-black uppercase tracking-[0.16em]">{community.community}</div>
                      <div className="mt-1 text-sm text-bauhaus-muted">
                        {[community.regionLabel, community.serviceRegion, community.landCouncil].filter(Boolean).join(' · ') || 'Region still needs better service labeling'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {community.needsPostcodeEnrichment ? (
                          <span className="border-2 border-bauhaus-red bg-bauhaus-red/10 px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-red">
                            Postcode missing
                          </span>
                        ) : null}
                        {community.hasGoodsSignal ? (
                          <span className="border-2 border-money bg-money-light px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-money">
                            Goods signal
                          </span>
                        ) : null}
                        {community.topBuyerNames.slice(0, 2).map((buyer) => (
                          <span key={buyer} className="border-2 border-bauhaus-black/20 px-2 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                            {buyer}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="border-2 border-bauhaus-black p-2">
                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Buyer / service matches</div>
                        <div className="mt-1 text-lg font-black">{community.buyerMatchCount}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border-2 border-bauhaus-black p-2">
                          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Store</div>
                          <div className="mt-1 font-black">{community.storeCount}</div>
                        </div>
                        <div className="border-2 border-bauhaus-black p-2">
                          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Health</div>
                          <div className="mt-1 font-black">{community.healthCount}</div>
                        </div>
                        <div className="border-2 border-bauhaus-black p-2">
                          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Housing</div>
                          <div className="mt-1 font-black">{community.housingCount}</div>
                        </div>
                        <div className="border-2 border-bauhaus-black p-2">
                          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Council</div>
                          <div className="mt-1 font-black">{community.councilCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-4 border-white/20 bg-white text-bauhaus-black">
                <div className="border-b-4 border-bauhaus-black px-5 py-4">
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Buyer and service anchors</div>
                  <h3 className="mt-2 text-2xl font-black tracking-tight">Local organisations already visible in the NT graph</h3>
                </div>
                <div className="divide-y-2 divide-bauhaus-black/10">
                  {initialData.ntSweep.topBuyerReach.slice(0, 8).map((buyer) => (
                    <div key={`${buyer.buyerName}-${buyer.buyerType}`} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-black uppercase tracking-[0.16em]">{buyer.buyerName}</div>
                          <div className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                            {buyer.buyerType} · {buyer.officialCommunityCount} official communities
                          </div>
                        </div>
                        <div className="border-2 border-bauhaus-black px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em]">
                          {buyer.coverageCount} matches
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-bauhaus-muted">
                        Sample communities: {buyer.sampleCommunities.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-4 border-white/20 bg-white text-bauhaus-black p-5">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Data still needed</div>
                <ul className="mt-4 space-y-3 text-sm">
                  {initialData.ntSweep.dataNeeds.map((need) => (
                    <li key={need} className="flex gap-2">
                      <span className="font-black text-bauhaus-red">•</span>
                      <span>{need}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6 text-bauhaus-black">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-black/60">Lifecycle + dump pressure</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Measure how long goods last, where replacement pressure is building, and what we still cannot prove</h2>
              <p className="mt-3 text-sm text-bauhaus-black/80">
                This is the circular-economy and procurement evidence layer. It now combines live asset ages with structured support incidents from the Goods register, so you can argue not just that Goods is better, but that the current replacement cycle is economically and environmentally broken.
              </p>
            </div>
            <div className="border-2 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.26em]">
              Current landfill pressure is still under-measured
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {initialData.lifecycle.productStats.map((stat) => (
              <LifecycleProductCard key={stat.productFamily} stat={stat} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="border-4 border-bauhaus-black bg-white p-5">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">What the evidence already says</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {initialData.lifecycle.evidencePoints.map((point) => (
                  <div key={point.title} className="border-2 border-bauhaus-black p-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">{point.title}</div>
                    <div className="mt-2 text-2xl font-black">{point.value}</div>
                    <p className="mt-2 text-sm text-bauhaus-muted">{point.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-4 border-bauhaus-black bg-white p-5">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Landfill pressure summary</div>
                <p className="mt-4 text-sm leading-relaxed text-bauhaus-black">
                  {initialData.lifecycle.landfillPressureSummary}
                </p>
              </div>

              <div className="border-4 border-bauhaus-black bg-white p-5">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Data we still need to scrape</div>
                <ul className="mt-4 space-y-3 text-sm text-bauhaus-black">
                  {initialData.lifecycle.researchNeeds.map((need) => (
                    <li key={need} className="flex gap-2">
                      <span className="font-black text-bauhaus-red">•</span>
                      <span>{need}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-bauhaus-red p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Human review path</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Ready to test the full Goods flow now</h2>
              <p className="mt-3 text-sm text-white/80">
                The workspace is ready for human review. Work this in order: confirm the strongest community proof, review the top buyer, review the top capital source, confirm the outbound identity, then export or push.
              </p>
            </div>
            <div className="border-2 border-white/40 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.26em]">
              Start in Buyer-led mode
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setMode('need')}
              className="border-4 border-white bg-white/10 p-4 text-left"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">1. Check need signal</div>
              <div className="mt-2 text-xl font-black">{reviewCommunity?.community || 'Community proof'}</div>
              <p className="mt-2 text-sm text-white/80">
                {reviewCommunity
                  ? `${reviewCommunity.proofLine} Confirm this is the community story you want to lead with.`
                  : 'Confirm which community and demand signal should lead the outreach story.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('buyer');
                setOutreachType('buyer');
                if (reviewBuyer) {
                  setSelectedIds((current) => ({
                    ...current,
                    buyer: Array.from(new Set([reviewBuyer.id, ...current.buyer])).slice(0, Math.max(current.buyer.length, 1)),
                  }));
                }
              }}
              className="border-4 border-white bg-white/10 p-4 text-left"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">2. Review top buyer</div>
              <div className="mt-2 text-xl font-black">{reviewBuyer?.name || 'Buyer target'}</div>
              <p className="mt-2 text-sm text-white/80">
                {reviewBuyer
                  ? `${reviewBuyer.nextAction} Make sure this stays selected for outreach if it is still the strongest live buyer path.`
                  : 'Check the highest-ranked buyer and confirm the next move is commercially real.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('capital');
                setOutreachType('capital');
                if (reviewCapital) {
                  setSelectedIds((current) => ({
                    ...current,
                    capital: Array.from(new Set([reviewCapital.id, ...current.capital])).slice(0, Math.max(current.capital.length, 1)),
                  }));
                }
              }}
              className="border-4 border-white bg-white/10 p-4 text-left"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">3. Review top capital source</div>
              <div className="mt-2 text-xl font-black">{reviewCapital?.name || 'Capital target'}</div>
              <p className="mt-2 text-sm text-white/80">
                {reviewCapital
                  ? `${reviewCapital.nextAction} Confirm the stage fit and whether this should be approached under the philanthropic identity.`
                  : 'Check the highest-ranked capital source and confirm the ask is the right instrument.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextType = targetTypeForMode(mode) || 'buyer';
                setOutreachType(nextType);
              }}
              className="border-4 border-white bg-white/10 p-4 text-left"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">4. Export or push</div>
              <div className="mt-2 text-xl font-black">
                {currentSourceIdentity?.name || initialData.orgName}
              </div>
              <p className="mt-2 text-sm text-white/80">
                Confirm the selected outbound source is right for the target set, then export to Notion/CSV or push the batch into Goods CRM.
              </p>
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Mode</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">{MODE_LABELS[mode]}</h2>
                <p className="mt-2 max-w-2xl text-sm text-bauhaus-muted">{modeDescription(mode)}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {(['need', 'buyer', 'capital', 'partner'] as GoodsWorkspaceMode[]).map((candidateMode) => (
                  <button
                    key={candidateMode}
                    type="button"
                    onClick={() => setMode(candidateMode)}
                    className={`border-4 px-4 py-3 text-xs font-black uppercase tracking-[0.28em] ${
                      mode === candidateMode
                        ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                        : 'border-bauhaus-black bg-white text-bauhaus-black'
                    }`}
                  >
                    {MODE_LABELS[candidateMode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {initialData.topMoves.map((move) => (
                <article key={move.title} className="border-2 border-bauhaus-black p-4">
                  <div className="text-sm font-black uppercase tracking-[0.24em] text-bauhaus-red">{move.title}</div>
                  <p className="mt-3 text-sm text-bauhaus-muted">{move.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-black/60">Why this is different</p>
            <div className="mt-4 text-3xl font-black tracking-tight">{scoreLabel(mode)}</div>
            <p className="mt-3 text-sm text-bauhaus-black/70">
              The score is not a black box. Every target explains why it is plausible: remote footprint, buyer/category fit, openness, community-control, and stage fit all stay visible.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-bauhaus-black">
              <li>• NT and remote-community pathways are weighted first.</li>
              <li>• Proven delivery communities stay in view, not just funding keywords.</li>
              <li>• Outreach outputs are practical: Notion, CSV, and Goods CRM push.</li>
            </ul>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-6">
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Community need + proof</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">Lead with communities that already prove the model</h2>
                </div>
                <div className="border-2 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.26em]">
                  NT + remote first
                </div>
              </div>
              <div className="mt-6 grid gap-5">
                {filteredCommunities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            </div>

            <div className="border-4 border-bauhaus-black bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Outreach exports</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">Move selected targets into action</h2>
                  <p className="mt-2 text-sm text-bauhaus-muted">
                    Export the targets you want to pursue, then push the same payload into Goods CRM with target type, plausible reason, and next action.
                  </p>
                  <p className="mt-3 text-sm font-medium text-bauhaus-black">
                    Outbound source:
                    {' '}
                    <span className="font-black">
                      {currentSourceIdentity?.name || initialData.orgName}
                      {currentSourceIdentity?.abn || initialData.orgAbn
                        ? ` · ABN ${currentSourceIdentity?.abn || initialData.orgAbn}`
                        : ''}
                    </span>
                  </p>
                </div>
                <div className="border-2 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.26em]">
                  {selectedCount || outreachTargets.length} selected
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[0.6fr_1.4fr]">
                <div className="space-y-4">
                  <div className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-muted">Target set</div>
                  {(['buyer', 'capital', 'partner'] as GoodsTargetType[]).map((targetType) => (
                    <button
                      key={targetType}
                      type="button"
                      onClick={() => setOutreachType(targetType)}
                      className={`block w-full border-4 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.28em] ${
                        outreachType === targetType
                          ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                          : 'border-bauhaus-black bg-white text-bauhaus-black'
                      }`}
                    >
                      {TARGET_TYPE_LABELS[targetType]}
                    </button>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => selectTop(outreachType, 3)}
                      className="border-4 border-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em]"
                    >
                      Select top 3
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds((current) => ({ ...current, [outreachType]: [] }))}
                      className="border-4 border-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border-2 border-bauhaus-black p-5">
                  <div className="mb-5 border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                      {currentSourceRecommendation.strategyLabel}
                    </div>
                    <p className="mt-2 text-sm text-bauhaus-black">{currentSourceRecommendation.rationale}</p>
                    <p className="mt-2 text-sm text-bauhaus-muted">{targetSetPurpose(outreachType)}</p>

                    {initialData.trackedIdentities.length ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {initialData.trackedIdentities.map((identity) => {
                          const selected = selectedSourceIdentityIds[outreachType] === identity.id;
                          return (
                            <button
                              key={`source-${outreachType}-${identity.id}`}
                              type="button"
                              onClick={() =>
                                setSelectedSourceIdentityIds((current) => ({
                                  ...current,
                                  [outreachType]: identity.id,
                                }))
                              }
                              className={`border-4 p-3 text-left ${
                                selected
                                  ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                                  : 'border-bauhaus-black bg-white text-bauhaus-black'
                              }`}
                            >
                              <div className="text-[11px] font-black uppercase tracking-[0.24em]">
                                {identityRoleLabel(identity.identityRole)} · {trackedFromLabel(identity.trackedFrom)}
                              </div>
                              <div className="mt-2 text-sm font-black uppercase tracking-[0.14em]">{identity.name}</div>
                              <div className="mt-1 text-sm text-bauhaus-muted">
                                {identity.abn ? `ABN ${identity.abn}` : 'ABN pending'}
                                {identity.gsId ? ` · GS ${identity.gsId}` : ''}
                              </div>
                              <div className="mt-2 text-[11px] font-black uppercase tracking-[0.24em]">
                                {selected ? 'Selected source' : 'Use this source'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 border-2 border-bauhaus-red bg-bauhaus-red/10 p-4 text-sm text-bauhaus-black">
                        No claimed Goods identity is available yet. Add the current ABN or the new PTY to the tracked identity settings and this panel will start routing outreach through the right entity automatically.
                      </div>
                    )}

                    {initialData.trackedIdentities.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSourceIdentityIds((current) => ({
                            ...current,
                            [outreachType]: currentSourceRecommendation.identityId,
                          }))
                        }
                        className="mt-4 border-4 border-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em]"
                      >
                        Reset to recommended source
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => exportTargets('notion')}
                      className="border-4 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.28em]"
                    >
                      {busy === 'export' ? 'Exporting…' : 'Notion-ready'}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => exportTargets('csv')}
                      className="border-4 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.28em]"
                    >
                      CSV export
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => exportTargets('json')}
                      className="border-4 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.28em]"
                    >
                      CRM payload
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => pushTargets()}
                      className="border-4 border-bauhaus-red bg-bauhaus-red px-4 py-3 text-xs font-black uppercase tracking-[0.28em] text-white"
                    >
                      {busy === 'push' ? 'Pushing…' : 'Push to Goods CRM'}
                    </button>
                  </div>

                  <div className="mt-4 border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">One-target smoke test</div>
                        <p className="mt-2 text-sm text-bauhaus-black">
                          Push a single top-ranked target first so you can confirm contact + opportunity creation in GHL before running a full batch.
                        </p>
                        <p className="mt-2 text-sm text-bauhaus-muted">
                          Test target:
                          {' '}
                          <span className="font-black text-bauhaus-black">{testTarget?.name || 'No target available'}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy !== null || !testTarget}
                        onClick={() => pushTargets(testTarget ? [testTarget.id] : [], 'push-test')}
                        className="border-4 border-bauhaus-blue bg-link-light px-4 py-3 text-xs font-black uppercase tracking-[0.28em] text-bauhaus-blue"
                      >
                        {busy === 'push-test' ? 'Testing…' : 'Push one test target'}
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-bauhaus-muted">
                    Source proof is seeded from Goods asset and strategy files:
                    {' '}
                    {initialData.sourcePaths.join(' • ')}
                  </p>
                  {status ? (
                    <div className="mt-4 border-2 border-bauhaus-blue bg-link-light p-4 text-sm font-medium text-bauhaus-blue">
                      {status}
                    </div>
                  ) : null}
                  {lastPushResult ? (
                    <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Latest CRM push result</div>
                          <div className="mt-2 text-lg font-black text-bauhaus-black">
                            {lastPushResult.successful}/{lastPushResult.totalTargets} successful · {lastPushResult.opportunitiesCreated} opportunities created
                          </div>
                        </div>
                        <div className="border-2 border-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em]">
                          {TARGET_TYPE_LABELS[lastPushResult.targetType]}
                        </div>
                      </div>
                      {initialData.ghl.opportunitiesListUrl ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={initialData.ghl.opportunitiesListUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="border-4 border-bauhaus-black px-4 py-3 text-xs font-black uppercase tracking-[0.28em] text-bauhaus-black"
                          >
                            Open GHL Goods pipeline
                          </a>
                          <div className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                            Verify in Goods → New Lead
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-3">
                        {lastPushResult.results.map((result) => (
                          <div key={`${result.targetId}-${result.contactId || 'no-contact'}`} className="border-2 border-bauhaus-black p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-sm font-black uppercase tracking-[0.18em] text-bauhaus-black">
                                {result.organizationName}
                              </div>
                              <div className={`border-2 px-2 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${
                                result.success
                                  ? 'border-money bg-money-light text-money'
                                  : 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red'
                              }`}>
                                {result.success ? 'Pushed' : 'Failed'}
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-bauhaus-muted md:grid-cols-2">
                              <div>Contact id: <span className="font-black text-bauhaus-black">{result.contactId || 'No contact id returned'}</span></div>
                              <div>Opportunity id: <span className="font-black text-bauhaus-black">{result.opportunityId || 'No opportunity id returned'}</span></div>
                              <div>Pipeline configured: <span className="font-black text-bauhaus-black">{result.pipelineConfigured ? 'Yes' : 'No'}</span></div>
                              <div>Opportunity created: <span className="font-black text-bauhaus-black">{result.opportunityCreated ? 'Yes' : 'No'}</span></div>
                            </div>
                            {result.success && initialData.ghl.opportunitiesListUrl ? (
                              <div className="mt-3">
                                <a
                                  href={initialData.ghl.opportunitiesListUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex border-4 border-bauhaus-blue bg-link-light px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-blue"
                                >
                                  Open in GHL
                                </a>
                              </div>
                            ) : null}
                            {result.error ? (
                              <div className="mt-3 border-2 border-bauhaus-red bg-bauhaus-red/10 p-3 text-sm font-medium text-bauhaus-red">
                                {result.error}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">
                {mode === 'buyer'
                  ? 'Buyer pipeline'
                  : mode === 'capital'
                    ? 'Capital stack'
                    : mode === 'partner'
                      ? 'Delivery + partner graph'
                      : 'Need-ranked communities'}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                {mode === 'buyer'
                  ? 'Who is most likely to buy or distribute 100+ beds?'
                  : mode === 'capital'
                    ? 'Who can fund production, working capital, or catalytic scale?'
                    : mode === 'partner'
                      ? 'Who can host or strengthen production in community?'
                      : 'Where is the leverage highest right now?'}
              </h2>

              <div className="mt-6 space-y-5">
                {mode === 'need'
                  ? initialData.communities.slice(0, 4).map((community) => (
                      <CommunityCard key={community.id} community={community} />
                    ))
                  : rankedTargets.map((target) => (
                      <TargetCard
                        key={target.id}
                        targetType={mode === 'capital' ? 'capital' : mode === 'partner' ? 'partner' : 'buyer'}
                        target={target as GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget}
                        selected={selectedIds[mode === 'capital' ? 'capital' : mode === 'partner' ? 'partner' : 'buyer'].includes((target as GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget).id)}
                        onToggle={() => toggleSelection(mode === 'capital' ? 'capital' : mode === 'partner' ? 'partner' : 'buyer', (target as GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget).id)}
                      />
                    ))}
              </div>
            </div>

            <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Capital pathways</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Stack the right money, not just more money</h2>
              <div className="mt-6 space-y-4">
                {initialData.capitalPathways.map((pathway) => (
                  <article key={pathway.id} className="border-2 border-bauhaus-black bg-white p-4">
                    <div className="text-sm font-black uppercase tracking-[0.24em] text-bauhaus-red">{pathway.title}</div>
                    <p className="mt-2 text-sm text-bauhaus-muted">{pathway.summary}</p>
                    <div className="mt-3 text-[11px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                      Targets: {pathway.targetIds.join(', ')}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
