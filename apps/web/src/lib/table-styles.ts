/** Shared Bauhaus table styling constants */

export const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
export const TH_R = 'text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
export const TD = 'py-3 pr-4';
export const TD_R = 'py-3 pr-4 text-right';
export const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50';
export const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;
