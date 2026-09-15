import React from 'react';

export interface LegendItem {
  label: string;
  condition: string;
  colorClass: string;
  bgDotClass: string;
}

interface BadgeLegendTooltipProps {
  title: string;
  activeLabel?: string; // 'Tinggi' | 'Sedang' | 'Longgar'
  items: LegendItem[];
  children: React.ReactNode;
}

export const BadgeLegendTooltip: React.FC<BadgeLegendTooltipProps> = ({
  title,
  activeLabel,
  items,
  children,
}) => {
  const activeItem = items.find(
    (i) => i.label.toLowerCase() === activeLabel?.toLowerCase()
  );

  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 p-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl text-left text-xs text-slate-200 min-w-[200px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        {activeItem ? (
          <div className="mb-2 pb-2 border-b border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {title}
            </div>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1.5 font-bold text-xs ${activeItem.colorClass}`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${activeItem.bgDotClass}`} />
                Kategori {activeItem.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="font-semibold text-slate-100 border-b border-slate-800 pb-1.5 mb-2">
            {title}
          </div>
        )}

        <div className="space-y-1 text-[11px]">
          {items.map((item, idx) => {
            const isActive = item.label.toLowerCase() === activeLabel?.toLowerCase();
            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-1.5 py-0.5 rounded transition-colors ${
                  isActive
                    ? 'bg-slate-800/90 font-bold border border-slate-700/60'
                    : 'opacity-50'
                }`}
              >
                <span className={`inline-flex items-center gap-1.5 font-medium ${item.colorClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.bgDotClass}`} />
                  {item.label}
                </span>
                <span className="font-mono text-[10px] text-slate-300">{item.condition}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
