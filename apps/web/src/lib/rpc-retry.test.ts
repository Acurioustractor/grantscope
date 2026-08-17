import { describe, expect, it } from 'vitest';
import { isTransientDbError, retryRpc } from './rpc-retry';

describe('isTransientDbError', () => {
  it('treats the error the browse pages actually died on as transient', () => {
    // Verbatim from the charities and social-enterprises pages during the pass 2 audit.
    expect(isTransientDbError('canceling statement due to statement timeout')).toBe(true);
  });

  it('treats connection-level failures as transient', () => {
    for (const m of ['ECONNRESET', 'fetch failed', 'socket hang up', 'too many clients already']) {
      expect(isTransientDbError(m)).toBe(true);
    }
  });

  it('does NOT retry errors that will fail identically forever', () => {
    for (const m of [
      'column "nope" does not exist',
      'permission denied for function se_browse',
      'function foo(text) does not exist',
    ]) {
      expect(isTransientDbError(m)).toBe(false);
    }
  });

  it('handles absent messages', () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError('')).toBe(false);
  });
});

describe('retryRpc', () => {
  it('does not call twice when the first attempt succeeds', async () => {
    let calls = 0;
    const res = await retryRpc(async () => {
      calls += 1;
      return { data: ['ok'], error: null };
    });
    expect(calls).toBe(1);
    expect(res.data).toEqual(['ok']);
  });

  it('retries once on a timeout and returns the second result', async () => {
    let calls = 0;
    const res = await retryRpc(
      async () => {
        calls += 1;
        return calls === 1
          ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
          : { data: ['recovered'], error: null };
      },
      { delayMs: 0 },
    );
    expect(calls).toBe(2);
    expect(res.data).toEqual(['recovered']);
  });

  it('gives up after ONE retry rather than hammering a genuinely slow query', async () => {
    let calls = 0;
    const res = await retryRpc(
      async () => {
        calls += 1;
        return { data: null, error: { message: 'canceling statement due to statement timeout' } };
      },
      { delayMs: 0 },
    );
    expect(calls).toBe(2);
    expect(res.error?.message).toMatch(/statement timeout/);
  });

  it('does not retry a permanent error', async () => {
    let calls = 0;
    await retryRpc(
      async () => {
        calls += 1;
        return { data: null, error: { message: 'permission denied for function se_browse' } };
      },
      { delayMs: 0 },
    );
    expect(calls).toBe(1);
  });
});
