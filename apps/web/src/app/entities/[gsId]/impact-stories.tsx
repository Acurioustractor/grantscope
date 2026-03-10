'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EvidenceRecord {
  id: string;
  title: string;
  excerpt: string;
  story_type: string;
  image_url: string | null;
  themes: string[];
  views: number;
  published_at: string;
  storyteller: {
    display_name: string;
    cultural_background?: string;
  };
  url: string;
}

interface EvidenceResponse {
  stories: EvidenceRecord[];
  organization: {
    name: string;
    slug: string;
    logo_url: string | null;
    url: string;
  } | null;
  count: number;
  attribution: {
    platform: string;
    message: string;
    url: string;
  };
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function CommunityEvidence({ gsId, isPremium }: { gsId: string; isPremium: boolean }) {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/entities/${gsId}/stories`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gsId]);

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
          Community Evidence
        </h2>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-bauhaus-canvas" />
          <div className="h-16 bg-bauhaus-canvas" />
        </div>
      </section>
    );
  }

  if (!data || data.count === 0) return null;

  // Premium: full evidence records. Free: summary count + unlock prompt.
  if (!isPremium) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
          Community Evidence ({data.count})
        </h2>
        <div className="bg-bauhaus-canvas p-4">
          <p className="text-sm font-bold text-bauhaus-black mb-1">
            {data.count} governed evidence record{data.count !== 1 ? 's' : ''} available
          </p>
          <p className="text-xs text-bauhaus-muted font-medium mb-3">
            Community-verified outcomes linked to this entity, with consent-governed provenance.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-4 py-2 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
          >
            Unlock Full Dossier
          </Link>
        </div>
        <p className="text-[10px] text-bauhaus-muted leading-relaxed mt-2">
          Evidence governed under Indigenous data sovereignty principles. Access and reuse subject to community consent.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
        Community Evidence ({data.count})
      </h2>

      <div className="space-y-0">
        {data.stories.slice(0, 5).map((record) => (
          <a
            key={record.id}
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-4 border-b-2 border-bauhaus-black/5 last:border-b-0 hover:bg-bauhaus-canvas/50 transition-colors -mx-2 px-2"
          >
            <div className="flex gap-4">
              {record.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={record.image_url}
                  alt=""
                  className="w-20 h-20 object-cover border-2 border-bauhaus-black/10 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-bauhaus-black hover:text-bauhaus-blue line-clamp-2">
                  {record.title}
                </div>
                {record.excerpt && (
                  <p className="text-xs text-bauhaus-muted font-medium mt-1 line-clamp-2">
                    {record.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-black px-1.5 py-0.5 border border-money/30 bg-money-light text-money uppercase tracking-widest">
                    Consent-governed
                  </span>
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                    {record.storyteller.display_name}
                  </span>
                  <span className="text-[10px] text-bauhaus-muted">&middot;</span>
                  <span className="text-[10px] text-bauhaus-muted font-medium">
                    {timeAgo(record.published_at)}
                  </span>
                  {record.themes.slice(0, 2).map((theme) => (
                    <span
                      key={theme}
                      className="text-[9px] font-bold px-1.5 py-0.5 border border-bauhaus-black/10 bg-bauhaus-canvas text-bauhaus-muted uppercase tracking-wider"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {data.count > 5 && data.organization?.url && (
        <div className="mt-3 text-center">
          <a
            href={data.organization.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:underline"
          >
            + {data.count - 5} more evidence records
          </a>
        </div>
      )}

      {/* Governance footer */}
      <div className="mt-4 bg-bauhaus-canvas p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
            Governed evidence via Empathy Ledger
          </span>
          <span className="text-[10px] font-black px-1.5 py-0.5 border border-money/30 bg-money-light text-money uppercase tracking-widest">
            Provenance verified
          </span>
        </div>
        <p className="text-[10px] text-bauhaus-muted leading-relaxed">
          Community-governed evidence with ongoing consent. Storytellers retain ownership and can revoke access at any time.
          Evidence does not imply causal attribution — it reflects governed testimony linked to funding activity.
        </p>
      </div>
    </section>
  );
}
