/**
 * The shared rule for when an LLM-extracted value is allowed to be written.
 *
 * From the 2026-09-21 abstention audit: every significant extraction bug that
 * day was a model allowed to answer when it should have abstained. Prompts
 * across the repo already ask for a quote from the page. This is the other
 * half — the boundary that refuses the value when the quote is not there.
 */

// A quote has to look like a sentence, not a restatement of the value.
// Short strings ("2026-06-30", "June") are the shape a model produces when it
// is manufacturing evidence for something it already guessed.
export const MIN_QUOTE = 15;

export function quote(value) {
  return typeof value === 'string' && value.trim().length >= MIN_QUOTE
    ? value.trim().slice(0, 500)
    : null;
}

/**
 * A row extracted from a page needs both a quote and the page it came from.
 * Used to refuse LLM-proposed people and grantees before they reach the
 * person graph, where an unevidenced name is indistinguishable from a real one.
 */
export function hasPageEvidence(row) {
  return Boolean(quote(row?.evidence_text) && String(row?.source_url || '').trim());
}
