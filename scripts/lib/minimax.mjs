const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export const MINIMAX_BASE_URL = (process.env.MINIMAX_BASE_URL || DEFAULT_MINIMAX_BASE_URL).replace(/\/$/, '');
export const MINIMAX_CHAT_COMPLETIONS_URL = `${MINIMAX_BASE_URL}/chat/completions`;

/**
 * Strip <think>...</think> blocks from MiniMax M2.7+ reasoning output.
 * M2.7 is a reasoning model that wraps its chain-of-thought in think tags.
 */
export function stripThinkTags(text) {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?<\/think>\n?/g, '').trim();
}

/**
 * Call MiniMax chat completions with automatic think-tag stripping.
 * Returns the cleaned text content (no think tags).
 *
 * @param {Object} options
 * @param {Array} options.messages - Chat messages array
 * @param {string} [options.model='MiniMax-M2.7'] - Model ID
 * @param {number} [options.max_tokens=1024] - Max tokens (set high to account for think tokens)
 * @param {number} [options.temperature=0.3] - Temperature
 * @returns {Promise<{text: string, usage: Object}>}
 */
export async function callMiniMax({ messages, model = 'MiniMax-M2.7', max_tokens = 2048, temperature = 0.3 }) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const res = await fetch(MINIMAX_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens, temperature }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MiniMax ${res.status}: ${body}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  return {
    text: stripThinkTags(raw),
    usage: data.usage || {},
  };
}
