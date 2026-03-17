// Shared service utilities — DRY helpers used across multiple service files

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safe<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) return null;
    return result.data;
  } catch {
    return null;
  }
}
