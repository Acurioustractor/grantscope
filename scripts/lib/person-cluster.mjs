/**
 * person-cluster — shared person-disambiguation clustering core.
 *
 * READ-ONLY data access. Used by both the verification gate
 * (scripts/person-disambig-probe.mjs) and the migration builder
 * (scripts/build-person-identities.mjs) so the contract can't drift.
 *
 * Approach (validated 2026-06-19): per-name co-director graph + union-find.
 * Temporal signal (appointment/cessation dates) is ~0% populated → unused.
 */

// ---- tunable thresholds (the disambiguation contract) ----
export const THRESHOLDS = {
  HIGH_DEGREE: 10,  // co-director on >= this many of the target's boards = "block officer" → glues them all
  MIN_SHARED: 2,    // mid-degree co-directors: a board-pair needs >= this many shared co-directors to merge
  NOMINEE_MIN: 20,  // a component >= this size with a dominant officer + postcode = trustee/nominee block
  DOMINANCE: 0.5,   // officer/postcode must cover >= this fraction of the component to flag nominee
};

export const esc = (s) => s.replace(/'/g, "''");

export class UF {
  constructor() { this.p = new Map(); }
  add(x) { if (!this.p.has(x)) this.p.set(x, x); }
  find(x) {
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

// exec_sql returns via PostgREST which caps at 1000 rows — page with an inner LIMIT/OFFSET.
export function makeQuery(supabase) {
  async function q(sql) {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) throw new Error(error.message + '\n--SQL--\n' + sql);
    return data || [];
  }
  async function qPaged(buildSql) {
    const page = 1000; let offset = 0; const all = [];
    for (;;) {
      const rows = await q(buildSql(page, offset));
      all.push(...rows);
      if (rows.length < page) break;
      offset += page;
    }
    return all;
  }
  return { q, qPaged };
}

/**
 * Fetch every signal needed to cluster one name. Returns role rows (with
 * person_roles.id so callers can key identities by role), co-director pairs,
 * and per-entity money. All paginated (1000-row cap workaround).
 */
export async function fetchName(qPaged, name) {
  const n = esc(name);
  const roles = await qPaged((lim, off) => `
    SELECT pr.id AS role_id, pr.entity_id, pr.company_abn, pr.role_type,
           e.canonical_name, e.entity_type, e.state, e.postcode
    FROM person_roles pr
    JOIN gs_entities e ON e.id = pr.entity_id
    WHERE pr.person_name_normalised = '${n}'
    ORDER BY pr.id LIMIT ${lim} OFFSET ${off}`);
  const codir = await qPaged((lim, off) => `
    SELECT pr.entity_id, pr.person_name_normalised AS codir
    FROM person_roles pr
    WHERE pr.entity_id IN (SELECT entity_id FROM person_roles WHERE person_name_normalised = '${n}')
      AND pr.person_name_normalised <> '${n}'
    ORDER BY pr.entity_id, codir LIMIT ${lim} OFFSET ${off}`);
  const money = await qPaged((lim, off) => `
    SELECT entity_id,
           MAX(justice_dollars) AS justice, MAX(procurement_dollars) AS procurement, MAX(donation_dollars) AS donation
    FROM mv_person_entity_network WHERE person_name_normalised = '${n}' GROUP BY entity_id
    ORDER BY entity_id LIMIT ${lim} OFFSET ${off}`);
  return { roles, codir, money };
}

/**
 * Cluster one name's roles into candidate distinct identities.
 * Returns { name, total, comps[], blockOfficers[], geo, mny } where each comp has
 * { size, justice, procurement, donation, ents[], roleIds[], officers[], topPc, topState, isNominee, confidence }.
 */
export function cluster(name, { roles, codir, money }, t = THRESHOLDS) {
  const geo = new Map();           // entity -> role row (name/abn/type/state/postcode)
  const roleIdsByEntity = new Map(); // entity -> [role_id...] (a name+entity can have multiple role rows)
  for (const r of roles) {
    if (!geo.has(r.entity_id)) geo.set(r.entity_id, r);
    if (!roleIdsByEntity.has(r.entity_id)) roleIdsByEntity.set(r.entity_id, []);
    roleIdsByEntity.get(r.entity_id).push(r.role_id);
  }
  const mny = new Map();
  for (const m of money) mny.set(m.entity_id, m);

  const byCodir = new Map();       // codir name -> Set(entity)
  for (const { entity_id, codir: c } of codir) {
    if (!byCodir.has(c)) byCodir.set(c, new Set());
    byCodir.get(c).add(entity_id);
  }

  const uf = new UF();
  for (const e of geo.keys()) uf.add(e);

  // 1) block officers (high degree) glue all their boards together
  const blockOfficers = [];
  for (const [c, set] of byCodir) {
    if (set.size >= t.HIGH_DEGREE) {
      blockOfficers.push({ name: c, degree: set.size });
      const arr = [...set];
      for (let i = 1; i < arr.length; i++) uf.union(arr[0], arr[i]);
    }
  }
  // 2) mid-degree co-directors: board-pairs merge only with >= MIN_SHARED corroborating co-directors
  const pairCount = new Map();
  for (const [, set] of byCodir) {
    if (set.size >= t.HIGH_DEGREE || set.size < 2) continue;
    const arr = [...set];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const k = arr[i] < arr[j] ? arr[i] + '|' + arr[j] : arr[j] + '|' + arr[i];
        pairCount.set(k, (pairCount.get(k) || 0) + 1);
      }
  }
  for (const [k, c] of pairCount) if (c >= t.MIN_SHARED) { const [a, b] = k.split('|'); uf.union(a, b); }

  // assemble components
  const comps = new Map();
  for (const e of geo.keys()) {
    const root = uf.find(e);
    if (!comps.has(root)) comps.set(root, []);
    comps.get(root).push(e);
  }

  const out = [];
  for (const [, ents] of comps) {
    const size = ents.length;
    let justice = 0, procurement = 0, donation = 0;
    const pcCount = new Map(), stateCount = new Map();
    const roleIds = [];
    for (const e of ents) {
      const m = mny.get(e); if (m) { justice += +m.justice || 0; procurement += +m.procurement || 0; donation += +m.donation || 0; }
      const g = geo.get(e);
      if (g?.postcode) pcCount.set(g.postcode, (pcCount.get(g.postcode) || 0) + 1);
      if (g?.state) stateCount.set(g.state, (stateCount.get(g.state) || 0) + 1);
      roleIds.push(...(roleIdsByEntity.get(e) || []));
    }
    const entSet = new Set(ents);
    const officers = [];
    for (const [c, set] of byCodir) {
      let hits = 0; for (const e of set) if (entSet.has(e)) hits++;
      if (hits >= 2) officers.push({ name: c, hits });
    }
    officers.sort((a, b) => b.hits - a.hits);
    const topPc = [...pcCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const topState = [...stateCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const topOfficer = officers[0];
    // Geographic corroboration at STATE level: trustee/nominee firms reliably
    // concentrate in one state, but their addresses fragment across postcodes
    // (GPO box vs street) so postcode-level dominance under-flags real blocks.
    const isNominee = size >= t.NOMINEE_MIN
      && topOfficer && topOfficer.hits / size >= t.DOMINANCE
      && topState && topState[1] / size >= t.DOMINANCE;
    const confidence = isNominee ? 'high' : size > 1 ? 'medium' : 'low';
    out.push({ size, justice, procurement, donation, ents, roleIds, officers, topPc, topState, isNominee, confidence });
  }
  out.sort((a, b) => b.size - a.size);
  return { name, total: roles.length, comps: out, blockOfficers, geo, mny };
}

/**
 * Stable identity key for a component: name + short hash of its sorted member ABNs.
 * Stable across rebuilds unless the cluster's membership changes. djb2 (no deps).
 */
export function identityKey(name, comp, geo) {
  const abns = comp.ents.map(e => geo.get(e)?.company_abn || e).sort();
  let h = 5381;
  const s = abns.join(',');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${name}#${(h >>> 0).toString(36)}`;
}
