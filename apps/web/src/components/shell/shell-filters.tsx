'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { topicLabel, type VocabEntry } from '@/lib/vocab';

/**
 * Topic / year selects for shell pages. Options come exclusively from the DB vocabularies
 * (lib/vocab.ts) — this component never invents a value, and a vocabulary that failed to load
 * simply renders no control.
 *
 * Selection lives in the URL (?topic=…&fy=…) so a filtered view is shareable and the server
 * component re-renders with validated params.
 */
export function ShellFilters({
  topics,
  years,
  activeTopic,
  activeYear,
}: {
  topics: VocabEntry[];
  years: VocabEntry[];
  activeTopic: string;
  activeYear: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: 'topic' | 'fy', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === '') params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const selectStyle = {
    background: 'var(--shell-canvas)',
    color: 'var(--shell-ink)',
  } as const;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {topics.length > 0 && (
        <select
          aria-label="Topic"
          value={activeTopic}
          onChange={(e) => setParam('topic', e.target.value)}
          className="shell-control px-2.5 py-1.5 text-[12.5px] font-semibold"
          style={selectStyle}
        >
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {topicLabel(t.value)}
            </option>
          ))}
        </select>
      )}
      {years.length > 0 && (
        <select
          aria-label="Financial year"
          value={activeYear ?? ''}
          onChange={(e) => setParam('fy', e.target.value)}
          className="shell-control px-2.5 py-1.5 text-[12.5px] font-semibold"
          style={selectStyle}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y.value} value={y.value}>
              {y.value}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
