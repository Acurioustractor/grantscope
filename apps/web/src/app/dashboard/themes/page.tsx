import type { Metadata } from 'next';
import Link from 'next/link';
import { allThemes, reportsForTheme } from '../../reports/theme/themes';

export const metadata: Metadata = { title: 'Themes — CivicGraph' };

/**
 * Shell-native Themes index (phase-2 ruling 2026-08-17: the rail must not exit the shell).
 * Theme DETAIL still lives on the public atlas (/reports/theme/[slug]) — the card says so.
 */
export default function ThemesPage() {
  const themes = allThemes().map((t) => ({
    slug: t.slug,
    title: t.title,
    description: t.description,
    reportCount: reportsForTheme(t.slug).length,
  }));

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Themes</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        The world&rsquo;s language for what the data holds. Theme pages open on the public atlas.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <Link
            key={t.slug}
            href={`/reports/theme/${t.slug}`}
            className="block bg-white p-4"
            style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
          >
            <div className="font-display text-[15px] font-bold">{t.title}</div>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
              {t.description}
            </p>
            <div className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
              {t.reportCount} report{t.reportCount === 1 ? '' : 's'} · atlas →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
