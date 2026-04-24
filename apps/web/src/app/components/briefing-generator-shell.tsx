import type { ReactNode } from 'react';
import Link from 'next/link';
import { BriefingLoopBar, type BriefingLaneKey, type BriefingOutputKey } from './briefing-loop-bar';

type BriefingLoopConfig = {
  message: string;
  output: BriefingOutputKey;
  subject?: string;
  state?: string;
  lanes?: BriefingLaneKey[];
};

interface BriefingGeneratorShellProps {
  hubHref: string;
  title: string;
  description: string;
  badge: string;
  children: ReactNode;
  loop?: BriefingLoopConfig;
}

export function BriefingGeneratorShell({
  hubHref,
  title,
  description,
  badge,
  children,
  loop,
}: BriefingGeneratorShellProps) {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href={hubHref} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Briefing Hub
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">{title}</h1>
          <p className="text-sm text-bauhaus-muted mt-1">{description}</p>
        </div>
        <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
          {badge}
        </div>
      </div>

      {loop && (
        <BriefingLoopBar
          refineHref={hubHref}
          output={loop.output}
          subject={loop.subject}
          state={loop.state}
          lanes={loop.lanes}
          className="mb-6"
          message={loop.message}
        />
      )}

      {children}
    </div>
  );
}
