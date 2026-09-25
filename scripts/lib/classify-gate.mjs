/**
 * May this model's confident alma-classify answers be applied without a person?
 *
 * Only when Ben has judged a random sample of 20 of its answers and at least 18 were right, and only
 * for the exact model that was measured (scripts/jev-gates.json). Any other model is review-only: its
 * confidence and reason are saved for the triage page, and the row keeps its status.
 *
 * `gate.model` is the first model measured; `gate.also` lists any others, each with its own
 * result, sample and date (gemini-2.5-flash: 18 of 20, 2026-09-25).
 *
 * Until 2026-09-25 this held for Jev alone. Every other provider (gemini, haiku, gpt-oss, llama)
 * applied its own answer at 0.7 confidence, and 1,131 funding opportunities were marked 'verified'
 * that way with no model ever measured.
 */
export function modelMayApply(gate, model) {
  if (!gate?.on || typeof model !== 'string' || model === '') return false;
  const measured = [gate.model, ...(Array.isArray(gate.also) ? gate.also.map((m) => m?.model) : [])];
  return measured.includes(model);
}
