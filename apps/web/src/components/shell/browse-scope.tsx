import type { ReactNode } from 'react';

/**
 * Public browse pages (grants, foundations, charities, social enterprises, councils, search) inside
 * the site's one public frame: the top nav and footer come from the root layout.
 *
 * Until 2026-09-24 these pages dropped the top nav and wrapped themselves in <Shell>, the black rail
 * and app header, so the nav's "Funding" link took a visitor into what looked like a different
 * product. OpenSecrets, USAspending, LittleSis and ProPublica all keep one site header for visitors
 * (research on the design-alignment page); the rail stays for signed-in pages (dashboard, clarity,
 * ops). The `.shell` class stays here only as a style scope, because the browse tables and filters
 * read its CSS variables. Restyling their content onto the public parts is a later step.
 */
export function BrowseScope({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-7">{children}</div>
    </div>
  );
}
