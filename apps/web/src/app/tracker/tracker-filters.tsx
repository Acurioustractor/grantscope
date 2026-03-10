'use client';

export interface Filters {
  minStars: number;
  color: string | null;
  search: string;
}

const COLORS: Record<string, { hex: string; label: string }> = {
  red: { hex: '#D02020', label: 'Empathy Ledger' },
  blue: { hex: '#1040C0', label: 'JusticeHub' },
  green: { hex: '#059669', label: 'Goods on Country' },
  yellow: { hex: '#F0C020', label: 'The Harvest' },
  orange: { hex: '#EA580C', label: 'ACT Farm' },
  purple: { hex: '#7C3AED', label: 'Art' },
};

export function TrackerFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white border-2 border-bauhaus-black">
      {/* Search */}
      <input
        type="text"
        placeholder="Search grants..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="border-2 border-bauhaus-black px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-bauhaus-blue w-48"
      />

      {/* Star filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mr-1">Stars</span>
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => onChange({ ...filters, minStars: s })}
            className={`px-2 py-1 text-xs font-black border-2 ${
              filters.minStars === s
                ? 'bg-bauhaus-black text-white border-bauhaus-black'
                : 'bg-white text-bauhaus-muted border-bauhaus-black/20 hover:border-bauhaus-black'
            }`}
          >
            {s === 0 ? 'All' : `${s}+`}
          </button>
        ))}
      </div>

      {/* Color filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mr-1">Project</span>
        <button
          onClick={() => onChange({ ...filters, color: null })}
          className={`px-2 py-1 text-xs font-black border-2 ${
            !filters.color
              ? 'bg-bauhaus-black text-white border-bauhaus-black'
              : 'bg-white text-bauhaus-muted border-bauhaus-black/20 hover:border-bauhaus-black'
          }`}
        >
          All
        </button>
        {Object.entries(COLORS).map(([key, { hex, label }]) => (
          <button
            key={key}
            onClick={() => onChange({ ...filters, color: filters.color === key ? null : key })}
            title={label}
            className="w-6 h-6 border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: hex,
              borderColor: filters.color === key ? '#121212' : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
}
