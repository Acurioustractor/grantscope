'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types for structured extraction
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface IntakeUpdate {
  type: string;
  // phase_change
  phase?: string;
  // idea_extracted
  idea_summary?: string;
  problem_statement?: string;
  issue_areas?: string[];
  geographic_focus?: { state?: string; lga?: string; postcode?: string };
  // beneficiary_extracted
  target_beneficiary?: { cohort?: string; location?: string; demographics?: string };
  // entity_recommended
  recommended_entity_type?: string;
  entity_type_rationale?: string;
  factors?: Record<string, boolean>;
  // landscape_shown
  orgs?: Array<{ name: string; gs_id?: string; relevance?: string }>;
  // funding_matched
  grants?: Array<{ name: string; amount?: string; deadline?: string }>;
  foundations?: Array<{ name: string; giving?: string }>;
  // plan_generated
  action_plan?: Array<{ step: string; description: string; timeline: string }>;
  draft_email?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Parsers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function parseIntakeUpdates(text: string): IntakeUpdate[] {
  const updates: IntakeUpdate[] = [];
  const regex = /<!-- INTAKE_UPDATE (.*?) -->/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    try {
      updates.push(JSON.parse(m[1]) as IntakeUpdate);
    } catch {
      // Skip invalid JSON
    }
  }
  return updates;
}

export function stripIntakeUpdates(text: string): string {
  return text.replace(/<!-- INTAKE_UPDATE .*? -->/g, '').trim();
}

export function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function getTextParts(parts: Array<{ type: string; text?: string }> | undefined): string {
  if (!parts) return '';
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase indicator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PHASES = [
  { key: 'idea', label: 'Idea', icon: '1' },
  { key: 'landscape', label: 'Landscape', icon: '2' },
  { key: 'structure', label: 'Structure', icon: '3' },
  { key: 'evidence', label: 'Evidence', icon: '4' },
  { key: 'funding', label: 'Funding', icon: '5' },
  { key: 'plan', label: 'Plan', icon: '6' },
];

function PhaseBar({ currentPhase }: { currentPhase: string }) {
  const currentIndex = PHASES.findIndex(p => p.key === currentPhase);

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 overflow-x-auto">
      {PHASES.map((phase, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={phase.key} className="flex items-center gap-1 shrink-0">
            {i > 0 && <div className={`w-4 h-px ${isComplete ? 'bg-bauhaus-black' : 'bg-gray-300'}`} />}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors
              ${isCurrent ? 'bg-bauhaus-black text-white' : isComplete ? 'bg-gray-200 text-gray-600' : 'text-gray-400'}`}
            >
              <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black
                ${isCurrent ? 'bg-white text-bauhaus-black' : isComplete ? 'bg-gray-400 text-white' : 'bg-gray-200 text-gray-400'}`}
              >
                {isComplete ? '\u2713' : phase.icon}
              </span>
              <span className="hidden sm:inline">{phase.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Live extraction indicators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExtractionPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
      {label}
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Chat Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WELCOME_TEXT = `Welcome! I'm your CivicGraph Innovation Guide. I can help with a new initiative, or work as an advanced support space for A Curious Tractor projects already in CivicGraph.

I have access to data on **590,000+ Australian entities**, **31,000+ grant opportunities**, **10,900+ foundations**, and **2,000+ evidence-based interventions** from the Australian Living Map of Alternatives.

For ACT, I can help connect your existing plans across Goods, JusticeHub, CivicGraph, Empathy Ledger, PICC, Harvest/Farm, ALMA, Contained, funders, procurement, evidence, partners, and next actions.

**Tell me what you are trying to move forward.** Name the project, decision, opportunity, partner, funder, or idea, and I will help turn it into a clear path.`;

interface SavedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function IntakeChat({
  intakeId,
  initialPhase,
  savedMessages,
  onIntakeUpdate,
}: {
  intakeId: string;
  initialPhase: string;
  savedMessages?: SavedMessage[];
  onIntakeUpdate: (updates: IntakeUpdate[]) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState('');
  const [currentPhase, setCurrentPhase] = useState(initialPhase);
  const [recentExtractions, setRecentExtractions] = useState<string[]>([]);

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: `/api/start/${intakeId}/chat`,
      }),
    [intakeId],
  );

  const initialMessages = useMemo(() => {
    const welcome = {
      id: 'welcome',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: WELCOME_TEXT }],
      createdAt: new Date(),
    };
    if (!savedMessages || savedMessages.length === 0) return [welcome];
    // Restore conversation from DB — prepend welcome, then saved messages
    return [
      welcome,
      ...savedMessages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: m.content }],
        createdAt: new Date(),
      })),
    ];
  }, [savedMessages]);

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Surface AI errors to user
  useEffect(() => {
    if (error) {
      setErrorMessage('Something went wrong. Please try again.');
      const timer = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Process structured updates
  const stableOnIntakeUpdate = useCallback(onIntakeUpdate, [onIntakeUpdate]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant' && !processedRef.current.has(msg.id)) {
        const text = getTextParts(msg.parts as Array<{ type: string; text?: string }>);
        const updates = parseIntakeUpdates(text);
        if (updates.length > 0 && !isStreaming) {
          processedRef.current.add(msg.id);

          // Track phase changes
          for (const u of updates) {
            if (u.type === 'phase_change' && u.phase) {
              setCurrentPhase(u.phase);
            }
          }

          // Show extraction indicators briefly
          const labels = updates.map(u => {
            switch (u.type) {
              case 'idea_extracted': return 'Idea captured';
              case 'beneficiary_extracted': return 'Beneficiary mapped';
              case 'entity_recommended': return 'Structure recommended';
              case 'landscape_shown': return 'Landscape loaded';
              case 'funding_matched': return 'Funding matched';
              case 'plan_generated': return 'Plan generated';
              default: return null;
            }
          }).filter(Boolean) as string[];

          if (labels.length > 0) {
            setRecentExtractions(labels);
            setTimeout(() => setRecentExtractions([]), 4000);
          }

          stableOnIntakeUpdate(updates);
        }
      }
    }
  }, [messages, stableOnIntakeUpdate, isStreaming]);

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
      {/* Phase bar */}
      <PhaseBar currentPhase={currentPhase} />

      {/* Extraction indicators */}
      {recentExtractions.length > 0 && (
        <div className="flex gap-2 px-4 py-2 bg-emerald-50/50 border-b border-emerald-100">
          {recentExtractions.map((label, i) => (
            <ExtractionPill key={i} label={label} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          const text = getTextParts(msg.parts as Array<{ type: string; text?: string }>);
          const displayText = stripIntakeUpdates(text);
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
                  : 'bg-gray-50 text-gray-800 border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdown(displayText) }} />
              </div>
            </div>
          );
        })}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
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

      {/* Error banner */}
      {errorMessage && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Tell me about your idea..."
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
