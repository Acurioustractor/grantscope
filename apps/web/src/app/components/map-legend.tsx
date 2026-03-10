interface LegendItem {
  color: string;
  label: string;
}

interface MapLegendProps {
  title: string;
  items: LegendItem[];
}

export function MapLegend({ title, items }: MapLegendProps) {
  return (
    <div className="absolute bottom-4 left-4 bg-white border-2 border-bauhaus-black p-2 z-[1000]">
      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] font-bold text-bauhaus-muted">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
