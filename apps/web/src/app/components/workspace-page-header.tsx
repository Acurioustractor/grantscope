/**
 * Workspace page header — consistent title + description + optional actions
 * for all logged-in workspace pages.
 */

interface WorkspacePageHeaderProps {
  title: string;
  description?: string;
  /** Small label above the title (e.g. module name) */
  eyebrow?: string;
  /** Right-side actions */
  actions?: React.ReactNode;
  /** Compact mode — smaller spacing for dense pages */
  compact?: boolean;
}

export function WorkspacePageHeader({
  title,
  description,
  eyebrow,
  actions,
  compact = false,
}: WorkspacePageHeaderProps) {
  return (
    <header className={compact ? 'mb-4' : 'mb-6'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ws-text-tertiary)' }}>
              {eyebrow}
            </p>
          )}
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--ws-text)' }}
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--ws-text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
