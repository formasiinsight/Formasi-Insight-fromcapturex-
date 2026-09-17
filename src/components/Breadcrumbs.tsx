import React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';

export interface BreadcrumbItem {
  id?: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  badge?: string | number;
  title?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  rightContent?: React.ReactNode;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  rightContent,
  className = '',
}) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center justify-between flex-wrap gap-3 bg-slate-900/90 border border-slate-800/90 rounded-2xl px-4 py-3 backdrop-blur-md shadow-sm mb-6 ${className}`}
    >
      <ol className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs text-slate-400 min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.active;
          const Icon = item.icon;

          return (
            <React.Fragment key={item.id || `${item.label}-${index}`}>
              <li className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                {item.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    title={item.title || item.label}
                    className="inline-flex items-center gap-1.5 hover:text-white text-slate-400 hover:bg-slate-800/70 px-2 py-1 rounded-lg transition-all cursor-pointer font-medium group truncate"
                  >
                    {Icon && (
                      <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                    )}
                    <span className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-[260px]">
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-300 rounded border border-slate-700/60 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ) : (
                  <div
                    title={item.title || item.label}
                    aria-current={isLast ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg truncate ${
                      isLast
                        ? 'font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20'
                        : 'text-slate-400 font-medium'
                    }`}
                  >
                    {Icon && (
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isLast ? 'text-indigo-400' : 'text-slate-500'
                        }`}
                      />
                    )}
                    <span className="truncate max-w-[170px] sm:max-w-[260px] md:max-w-[360px]">
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border shrink-0 ${
                          isLast
                            ? 'bg-indigo-950/80 text-indigo-200 border-indigo-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700/60'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </li>

              {!isLast && index < items.length - 1 && (
                <li aria-hidden="true" className="shrink-0 text-slate-600 flex items-center">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {rightContent && (
        <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto shrink-0">
          {rightContent}
        </div>
      )}
    </nav>
  );
};
