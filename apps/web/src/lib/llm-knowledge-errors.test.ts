import { describe, expect, it, vi } from 'vitest';
import { createLLMKnowledgePlugin } from '../../../../packages/grant-engine/src/sources/llm-knowledge';
import { SourceRegistry } from '../../../../packages/grant-engine/src/sources/registry';

/**
 * A source that fails must say so.
 *
 * llm-knowledge caught each failed lookup, logged it and moved on, so the engine reported
 * "0 grants, no errors" through a missing ANTHROPIC_API_KEY, an empty credit balance (2026-08-07
 * onwards) and a retired model (claude-3-5-haiku since 2026-02-19). Nothing anywhere said the
 * source was dead. Failures are now thrown at the end of the run and land in the source's stats.
 */

const twoSources = [
  { name: 'Source A', url: 'https://a.example', categories: ['community'], keywords: ['k'] },
  { name: 'Source B', url: 'https://b.example', categories: ['community'], keywords: ['k'] },
];

async function runThroughRegistry(create: () => Promise<unknown>) {
  const registry = new SourceRegistry();
  registry.register(
    createLLMKnowledgePlugin({ client: { messages: { create } } as never, sources: twoSources, requestDelayMs: 1 }),
  );
  const finished: Array<{ grantsFound: number; errors: string[] }> = [];
  for await (const ev of registry.discoverAll({}, ['llm-knowledge'])) {
    if (ev.kind === 'source-complete') finished.push(ev.stats);
  }
  return finished;
}

describe('llm-knowledge failure reporting', () => {
  it('records every failed lookup in the registry stats', async () => {
    const create = vi.fn().mockRejectedValue(new Error('credit balance is too low'));
    const finished = await runThroughRegistry(create);

    expect(create).toHaveBeenCalledTimes(2);
    expect(finished).toHaveLength(1);
    expect(finished[0].grantsFound).toBe(0);
    expect(finished[0].errors).toHaveLength(1);
    expect(finished[0].errors[0]).toMatch(/2 of 2 lookups failed/);
    expect(finished[0].errors[0]).toMatch(/credit balance is too low/);
  });

  it('stays quiet when the lookups work and simply find nothing', async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '[]' }] });
    const finished = await runThroughRegistry(create);

    expect(finished[0].grantsFound).toBe(0);
    expect(finished[0].errors).toEqual([]);
  });
});
