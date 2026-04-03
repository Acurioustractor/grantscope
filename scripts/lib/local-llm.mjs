/**
 * local-llm.mjs — Shared library for calling local Gemma 4 via llama-server
 *
 * Provides a drop-in provider object for the existing multi-provider
 * round-robin pattern used in CivicGraph enrichment scripts.
 *
 * Prerequisites:
 *   llama-server -m <gemma4.gguf> --jinja -fa -c 131072 -ngl 99
 */

export const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://127.0.0.1:8080/v1/chat/completions';
export const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'gemma4';

const HEALTH_CHECK_TIMEOUT_MS = 2000;

/**
 * Check if the local LLM server is reachable.
 * Returns true if the server responds, false otherwise.
 */
export async function isLocalLLMAvailable() {
  try {
    const healthUrl = LOCAL_LLM_URL.replace('/chat/completions', '/models');
    const res = await fetch(healthUrl, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Call the local LLM server with a chat completions request.
 *
 * @param {object} opts
 * @param {Array}  opts.messages      - OpenAI-format messages array
 * @param {number} [opts.temperature] - Default 0.2
 * @param {number} [opts.max_tokens]  - Default 1500
 * @param {number} [opts.timeout]     - Request timeout in ms, default 120000
 * @returns {Promise<{text: string, tokensPerSec: number}>}
 */
export async function callLocalLLM({
  messages,
  temperature = 0.2,
  max_tokens = 1500,
  timeout = 120_000,
}) {
  const t0 = Date.now();

  let res;
  try {
    res = await fetch(LOCAL_LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_LLM_MODEL,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch failed')) {
      throw new Error(
        'Local LLM not running at ' + LOCAL_LLM_URL +
        '\nStart it with: llama-server -m <gemma4.gguf> --jinja -fa -c 131072 -ngl 99'
      );
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Local LLM returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const elapsedSec = (Date.now() - t0) / 1000;
  const outputTokens = data.usage?.completion_tokens || text.split(/\s+/).length;
  const tokensPerSec = Math.round(outputTokens / elapsedSec);

  return { text, tokensPerSec };
}

/**
 * Provider object — matches the shape used in PROVIDERS arrays across all
 * CivicGraph enrichment scripts. Insert at position 0 to prefer local first.
 */
export const LOCAL_PROVIDER = {
  name: 'local-gemma4',
  baseUrl: LOCAL_LLM_URL,
  model: LOCAL_LLM_MODEL,
  envKey: null,       // no API key required
  disabled: false,
  isLocal: true,
};
