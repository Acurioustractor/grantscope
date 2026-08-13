// Shared service utilities — DRY helpers used across multiple service files

const loggedSafeErrors = new Set<string>();

function shouldSuppressDuplicateSafeError(key: string) {
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build';
  if (!isBuild) return false;
  if (loggedSafeErrors.has(key)) return true;
  loggedSafeErrors.add(key);
  return false;
}

function logSafeError(context: string | undefined, kind: 'failed' | 'threw', message: unknown) {
  const label = context || 'query';
  const text = message instanceof Error ? message.message : String(message);
  const key = `${label}:${kind}:${text}`;
  if (shouldSuppressDuplicateSafeError(key)) return;
  console.error(`[report-service] ${label} ${kind}:`, text);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safe<T = any>(p: PromiseLike<{ data: T; error: any }>, context?: string): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) {
      logSafeError(context, 'failed', result.error.message || result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    logSafeError(context, 'threw', err);
    return null;
  }
}
