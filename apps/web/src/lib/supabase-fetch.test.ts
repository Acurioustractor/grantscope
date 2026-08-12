import { describe, expect, it, vi } from 'vitest';
import { createConcurrencyLimitedFetch } from './supabase-fetch';

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('Supabase runtime concurrency', () => {
  it('queues requests above the configured process limit', async () => {
    const pending = [deferredResponse(), deferredResponse(), deferredResponse()];
    const implementation = vi
      .fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
      .mockImplementationOnce(() => pending[0].promise)
      .mockImplementationOnce(() => pending[1].promise)
      .mockImplementationOnce(() => pending[2].promise);
    const limitedFetch = createConcurrencyLimitedFetch(implementation, 2);

    const first = limitedFetch('https://example.test/first');
    const second = limitedFetch('https://example.test/second');
    const third = limitedFetch('https://example.test/third');

    expect(implementation).toHaveBeenCalledTimes(2);
    pending[0].resolve(new Response('first'));
    await first;
    await Promise.resolve();
    expect(implementation).toHaveBeenCalledTimes(3);

    pending[1].resolve(new Response('second'));
    pending[2].resolve(new Response('third'));
    await Promise.all([second, third]);
  });

  it('drops a cancelled queued request before it reaches PostgREST', async () => {
    const active = deferredResponse();
    const implementation = vi
      .fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
      .mockImplementationOnce(() => active.promise);
    const limitedFetch = createConcurrencyLimitedFetch(implementation, 1);
    const controller = new AbortController();

    const first = limitedFetch('https://example.test/active');
    const queued = limitedFetch('https://example.test/queued', { signal: controller.signal });
    controller.abort();

    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    expect(implementation).toHaveBeenCalledTimes(1);

    active.resolve(new Response('active'));
    await first;
    await Promise.resolve();
    expect(implementation).toHaveBeenCalledTimes(1);
  });
});
