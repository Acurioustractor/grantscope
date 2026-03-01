'use client';

import { useState } from 'react';

const TYPES = [
  { value: 'issue', label: 'Report an Issue', desc: 'Wrong data, broken page, or bug' },
  { value: 'data_source', label: 'Suggest a Data Source', desc: 'A grants database or dataset we should add' },
  { value: 'idea', label: 'Share an Idea', desc: 'Feature request or improvement' },
  { value: 'other', label: 'Other', desc: 'Anything else' },
] as const;

export function FeedbackForm() {
  const [type, setType] = useState<string>('idea');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, email, message }),
      });
      if (res.ok) {
        setStatus('sent');
        setMessage('');
        setName('');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="border-4 border-money bg-money-light p-8 max-w-2xl">
        <div className="text-xl font-black text-money mb-2">Thank you!</div>
        <p className="text-sm text-bauhaus-black font-medium mb-4">
          Your feedback has been received. We read everything.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs font-black uppercase tracking-widest text-money hover:text-bauhaus-black transition-colors cursor-pointer"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {/* Type selector */}
      <div>
        <label className="text-xs font-black uppercase tracking-widest text-bauhaus-black block mb-2">
          What kind of feedback?
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-4 border-bauhaus-black">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`p-3 text-left transition-all cursor-pointer border-r-2 last:border-r-0 border-bauhaus-black/10 ${
                type === t.value
                  ? 'bg-bauhaus-black text-white'
                  : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
              }`}
            >
              <div className="text-xs font-black">{t.label}</div>
              <div className={`text-[10px] mt-0.5 ${type === t.value ? 'text-white/60' : 'text-bauhaus-muted'}`}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="feedback-message" className="text-xs font-black uppercase tracking-widest text-bauhaus-black block mb-2">
          Your message
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
          placeholder="Tell us what you've found, what's missing, or what you'd like to see..."
          className="w-full px-4 py-3 text-sm font-medium border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow/20 focus:outline-none placeholder:text-bauhaus-muted resize-y"
        />
      </div>

      {/* Name + Email (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="feedback-name" className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
            Name (optional)
          </label>
          <input
            id="feedback-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-3 text-sm font-medium border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow/20 focus:outline-none placeholder:text-bauhaus-muted"
          />
        </div>
        <div>
          <label htmlFor="feedback-email" className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
            Email (optional)
          </label>
          <input
            id="feedback-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 text-sm font-medium border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow/20 focus:outline-none placeholder:text-bauhaus-muted"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'sending' || !message.trim()}
          className="px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors cursor-pointer border-4 border-bauhaus-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'sending' ? 'Sending...' : 'Send Feedback'}
        </button>
        {status === 'error' && (
          <span className="text-sm font-bold text-bauhaus-red">Something went wrong. Please try again.</span>
        )}
      </div>
    </form>
  );
}
