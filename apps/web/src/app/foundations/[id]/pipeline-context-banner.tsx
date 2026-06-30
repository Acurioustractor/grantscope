'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PipelineContext {
  orgName: string;
  orgSlug: string | null;
  items: Array<{ name: string; status: string; amount_display: string | null; deadline: string | null }>;
}

export function PipelineContextBanner({ foundationId, foundationName }: { foundationId: string; foundationName: string }) {
  const [pipelineContext, setPipelineContext] = useState<PipelineContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/foundations/${foundationId}/pipeline-context`)
      .then((r) => (r.ok ? r.json() : { pipelineContext: null }))
      .then((data: { pipelineContext: PipelineContext | null }) => {
        if (!cancelled) setPipelineContext(data.pipelineContext);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [foundationId]);

  if (!pipelineContext) return null;

  return (
    <div className="mb-6 border-4 border-green-600 bg-green-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-green-800 mb-2">
            Your Pipeline with {foundationName}
          </h3>
          <div className="space-y-1.5">
            {pipelineContext.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className={`text-[10px] px-2 py-0.5 font-bold border rounded-sm uppercase ${
                  item.status === 'awarded' ? 'bg-green-100 text-green-800 border-green-300' :
                  item.status === 'submitted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  item.status === 'drafting' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {item.status}
                </span>
                <span className="font-medium text-gray-800">{item.name}</span>
                {item.amount_display && <span className="font-mono text-green-700 text-xs">{item.amount_display}</span>}
                {item.deadline && <span className="text-gray-400 text-xs">Due {item.deadline}</span>}
              </div>
            ))}
          </div>
        </div>
        {pipelineContext.orgSlug && (
          <Link
            href={`/org/${pipelineContext.orgSlug}`}
            className="text-xs px-3 py-2 bg-green-700 text-white font-bold uppercase tracking-wider hover:bg-green-800 transition-colors rounded-sm shrink-0"
          >
            {pipelineContext.orgName} Dashboard &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
