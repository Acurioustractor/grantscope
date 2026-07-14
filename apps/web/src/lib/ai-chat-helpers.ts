import type { ModelMessage, UIMessage } from 'ai';

type ChatRole = 'system' | 'user' | 'assistant';
type TextChatMessage = {
  role?: unknown;
  parts?: unknown;
  content?: unknown;
};

function isChatRole(role: unknown): role is ChatRole {
  return role === 'system' || role === 'user' || role === 'assistant';
}

function getTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';

  return parts
    .filter((part): part is { type: 'text'; text: string } => {
      return (
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      );
    })
    .map(part => part.text)
    .join('');
}

function getTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .filter((part): part is { type: 'text'; text: string } => {
      return (
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      );
    })
    .map(part => part.text)
    .join('');
}

/**
 * Extract plain text from a UIMessage's parts array.
 * Used by all chat API routes to get text content from messages.
 */
export function getTextFromMessage(msg: UIMessage | TextChatMessage): string {
  return getTextFromParts(msg.parts) || getTextFromContent('content' in msg ? msg.content : undefined);
}

/**
 * These chat routes only support text. Build provider input from role + text so
 * local UI/database ids are never forwarded as provider message ids.
 */
export function toTextModelMessages(messages: Array<UIMessage | TextChatMessage>): ModelMessage[] {
  return messages
    .map((message): ModelMessage | null => {
      if (!isChatRole(message.role)) return null;

      const content = getTextFromMessage(message);
      if (!content) return null;

      return { role: message.role, content };
    })
    .filter((message): message is ModelMessage => message !== null);
}
