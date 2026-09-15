import React from 'react';
import { healHeaderLokasiAndPendidikan } from '../utils/jenisFormasiUtils';
import { HighlightText } from './HighlightText';

interface LokasiDisplayProps {
  lokasiRaw?: string;
  kodeLokasi?: string;
  namaLokasi?: string;
  pendidikan?: string;
  className?: string;
  searchQuery?: string;
}

// Known Indonesian conjunctions and prepositions that should be lowercase (unless at the start)
const LOWERCASE_WORDS = new Set([
  'dan',
  'atau',
  'di',
  'ke',
  'dari',
  'yang',
  'untuk',
  'pada',
  'dengan',
  'tentang',
  'sebagai',
  'terhadap',
  'oleh',
  'serta',
  'dalam',
  'atas',
  'per',
]);

// Known acronyms and abbreviations that should remain UPPERCASE
const UPPERCASE_ACRONYMS = new Set([
  'SDM',
  'DPRD',
  'DPR',
  'ASN',
  'SDA',
  'RSD',
  'RSUD',
  'UPT',
  'UPTD',
  'BLUD',
  'SKPD',
  'OPD',
  'BKN',
  'BPBD',
  'BKPSDM',
  'BAPPEDA',
  'DINKES',
  'DISDIK',
  'DPUPR',
  'PLT',
  'PJ',
  'TNI',
  'POLRI',
  'TK',
  'SD',
  'SMP',
  'SMA',
  'SMK',
  'SLB',
  'IPA',
  'IPS',
  'PAUD',
  'K3',
  'IT',
  'BPJS',
  'IGD',
  'ICU',
  'ICCU',
  'NICU',
  'PICU',
  'VK',
  'HD',
  'OK',
  'CSSD',
  'UTDRS',
  'KPPN',
  'KPP',
  'KPU',
  'BAWASLU',
  'LSM',
  'BPN',
  'BPS',
  'SAKIP',
  'LAKIP',
  'LPSE',
  'SIM',
  'KTP',
  'NIP',
  'NIK',
  'SK',
  'PKM',
]);

// Roman numerals that should be UPPERCASE
const ROMAN_NUMERALS = new Set([
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
]);

// Convert text to Indonesian EYD-compliant Title Case
const toTitleCase = (str: string): string => {
  if (!str) return '';

  // Split into words while keeping word boundaries/punctuation
  const words = str.trim().split(/\s+/);

  return words
    .map((word, index) => {
      // Extract leading/trailing punctuation if any (e.g., "(SDM)", "DR.", "RSUD,")
      const match = word.match(/^([^\w]*)([\w.-]+)([^\w]*)$/);
      if (!match) return word;

      const [, prefix, core, suffix] = match;
      const cleanCoreUpper = core.toUpperCase();
      const cleanCoreLower = core.toLowerCase();

      let formattedCore = '';

      if (ROMAN_NUMERALS.has(cleanCoreUpper)) {
        formattedCore = cleanCoreUpper;
      } else if (UPPERCASE_ACRONYMS.has(cleanCoreUpper)) {
        formattedCore = cleanCoreUpper;
      } else if (index > 0 && LOWERCASE_WORDS.has(cleanCoreLower)) {
        formattedCore = cleanCoreLower;
      } else if (cleanCoreLower === 'dr' || cleanCoreLower === 'dr.') {
        formattedCore = 'Dr.';
      } else if (cleanCoreLower === 'hj' || cleanCoreLower === 'hj.') {
        formattedCore = 'Hj.';
      } else {
        // Standard Title Case: capitalize first letter, rest lowercase
        formattedCore =
          cleanCoreLower.charAt(0).toUpperCase() + cleanCoreLower.slice(1);
      }

      return `${prefix}${formattedCore}${suffix}`;
    })
    .join(' ');
};

export const LokasiDisplay: React.FC<LokasiDisplayProps> = React.memo(({
  lokasiRaw,
  kodeLokasi,
  namaLokasi,
  pendidikan,
  className = '',
  searchQuery = '',
}) => {
  // Heal header if lokasi and pendidikan were split
  const healed = healHeaderLokasiAndPendidikan({
    lokasiFormasi: lokasiRaw,
    kodeLokasi,
    namaLokasi,
    pendidikan,
  });

  let extractedKode = (healed.kodeLokasi || kodeLokasi || '').trim();
  let rawName = (healed.namaLokasi || namaLokasi || '').trim();
  const effectiveLokasiRaw = healed.lokasiFormasi || lokasiRaw;

  // Extract from lokasiRaw if specific fields not provided
  if (!rawName && lokasiRaw) {
    const trimmed = lokasiRaw.trim();
    const dashMatch = trimmed.match(/^(\d+)\s*-\s*(.+)$/);
    if (dashMatch) {
      if (!extractedKode) {
        extractedKode = dashMatch[1].trim();
      }
      rawName = dashMatch[2].trim();
    } else {
      rawName = trimmed;
    }
  }

  if (!rawName && !extractedKode) {
    return <span className="text-slate-500 font-mono">-</span>;
  }

  // Split by "|" separator
  const rawParts = rawName
    ? rawName
        .split(/\s*\|\s*/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  // Filter out parent instansi like "PEMERINTAH KABUPATEN...", "PEMERINTAH KOTA...", "PEMERINTAH PROVINSI..."
  const filteredParts = rawParts.filter(
    (part) => !/^PEMERINTAH\b/i.test(part)
  );

  // Fallback to rawParts if filtering removed everything
  const parts = filteredParts.length > 0 ? filteredParts : rawParts;

  // Merge lone prefix (e.g. "DINAS") with next part if separated by "|"
  const LONE_PREFIXES = new Set([
    'DINAS',
    'BAGIAN',
    'BIDANG',
    'BADAN',
    'SUBBAGIAN',
    'SUBBIDANG',
    'SEKRETARIAT',
    'DIREKTORAT',
    'INSPEKTORAT',
    'DEPUTI',
  ]);

  let effectiveParts = [...parts];
  if (
    effectiveParts.length > 1 &&
    LONE_PREFIXES.has(effectiveParts[0].toUpperCase().trim())
  ) {
    effectiveParts = [
      `${effectiveParts[0]} ${effectiveParts[1]}`,
      ...effectiveParts.slice(2),
    ];
  }

  const parent = toTitleCase(effectiveParts[0] || rawName || '-');
  const children = effectiveParts.length > 1 ? effectiveParts.slice(1).map(toTitleCase) : [];

  return (
    <div className={`space-y-0.5 text-xs ${className}`}>
      {/* 1. Kode Lokasi (monospace, muted, small, matches Kode Jabatan Formasi style) */}
      {extractedKode && (
        <span className="block text-[10px] font-mono text-indigo-400/90 mb-0.5 tracking-tight font-semibold">
          <HighlightText text={extractedKode} query={searchQuery} />
        </span>
      )}

      {/* 2. Parent (heading) */}
      <div className="font-semibold text-slate-200 text-xs leading-snug whitespace-normal line-clamp-3">
        <HighlightText text={parent} query={searchQuery} />
      </div>

      {/* 3. Children (if any) */}
      {children.length > 0 && (
        <div className="space-y-0.5 mt-0.5">
          {children.map((child, idx) => (
            <div
              key={idx}
              className="flex items-start text-[11px] text-slate-300 leading-tight"
            >
              <span className="text-slate-400 font-bold shrink-0 select-none mr-1">
                ›
              </span>
              <span className="line-clamp-3 break-words" title={child}>
                <HighlightText text={child} query={searchQuery} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
