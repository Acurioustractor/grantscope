'use client';

const COLOR_MAP: Record<string, { hex: string; project: string }> = {
  red: { hex: '#D02020', project: 'Empathy Ledger' },
  blue: { hex: '#1040C0', project: 'JusticeHub' },
  green: { hex: '#059669', project: 'Goods on Country' },
  yellow: { hex: '#F0C020', project: 'The Harvest' },
  orange: { hex: '#EA580C', project: 'ACT Farm' },
  purple: { hex: '#7C3AED', project: 'Art' },
};

interface ColorLabelProps {
  value: string | null;
  onChange: (color: string) => void;
}

export function ColorLabel({ value, onChange }: ColorLabelProps) {
  return (
    <div className="flex items-center gap-1">
      {Object.entries(COLOR_MAP).map(([key, { hex, project }]) => (
        <button
          key={key}
          onClick={() => onChange(key === value ? 'none' : key)}
          title={project}
          className="relative w-5 h-5 border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: hex,
            borderColor: key === value ? '#121212' : 'transparent',
          }}
        >
          {key === value && (
            <svg className="absolute inset-0 m-auto w-3 h-3" viewBox="0 0 12 12" fill="white">
              <path d="M10 3L4.5 8.5 2 6" stroke="white" strokeWidth={2} fill="none" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

/** Small dot for display in cards */
export function ColorDot({ color }: { color: string | null }) {
  if (!color || color === 'none') return null;
  const entry = COLOR_MAP[color];
  if (!entry) return null;
  return (
    <span
      className="inline-block w-3 h-3 flex-shrink-0"
      style={{ backgroundColor: entry.hex }}
      title={entry.project}
    />
  );
}

/** Labeled project tag for display in cards */
export function ProjectTag({ color }: { color: string | null }) {
  if (!color || color === 'none') return null;
  const entry = COLOR_MAP[color];
  if (!entry) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white flex-shrink-0"
      style={{ backgroundColor: entry.hex }}
    >
      {entry.project}
    </span>
  );
}
