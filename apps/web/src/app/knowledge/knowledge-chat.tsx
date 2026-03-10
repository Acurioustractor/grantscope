'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const EXAMPLE_PROMPTS = [
  'What is our mission?',
  'Summarise our annual report',
  'What projects are we running?',
];

export function KnowledgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build messages in UIMessage format for the chat API
      const allMessages = [...messages, userMessage].map((m, i) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: 'text', text: m.content }],
      }));

      const res = await fetch('/api/chat?scope=knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
          return updated;
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-4 border-bauhaus-black flex flex-col" style={{ height: '500px' }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-bauhaus-muted font-medium">
              Ask questions about your uploaded documents:
            </p>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="block w-full text-left px-3 py-2 text-xs font-bold text-bauhaus-black border-2 border-bauhaus-black/20 hover:border-bauhaus-blue hover:text-bauhaus-blue transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`text-sm ${
                msg.role === 'user'
                  ? 'font-bold text-bauhaus-black'
                  : 'text-bauhaus-black/80 font-medium'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-0.5">
                {msg.role === 'user' ? 'You' : 'CivicGraph'}
              </span>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="text-xs text-bauhaus-muted font-bold animate-pulse">Thinking...</div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="border-t-2 border-bauhaus-black/20 p-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your documents..."
          className="flex-1 px-3 py-2 text-sm border-2 border-bauhaus-black font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-blue"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
