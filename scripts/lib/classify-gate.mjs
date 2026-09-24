/**
 * May this model's confident alma-classify answers be applied without a person?
 *
 * Only when Ben has judged a random sample of 20 of its answers and at least 18 were right, and only
 * for the exact model that was measured (scripts/jev-gates.json). Any other model is review-only: its
 * confidence and reason are saved for the triage page, and the row keeps its status.
 *
 * Until 2026-09-25 this held for Jev alone. Every other provider (gemini, haiku, gpt-oss, llama)
 * applied its own answer at 0.7 confidence, and 1,131 funding opportunities were marked 'verified'
 * that way with no model ever measured.
 */
export function modelMayApply(gate, model) {
  return Boolean(gate?.on) && typeof model === 'string' && model !== '' && model === gate.model;
}
