import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { modelMayApply } from '../../../../scripts/lib/classify-gate.mjs';

/**
 * alma-classify applies a model's answer (e.g. marks a funding opportunity 'verified') only when Ben
 * has measured that exact model: 20 answers judged, at least 18 right, recorded in jev-gates.json.
 * Until 2026-09-25 this gate covered Jev alone, and gemini, haiku, gpt-oss and llama marked 1,131
 * opportunities 'verified' on their own confidence.
 */
const REPO = join(import.meta.dirname, '../../../..');
const gates = JSON.parse(readFileSync(join(REPO, 'scripts/jev-gates.json'), 'utf8'));
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('alma-classify model gate', () => {
  const gate = { on: true, model: 'jev-1.13.0' };

  it('applies only the measured model', () => {
    expect(modelMayApply(gate, 'jev-1.13.0')).toBe(true);
    for (const other of ['jev-1.14.0', 'gemini-2.5-flash', 'claude-haiku-4-5-20251001', 'gpt-oss:20b', '', undefined]) {
      expect(modelMayApply(gate, other)).toBe(false);
    }
  });

  it('applies a second model once it is listed as measured', () => {
    const both = { ...gate, also: [{ model: 'gemini-2.5-flash', measured: '18 of 20', by: 'Ben' }] };
    expect(modelMayApply(both, 'gemini-2.5-flash')).toBe(true);
    expect(modelMayApply(both, 'jev-1.13.0')).toBe(true);
    expect(modelMayApply(both, 'claude-haiku-4-5-20251001')).toBe(false);
  });

  it('every model the live gate lets through was measured by Ben on a sample', () => {
    const g = gates['alma-classify'];
    for (const m of [g, ...(g.also ?? [])]) {
      expect(m).toMatchObject({ model: expect.any(String), measured: expect.stringMatching(/of 20/), by: 'Ben' });
    }
  });

  it('applies nothing while the gate is off or missing', () => {
    expect(modelMayApply({ ...gate, on: false }, 'jev-1.13.0')).toBe(false);
    expect(modelMayApply(undefined, 'jev-1.13.0')).toBe(false);
  });

  it('the live gate names a model and who measured it', () => {
    expect(gates['alma-classify']).toMatchObject({ model: expect.any(String), by: 'Ben' });
  });

  it('the classifier gates every provider, not only Jev', () => {
    const src = code(readFileSync(join(REPO, 'scripts/auto-classify-llm.mjs'), 'utf8'));
    // Gated per answer by the model that gave it (a routed second opinion carries its own model).
    expect(src).toMatch(/const answeredBy = decision\.model \?\? MODEL;/);
    expect(src).toMatch(/const gated = !modelMayApply\(JEV_GATE, answeredBy\);/);
    expect(src).not.toMatch(/activeProvider === ['"]jev['"]\s*&&/);
  });
});
