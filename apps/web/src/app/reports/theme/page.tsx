import Link from 'next/link';
import { allThemes, reportsForTheme } from './themes';

export const metadata = {
  title: 'Themes — CivicGraph',
  description: 'The report sections as navigable themes — money, questions and reports per subject.',
};

/** The themes index: one row per section, honest about how much each one holds. */
export default function ThemesIndexPage() {
  const themes = allThemes();
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-black uppercase tracking-widest text-bauhaus-black mb-1">Themes</h1>
      <p className="text-sm font-medium text-bauhaus-muted mb-8">
        Every subject the reports file under. Each theme page shows its money, its questions and
        its reports together.
      </p>
      <div className="flex flex-col divide-y divide-bauhaus-black/10 border-y border-bauhaus-black/10">
        {themes.map((t) => {
          const reportCount = reportsForTheme(t.slug).length;
          return (
            <Link key={t.slug} href={`/reports/theme/${t.slug}`} className="py-4 group">
              <div className="font-bold text-bauhaus-black group-hover:text-bauhaus-blue">
                {t.title}
              </div>
              <div className="text-[12.5px] text-bauhaus-muted">
                {t.description ?? ''}
                {t.description ? ' · ' : ''}
                {reportCount} report{reportCount === 1 ? '' : 's'}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
