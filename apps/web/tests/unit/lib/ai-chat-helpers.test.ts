import { describe, expect, it } from 'vitest';
import { getTextFromMessage, toTextModelMessages } from '@/lib/ai-chat-helpers';

describe('ai chat helpers', () => {
  it('extracts text from UI message parts', () => {
    expect(
      getTextFromMessage({
        id: '019f5f2c-3c3a-7f83-a343-073675ec9f82',
        role: 'user',
        parts: [
          { type: 'text', text: 'Find youth justice grants' },
          { type: 'step-start' },
        ],
      }),
    ).toBe('Find youth justice grants');
  });

  it('extracts text from legacy content fields', () => {
    expect(getTextFromMessage({ role: 'user', content: 'Legacy message' })).toBe('Legacy message');
    expect(
      getTextFromMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'Legacy part message' }],
      }),
    ).toBe('Legacy part message');
  });

  it('builds plain model messages without forwarding UI ids or metadata', () => {
    const messages = toTextModelMessages([
      {
        id: '019f5f2c-3c3a-7f83-a343-073675ec9f82',
        role: 'user',
        metadata: { createdAt: '2026-07-14T05:56:07.000Z' },
        parts: [{ type: 'text', text: 'Show me grants for Palm Island' }],
      },
      {
        id: 'db-row-123',
        role: 'assistant',
        parts: [{ type: 'text', text: 'I can help with that.' }],
      },
    ]);

    expect(messages).toEqual([
      { role: 'user', content: 'Show me grants for Palm Island' },
      { role: 'assistant', content: 'I can help with that.' },
    ]);
    expect(messages[0]).not.toHaveProperty('id');
    expect(messages[0]).not.toHaveProperty('metadata');
  });
});
