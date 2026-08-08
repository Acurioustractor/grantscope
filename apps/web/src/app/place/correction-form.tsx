'use client';

import { useState } from 'react';

interface CorrectionFormProps {
  pageRoute: string;
  lgaName?: string;
  /** Fallback if the API cannot take the correction. */
  mailtoHref: string;
}

/**
 * A correction still goes to a person — this form just makes sure it is not
 * lost to a mailbox on the way. Submissions land in a review queue that a
 * person reads; nothing on the site changes automatically.
 */
export function CorrectionForm({ pageRoute, lgaName, mailtoHref }: CorrectionFormProps) {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3 || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/place/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_route: pageRoute,
          lga_name: lgaName,
          message: message.trim(),
          contact: contact.trim() || undefined,
        }),
      });
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  if (state === 'sent') {
    return (
      <p className="border-4 border-bauhaus-black bg-white p-4 text-base leading-7">
        Received. A person will read it, and if the page changes we will say what changed and why.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="correction-message" className="block text-[11px] font-black uppercase tracking-widest">
          What we have wrong
        </label>
        <textarea
          id="correction-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
          required
          placeholder="Which organisations belong here, which do not, or anything else this page gets wrong."
          className="mt-2 w-full border-4 border-bauhaus-black bg-white p-3 text-base leading-7 outline-none focus:border-bauhaus-red"
        />
      </div>
      <div>
        <label htmlFor="correction-contact" className="block text-[11px] font-black uppercase tracking-widest">
          Your name and organisation <span className="font-normal normal-case tracking-normal">(optional, so we can reply)</span>
        </label>
        <input
          id="correction-contact"
          type="text"
          value={contact}
          onChange={e => setContact(e.target.value)}
          maxLength={320}
          className="mt-2 w-full border-4 border-bauhaus-black bg-white p-3 text-base outline-none focus:border-bauhaus-red"
        />
      </div>
      {/* Honeypot — hidden from people, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === 'sending' || message.trim().length < 3}
          className="inline-block border-4 border-bauhaus-black bg-white px-5 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Send the correction'}
        </button>
        {state === 'failed' ? (
          <p className="text-sm">
            That did not go through.{' '}
            <a href={mailtoHref} className="font-bold underline">
              Email it instead
            </a>
            {' '}— it reaches the same person.
          </p>
        ) : (
          <a href={mailtoHref} className="text-sm underline">
            Prefer email?
          </a>
        )}
      </div>
    </form>
  );
}
