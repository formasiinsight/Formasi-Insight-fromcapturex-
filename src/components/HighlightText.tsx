import React from 'react';

interface HighlightTextProps {
  text: string;
  query?: string;
  queries?: string[];
  className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  query,
  queries,
  className = '',
}) => {
  if (!text) return null;

  const termsSet = new Set<string>();
  if (query && query !== 'ALL' && query.trim()) {
    termsSet.add(query.trim());
  }
  if (queries && Array.isArray(queries)) {
    queries.forEach((q) => {
      if (q && q !== 'ALL' && q.trim()) {
        termsSet.add(q.trim());
      }
    });
  }

  const activeTerms = Array.from(termsSet);

  if (activeTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = activeTerms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  try {
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return (
      <span className={className}>
        {parts.map((part, idx) => {
          const isMatch = activeTerms.some(
            (t) => t.toLowerCase() === part.toLowerCase()
          );
          if (isMatch) {
            return (
              <mark
                key={idx}
                className="bg-amber-400/30 text-amber-200 font-bold px-0.5 rounded underline decoration-amber-400/60 decoration-2 underline-offset-2"
              >
                {part}
              </mark>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </span>
    );
  } catch {
    return <span className={className}>{text}</span>;
  }
};

