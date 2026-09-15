import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, X, Building2, MapPin, Landmark, Building } from 'lucide-react';
import { InstansiItem, InstansiKategori } from '../types';

interface HeaderInstansiSelectorProps {
  selectedInstansi: InstansiItem | null;
  instansiList: InstansiItem[];
  onSelectInstansi: (instansi: InstansiItem) => void;
}

const CATEGORIES: { id: string; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'Semua Kategori', shortLabel: 'Semua', icon: Building2 },
  { id: 'pemprov', label: 'Pemerintah Provinsi', shortLabel: 'Pemprov', icon: MapPin },
  { id: 'pemkab_pemkot', label: 'Pemerintah Kab / Kota', shortLabel: 'Pemkab/Kota', icon: MapPin },
  { id: 'kementerian', label: 'Kementerian RI', shortLabel: 'Kementerian', icon: Landmark },
  { id: 'lembaga', label: 'Lembaga / Badan RI', shortLabel: 'Lembaga', icon: Building },
];

export const HeaderInstansiSelector: React.FC<HeaderInstansiSelectorProps> = ({
  selectedInstansi,
  instansiList,
  onSelectInstansi,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync category if selectedInstansi changes from external source
  useEffect(() => {
    if (selectedInstansi && selectedCategory !== 'all') {
      const matchInCurrentCategory =
        selectedCategory === selectedInstansi.kategori;
      if (!matchInCurrentCategory) {
        // Automatically switch category to match selected instansi
        setSelectedCategory(selectedInstansi.kategori);
      }
    }
  }, [selectedInstansi?.id]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle ESC key to close popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Count instansi by category helper
  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return instansiList.length;
    return instansiList.filter((i) => i.kategori === catId).length;
  };

  // Filter instansi list based on Category and Search Query
  const filteredInstansi = instansiList.filter((inst) => {
    const matchesCategory = selectedCategory === 'all' || inst.kategori === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      inst.nama.toLowerCase().includes(query) ||
      (inst.kode && inst.kode.toLowerCase().includes(query)) ||
      (inst.provinsi && inst.provinsi.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  // Handle category change in Step 1
  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setSearchQuery(''); // Reset search query when category changes

    // Filter list by new category
    const matches = instansiList.filter((i) => catId === 'all' || i.kategori === catId);
    
    // If current selected instansi is not in the new category, auto select the first matching instansi
    if (matches.length > 0 && selectedInstansi) {
      const isCurrentInNewCategory = matches.some((i) => i.id === selectedInstansi.id);
      if (!isCurrentInNewCategory) {
        onSelectInstansi(matches[0]);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" ref={containerRef}>
      {/* STEP 1: Select Kategori (Pemprov, Pemkab, Kementerian, Lembaga) */}
      <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 shadow-inner transition-colors">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 border border-indigo-800/60 px-1 py-0.2 rounded shrink-0">
          1. Jenis
        </span>
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="bg-transparent text-indigo-200 font-bold focus:outline-none cursor-pointer text-xs max-w-[130px] sm:max-w-[150px] truncate"
        >
          <option value="all" className="bg-slate-900 text-slate-200">
            🏢 Semua Jenis ({instansiList.length})
          </option>
          <option value="pemprov" className="bg-slate-900 text-slate-200">
            🏛️ Pemprov ({getCategoryCount('pemprov')})
          </option>
          <option value="pemkab_pemkot" className="bg-slate-900 text-slate-200">
            🏘️ Pemkab/Kota ({getCategoryCount('pemkab_pemkot')})
          </option>
          <option value="kementerian" className="bg-slate-900 text-slate-200">
            🏛️ Kementerian ({getCategoryCount('kementerian')})
          </option>
          <option value="lembaga" className="bg-slate-900 text-slate-200">
            ⚖️ Lembaga ({getCategoryCount('lembaga')})
          </option>
        </select>
      </div>

      {/* STEP 2 & 3: Select Instansi with Real-time Search Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-lg px-2.5 py-1 text-xs text-left shadow-inner transition-all cursor-pointer group max-w-[220px] sm:max-w-[280px]"
        >
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-400 bg-purple-950/80 border border-purple-800/60 px-1 py-0.2 rounded shrink-0">
            2. Instansi
          </span>

          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="font-bold text-slate-100 group-hover:text-indigo-300 truncate transition-colors">
              {selectedInstansi ? selectedInstansi.nama : 'Pilih Instansi'}
            </span>
            {selectedInstansi?.parsedData ? (
              <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                ✓ Data
              </span>
            ) : (
              <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-slate-800 text-slate-400 shrink-0">
                Kosong
              </span>
            )}
          </div>

          <Search className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 shrink-0 transition-colors" />
          <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
        </button>

        {/* STEP 3: SEARCH & SELECT POPOVER DROPDOWN */}
        {isOpen && (
          <div className="absolute right-0 sm:right-0 left-0 sm:left-auto top-full mt-2 w-full sm:w-[380px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Field Header */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/80">
              <div className="relative">
                <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau kode instansi..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Category Filter Pills inside Popover */}
              <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {cat.shortLabel} ({getCategoryCount(cat.id)})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Instansi Results */}
            <div className="max-h-[280px] overflow-y-auto p-1.5 divide-y divide-slate-800/40">
              {filteredInstansi.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-300">Instansi tidak ditemukan</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tidak ada instansi yang cocok dengan kata kunci atau filter ini.
                  </p>
                </div>
              ) : (
                filteredInstansi.map((inst, idx) => {
                  const isSelected = selectedInstansi?.id === inst.id;
                  const hasData = Boolean(inst.parsedData && inst.parsedData.formasiList?.length > 0);

                  return (
                    <button
                      key={`${inst.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        onSelectInstansi(inst);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/25 text-white border border-indigo-500/50 font-semibold shadow-sm'
                          : 'hover:bg-slate-800/70 text-slate-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-100 truncate">{inst.nama}</span>
                          {inst.kode && (
                            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950/60 border border-indigo-800/40 px-1.5 py-0.2 rounded">
                              {inst.kode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span className="capitalize font-medium text-slate-400">
                            {inst.kategori === 'pemkab_pemkot'
                              ? 'Pemkab / Pemkot'
                              : inst.kategori === 'pemprov'
                              ? 'Pemprov'
                              : inst.kategori === 'kementerian'
                              ? 'Kementerian'
                              : 'Lembaga'}
                          </span>
                          {inst.provinsi && <span>&bull; {inst.provinsi}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasData ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3 mr-0.5" />
                            Ada Data
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                            Perlu PDF
                          </span>
                        )}

                        {isSelected && <Check className="w-4 h-4 text-indigo-400 ml-1" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer with summary and search reset */}
            <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Menampilkan {filteredInstansi.length} dari {instansiList.length} instansi</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-medium"
                >
                  Reset Kata Kunci
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
