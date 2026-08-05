import type { ReactNode } from 'react';

export function ActWorkspacePageHeader({
  eyebrow,
  title,
  description,
  controls,
  meta,
  testId,
  sticky = true,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  controls?: ReactNode;
  meta?: ReactNode;
  testId?: string;
  sticky?: boolean;
}) {
  const hasControls = Boolean(controls);

  return (
    <header
      className={`${sticky ? 'sticky top-12 z-20 lg:top-0' : ''} border-b border-[var(--ws-border)] bg-[var(--ws-surface-0)]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8`}
      data-testid={testId}
    >
      <div className={hasControls ? 'grid min-w-0 gap-3 lg:grid-cols-[minmax(200px,300px)_minmax(300px,1fr)_auto] lg:items-center' : 'flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'}>
        <div className="min-w-0">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)] sm:text-[10px]">{eyebrow}</div>
          <h1 className="mt-1 break-words font-ql-display text-2xl font-semibold tracking-normal text-[var(--ws-text)] sm:truncate sm:text-2xl">{title}</h1>
          {description ? <p className="mt-0.5 truncate text-xs text-[var(--ws-text-secondary)]">{description}</p> : null}
        </div>
        {controls ? <div className="min-w-0">{controls}</div> : null}
        {meta ? <div className="min-w-0 sm:shrink-0">{meta}</div> : null}
      </div>
    </header>
  );
}
