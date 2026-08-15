import { describe, it, expect } from 'vitest';
import { isLocalDevBypass, localDevAdminUser } from '@/lib/admin-auth-bypass';
import { isAdminEmail } from '@/lib/admin';

/**
 * This test is the reason the bypass is allowed to exist.
 *
 * It exists to fail the build if anyone weakens the guard — including a future version of me
 * "simplifying" two conditions into one. Every deployed shape of this app must be gated, and the
 * only thing standing between a convenience and an open admin surface is this file.
 */
describe('local dev admin bypass', () => {
  it('opens ONLY in local development', () => {
    expect(isLocalDevBypass({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isLocalDevBypass({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('never opens when NODE_ENV is production', () => {
    expect(isLocalDevBypass({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('never opens on Vercel, on ANY Vercel environment', () => {
    // Vercel sets VERCEL=1 on every deployment. This is the check that survives a mis-set
    // NODE_ENV, which is the realistic way the first guard fails.
    for (const env of ['production', 'preview', 'development']) {
      expect(
        isLocalDevBypass({
          NODE_ENV: 'development',
          VERCEL: '1',
          VERCEL_ENV: env,
        } as NodeJS.ProcessEnv),
        `bypass must stay closed on Vercel (VERCEL_ENV=${env})`,
      ).toBe(false);
    }
  });

  it('stays closed when BOTH signals say deployed', () => {
    expect(
      isLocalDevBypass({ NODE_ENV: 'production', VERCEL: '1' } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('the two guards are independent — neither alone can open it', () => {
    // If someone deletes either check, one of these flips to true and this test fails.
    const vercelOnly = isLocalDevBypass({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    const nodeEnvOnly = isLocalDevBypass({ NODE_ENV: 'development', VERCEL: '1' } as NodeJS.ProcessEnv);
    expect(vercelOnly || nodeEnvOnly, 'a single guard is admitting a deployed environment').toBe(false);
  });

  it('the synthetic user is a real admin and is obviously synthetic', () => {
    const user = localDevAdminUser();
    expect(isAdminEmail(user.email), 'bypass user must pass isAdminEmail').toBe(true);
    expect(user.app_metadata.provider).toBe('local-dev-bypass');
    expect(user.id).toMatch(/dev0$/);
  });
});
