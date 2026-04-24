'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type FundingWorkspaceShortlistButtonProps = {
  kind: 'grant' | 'foundation';
  itemId: string;
  orgProfileId?: string | null;
  orgSlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  itemName?: string;
  providerName?: string | null;
  deadline?: string | null;
  amountDisplay?: string | null;
  amountNumeric?: number | null;
};

export function FundingWorkspaceShortlistButton({
  kind,
  itemId,
  orgProfileId,
  orgSlug,
  projectId,
  projectSlug,
  projectName,
  itemName,
  providerName,
  deadline,
  amountDisplay,
  amountNumeric,
}: FundingWorkspaceShortlistButtonProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
    });
  }, []);

  const destinationHref =
    kind === 'grant'
      ? orgSlug
        ? projectSlug
          ? `/org/${orgSlug}/${projectSlug}`
          : `/org/${orgSlug}`
        : null
      : orgSlug && projectSlug
        ? `/org/${orgSlug}/${projectSlug}`
        : null;

  const destinationLabel =
    kind === 'grant'
      ? projectName
        ? `Open ${projectName} pipeline`
        : 'Open organisation dashboard'
      : projectName
        ? `Open ${projectName}`
        : 'Open project';

  async function onSave() {
    if (!isLoggedIn) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
      return;
    }

    setIsSaving(true);
    try {
      let endpoint = kind === 'grant' ? `/api/tracker/${itemId}` : `/api/foundations/saved/${itemId}`;
      let method: 'PUT' | 'POST' = 'PUT';
      let body: Record<string, unknown> = { stage: 'discovered' };

      if (kind === 'grant' && orgProfileId) {
        endpoint = `/api/org/${orgProfileId}/pipeline`;
        method = 'POST';
        body = {
          project_id: projectId ?? null,
          name: itemName,
          amount_display: amountDisplay ?? null,
          amount_numeric: amountNumeric ?? null,
          funder: providerName ?? null,
          deadline: deadline ?? null,
          status: 'prospect',
          grant_opportunity_id: itemId,
          funder_type: 'government',
        };
      } else if (kind === 'foundation' && orgProfileId && projectId) {
        endpoint = `/api/org/${orgProfileId}/projects/${projectId}/foundations`;
        method = 'POST';
        body = {
          foundation_id: itemId,
          stage: 'saved',
          engagement_status: 'researching',
        };
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
        return;
      }

      if (response.status === 403) {
        window.location.href = '/pricing';
        return;
      }

      if (!response.ok) return;
      setSaved(true);
    } finally {
      setIsSaving(false);
    }
  }

  if (saved) {
    const savedLabel =
      kind === 'grant' && orgProfileId
        ? projectName
          ? `Added to ${projectName} pipeline`
          : 'Added to organisation pipeline'
        : kind === 'foundation' && orgProfileId && projectId
          ? projectName
            ? `Saved to ${projectName}`
            : 'Saved to project'
          : 'Saved to shortlist';
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="border-2 border-money bg-money-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-money">
          {savedLabel}
        </span>
        {destinationHref ? (
          <Link
            href={destinationHref}
            className="border-2 border-money px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-money transition-colors hover:bg-money hover:text-white"
          >
            {destinationLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  const buttonLabel =
    kind === 'grant' && orgProfileId
      ? 'Add to pipeline'
      : kind === 'foundation' && orgProfileId && projectId
        ? 'Save to project'
        : 'Save shortlist';

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={isSaving}
      className="border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white disabled:cursor-wait disabled:opacity-60"
    >
      {isSaving ? 'Saving...' : buttonLabel}
    </button>
  );
}
