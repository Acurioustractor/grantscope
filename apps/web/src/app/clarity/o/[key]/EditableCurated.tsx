'use client';

import { useState } from 'react';
import type { CuratedField } from '../../curated-fields';
import { Prose } from './prose';

/**
 * Inline edit for one curated field. The write path is the admin-gated PATCH
 * /api/clarity/object; this component is a convenience over it, never a gate. Saved values
 * render immediately; a failure restores the previous text and says so. Empty saves as null on
 * purpose — the stub logic depends on null meaning "absent", not "wrote nothing".
 */
export default function EditableCurated({
  objectKey,
  field,
  initial,
  variant,
  className,
}: {
  objectKey: string;
  field: CuratedField;
  initial: string | null;
  variant: 'prose' | 'mono';
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clarity/object', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_key: objectKey, field, value: draft }),
      });
      const body = (await res.json()) as { value?: string | null; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setValue(body.value ?? null);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className={className}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={variant === 'prose' ? 4 : 2}
          autoFocus
          className="w-full border-2 border-bauhaus-black p-2 font-mono text-[13px]"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="border-2 border-bauhaus-black px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-bauhaus-canvas disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={busy}
            className="border-2 border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:border-bauhaus-black hover:text-bauhaus-black disabled:opacity-40"
          >
            Cancel
          </button>
          {error ? <span className="font-mono text-[11px] text-bauhaus-red">{error}</span> : null}
        </div>
      </div>
    );
  }

  const editButton = (
    <button
      onClick={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      className="font-mono text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-bauhaus-blue"
      aria-label={`edit ${field}`}
    >
      {value ? 'edit' : `add ${field.replace('_', ' ')}`}
    </button>
  );

  if (!value) {
    return <span className={className}>{editButton}</span>;
  }
  if (variant === 'mono') {
    return (
      <span className={className}>
        {value} {editButton}
      </span>
    );
  }
  return (
    <div className={className}>
      <Prose text={value} />
      <div className="mt-0.5">{editButton}</div>
    </div>
  );
}
