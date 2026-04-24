import type { ReactNode } from 'react';

interface BriefingControlPanelProps {
  title: string;
  children: ReactNode;
  note?: string;
  error?: string;
  className?: string;
}

export function BriefingControlPanel({
  title,
  children,
  note,
  error,
  className = '',
}: BriefingControlPanelProps) {
  return (
    <div className={`border-4 border-bauhaus-black p-6 mb-8 ${className}`.trim()}>
      <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">{title}</div>
      {children}
      {note && <p className="text-xs text-bauhaus-muted mt-3">{note}</p>}
      {error && <p className="text-sm text-bauhaus-red mt-3">{error}</p>}
    </div>
  );
}
