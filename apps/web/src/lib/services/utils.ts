// Shared service utilities — DRY helpers used across multiple service files

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safe<T = any>(p: PromiseLike<{ data: T; error: any }>, context?: string): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) {
      console.error(`[report-service] ${context || 'query'} failed:`, result.error.message || result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    console.error(`[report-service] ${context || 'query'} threw:`, err instanceof Error ? err.message : err);
    return null;
  }
}
