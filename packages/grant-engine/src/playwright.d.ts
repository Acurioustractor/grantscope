// Playwright is dynamically imported at runtime — this shim satisfies TS.
// The actual import is guarded by a try/catch so it's optional.
declare module 'playwright' {
  export const chromium: {
    launch(options?: { headless?: boolean }): Promise<{
      newPage(): Promise<{
        goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
        waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
        waitForTimeout(ms: number): Promise<void>;
        waitForLoadState(state?: string): Promise<void>;
        evaluate(expression: string): Promise<unknown>;
      }>;
      close(): Promise<void>;
    }>;
  };
}
