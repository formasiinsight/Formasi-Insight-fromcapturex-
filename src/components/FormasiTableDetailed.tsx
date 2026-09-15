import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import {
  Search,
  Users,
  GraduationCap,
  MapPin,
  Award,
  Building2,
  ChevronDown,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  CheckCircle2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { InstansiItem, SSCASNFormasiBlock, SSCASNPeserta } from '../types';
import { getFormasiKuota } from '../utils/kuotaUtils';
import { OFFICIAL_JENIS_FORMASI_LIST, matchPendidikanWithFilters } from '../utils/jenisFormasiUtils';
import { JurusanListDisplay } from './JurusanListDisplay';
import { LokasiDisplay } from './LokasiDisplay';
import { BadgeLegendTooltip } from './BadgeLegendTooltip';
import { HighlightText } from './HighlightText';

const RATIO_LEGEND = [
  { label: 'Tinggi', condition: '> 1:3', colorClass: 'text-rose-400', bgDotClass: 'bg-rose-500' },
  { label: 'Sedang', condition: '1:2 - 1:3', colorClass: 'text-indigo-400', bgDotClass: 'bg-indigo-500' },
  { label: 'Longgar', condition: '< 1:2', colorClass: 'text-emerald-400', bgDotClass: 'bg-emerald-500' },
];

const SKD_LEGEND = [
  { label: 'Tinggi', condition: '> 440', colorClass: 'text-rose-400', bgDotClass: 'bg-rose-500' },
  { label: 'Sedang', condition: '400 - 440', colorClass: 'text-indigo-400', bgDotClass: 'bg-indigo-500' },
  { label: 'Longgar', condition: '< 400', colorClass: 'text-emerald-400', bgDotClass: 'bg-emerald-500' },
];

const SKB_LEGEND = [
  { label: 'Tinggi', condition: '> 70', colorClass: 'text-rose-400', bgDotClass: 'bg-rose-500' },
  { label: 'Sedang', condition: '65 - 70', colorClass: 'text-indigo-400', bgDotClass: 'bg-indigo-500' },
  { label: 'Longgar', condition: '< 65', colorClass: 'text-emerald-400', bgDotClass: 'bg-emerald-500' },
];

interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  icon: React.ReactNode;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  icon,
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  return (
    <div className={`space-y-1 relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium flex items-center justify-between transition-colors text-left cursor-pointer focus:outline-none focus:border-indigo-500"
      >
        <span className="truncate pr-1 text-slate-200">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[220px]">
          <div className="p-1.5 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari opsi..."
                className="w-full pl-7 pr-2 py-1 bg-slate-900 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-2 py-1 text-xs text-left rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                    opt.value === value
                      ? 'bg-indigo-600/30 text-indigo-200 font-bold border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'
                  }`}
                >
                  <span className="truncate pr-1">{opt.label}</span>
                  {opt.value === value && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
              ))
            ) : (
              <div className="p-2.5 text-center text-xs text-slate-500">Tidak ada opsi ditemukan</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface FormasiItemProcessed {
  instansiId: string;
  instansiNama: string;
  block: SSCASNFormasiBlock;
  kuota: number;
  blockPesertaCount: number;
  numRatio: number;
  ratio: string;
  ratioBadgeStyle: string;
  ratioActiveLabel: string;
  minSkdPeserta: SSCASNPeserta | null;
  minSkdNum: number | null;
  skdBadgeStyle: string;
  skdActiveLabel: string;
  minSkbVal: string;
  minSkbNum: number | null;
  skbBadgeStyle: string;
  skbActiveLabel: string;
  cut: string;
  cutNum: number;
  kodeJab: string;
  namaJab: string;
  rowKey: string;
}

interface FormasiTableDetailedProps {
  instansiList: InstansiItem[];
  selectedInstansiId: string;
  onSelectInstansiId: (id: string) => void;
  selectedJenjang?: string;
  onSelectJenjang?: (jenjang: string) => void;
  selectedJurusan?: string;
  onSelectJurusan?: (jurusan: string) => void;
  onViewPeserta: (formasi: SSCASNFormasiBlock, instansiNama: string, instansiId?: string) => void;
}

export const FormasiTableDetailed: React.FC<FormasiTableDetailedProps> = ({
  instansiList,
  selectedInstansiId,
  onSelectInstansiId,
  selectedJenjang: propJenjang = 'ALL',
  onSelectJenjang,
  selectedJurusan = 'ALL',
  onSelectJurusan,
  onViewPeserta,
}) => {
  const [selectedJabatan, setSelectedJabatan] = useState('');
  const [selectedJenjang, setSelectedJenjang] = useState(propJenjang || 'ALL');
  const [selectedPendidikan, setSelectedPendidikan] = useState(selectedJurusan || 'ALL');
  const [selectedLokasi, setSelectedLokasi] = useState('ALL');
  const [selectedJenis, setSelectedJenis] = useState('ALL');
  const [onlyWithKuota, setOnlyWithKuota] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pageInput, setPageInput] = useState('');

  // Use deferred values for smooth text input filtering across large datasets
  const deferredJabatan = useDeferredValue(selectedJabatan);
  const deferredPendidikan = useDeferredValue(selectedPendidikan);
  const deferredLokasi = useDeferredValue(selectedLokasi);

  // Sorting state for numerical columns
  type SortField = 'NONE' | 'KUOTA' | 'PELAMAR' | 'RASIO' | 'MIN_SKD' | 'MIN_SKB' | 'CUTOFF';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('NONE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField('NONE');
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Sync selectedJenjang if prop changes
  useEffect(() => {
    if (propJenjang !== undefined) {
      setSelectedJenjang(propJenjang);
      setCurrentPage(1);
    }
  }, [propJenjang]);

  // Sync selectedPendidikan if selectedJurusan prop changes
  useEffect(() => {
    if (selectedJurusan) {
      setSelectedPendidikan(selectedJurusan || 'ALL');
      setCurrentPage(1);
    }
  }, [selectedJurusan]);

  // Filter instansi items that have parsed data
  const instansiWithData = useMemo(() => {
    return instansiList.filter((i) => i?.parsedData && (i.parsedData.formasiList?.length ?? 0) > 0);
  }, [instansiList]);

  // Pre-process all formations with calculated metrics once
  const allFormasiEntries = useMemo(() => {
    const entries: FormasiItemProcessed[] = [];

    const targetList =
      selectedInstansiId === 'ALL'
        ? instansiWithData
        : instansiWithData.filter((i) => i.id === selectedInstansiId);

    targetList.forEach((inst) => {
      const blocks = inst.parsedData?.formasiList || [];
      blocks.forEach((block, idx) => {
        if (!block) return;

        const h = block?.header || ({} as any);
        const pList = Array.isArray(block?.pesertaList) ? block.pesertaList : [];
        const analytics = block?.analytics;
        const blockPesertaCount =
          pList.length > 0
            ? pList.length
            : typeof analytics?.totalPesertaSkb === 'number' && analytics.totalPesertaSkb > 0
            ? analytics.totalPesertaSkb
            : typeof block?.pesertaCount === 'number'
            ? block.pesertaCount
            : (block?.verification?.totalRecords || 0);

        const kuota = getFormasiKuota(h, pList);
        let numRatio = kuota > 0 ? blockPesertaCount / kuota : 0;
        if (numRatio === 0 && analytics?.rasioKeketatan && analytics.rasioKeketatan !== '-') {
          const parsedRatio = parseFloat(analytics.rasioKeketatan.replace(/^1\s*:\s*/, ''));
          if (!isNaN(parsedRatio)) numRatio = parsedRatio;
        }
        const ratio = numRatio.toFixed(1);

        let ratioBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
        let ratioActiveLabel = 'Sedang';
        if (numRatio > 3) {
          ratioBadgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
          ratioActiveLabel = 'Tinggi';
        } else if (numRatio >= 2) {
          ratioBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
          ratioActiveLabel = 'Sedang';
        } else {
          ratioBadgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
          ratioActiveLabel = 'Longgar';
        }

        const passed = pList.filter((p) => p?.keterangan && p.keterangan.startsWith('P/L'));

        let minSkdPeserta: SSCASNPeserta | null = null;
        if (passed.length > 0) {
          minSkdPeserta = passed.reduce((min, p) => (p.totalSkd < min.totalSkd ? p : min), passed[0]);
        }
        const minSkdNum: number | null = minSkdPeserta ? minSkdPeserta.totalSkd : (analytics?.minSkd ?? null);

        let skdBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
        let skdActiveLabel = 'Sedang';
        if (minSkdNum !== null) {
          if (minSkdNum > 440) {
            skdBadgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
            skdActiveLabel = 'Tinggi';
          } else if (minSkdNum >= 400) {
            skdBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
            skdActiveLabel = 'Sedang';
          } else {
            skdBadgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
            skdActiveLabel = 'Longgar';
          }
        }

        let minSkbVal: string = '-';
        let minSkbNum: number | null = null;
        if (passed.length > 0) {
          minSkbNum = Math.min(...passed.map((p) => p.skb));
        } else if (analytics?.minSkb !== undefined && analytics.minSkb !== null) {
          minSkbNum = analytics.minSkb;
        }

        if (minSkbNum !== null) {
          minSkbVal = minSkbNum % 1 === 0 ? minSkbNum.toString() : minSkbNum.toFixed(2);
        }

        let skbBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
        let skbActiveLabel = 'Sedang';
        if (minSkbNum !== null) {
          if (minSkbNum > 70) {
            skbBadgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
            skbActiveLabel = 'Tinggi';
          } else if (minSkbNum >= 65) {
            skbBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
            skbActiveLabel = 'Sedang';
          } else {
            skbBadgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
            skbActiveLabel = 'Longgar';
          }
        }

        const cuts = passed.map((p) => Number(p.nilaiAkhir) || 0).filter((v) => v > 0);
        let cutNum = cuts.length > 0 ? Math.min(...cuts) : (analytics?.cutoffNilaiAkhir ?? 0);
        const cut = cutNum > 0 ? cutNum.toFixed(3) : '-';

        let kodeJab = h.kodeJabatan || '';
        let namaJab = h.namaJabatan || h.jabatanFormasi || '-';
        if (!kodeJab && h.jabatanFormasi) {
          const dashIdx = h.jabatanFormasi.indexOf(' - ');
          if (dashIdx !== -1) {
            kodeJab = h.jabatanFormasi.substring(0, dashIdx).trim();
            namaJab = h.jabatanFormasi.substring(dashIdx + 3).trim();
          }
        }

        const rowKey = `${inst.id || inst.nama}-${block.id || idx}`;

        entries.push({
          instansiId: inst.id,
          instansiNama: inst.nama,
          block,
          kuota,
          blockPesertaCount,
          numRatio,
          ratio,
          ratioBadgeStyle,
          ratioActiveLabel,
          minSkdPeserta,
          minSkdNum,
          skdBadgeStyle,
          skdActiveLabel,
          minSkbVal,
          minSkbNum,
          skbBadgeStyle,
          skbActiveLabel,
          cut,
          cutNum,
          kodeJab,
          namaJab,
          rowKey,
        });
      });
    });

    return entries;
  }, [instansiWithData, selectedInstansiId]);

  const instansiOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: `Semua Instansi (${instansiWithData.length})` },
      ...instansiWithData.map((inst) => {
        const count = inst.totalFormasiDB || inst.parsedData?.meta?.totalFormasiCount || inst.parsedData?.formasiList?.length || 0;
        return {
          value: inst.id,
          label: `${inst.nama} (${count})`,
        };
      }),
    ];
  }, [instansiWithData]);

  const jenjangOptions: SelectOption[] = [
    { value: 'ALL', label: 'Semua Jenjang' },
    { value: 'S-1', label: 'S-1 / Sarjana' },
    { value: 'D-IV', label: 'D-IV / Diploma 4' },
    { value: 'D-III', label: 'D-III / Diploma 3' },
    { value: 'D-II', label: 'D-II / Diploma 2' },
    { value: 'D-I', label: 'D-I / Diploma 1' },
    { value: 'S-2', label: 'S-2 / Magister' },
    { value: 'S-3', label: 'S-3 / Doktor' },
    { value: 'SLTA', label: 'SLTA / SMA / SMK' },
    { value: 'SMK', label: 'SMK' },
    { value: 'SMA', label: 'SMA / MA' },
  ];

  const uniqueJenisList = useMemo(() => {
    const set = new Set<string>();
    allFormasiEntries.forEach((e) => {
      const j = e.block.header?.jenisFormasi;
      if (j && j !== '-') set.add(j);
    });
    const list = Array.from(set);
    return list.sort((a, b) => {
      const idxA = OFFICIAL_JENIS_FORMASI_LIST.indexOf(a);
      const idxB = OFFICIAL_JENIS_FORMASI_LIST.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [allFormasiEntries]);

  const jenisOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'Semua Jenis Formasi' },
      ...uniqueJenisList.map((j) => ({ value: j, label: j })),
    ];
  }, [uniqueJenisList]);

  // Apply multi-filtering logic
  const filteredFormasis = useMemo(() => {
    const jabatanQuery = deferredJabatan.trim().toLowerCase();
    const jurusanQuery = deferredPendidikan === 'ALL' ? '' : deferredPendidikan.trim();
    const lokasiQuery = deferredLokasi === 'ALL' ? '' : deferredLokasi.trim().toLowerCase();

    return allFormasiEntries.filter(({ block, namaJab, kodeJab, kuota }) => {
      const h = block.header || ({} as any);

      // 0. Jabatan Free Text Filter
      if (jabatanQuery) {
        if (!namaJab.toLowerCase().includes(jabatanQuery) && !kodeJab.toLowerCase().includes(jabatanQuery)) {
          return false;
        }
      }

      // 1. Pendidikan & Jenjang Filter
      if (selectedJenjang !== 'ALL' || jurusanQuery) {
        if (!matchPendidikanWithFilters(h.pendidikan || '', selectedJenjang, jurusanQuery)) {
          return false;
        }
      }

      // 2. Lokasi Free Text Filter
      if (lokasiQuery) {
        if (!h.lokasiFormasi?.toLowerCase().includes(lokasiQuery)) {
          return false;
        }
      }

      // 3. Jenis Formasi Filter
      if (selectedJenis !== 'ALL') {
        if (h.jenisFormasi !== selectedJenis) {
          return false;
        }
      }

      // 4. Only With Kuota
      if (onlyWithKuota && kuota <= 0) {
        return false;
      }

      return true;
    });
  }, [allFormasiEntries, deferredJabatan, selectedJenjang, deferredPendidikan, deferredLokasi, selectedJenis, onlyWithKuota]);

  // Compute sorted formations based on precalculated numbers
  const sortedFormasis = useMemo(() => {
    if (sortField === 'NONE') return filteredFormasis;

    return [...filteredFormasis].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortField) {
        case 'KUOTA':
          valA = a.kuota;
          valB = b.kuota;
          break;
        case 'PELAMAR':
          valA = a.blockPesertaCount;
          valB = b.blockPesertaCount;
          break;
        case 'RASIO':
          valA = a.numRatio;
          valB = b.numRatio;
          break;
        case 'MIN_SKD':
          valA = a.minSkdPeserta ? a.minSkdPeserta.totalSkd : a.minSkdNum !== null ? a.minSkdNum : (sortDirection === 'asc' ? 999999 : -1);
          valB = b.minSkdPeserta ? b.minSkdPeserta.totalSkd : b.minSkdNum !== null ? b.minSkdNum : (sortDirection === 'asc' ? 999999 : -1);
          break;
        case 'MIN_SKB':
          valA = a.minSkbNum !== null ? a.minSkbNum : (sortDirection === 'asc' ? 999999 : -1);
          valB = b.minSkbNum !== null ? b.minSkbNum : (sortDirection === 'asc' ? 999999 : -1);
          break;
        case 'CUTOFF':
          valA = a.cutNum > 0 ? a.cutNum : (sortDirection === 'asc' ? 999999 : -1);
          valB = b.cutNum > 0 ? b.cutNum : (sortDirection === 'asc' ? 999999 : -1);
          break;
        default:
          return 0;
      }

      if (valA === valB) return 0;
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredFormasis, sortField, sortDirection]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(sortedFormasis.length / pageSize));

  // Reset to page 1 if currentPage exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Paginated slice for instant DOM rendering
  const paginatedFormasis = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFormasis.slice(start, start + pageSize);
  }, [sortedFormasis, currentPage, pageSize]);

  const resetFilters = () => {
    setSelectedJabatan('');
    setSelectedJenjang('ALL');
    onSelectJenjang?.('ALL');
    setSelectedPendidikan('ALL');
    onSelectJurusan?.('');
    setSelectedLokasi('ALL');
    setSelectedJenis('ALL');
    setOnlyWithKuota(false);
    setSortField('NONE');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setPageInput('');
    }
  };

  // Generate page numbers for pagination bar
  const paginationButtons = useMemo(() => {
    const delta = 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (typeof i === 'number') {
        if (l !== undefined) {
          if (i - l === 2) {
            rangeWithDots.push(l + 1);
          } else if (i - l !== 1) {
            rangeWithDots.push('...');
          }
        }
        rangeWithDots.push(i);
        l = i;
      }
    });

    return rangeWithDots;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* COMPACT HEADER & FILTER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Formasi & Filter Pendidikan</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                {filteredFormasis.length.toLocaleString('id-ID')} Formasi Ditemukan
              </span>
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Gunakan pencarian bebas untuk jabatan, jurusan, dan lokasi, serta dropdown UI untuk instansi, jenjang, dan jenis formasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter 1: Pilih Instansi (UI Searchable Dropdown) */}
            <div className="w-full sm:w-64">
              <SearchableSelect
                label=""
                icon={null}
                options={instansiOptions}
                value={selectedInstansiId}
                onChange={(val) => {
                  onSelectInstansiId(val);
                  setCurrentPage(1);
                }}
                placeholder="Pilih Instansi..."
              />
            </div>

            <button
              onClick={resetFilters}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* FILTER CONTROLS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Filter 1: Jabatan Formasi (Free Text Input) */}
          <div className="space-y-1 lg:col-span-3">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-sky-400" />
              <span>Jabatan Formasi</span>
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={selectedJabatan}
                onChange={(e) => {
                  setSelectedJabatan(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ketik jabatan (misal: Guru, Arsiparis)..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
              {selectedJabatan && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJabatan('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Hapus Jabatan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter 2: Kualifikasi Pendidikan */}
          <div className="space-y-1 lg:col-span-4">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
              <span>Kualifikasi Pendidikan</span>
            </label>
            <div className="flex items-center gap-1.5">
              <div className="w-32 sm:w-36 shrink-0">
                <SearchableSelect
                  label=""
                  icon={null}
                  options={jenjangOptions}
                  value={selectedJenjang}
                  onChange={(val) => {
                    setSelectedJenjang(val);
                    onSelectJenjang?.(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Jenjang..."
                />
              </div>
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={selectedPendidikan === 'ALL' ? '' : selectedPendidikan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPendidikan(val);
                    onSelectJurusan?.(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Ketik Jurusan / Prodi..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                />
                {selectedPendidikan && selectedPendidikan !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPendidikan('ALL');
                      onSelectJurusan?.('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Hapus Jurusan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter 3: Lokasi Formasi */}
          <div className="space-y-1 lg:col-span-3">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lokasi Formasi</span>
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={selectedLokasi === 'ALL' ? '' : selectedLokasi}
                onChange={(e) => {
                  setSelectedLokasi(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Ketik lokasi (misal: Surabaya, Malang)..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
              {selectedLokasi && selectedLokasi !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLokasi('ALL');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Hapus Lokasi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter 4: Jenis Formasi */}
          <SearchableSelect
            label="Jenis Formasi"
            icon={<Award className="w-3.5 h-3.5 text-amber-400" />}
            options={jenisOptions}
            value={selectedJenis}
            onChange={(val) => {
              setSelectedJenis(val);
              setCurrentPage(1);
            }}
            placeholder="Pilih Jenis..."
            className="lg:col-span-2"
          />
        </div>
      </div>

      {/* FORMASI COMPACT CARDS & TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg flex flex-col">
        {/* Table Top Bar with Summary & Fast Page Size Selector */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">
              Menampilkan{' '}
              <strong className="text-indigo-300 font-mono">
                {sortedFormasis.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </strong>{' '}
              -{' '}
              <strong className="text-indigo-300 font-mono">
                {Math.min(currentPage * pageSize, sortedFormasis.length)}
              </strong>{' '}
              dari{' '}
              <strong className="text-white font-mono">{sortedFormasis.length.toLocaleString('id-ID')}</strong> formasi
            </span>
            {sortedFormasis.length !== allFormasiEntries.length && (
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                (difilter dari {allFormasiEntries.length.toLocaleString('id-ID')} total)
              </span>
            )}
          </div>

          {/* Items per page selector & Pagination controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            {/* Quick Next/Prev Header buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-semibold text-indigo-300 px-1.5">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-auto max-h-[calc(100vh-220px)] min-h-[350px] relative">
          <table className="w-full text-left border-separate border-spacing-0 text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-2 text-center w-12 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">No</th>
                <th className="p-2 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[250px] lg:min-w-[320px]">Jabatan Formasi</th>
                <th className="p-2 min-w-[280px] lg:min-w-[340px] sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">Kualifikasi Pendidikan</th>
                <th className="p-2 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">Jenis</th>
                <th className="p-2 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[240px]">Lokasi Unit Kerja</th>
                
                {/* 1. Kuota Sorting Header */}
                <th className="p-2 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('KUOTA')}
                    className="inline-flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Urutkan berdasarkan Kuota"
                  >
                    <span className={sortField === 'KUOTA' ? 'text-indigo-400 font-bold' : ''}>Kuota</span>
                    {sortField === 'KUOTA' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>

                {/* 2. Pelamar Sorting Header */}
                <th className="p-2 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('PELAMAR')}
                    className="inline-flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Urutkan berdasarkan Jumlah Pelamar"
                  >
                    <span className={sortField === 'PELAMAR' ? 'text-indigo-400 font-bold' : ''}>Pelamar</span>
                    {sortField === 'PELAMAR' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>

                {/* 3. Rasio Sorting Header */}
                <th className="p-2 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('RASIO')}
                    className="inline-flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Urutkan berdasarkan Rasio Keketatan"
                  >
                    <span className={sortField === 'RASIO' ? 'text-indigo-400 font-bold' : ''}>Rasio</span>
                    {sortField === 'RASIO' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>

                {/* 4. Min SKD (P/L) Sorting Header */}
                <th className="p-2 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('MIN_SKD')}
                    className="inline-flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Urutkan berdasarkan Nilai Min SKD (P/L)"
                  >
                    <span className={sortField === 'MIN_SKD' ? 'text-indigo-400 font-bold' : ''}>Min SKD (P/L)</span>
                    {sortField === 'MIN_SKD' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>

                {/* 5. Min SKB (P/L) Sorting Header */}
                <th className="p-2 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('MIN_SKB')}
                    className="inline-flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Urutkan berdasarkan Nilai Min SKB (P/L)"
                  >
                    <span className={sortField === 'MIN_SKB' ? 'text-indigo-400 font-bold' : ''}>Min SKB (P/L)</span>
                    {sortField === 'MIN_SKB' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>

                {/* 6. Cut-off (P/L) Sorting Header */}
                <th className="p-2 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('CUTOFF')}
                    className="inline-flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer group"
                    title="Urutkan berdasarkan Nilai Cut-off Akhir (P/L)"
                  >
                    <span className={sortField === 'CUTOFF' ? 'text-indigo-400 font-bold' : ''}>Cut-off (P/L)</span>
                    {sortField === 'CUTOFF' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>

                <th className="p-2 text-right sticky top-0 right-0 z-30 bg-slate-900 border-b border-slate-800 border-l border-slate-800/80 shadow-[-4px_0_10px_rgba(0,0,0,0.4)] whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {paginatedFormasis.length > 0 ? (
                paginatedFormasis.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx;
                  const h = item.block?.header || ({} as any);

                  return (
                    <tr key={item.rowKey} className="hover:bg-slate-800/40 transition-colors align-top">
                      <td className="p-2 text-center font-mono text-slate-500 font-semibold">{globalIdx + 1}</td>
                      <td className="p-2 min-w-[250px] lg:min-w-[320px]">
                        {item.kodeJab && (
                          <span className="block text-[10px] font-mono text-indigo-400/90 mb-0.5 tracking-tight font-semibold">
                            <HighlightText text={item.kodeJab} query={selectedJabatan} />
                          </span>
                        )}
                        <p className="text-xs font-semibold text-slate-100 leading-tight whitespace-normal">
                          <HighlightText text={item.namaJab} query={selectedJabatan} />
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5 truncate max-w-[280px]" title={item.instansiNama}>
                          {item.instansiNama}
                        </span>
                      </td>
                      <td className="p-2 min-w-[280px] lg:min-w-[340px] font-medium text-slate-200">
                        <JurusanListDisplay
                          pendidikanRaw={h.pendidikan}
                          selectedJenjang={selectedJenjang}
                          selectedPendidikan={selectedPendidikan}
                        />
                      </td>
                      <td className="p-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-medium text-[10px] inline-block border border-slate-700/80 whitespace-normal">
                          {h.jenisFormasi || 'UMUM'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-300 font-medium min-w-[240px]">
                        <LokasiDisplay
                          lokasiRaw={h.lokasiFormasi}
                          kodeLokasi={h.kodeLokasi}
                          namaLokasi={h.namaLokasi}
                          pendidikan={h.pendidikan}
                          searchQuery={selectedLokasi === 'ALL' ? '' : selectedLokasi}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 font-extrabold font-mono rounded-md border border-indigo-500/20 text-xs inline-block">
                          {item.kuota}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 font-extrabold font-mono rounded-md border border-indigo-500/20 text-xs inline-block">
                          {item.blockPesertaCount}
                        </span>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center justify-center">
                          <BadgeLegendTooltip title="Rasio Keketatan" activeLabel={item.ratioActiveLabel} items={RATIO_LEGEND}>
                            <span className={`px-2 py-0.5 font-mono font-extrabold rounded-md border text-[11px] inline-block whitespace-nowrap cursor-pointer ${item.ratioBadgeStyle}`}>
                              1 : {item.ratio}
                            </span>
                          </BadgeLegendTooltip>
                          {item.kuota > item.blockPesertaCount && (
                            <span className="text-[9px] font-medium text-amber-400 mt-0.5 whitespace-nowrap">
                              Formasi Kosong
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {item.minSkdPeserta ? (
                          <div className="inline-flex flex-col items-center whitespace-nowrap">
                            <BadgeLegendTooltip title="Nilai Min SKD (P/L)" activeLabel={item.skdActiveLabel} items={SKD_LEGEND}>
                              <span className={`font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md border inline-block mb-0.5 whitespace-nowrap cursor-pointer ${item.skdBadgeStyle}`}>
                                {item.minSkdPeserta.totalSkd}
                              </span>
                            </BadgeLegendTooltip>
                            <span className="text-[9px] text-slate-400 font-mono leading-tight whitespace-nowrap">
                              {item.minSkdPeserta.twk} &bull; {item.minSkdPeserta.tiu} &bull; {item.minSkdPeserta.tkp}
                            </span>
                          </div>
                        ) : item.minSkdNum !== null ? (
                          <BadgeLegendTooltip title="Nilai Min SKD (P/L)" activeLabel={item.skdActiveLabel} items={SKD_LEGEND}>
                            <span className={`font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md border inline-block whitespace-nowrap cursor-pointer ${item.skdBadgeStyle}`}>
                              {item.minSkdNum}
                            </span>
                          </BadgeLegendTooltip>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {item.minSkbVal !== '-' ? (
                          <BadgeLegendTooltip title="Nilai Min SKB (P/L)" activeLabel={item.skbActiveLabel} items={SKB_LEGEND}>
                            <span className={`font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md border inline-block whitespace-nowrap cursor-pointer ${item.skbBadgeStyle}`}>
                              {item.minSkbVal}
                            </span>
                          </BadgeLegendTooltip>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {item.cut !== '-' ? (
                          <span className="font-mono font-extrabold text-indigo-300 text-[11px] bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 inline-block whitespace-nowrap">
                            {item.cut}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right sticky right-0 z-10 bg-slate-900 border-l border-slate-800/80 shadow-[-4px_0_10px_rgba(0,0,0,0.4)]">
                        <button
                          onClick={() => onViewPeserta(item.block, item.instansiNama, item.instansiId)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg shadow transition-all cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-500 space-y-2">
                    <SlidersHorizontal className="w-7 h-7 text-slate-600 mx-auto" />
                    <p className="text-slate-300 font-semibold text-xs">Tidak ada formasi yang sesuai dengan kriteria filter.</p>
                    <p className="text-[11px] text-slate-500">Coba ubah kata kunci jurusan, lokasi, atau pilih opsi instansi / jenjang lainnya.</p>
                    <button
                      onClick={resetFilters}
                      className="mt-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Reset Filter
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM PAGINATION BAR */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 rounded-b-2xl">
            <div className="flex items-center gap-2">
              <span>
                Halaman <strong className="text-white font-mono">{currentPage}</strong> dari{' '}
                <strong className="text-white font-mono">{totalPages}</strong>
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* First Page */}
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pertama</span>
              </button>

              {/* Prev Page */}
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              {/* Number Buttons */}
              <div className="flex items-center gap-1 px-1">
                {paginationButtons.map((btn, i) => {
                  if (btn === '...') {
                    return (
                      <span key={`dots-${i}`} className="px-1 text-slate-600 select-none">
                        ...
                      </span>
                    );
                  }
                  const pageNum = btn as number;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-2 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Page */}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                title="Halaman Berikutnya"
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                title="Halaman Terakhir"
              >
                <span className="hidden sm:inline">Terakhir</span>
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              {/* Jump to Page Form */}
              <form onSubmit={handlePageJump} className="flex items-center gap-1 ml-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="Hal..."
                  className="w-14 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Go
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
