import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';

describe('Sentry Configuration', () => {
  const webDir = join(__dirname, '../..');

  it('uses the current Next.js server instrumentation convention', () => {
    const instrumentation = join(webDir, 'src/instrumentation.ts');
    expect(existsSync(instrumentation)).toBe(true);
    const content = readFileSync(instrumentation, 'utf-8');
    expect(content).toContain('export async function register()');
    expect(content).toContain('Sentry.captureRequestError');
  });

  it('uses client instrumentation with navigation tracing', () => {
    const instrumentation = join(webDir, 'src/instrumentation-client.ts');
    expect(existsSync(instrumentation)).toBe(true);
    const content = readFileSync(instrumentation, 'utf-8');
    expect(content).toContain('Sentry.init');
    expect(content).toContain('Sentry.captureRouterTransitionStart');
  });

  it('should have global-error.tsx', () => {
    const globalError = join(webDir, 'src/app/global-error.tsx');
    expect(existsSync(globalError)).toBe(true);
  });

  it('should have NEXT_PUBLIC_SENTRY_DSN in .env.example', () => {
    const envExample = join(webDir, '../../.env.example');
    const content = readFileSync(envExample, 'utf-8');
    expect(content).toContain('NEXT_PUBLIC_SENTRY_DSN');
  });
});
