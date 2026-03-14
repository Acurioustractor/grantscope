import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';

describe('Sentry Configuration', () => {
  const webDir = join(__dirname, '../..');

  it('should have sentry.client.config.ts', () => {
    const clientConfig = join(webDir, 'sentry.client.config.ts');
    expect(existsSync(clientConfig)).toBe(true);
  });

  it('should have sentry.server.config.ts', () => {
    const serverConfig = join(webDir, 'sentry.server.config.ts');
    expect(existsSync(serverConfig)).toBe(true);
  });

  it('should have sentry.edge.config.ts', () => {
    const edgeConfig = join(webDir, 'sentry.edge.config.ts');
    expect(existsSync(edgeConfig)).toBe(true);
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
