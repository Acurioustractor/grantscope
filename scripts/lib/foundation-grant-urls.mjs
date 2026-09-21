/**
 * Choosing the URL a foundation programme shows on the desk.
 *
 * The problem (2026-09-21): every foundation-programme grant carried a
 * fabricated anchor — 1,744 of 1,746 rows were `${base}#${slug(name)}`, an
 * anchor we invented that almost never matches an element on the page. A
 * browser ignores it, so nothing broke, but the URL reads as a deep link to a
 * specific programme when it is often just the foundation's front page.
 *
 * The anchor is not decoration, though. `grant_opportunities_url_idx` is UNIQUE
 * on url, and foundations routinely expose several programmes from one page, so
 * without something per-programme only one of them would land.
 *
 * So the rule is: a real URL is used as it is, and the anchor is added only
 * where it is doing the work of keeping two rows apart. 84% of programmes have
 * their own distinct URL and no longer need one.
 */

export function programSlug(name) {
  return String(name || 'program')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'program';
}

export function stripFragment(url) {
  return typeof url === 'string' && url ? url.split('#')[0] : null;
}

/**
 * @param {Array<{id: string|number, name: string, baseUrl: string|null}>} programs
 *        every programme in this sync, with its fragment-free candidate URL
 * @param {Map<string, string|null>} [urlOwner]
 *        base URL -> the source_id of the existing row holding it, so a URL
 *        already owned by a DIFFERENT row does not collide on the unique index
 * @returns {Map<string|number, {url: string|null, synthetic: boolean}>}
 */
export function assignProgramUrls(programs, urlOwner = new Map()) {
  const wanting = new Map();
  for (const p of programs) {
    const base = stripFragment(p.baseUrl);
    if (!base) continue;
    (wanting.get(base) || wanting.set(base, []).get(base)).push(p);
  }

  const out = new Map();
  for (const p of programs) {
    const base = stripFragment(p.baseUrl);
    if (!base) {
      out.set(p.id, { url: null, synthetic: false });
      continue;
    }
    const contenders = wanting.get(base) || [];
    const owner = urlOwner.get(base);
    // Taken by a different row, or wanted by more than one programme in this
    // batch: the bare URL cannot identify this programme, so disambiguate.
    const contested = contenders.length > 1
      || (owner !== undefined && owner !== null && String(owner) !== String(p.id));
    out.set(p.id, contested
      ? { url: `${base}#${programSlug(p.name)}`, synthetic: true }
      : { url: base, synthetic: false });
  }
  // Two programmes with the SAME name on the SAME page would resolve to the
  // same `base#slug` and collide on the unique index. Rare, but a failed sync
  // is a worse way to find out. Suffix the later ones.
  const seen = new Map();
  for (const [id, value] of out) {
    if (!value.url) continue;
    const n = (seen.get(value.url) || 0) + 1;
    seen.set(value.url, n);
    if (n > 1) out.set(id, { url: `${value.url}-${n}`, synthetic: true });
  }

  return out;
}
