type OptionalQueryResult<T> = {
  data: T | null;
  error?: { message?: string } | null;
};

export async function safeOptionalData<T>(
  query: PromiseLike<OptionalQueryResult<T>>,
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await query;
    if (error || data == null) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

type OptionalCountQueryResult = {
  count: number | null;
  error?: { message?: string } | null;
};

export async function safeOptionalCount(
  query: PromiseLike<OptionalCountQueryResult>,
  fallback = 0,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error || count == null) return fallback;
    return count;
  } catch {
    return fallback;
  }
}
