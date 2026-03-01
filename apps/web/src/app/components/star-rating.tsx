'use client';

interface StarRatingProps {
  value: number;
  onChange: (stars: number) => void;
}

export function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star === value ? 0 : star)}
          className="p-0.5 hover:scale-110 transition-transform"
          title={star === value ? 'Remove rating' : `Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 20 20"
            fill={star <= value ? '#F0C020' : 'none'}
            stroke={star <= value ? '#F0C020' : '#777777'}
            strokeWidth={2}
          >
            <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
