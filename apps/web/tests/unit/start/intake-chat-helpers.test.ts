import { describe, it, expect } from 'vitest';
import {
  parseIntakeUpdates,
  stripIntakeUpdates,
  formatMarkdown,
} from '@/app/start/_components/intake-chat';
import { getTextFromMessage } from '@/lib/ai-chat-helpers';
import { safe } from '@/lib/services/utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// parseIntakeUpdates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('parseIntakeUpdates', () => {
  it('extracts a single update from text', () => {
    const text = 'Some response <!-- INTAKE_UPDATE {"type":"phase_change","phase":"landscape"} --> more text';
    const updates = parseIntakeUpdates(text);
    expect(updates).toHaveLength(1);
    expect(updates[0].type).toBe('phase_change');
    expect(updates[0].phase).toBe('landscape');
  });

  it('extracts multiple updates', () => {
    const text = '<!-- INTAKE_UPDATE {"type":"phase_change","phase":"evidence"} --> hello <!-- INTAKE_UPDATE {"type":"idea_extracted","idea_summary":"Youth diversion"} -->';
    const updates = parseIntakeUpdates(text);
    expect(updates).toHaveLength(2);
    expect(updates[0].type).toBe('phase_change');
    expect(updates[1].type).toBe('idea_extracted');
    expect(updates[1].idea_summary).toBe('Youth diversion');
  });

  it('returns empty array for text with no updates', () => {
    expect(parseIntakeUpdates('Just regular text')).toEqual([]);
    expect(parseIntakeUpdates('')).toEqual([]);
  });

  it('skips invalid JSON blocks', () => {
    const text = '<!-- INTAKE_UPDATE {not valid json} --> <!-- INTAKE_UPDATE {"type":"phase_change","phase":"plan"} -->';
    const updates = parseIntakeUpdates(text);
    expect(updates).toHaveLength(1);
    expect(updates[0].type).toBe('phase_change');
  });

  it('extracts complex nested objects', () => {
    const text = '<!-- INTAKE_UPDATE {"type":"idea_extracted","geographic_focus":{"state":"QLD","lga":"Palm Island","postcode":"4816"}} -->';
    const updates = parseIntakeUpdates(text);
    expect(updates).toHaveLength(1);
    expect(updates[0].geographic_focus).toEqual({
      state: 'QLD',
      lga: 'Palm Island',
      postcode: '4816',
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// stripIntakeUpdates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('stripIntakeUpdates', () => {
  it('removes update comments and trims', () => {
    const text = 'Hello world <!-- INTAKE_UPDATE {"type":"phase_change"} --> goodbye';
    expect(stripIntakeUpdates(text)).toBe('Hello world  goodbye');
  });

  it('handles text with no updates', () => {
    expect(stripIntakeUpdates('Just text')).toBe('Just text');
  });

  it('handles text that is only updates', () => {
    expect(stripIntakeUpdates('<!-- INTAKE_UPDATE {"type":"phase_change"} -->')).toBe('');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// formatMarkdown
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('formatMarkdown', () => {
  it('converts bold markdown to HTML', () => {
    expect(formatMarkdown('Hello **world**')).toBe('Hello <strong>world</strong>');
  });

  it('converts italic markdown to HTML', () => {
    expect(formatMarkdown('Hello *world*')).toBe('Hello <em>world</em>');
  });

  it('escapes HTML entities before converting markdown', () => {
    expect(formatMarkdown('Use <script> **bold**')).toBe(
      'Use &lt;script&gt; <strong>bold</strong>'
    );
  });

  it('escapes ampersands', () => {
    expect(formatMarkdown('A & B')).toBe('A &amp; B');
  });

  it('handles text with no markdown', () => {
    expect(formatMarkdown('plain text')).toBe('plain text');
  });

  it('handles nested bold and italic', () => {
    expect(formatMarkdown('**bold** and *italic*')).toBe(
      '<strong>bold</strong> and <em>italic</em>'
    );
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getTextFromMessage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getTextFromMessage', () => {
  it('extracts text from parts', () => {
    const msg = {
      id: '1',
      role: 'assistant' as const,
      parts: [
        { type: 'text' as const, text: 'Hello ' },
        { type: 'text' as const, text: 'world' },
      ],
      createdAt: new Date(),
    };
    expect(getTextFromMessage(msg)).toBe('Hello world');
  });

  it('filters out non-text parts', () => {
    // Use type assertion to simulate a message with mixed part types
    const msg = {
      id: '1',
      role: 'assistant' as const,
      parts: [
        { type: 'text' as const, text: 'Hello' },
        { type: 'reasoning' as const, text: 'thinking...' },
      ],
      createdAt: new Date(),
    };
    // reasoning parts should be filtered out — only 'text' type extracted
    expect(getTextFromMessage(msg)).toBe('Hello');
  });

  it('returns empty string for undefined parts', () => {
    const msg = {
      id: '1',
      role: 'assistant' as const,
      parts: undefined as unknown as [],
      createdAt: new Date(),
    };
    expect(getTextFromMessage(msg)).toBe('');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// safe()
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('safe', () => {
  it('returns data on success', async () => {
    const result = await safe(Promise.resolve({ data: [1, 2, 3], error: null }));
    expect(result).toEqual([1, 2, 3]);
  });

  it('returns null on error', async () => {
    const result = await safe(Promise.resolve({ data: null, error: { message: 'fail' } }));
    expect(result).toBeNull();
  });

  it('returns null on thrown exception', async () => {
    const result = await safe(Promise.reject(new Error('boom')));
    expect(result).toBeNull();
  });
});
