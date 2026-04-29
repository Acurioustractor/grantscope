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

/**
 * Call MiniMax and parse the response as JSON. Designed for structured
 * extraction tasks where Anthropic tool-use was the original pattern.
 *
 * Strips <think> blocks AND markdown code fences before parsing. If the model
 * wraps content in ```json ... ``` it'll be unwrapped automatically.
 *
 * @param {Object} options
 * @param {string} options.system - System prompt (must instruct "return ONLY valid JSON")
 * @param {string} options.user   - User prompt (the chunk to extract from)
 * @param {string} [options.model='MiniMax-M2.7']
 * @param {number} [options.max_tokens=8000]
 * @param {number} [options.temperature=0.1]
 * @returns {Promise<{ json: any, raw: string, usage: Object }>}
 */
export async function callMiniMaxJSON({ system, user, model = 'MiniMax-M2.7', max_tokens = 8000, temperature = 0.1 }) {
  const { text, usage } = await callMiniMax({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    model,
    max_tokens,
    temperature,
  });
  // Strip code fences if present, then try to find the first valid JSON
  // object/array even when MiniMax accidentally writes prose around it.
  let cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  let json;
  try {
    json = JSON.parse(cleaned);
  } catch {
    // Fallback: locate the first {...} or [...] block by bracket counting
    const candidate = extractFirstJsonBlock(cleaned);
    if (candidate) {
      try { json = JSON.parse(candidate); }
      catch (err2) {
        throw new Error(`MiniMax returned non-JSON (extraction failed): ${err2.message} | preview: ${cleaned.slice(0, 200)}`);
      }
    } else {
      throw new Error(`MiniMax returned non-JSON (no block found): preview: ${cleaned.slice(0, 200)}`);
    }
  }
  return { json, raw: text, usage };
}

function extractFirstJsonBlock(s) {
  // Find first { or [ and walk to matching closer respecting strings.
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') { start = i; break; }
  }
  if (start < 0) return null;
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

