import type { UIMessage } from 'ai';

/**
 * Extract plain text from a UIMessage's parts array.
 * Used by all chat API routes to get text content from messages.
 */
export function getTextFromMessage(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}
