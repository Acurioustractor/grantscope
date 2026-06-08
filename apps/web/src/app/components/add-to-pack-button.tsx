'use client';

import { useShortlist, type ShortlistItem } from './shortlist-context';

/**
 * Buyer action: add/remove a supplier to the tender-pack shortlist.
 * `card` = compact, sits in a search result row. `profile` = prominent CTA.
 */
export function AddToPackButton({
  item,
  variant = 'card',
}: {
  item: ShortlistItem;
  variant?: 'card' | 'profile';
}) {
  const { has, toggle } = useShortlist();
  const inPack = has(item.se_id);

  const onClick = (e: React.MouseEvent) => {
    // Cards wrap the whole row in a stretched <Link>; stop the click bubbling
    // up to it so toggling the pack doesn't also navigate to the profile.
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  };

  if (variant === 'profile') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={inPack}
        className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black transition-colors ${
          inPack
            ? 'bg-bauhaus-black text-bauhaus-yellow hover:bg-bauhaus-red hover:text-white hover:border-bauhaus-red'
            : 'bg-bauhaus-red text-white hover:bg-bauhaus-black'
        }`}
      >
        {inPack ? '✓ In tender pack — remove' : '+ Add to tender pack'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={inPack}
      className={`relative z-10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest border-2 transition-colors ${
        inPack
          ? 'border-bauhaus-black bg-bauhaus-black text-bauhaus-yellow hover:bg-bauhaus-red hover:text-white hover:border-bauhaus-red'
          : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-yellow'
      }`}
    >
      {inPack ? '✓ In pack' : '+ Add to pack'}
    </button>
  );
}
