/**
 * CKAN API client — shared across the government open-data source plugins
 * (data.qld, data.gov.au, data.nsw, data.vic all run CKAN).
 *
 * Why this exists: the per-plugin fetch code fetched a single `limit=500` page
 * with no offset loop, so any resource with more than 500 rows was silently
 * truncated. This client paginates through the whole resource and logs when a
 * safety cap is hit, so we never silently drop records.
 *
 * Zero dependencies — uses global fetch + AbortController.
 */

const DEFAULT_USER_AGENT = 'GrantScope/1.0 (research; contact@act.place)';
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 2;

export interface CkanFetchOptions {
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export interface CkanDatastoreOptions extends CkanFetchOptions {
  /** Rows per page (CKAN caps most portals at 1000). */
  pageSize?: number;
  /** Hard safety cap across all pages. When hit, we log a truncation warning. */
  maxRecords?: number;
  /** Full-text filter passed as CKAN `q`. */
  q?: string;
  /** Field filters passed as CKAN `filters` (JSON-encoded). */
  filters?: Record<string, unknown>;
}

interface DatastoreResult<T> {
  success: boolean;
  result?: { total: number; records: T[]; _links?: { start?: string; next?: string } };
  error?: unknown;
}

interface PackageSearchResult {
  success: boolean;
  result?: { count: number; results: CkanPackage[] };
}

export interface CkanPackage {
  id: string;
  name: string;
  title?: string;
  notes?: string;
  resources?: Array<{ id: string; url: string; format: string; name: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a JSON URL with timeout + bounded retry. Throws after the last retry.
 */
export async function ckanFetchJson<T>(url: string, options: CkanFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, userAgent = DEFAULT_USER_AGENT } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`ckanFetchJson failed for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/**
 * Paginate an entire CKAN datastore resource, yielding every record.
 * Stops when the resource is exhausted or `maxRecords` is reached (logged).
 */
export async function* ckanDatastoreSearch<T = Record<string, unknown>>(
  base: string,
  resourceId: string,
  options: CkanDatastoreOptions = {},
): AsyncGenerator<T> {
  const { pageSize = DEFAULT_PAGE_SIZE, maxRecords = Infinity, q, filters } = options;
  let offset = 0;
  let fetched = 0;
  let total = Infinity;

  while (fetched < total && fetched < maxRecords) {
    const limit = Math.min(pageSize, maxRecords - fetched);
    const params = new URLSearchParams({
      resource_id: resourceId,
      limit: String(limit),
      offset: String(offset),
    });
    if (q) params.set('q', q);
    if (filters) params.set('filters', JSON.stringify(filters));

    const data = await ckanFetchJson<DatastoreResult<T>>(`${base}/datastore_search?${params}`, options);
    if (!data.success || !data.result) break;

    const records = data.result.records || [];
    total = typeof data.result.total === 'number' ? data.result.total : records.length;

    for (const record of records) yield record;

    fetched += records.length;
    offset += records.length;

    // Last page: fewer rows than asked, or an empty page — stop.
    if (records.length === 0 || records.length < limit) break;
  }

  if (fetched < total && fetched >= maxRecords) {
    console.warn(`[ckan] resource ${resourceId}: stopped at maxRecords=${maxRecords} of ${total} total — ${total - fetched} records NOT ingested`);
  }
}

/** Convenience: collect an entire datastore resource into an array. */
export async function ckanDatastoreAll<T = Record<string, unknown>>(
  base: string,
  resourceId: string,
  options: CkanDatastoreOptions = {},
): Promise<T[]> {
  const out: T[] = [];
  for await (const record of ckanDatastoreSearch<T>(base, resourceId, options)) out.push(record);
  return out;
}

/** Search a CKAN portal's packages (datasets). */
export async function ckanPackageSearch(
  base: string,
  query: string,
  options: CkanFetchOptions & { rows?: number; start?: number } = {},
): Promise<CkanPackage[]> {
  const { rows = 50, start = 0 } = options;
  const params = new URLSearchParams({ q: query, rows: String(rows), start: String(start) });
  const data = await ckanFetchJson<PackageSearchResult>(`${base}/package_search?${params}`, options);
  return data.success && data.result ? data.result.results : [];
}

/** Fetch a single CKAN package (dataset) by id or name, including its resources. */
export async function ckanPackageShow(base: string, id: string, options: CkanFetchOptions = {}): Promise<CkanPackage | null> {
  const data = await ckanFetchJson<{ success: boolean; result?: CkanPackage }>(
    `${base}/package_show?id=${encodeURIComponent(id)}`,
    options,
  );
  return data.success && data.result ? data.result : null;
}
