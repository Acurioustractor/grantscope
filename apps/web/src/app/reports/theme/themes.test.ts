import { describe, expect, it } from 'vitest';
import { allThemes, reportsForTheme, slugify, themeBySlug } from './themes';

describe('slugify', () => {
  it('handles the ampersand titles without leaving a stray dash', () => {
    expect(slugify('Accountability & Power')).toBe('accountability-power');
    expect(slugify('Philanthropy & Corporate')).toBe('philanthropy-corporate');
    expect(slugify('Cross-System')).toBe('cross-system');
  });
});

describe('allThemes', () => {
  it('excludes the curated shortcut sections', () => {
    // Current Map and State Dashboards are lists of pointers, not subjects. A theme page for
    // "Current Map" would be a page about a menu.
    const slugs = allThemes().map((t) => t.slug);
    expect(slugs).not.toContain('current-map');
    expect(slugs).not.toContain('state-dashboards');
  });

  it('covers the subject sections', () => {
    const slugs = allThemes().map((t) => t.slug);
    for (const s of ['youth-justice', 'child-protection', 'accountability-power', 'data-system']) {
      expect(slugs).toContain(s);
    }
  });

  it('never collides with an existing report route', () => {
    // /reports/youth-justice etc. are real pages — the section's own Overview. This is why theme
    // pages live at /reports/theme/[slug] and not /reports/[slug].
    for (const t of allThemes()) {
      expect(t.slug).not.toMatch(/^\//);
    }
  });
});

describe('reportsForTheme', () => {
  it('flattens the nav tree and de-duplicates by href', () => {
    // A section can list the same page twice — an Overview that is also the parent of its own
    // children. Rendering it twice reads as a bug.
    const reports = reportsForTheme('youth-justice');
    const hrefs = reports.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(reports.length).toBeGreaterThan(10);
  });

  it('gives a child with no status its parent status rather than a default', () => {
    // QLD is `current` and its children carry no status of their own. Defaulting them to
    // `reference` would understate them; defaulting to `current` would overstate every other
    // section's children. Inheritance is the only honest option.
    const reports = reportsForTheme('youth-justice');
    const watchhouse = reports.find((r) => r.href === '/reports/youth-justice/qld/watchhouse-data');
    expect(watchhouse?.status).toBe('current');
  });

  it('returns nothing for an unknown slug', () => {
    expect(reportsForTheme('not-a-theme')).toEqual([]);
  });
});

describe('the review-status policy', () => {
  it('makes Accountability & Power count-only', () => {
    // 10 of the 20 review-status reports live here, and its subjects are named individuals and
    // the boards they sit on. A framing-unreviewed claim about a person is a different risk from
    // a framing-unreviewed claim about a budget line.
    expect(themeBySlug('accountability-power')?.reviewPolicy).toBe('count-only');
  });

  it('leaves the sector themes able to link with a warning', () => {
    for (const s of ['youth-justice', 'child-protection', 'disability']) {
      expect(themeBySlug(s)?.reviewPolicy).toBe('link-with-warning');
    }
  });

  it('still holds review-status reports to count — the restriction is real, not theoretical', () => {
    const withheld = reportsForTheme('accountability-power').filter((r) => r.status === 'review');
    expect(withheld.length).toBeGreaterThanOrEqual(10);
  });
});

describe('HOUSE questions', () => {
  it('are the only subject routed to a theme, and they are operator-tier', () => {
    // data-system maps to HOUSE. HOUSE questions describe our own estate, not the world, so the
    // page must withhold them from a public surface rather than publishing our to-do list as
    // findings. The page asserts this via canRender(); this test pins the mapping it depends on.
    expect(themeBySlug('data-system')?.questionSubjects).toContain('HOUSE');
    for (const t of allThemes()) {
      if (t.slug === 'data-system') continue;
      expect(t.questionSubjects).not.toContain('HOUSE');
    }
  });
});

describe('themes with no registered question', () => {
  it('declare it rather than borrowing a subject', () => {
    // Child Protection has 10 reports and no registered question. The page must show no number at
    // all rather than lifting a figure from report prose — 20 reports are flagged as needing
    // figure review and theirs are exactly the ones that must not be quoted.
    expect(themeBySlug('child-protection')?.questionSubjects).toEqual([]);
    expect(reportsForTheme('child-protection').length).toBeGreaterThan(0);
  });
});
