import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cleanPendidikanString, isSingleClauseMatchingJenjang } from '../utils/jenisFormasiUtils';
import { HighlightText } from './HighlightText';

interface JurusanListDisplayProps {
  pendidikanRaw: string;
  searchQuery?: string;
  selectedJenjang?: string;
  selectedPendidikan?: string;
  onExpandChange?: (isExpanded: boolean) => void;
}

export const JurusanListDisplay: React.FC<JurusanListDisplayProps> = React.memo(({
  pendidikanRaw,
  searchQuery = '',
  selectedJenjang = 'ALL',
  selectedPendidikan = 'ALL',
  onExpandChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const cleaned = cleanPendidikanString(pendidikanRaw);
  if (!cleaned || cleaned === '-') {
    return <span className="text-slate-500 font-mono">-</span>;
  }

  // Split into individual majors in original order
  const allMajors = cleaned
    .split(/\s*(?:\/|\n+|;|\|)\s*/)
    .map((m) => m.trim())
    .filter(Boolean);

  if (allMajors.length === 0) {
    return <span className="text-slate-500 font-mono">-</span>;
  }

  const activeFilter =
    selectedPendidikan && selectedPendidikan !== 'ALL'
      ? selectedPendidikan.trim()
      : '';
  const activeSearch = searchQuery ? searchQuery.trim() : '';
  const activeJenjang = selectedJenjang && selectedJenjang !== 'ALL' ? selectedJenjang.trim() : '';

  const isFiltering = Boolean(activeFilter || activeSearch || activeJenjang);

  const isMajorMatch = (m: string) => {
    if (!isFiltering) return false;

    let matchJen = true;
    if (activeJenjang) {
      matchJen = isSingleClauseMatchingJenjang(m, activeJenjang);
    }

    let matchJur = true;
    if (activeFilter) {
      matchJur = m.toLowerCase().includes(activeFilter.toLowerCase());
    }

    let matchSearch = true;
    if (activeSearch) {
      matchSearch = m.toLowerCase().includes(activeSearch.toLowerCase());
    }

    return matchJen && matchJur && matchSearch;
  };

  const MAX_VISIBLE = 2;

  let visibleList: { text: string; isMatched: boolean }[] = [];
  let hiddenCount = 0;

  if (isExpanded) {
    visibleList = allMajors.map((m) => ({ text: m, isMatched: isMajorMatch(m) }));
    hiddenCount = 0;
  } else if (isFiltering) {
    const matchingMajors = allMajors.filter(isMajorMatch);
    const nonMatchingMajors = allMajors.filter((m) => !isMajorMatch(m));

    if (matchingMajors.length > 0) {
      const ordered = [...matchingMajors, ...nonMatchingMajors];
      visibleList = ordered.slice(0, MAX_VISIBLE).map((m) => ({
        text: m,
        isMatched: isMajorMatch(m),
      }));
      hiddenCount = Math.max(0, ordered.length - MAX_VISIBLE);
    } else {
      visibleList = allMajors.slice(0, MAX_VISIBLE).map((m) => ({
        text: m,
        isMatched: false,
      }));
      hiddenCount = Math.max(0, allMajors.length - MAX_VISIBLE);
    }
  } else {
    visibleList = allMajors.slice(0, MAX_VISIBLE).map((m) => ({
      text: m,
      isMatched: false,
    }));
    hiddenCount = Math.max(0, allMajors.length - MAX_VISIBLE);
  }

  const hasMoreThanMax = allMajors.length > MAX_VISIBLE;

  return (
    <div className="space-y-0.5 text-xs w-full max-w-lg">
      {/* List of Majors */}
      <div className="space-y-0.5">
        {visibleList.map((item, index) => (
          <div
            key={index}
            className={`leading-snug whitespace-normal break-words ${
              item.isMatched ? 'text-amber-300 font-semibold' : 'text-slate-200'
            }`}
          >
            <HighlightText
              text={item.text}
              queries={[activeFilter, activeSearch]}
            />
          </div>
        ))}
      </div>

      {/* Collapse / Expand Toggle Button - Blue link style */}
      {hasMoreThanMax && (
        <div className="pt-0.5">
          {isExpanded ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
                onExpandChange?.(false);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer hover:underline"
            >
              <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Sembunyikan jurusan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
                onExpandChange?.(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer hover:underline"
            >
              <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
              <span>+ {hiddenCount > 0 ? hiddenCount : allMajors.length - MAX_VISIBLE} jurusan lainnya</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
