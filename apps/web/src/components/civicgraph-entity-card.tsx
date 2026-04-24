/**
 * CivicGraphEntityCard — a compact, embeddable entity summary card.
 *
 * Used on:
 *   1. /embed/entity/[identifier]     (iframe embed for EL / partner sites)
 *   2. Any CivicGraph page that wants a small entity anchor
 *   3. As a rendering helper for the /api/data/entity/[identifier] contract
 *
 * This is a server component — no interactivity. Keep it that way so it
 * renders fast and works inside an iframe without hydration cost.
 */

type EntitySummary = {
  total_government_funding: number;
  contract_count: number;
  donation_count: number;
  grant_count: number;
  alma_intervention_count: number;
  year_range: { first: number | null; last: number | null };
};

type EntityBasics = {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string | null;
  sector: string | null;
  state: string | null;
  lga_name: string | null;
  is_community_controlled: boolean;
  website?: string | null;
  description?: string | null;
};

export type CivicGraphEntityCardData = {
  entity: EntityBasics;
  summary: EntitySummary;
  url: string;
};

function formatCurrency(amount: number): string {
  if (amount === 0) return '$0';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatAbn(abn: string | null): string | null {
  if (!abn || abn.length !== 11) return abn;
  return `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8, 11)}`;
}

function entityTypeLabel(type: string | null): string {
  if (!type) return 'Organisation';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CivicGraphEntityCard({
  data,
  variant = 'full',
}: {
  data: CivicGraphEntityCardData;
  variant?: 'full' | 'compact';
}) {
  const { entity, summary, url } = data;

  const tagline: string[] = [];
  if (entity.is_community_controlled) tagline.push('Community-controlled');
  if (entity.entity_type) tagline.push(entityTypeLabel(entity.entity_type));
  if (entity.lga_name) tagline.push(entity.lga_name);
  else if (entity.state) tagline.push(entity.state);

  const hasSystems = summary.contract_count + summary.donation_count + summary.grant_count + summary.alma_intervention_count > 0;

  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
          About this organisation
        </p>
      </div>

      <div className="px-5 py-4">
        <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black">
          {entity.canonical_name}
        </h3>
        {tagline.length > 0 && (
          <p className="mt-1 text-xs font-medium text-bauhaus-muted">
            {tagline.join(' · ')}
          </p>
        )}
        {formatAbn(entity.abn) && (
          <p className="mt-1 text-[11px] font-mono text-bauhaus-muted">
            ABN {formatAbn(entity.abn)}
          </p>
        )}

        {variant === 'full' && entity.description && (
          <p className="mt-3 text-sm text-bauhaus-black/80">{entity.description}</p>
        )}

        {hasSystems ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t-2 border-bauhaus-black/10 pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Gov funding
              </dt>
              <dd className="mt-1 text-lg font-black text-bauhaus-black">
                {formatCurrency(summary.total_government_funding)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Contracts
              </dt>
              <dd className="mt-1 text-lg font-black text-bauhaus-black">
                {summary.contract_count}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Grants
              </dt>
              <dd className="mt-1 text-lg font-black text-bauhaus-black">
                {summary.grant_count}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Evidence
              </dt>
              <dd className="mt-1 text-lg font-black text-bauhaus-black">
                {summary.alma_intervention_count > 0 ? `${summary.alma_intervention_count} ALMA` : '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 border-t-2 border-bauhaus-black/10 pt-4 text-xs text-bauhaus-muted">
            No cross-system records yet. This entity is in the graph but has no linked
            procurement, donations, grants, or evidence records.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t-4 border-bauhaus-black bg-bauhaus-black px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
          CivicGraph
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:text-bauhaus-yellow"
        >
          Full dossier &rarr;
        </a>
      </div>
    </div>
  );
}
