type RuntimeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type QueuedRequest = {
  cancelled: boolean;
  run: () => Promise<Response>;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal | null;
  removeAbortListener?: () => void;
};

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_MAX_QUEUED_REQUESTS = 12;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

type RuntimeFetchLimits = {
  maxQueuedRequests?: number;
  requestTimeoutMs?: number;
};

function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function createBudgetError() {
  const error = new Error('Supabase request budget exhausted');
  error.name = 'SupabaseBudgetError';
  return error;
}

function configuredConcurrency() {
  const value = Number.parseInt(process.env.SUPABASE_RUNTIME_MAX_CONCURRENCY ?? '', 10);
  if (!Number.isFinite(value)) return DEFAULT_MAX_CONCURRENCY;
  return Math.min(Math.max(value, 1), 12);
}

export function createConcurrencyLimitedFetch(
  implementation: RuntimeFetch,
  maxConcurrency: number,
  limits: RuntimeFetchLimits = {},
): RuntimeFetch {
  const limit = Math.max(1, Math.floor(maxConcurrency));
  const maxQueuedRequests = Math.max(
    0,
    Math.floor(limits.maxQueuedRequests ?? DEFAULT_MAX_QUEUED_REQUESTS),
  );
  const requestTimeoutMs = Math.max(
    1,
    Math.floor(limits.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
  );
  const queue: QueuedRequest[] = [];
  let active = 0;

  const drain = () => {
    while (active < limit && queue.length > 0) {
      const request = queue.shift();
      if (!request) return;

      if (request.cancelled || request.signal?.aborted) {
        request.removeAbortListener?.();
        if (!request.cancelled) request.reject(createAbortError());
        continue;
      }

      request.removeAbortListener?.();
      active += 1;
      void request
        .run()
        .then(request.resolve, request.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  return (input, init = {}) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init.signal;
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      const request: QueuedRequest = {
        cancelled: false,
        run: async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
          const onAbort = () => controller.abort();
          signal?.addEventListener('abort', onAbort, { once: true });

          try {
            return await implementation(input, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', onAbort);
          }
        },
        resolve,
        reject,
        signal,
      };

      if (signal) {
        const onAbort = () => {
          request.cancelled = true;
          reject(createAbortError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
        request.removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      }

      if (active >= limit && queue.length >= maxQueuedRequests) {
        request.removeAbortListener?.();
        reject(createBudgetError());
        return;
      }

      queue.push(request);
      drain();
    });
}

const globalForRuntimeFetch = globalThis as typeof globalThis & {
  __civicGraphSupabaseFetch?: RuntimeFetch;
};

export const runtimeSupabaseFetch =
  globalForRuntimeFetch.__civicGraphSupabaseFetch ??
  createConcurrencyLimitedFetch((input, init) => fetch(input, init), configuredConcurrency());

globalForRuntimeFetch.__civicGraphSupabaseFetch = runtimeSupabaseFetch;
