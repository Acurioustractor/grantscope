'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './chat-message';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: text.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((message, index) => ({
            id: message.id || String(index),
            role: message.role,
            parts: [{ type: 'text', text: message.content }],
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const assistantId = `${Date.now()}-assistant`;
      let assistantContent = '';
      const decoder = new TextDecoder();

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: assistantContent } : message
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const sendSuggestion = (text: string) => {
    void sendMessage(text);
  };

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-bauhaus-red border-4 border-bauhaus-black bauhaus-shadow flex items-center justify-center text-white font-black text-sm uppercase tracking-wider hover:bg-bauhaus-black transition-colors cursor-pointer"
        aria-label="Open AI chat"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          'AI'
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed top-0 right-0 z-40 w-full max-w-md h-full bg-bauhaus-canvas border-l-4 border-bauhaus-black flex flex-col">
          {/* Header */}
          <div className="bg-bauhaus-black p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest">CivicGraph AI</div>
              <div className="text-[11px] text-white/60 font-medium mt-0.5">Ask about grants, foundations, or funding</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white p-1 cursor-pointer"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-bauhaus-red border-4 border-bauhaus-black mx-auto mb-4 flex items-center justify-center">
                  <div className="w-8 h-8 bg-white rounded-full"></div>
                </div>
                <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">Grant Discovery</h3>
                <p className="text-xs text-bauhaus-muted font-medium leading-relaxed max-w-xs mx-auto">
                  Describe your organisation and what you need funding for. I&apos;ll search across grants and foundations to find matches.
                </p>
                <div className="mt-4 space-y-1.5">
                  {[
                    'Find grants for First Nations arts in QLD',
                    'What foundations fund environmental regeneration?',
                    'Grants for youth mental health programs',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => sendSuggestion(suggestion)}
                      className="block w-full text-left px-3 py-2 text-xs font-bold text-bauhaus-blue bg-link-light border-2 border-bauhaus-blue/20 hover:border-bauhaus-blue transition-colors cursor-pointer"
                    >
                      &ldquo;{suggestion}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <ChatMessage key={m.id} role={m.role} content={m.content} />
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="p-3 border-4 border-bauhaus-blue bg-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1.5">CivicGraph AI</div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-bauhaus-blue animate-pulse"></div>
                  <div className="w-2 h-2 bg-bauhaus-blue animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-bauhaus-blue animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t-4 border-bauhaus-black bg-white">
            <div className="flex gap-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe what you need funding for..."
                className="flex-1 px-3 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none placeholder:text-bauhaus-muted placeholder:font-medium"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
