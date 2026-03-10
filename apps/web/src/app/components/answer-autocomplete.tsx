'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SuggestedAnswer {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  similarity: number | null;
}

interface AnswerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function AnswerAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing to see suggestions from your answer bank...',
  rows = 4,
  className = '',
}: AnswerAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SuggestedAnswer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchAnswers = useCallback(async (query: string) => {
    if (query.length < 10) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch('/api/answers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 3 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results || []);
        setShowSuggestions((data.results || []).length > 0);
      }
    } catch {
      // Silently fail
    } finally {
      setSearching(false);
    }
  }, []);

  function handleChange(newValue: string) {
    onChange(newValue);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchAnswers(newValue), 300);
  }

  function selectSuggestion(answer: SuggestedAnswer) {
    onChange(answer.answer);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <textarea
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full border-3 border-bauhaus-black p-3 text-sm focus:outline-none focus:border-bauhaus-blue ${className}`}
      />

      {searching && (
        <div className="absolute top-2 right-2">
          <div className="w-4 h-4 border-2 border-bauhaus-blue/30 border-t-bauhaus-blue rounded-full animate-spin" />
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 border-3 border-bauhaus-black border-t-0 bg-white shadow-lg max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 bg-bauhaus-black/5 border-b border-bauhaus-black/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              From your answer bank
            </span>
          </div>
          {suggestions.map(s => (
            <button
              key={s.id}
              onClick={() => selectSuggestion(s)}
              className="block w-full text-left px-3 py-2 hover:bg-bauhaus-blue/5 border-b border-bauhaus-black/5 last:border-b-0 transition-colors"
            >
              <div className="text-xs font-bold text-bauhaus-black line-clamp-1">{s.question}</div>
              <div className="text-xs text-bauhaus-black/60 mt-0.5 line-clamp-2">{s.answer}</div>
              {s.category && (
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                  {s.category}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
