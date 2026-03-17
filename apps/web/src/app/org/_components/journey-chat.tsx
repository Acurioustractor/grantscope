'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useState, useEffect, useRef, useMemo } from 'react';
import type { JourneyFull } from '@/lib/services/journey-service';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types for structured extraction
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PersonaCreated {
  type: 'persona_created';
  persona: {
    label: string;
    description?: string;
    cohort?: string;
    context?: string;
  };
}

interface StepAdded {
  type: 'step_added';
  personaLabel: string;
  step: {
    path: 'current' | 'alternative';
    step_number: number;
    title: string;
    description?: string;
    system?: string;
    emotion?: string;
    duration?: string;
    is_divergence_point?: boolean;
    icon?: string;
  };
}

interface MatchFound {
  type: 'match_found';
  stepTitle: string;
  match: {
    match_type: 'alma_intervention' | 'alma_evidence' | 'funding' | 'outcome' | 'entity';
    match_name: string;
    match_detail?: string;
    confidence?: number;
  };
}

type JourneyUpdate = PersonaCreated | StepAdded | MatchFound;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Parse structured updates from AI response
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseJourneyUpdates(text: string): JourneyUpdate[] {
  const updates: JourneyUpdate[] = [];
  const regex = /<!-- JOURNEY_UPDATE (.*?) -->/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      updates.push(parsed as JourneyUpdate);
    } catch {
      // Skip invalid JSON
    }
  }
  return updates;
}

function stripJourneyUpdates(text: string): string {
  return text.replace(/<!-- JOURNEY_UPDATE .*? -->/g, '').trim();
}

function getTextParts(parts: Array<{ type: string; text?: string }> | undefined): string {
  if (!parts) return '';
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Journey Chat Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WELCOME_TEXT = "I'm your Journey Mapping Guide. I'll help you map the real journeys of the people your project serves \u2014 showing what happens now versus what could happen with your project.\n\nLet's start with one specific person. Not a named individual, but an archetype \u2014 someone who represents the people you're trying to help.\n\n**Who is the first person you'd like to map?** Tell me about them: their age, where they live, what they're dealing with right now.";

export function JourneyChat({
  orgProfileId,
  journeyId,
  journey,
  onJourneyUpdate,
}: {
  orgProfileId: string;
  journeyId: string;
  journey: JourneyFull;
  onJourneyUpdate: (updates: JourneyUpdate[]) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState('');

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: `/api/org/${orgProfileId}/journeys/chat`,
        body: { journeyId },
      }),
    [orgProfileId, journeyId],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    messages: journey.personas.length === 0
      ? [{
          id: 'welcome',
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, text: WELCOME_TEXT }],
          createdAt: new Date(),
        }]
      : undefined,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Process structured updates from new messages
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant' && !processedRef.current.has(msg.id)) {
        const text = getTextParts(msg.parts as Array<{ type: string; text?: string }>);
        const updates = parseJourneyUpdates(text);
        if (updates.length > 0 && !isStreaming) {
          processedRef.current.add(msg.id);
          onJourneyUpdate(updates);
        }
      }
    }
  }, [messages, onJourneyUpdate, isStreaming]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue('');
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          const text = getTextParts(msg.parts as Array<{ type: string; text?: string }>);
          const displayText = stripJourneyUpdates(text);
          if (!displayText) return null;
          const role = msg.role as string;

          return (
            <div
              key={msg.id}
              className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed
                ${role === 'user'
                  ? 'bg-bauhaus-black text-white'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{displayText}</div>
              </div>
            </div>
          );
        })}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Describe a person your project serves..."
            className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-2.5 text-sm
              focus:outline-none focus:border-bauhaus-black transition-colors"
            disabled={isStreaming}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            className="bg-bauhaus-black text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider
              hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export types for use in parent
export type { JourneyUpdate };
