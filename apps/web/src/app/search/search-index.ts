import { getDirectServiceSupabase } from '@/lib/supabase';
import { reportSections, type ReportStatus } from '../reports/_components/sidebar-nav-data';
import { allThemes } from '../reports/theme/themes';

/**
 * The small-kind search index — reports, questions, themes, objects.
 *
 * These four kinds total ~1,575 items, smaller than the catalogue the /clarity ledger already
 * inlines, so the whole set ships to the client and filters in memory: instant, offline, and
 * "nothing matches" is answerable without a round trip. Entities, people, places and grants stay
 * live queries through /api/global-search — they already work at that size.
 *
 * See `thoughts/shared/plans/clarity-console-part-2.md`, slice D.
 */

export interface IndexedReport {
  kind: 'report';
  label: string;
  href: string;
  section: string;
  status: ReportStatus | null;
}

export interface IndexedQuestion {
  kind: 'question';
  slug: string;
  question: string;
  subject: string | null;
  headline: string | null;
  href: string;
}

export interface IndexedTheme {
  kind: 'theme';
  slug: string;
  title: string;
  description: string | null;
  href: string;
}

export interface IndexedObject {
  kind: 'object';
  key: string;
  name: string;
  objectKind: string;
  domain: string | null;
  href: string;
}

export interface SmallIndex {
  reports: IndexedReport[];
  questions: IndexedQuestion[];
  themes: IndexedTheme[];
  objects: IndexedObject[];
}

function flattenReports(): IndexedReport[] {
  const out: IndexedReport[] = [];
  const seen = new Set<string>();
  for (const section of reportSections) {
    const walk = (items: typeof section.items) => {
      for (const item of items) {
        if (!seen.has(item.href)) {
          seen.add(item.href);
          out.push({
            kind: 'report',
            label: item.label,
            href: item.href,
            section: section.title,
            status: item.status ?? null,
          });
        }
        if (item.children) walk(item.children);
      }
    };
    walk(section.items);
  }
  return out;
}

export async function buildSmallIndex(): Promise<SmallIndex> {
  const supabase = getDirectServiceSupabase();

  const [questionRes, objectRes] = await Promise.all([
    // Defamation-sensitive questions are withheld from the public index: the question TEXT
    // itself names individuals. Withheld beats promoted.
    supabase
      .from('v_clarity_board_cards')
      .select('slug, question, subject, headline, defamation_sensitive')
      .order('slug'),
    supabase
      .from('clarity_object')
      .select('object_key, object_name, object_kind, domain')
      .order('object_key'),
  ]);

  const questions: IndexedQuestion[] = (questionRes.data ?? [])
    .filter((q) => q.defamation_sensitive !== true)
    .map((q) => ({
      kind: 'question' as const,
      slug: q.slug,
      question: q.question,
      subject: q.subject,
      headline: q.headline,
      href: `/clarity/q/${q.slug}`,
    }));

  const objects: IndexedObject[] = (objectRes.data ?? []).map((o) => ({
    kind: 'object' as const,
    key: o.object_key,
    name: o.object_name,
    objectKind: o.object_kind,
    domain: o.domain,
    href: `/clarity/o/${encodeURIComponent(o.object_key)}`,
  }));

  const themes: IndexedTheme[] = allThemes().map((t) => ({
    kind: 'theme' as const,
    slug: t.slug,
    title: t.title,
    description: t.description,
    href: `/reports/theme/${t.slug}`,
  }));

  return { reports: flattenReports(), questions, themes, objects };
}
