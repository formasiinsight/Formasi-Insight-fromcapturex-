import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GraduationCap,
  Building2,
  Landmark,
  Shield,
  MapPin,
  Building,
  Search,
  ChevronRight,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { InstansiItem, SSCASNFormasiBlock } from '../types';
import { getFormasiKuota as calculateKuota } from '../utils/kuotaUtils';
import { matchPendidikanWithFilters } from '../utils/jenisFormasiUtils';

interface DashboardAnalyticsProps {
  instansi: InstansiItem | null;
  instansiList: InstansiItem[];
  selectedJenjang?: string;
  onSelectJenjang?: (jenjang: string) => void;
  selectedJurusan?: string;
  onSelectJurusan?: (jurusan: string) => void;
  onSelectInstansi: (instansi: InstansiItem) => void;
  onGoToUpload: (instansiId: string) => void;
  onGoToFormasiTab: () => void;
  onViewPeserta?: (block: SSCASNFormasiBlock, instansiNama: string) => void;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  instansi,
  instansiList,
  selectedJenjang: externalJenjang,
  onSelectJenjang: externalOnSelectJenjang,
  selectedJurusan: externalJurusan,
  onSelectJurusan: externalOnSelectJurusan,
  onSelectInstansi,
  onGoToUpload,
  onGoToFormasiTab,
  onViewPeserta,
}) => {
  // State for Jenjang and Free text Jurusan (Input vs Applied for trigger point)
  const [inputJenjang, setInputJenjang] = useState<string>(externalJenjang || 'ALL');
  const [inputJurusan, setInputJurusan] = useState<string>(externalJurusan || '');
  const [appliedJenjang, setAppliedJenjang] = useState<string>(externalJenjang || 'ALL');
  const [appliedJurusan, setAppliedJurusan] = useState<string>(externalJurusan || '');

  // Sync external filters if updated externally
  React.useEffect(() => {
    if (externalJenjang !== undefined && externalJenjang !== appliedJenjang) {
      setInputJenjang(externalJenjang);
      setAppliedJenjang(externalJenjang);
    }
  }, [externalJenjang]);

  React.useEffect(() => {
    if (externalJurusan !== undefined && externalJurusan !== appliedJurusan) {
      setInputJurusan(externalJurusan);
      setAppliedJurusan(externalJurusan);
    }
  }, [externalJurusan]);

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedJenjang(inputJenjang);
    setAppliedJurusan(inputJurusan);
    if (externalOnSelectJenjang) {
      externalOnSelectJenjang(inputJenjang);
    }
    if (externalOnSelectJurusan) {
      externalOnSelectJurusan(inputJurusan);
    }
  };

  // State for instansi search query and category filter
  const [instansiSearchQuery, setInstansiSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // State for sorting columns
  const [sortField, setSortField] = useState<'NONE' | 'FORMASI' | 'KUOTA'>('NONE');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'FORMASI' | 'KUOTA') => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortField('NONE');
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const activeQueryDisplay = `${appliedJenjang === 'ALL' ? '' : appliedJenjang + ' '}${appliedJurusan || 'Semua Jurusan'}`.trim();

  // Aggregate Instansi Comparison Data for the selected Jenjang and Jurusan
  const aggregatedData = useMemo(() => {
    const jenjangLower = appliedJenjang.toLowerCase();
    const jurusanLower = appliedJurusan.trim().toLowerCase();

    if (!jurusanLower && appliedJenjang === 'ALL') {
      return {
        matchingInstansiList: [],
        totalInstansiCount: 0,
        totalKuota: 0,
        totalPelamar: 0,
        totalPassed: 0,
        avgRasio: 0,
        highestScore: 0,
        lowestScore: 0,
        avgPassedScore: 0,
        instansiAnalyses: [],
      };
    }

    // Match formasi blocks per instansi
    const safeInstansiList = Array.isArray(instansiList) ? instansiList : [];
    const instansiAnalyses = safeInstansiList
      .map((inst) => {
        if (!inst) return null;
        const blocks = Array.isArray(inst.parsedData?.formasiList) ? inst.parsedData.formasiList : [];
        const matchingBlocks = blocks.filter((block) => {
          if (!block || !block.header) return false;
          const pen = block.header.pendidikan || '';
          return matchPendidikanWithFilters(pen, appliedJenjang, appliedJurusan);
        });

        if (matchingBlocks.length === 0) return null;

        // Calculate aggregated metrics for this instansi & major
        let instansiKuota = 0;
        let instansiPelamar = 0;
        let instansiPassed = 0;
        const allPassedScores: number[] = [];
        const jabatanNamesSet = new Set<string>();

        matchingBlocks.forEach((block) => {
          const pList = Array.isArray(block.pesertaList) ? block.pesertaList : [];
          const analytics = block.analytics;
          const kuota = calculateKuota(block.header, pList);
          instansiKuota += kuota;
          
          const blockPesertaCount =
            pList.length > 0
              ? pList.length
              : typeof analytics?.totalPesertaSkb === 'number' && analytics.totalPesertaSkb > 0
              ? analytics.totalPesertaSkb
              : typeof block.pesertaCount === 'number'
              ? block.pesertaCount
              : (block.verification?.totalRecords || 0);
          instansiPelamar += blockPesertaCount;

          const passedPeserta = pList.filter((p) => p?.keterangan && p.keterangan.startsWith('P/L'));
          const blockPassedCount =
            passedPeserta.length > 0
              ? passedPeserta.length
              : typeof analytics?.totalLulus === 'number' && analytics.totalLulus > 0
              ? analytics.totalLulus
              : (block.verification?.passedCount || 0);
          instansiPassed += blockPassedCount;

          if (passedPeserta.length > 0) {
            passedPeserta.forEach((p) => {
              if (p && typeof p.nilaiAkhir === 'number' && !isNaN(p.nilaiAkhir)) {
                allPassedScores.push(p.nilaiAkhir);
              }
            });
          } else {
            if (analytics?.cutoffNilaiAkhir) allPassedScores.push(analytics.cutoffNilaiAkhir);
            if (analytics?.highestNilaiAkhir) allPassedScores.push(analytics.highestNilaiAkhir);
          }

          let rawJab = block.header?.namaJabatan || block.header?.jabatanFormasi || '';
          rawJab = rawJab.replace(/^JF\d+\s*-\s*/i, '').trim();
          if (rawJab) jabatanNamesSet.add(rawJab);
        });

        const ratioNumber = instansiKuota > 0 ? instansiPelamar / instansiKuota : 0;
        const minCutoffScore =
          allPassedScores.length > 0 ? Math.min(...allPassedScores) : null;
        const maxScore =
          allPassedScores.length > 0 ? Math.max(...allPassedScores) : null;

        return {
          instansi: inst,
          matchingBlocks,
          totalKuota: instansiKuota,
          totalPelamar: instansiPelamar,
          totalPassed: instansiPassed,
          ratioNumber,
          ratioFormatted: ratioNumber.toFixed(1),
          minCutoffScore,
          maxScore,
          jabatanList: Array.from(jabatanNamesSet),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Calculate overall stats
    const totalInstansiCount = instansiAnalyses.length;
    const totalKuota = instansiAnalyses.reduce((acc, curr) => acc + curr.totalKuota, 0);
    const totalPelamar = instansiAnalyses.reduce((acc, curr) => acc + curr.totalPelamar, 0);
    const passedCount = instansiAnalyses.reduce((acc, curr) => acc + curr.totalPassed, 0);

    // Identify special badges
    const sortedByKuota = [...instansiAnalyses].sort((a, b) => b.totalKuota - a.totalKuota);
    const highestKuotaInstansi = sortedByKuota[0] || null;

    const sortedByCutoff = [...instansiAnalyses]
      .filter((i) => i.minCutoffScore !== null)
      .sort((a, b) => (a.minCutoffScore as number) - (b.minCutoffScore as number));
    const lowestCutoffInstansi = sortedByCutoff[0] || null;

    const sortedByRatio = [...instansiAnalyses].sort((a, b) => {
      if (a.totalPelamar < a.totalKuota && b.totalPelamar >= b.totalKuota) return -1;
      if (b.totalPelamar < b.totalKuota && a.totalPelamar >= a.totalKuota) return 1;
      return a.ratioNumber - b.ratioNumber;
    });
    const bestRecommendationInstansi = sortedByRatio[0] || null;

    return {
      matchingInstansiList: instansiAnalyses,
      totalInstansiCount,
      totalKuota,
      totalPelamar,
      passedCount,
      bestRecommendationInstansi,
      highestKuotaInstansi,
      lowestCutoffInstansi,
    };
  }, [instansiList, appliedJenjang, appliedJurusan]);

  // Breakdown metrics for the 5 summary cards
  const categoryStats = useMemo(() => {
    let kementerianFormasi = 0;
    let kementerianInstansi = 0;
    let lembagaFormasi = 0;
    let lembagaInstansi = 0;
    let pemprovFormasi = 0;
    let pemprovInstansi = 0;
    let pemkabFormasi = 0;
    let pemkabInstansi = 0;

    aggregatedData.matchingInstansiList.forEach((item) => {
      const kat = (item.instansi.kategori || '').toLowerCase();
      const count = item.matchingBlocks.length;

      if (kat.includes('kementerian')) {
        kementerianFormasi += count;
        kementerianInstansi += 1;
      } else if (kat.includes('lembaga')) {
        lembagaFormasi += count;
        lembagaInstansi += 1;
      } else if (kat.includes('pemprov') || kat.includes('provinsi')) {
        pemprovFormasi += count;
        pemprovInstansi += 1;
      } else {
        pemkabFormasi += count;
        pemkabInstansi += 1;
      }
    });

    return {
      kementerianFormasi,
      kementerianInstansi,
      lembagaFormasi,
      lembagaInstansi,
      pemprovFormasi,
      pemprovInstansi,
      pemkabFormasi,
      pemkabInstansi,
    };
  }, [aggregatedData.matchingInstansiList]);

  // Filter instansi list by search query and category filter
  const filteredInstansiList = useMemo(() => {
    let list = aggregatedData.matchingInstansiList;

    if (instansiSearchQuery.trim()) {
      const q = instansiSearchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.instansi.nama.toLowerCase().includes(q) ||
          item.instansi.kode.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((item) => {
        const kat = (item.instansi.kategori || '').toLowerCase();
        if (selectedCategory === 'KEMENTERIAN') return kat.includes('kementerian');
        if (selectedCategory === 'LEMBAGA') return kat.includes('lembaga');
        if (selectedCategory === 'PEMPROV') return kat.includes('pemprov') || kat.includes('provinsi');
        if (selectedCategory === 'PEMKAB')
          return (
            kat.includes('pemkab') ||
            kat.includes('pemkot') ||
            kat.includes('kabupaten') ||
            kat.includes('kota') ||
            kat.includes('daerah')
          );
        return true;
      });
    }

    if (sortField === 'FORMASI') {
      list = [...list].sort((a, b) => {
        const diff = a.matchingBlocks.length - b.matchingBlocks.length;
        return sortOrder === 'asc' ? diff : -diff;
      });
    } else if (sortField === 'KUOTA') {
      list = [...list].sort((a, b) => {
        const diff = a.totalKuota - b.totalKuota;
        return sortOrder === 'asc' ? diff : -diff;
      });
    }

    return list;
  }, [aggregatedData.matchingInstansiList, instansiSearchQuery, selectedCategory, sortField, sortOrder]);

  // Infinite Scroll State & Intersection Observer
  const [displayLimit, setDisplayLimit] = useState<number>(25);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Reset display limit on filter/search change or sort change
  useEffect(() => {
    setDisplayLimit(25);
  }, [instansiSearchQuery, selectedCategory, appliedJenjang, appliedJurusan, sortField, sortOrder]);

  // Auto load more on scroll
  useEffect(() => {
    if (!observerRef.current) return;
    const target = observerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit((prev) => Math.min(prev + 25, filteredInstansiList.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [filteredInstansiList.length]);

  const visibleInstansiList = useMemo(() => {
    return filteredInstansiList.slice(0, displayLimit);
  }, [filteredInstansiList, displayLimit]);

  const loadedInstansiCount = instansiList.filter(
    (i) => i.parsedData && (i.parsedData.formasiList?.length ?? 0) > 0
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* COMPACT FILTER CARD FOR KUALIFIKASI PENDIDIKAN */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <form onSubmit={handleApplyFilter} className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
          {/* Kualifikasi Pendidikan (Jenjang Dropdown + Free Text Input) */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
              <span>Kualifikasi Pendidikan</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="w-full sm:w-48 shrink-0">
                <select
                  value={inputJenjang}
                  onChange={(e) => setInputJenjang(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white font-semibold rounded-xl px-3 py-2.5 text-xs cursor-pointer focus:outline-none"
                >
                  <option value="ALL">🌐 Semua Jenjang</option>
                  <option value="S-1">🎓 S-1 / Sarjana</option>
                  <option value="D-IV">📜 D-IV / Diploma 4</option>
                  <option value="D-III">📜 D-III / Diploma 3</option>
                  <option value="D-II">📜 D-II / Diploma 2</option>
                  <option value="D-I">📜 D-I / Diploma 1</option>
                  <option value="S-2">🎓 S-2 / Magister</option>
                  <option value="S-3">🎓 S-3 / Doktor</option>
                  <option value="SLTA">🏫 SLTA / SMA / SMK (Sederajat)</option>
                  <option value="SMK">🏫 SMK (Sekolah Menengah Kejuruan)</option>
                  <option value="SMA">🏫 SMA / MA (Sekolah Menengah Atas)</option>
                </select>
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputJurusan}
                  onChange={(e) => setInputJurusan(e.target.value)}
                  placeholder="Ketik nama jurusan (misal: Perikanan, Hukum, Informatika)..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                />
                {inputJurusan && (
                  <button
                    type="button"
                    onClick={() => setInputJurusan('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full cursor-pointer text-xs"
                    title="Hapus teks"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Apply Trigger Button */}
          <div className="shrink-0">
            <button
              type="submit"
              className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer border border-indigo-400/30"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Terapkan Filter</span>
            </button>
          </div>
        </form>
      </div>

      {/* EMPTY STATE GUIDE WHEN EDUCATION IS NOT FILLED */}
      {!appliedJurusan.trim() ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-lg font-black text-white tracking-tight">
              Silakan Isi & Terapkan Filter Pendidikan Terlebih Dahulu
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Pilih jenjang pendidikan (misal: <span className="text-slate-300 font-medium">S-1, D-III, SLTA</span>) dan masukkan kata kunci program studi/jurusan Anda pada formulir filter di atas, lalu klik tombol <strong className="text-indigo-300 font-bold">"Terapkan Filter"</strong> untuk menampilkan data analisis peluang, alokasi formasi, dan rasio keketatan CPNS.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Contoh jurusan: Teknik Informatika, Akuntansi, Hukum, Manajemen, Keperawatan</span>
          </div>
        </div>
      ) : aggregatedData.totalInstansiCount === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 border-dashed rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            Tidak Ada Instansi Membuka Formasi Untuk Jenjang {appliedJenjang === 'ALL' ? 'Semua' : appliedJenjang} - "{appliedJurusan}"
          </h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            Coba sesuaikan kata kunci jurusan atau ubah filter jenjang pendidikan di atas, lalu klik "Terapkan Filter" untuk mencari formasi instansi lain.
          </p>
        </div>
      ) : (
        <>
          {/* 2. OVERVIEW KPI METRIC CARDS FOR THIS JURUSAN */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Total Instansi */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>Total Instansi</span>
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {aggregatedData.totalInstansiCount}{' '}
                <span className="text-xs font-semibold text-slate-400">Instansi</span>
              </p>
              <p className="text-[11px] text-indigo-400 font-medium mt-0.5">
                {aggregatedData.totalKuota} Kuota Kursi
              </p>
            </div>

            {/* 2. Kementerian */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>Kementerian</span>
                <Landmark className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {categoryStats.kementerianInstansi}{' '}
                <span className="text-xs font-semibold text-slate-400">Instansi</span>
              </p>
              <p className="text-[11px] text-purple-400 font-medium mt-0.5">
                {categoryStats.kementerianFormasi} Formasi
              </p>
            </div>

            {/* 3. Lembaga */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>Lembaga</span>
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {categoryStats.lembagaInstansi}{' '}
                <span className="text-xs font-semibold text-slate-400">Instansi</span>
              </p>
              <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                {categoryStats.lembagaFormasi} Formasi
              </p>
            </div>

            {/* 4. Pemprov */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>Pemprov</span>
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {categoryStats.pemprovInstansi}{' '}
                <span className="text-xs font-semibold text-slate-400">Instansi</span>
              </p>
              <p className="text-[11px] text-amber-400 font-medium mt-0.5">
                {categoryStats.pemprovFormasi} Formasi
              </p>
            </div>

            {/* 5. Pemkab / Pemkot */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>Pemkab/Pemkot</span>
                <Building className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white">
                {categoryStats.pemkabInstansi}{' '}
                <span className="text-xs font-semibold text-slate-400">Instansi</span>
              </p>
              <p className="text-[11px] text-cyan-400 font-medium mt-0.5">
                {categoryStats.pemkabFormasi} Formasi
              </p>
            </div>
          </div>

          {/* 3. INSTANSI RECOMMENDATION & COMPARISON TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-extrabold text-white">
                    Tabel Analisis & Keketatan Formasi Instansi
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Jurusan {activeQueryDisplay}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Perbandingan alokasi kuota, jumlah jabatan/formasi, dan rasio keketatan persaingan untuk jurusan {activeQueryDisplay} di seluruh instansi SSCASN.
                </p>
              </div>

              {/* Search Input by Instansi */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={instansiSearchQuery}
                  onChange={(e) => setInstansiSearchQuery(e.target.value)}
                  placeholder="Cari nama / kode instansi..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all font-medium"
                />
                {instansiSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInstansiSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* CATEGORY FILTER TABS */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'ALL', label: '🌐 Semua Jenis' },
                { id: 'KEMENTERIAN', label: '🏛️ Kementerian' },
                { id: 'LEMBAGA', label: '🏢 Lembaga' },
                { id: 'PEMPROV', label: '🚩 Pemprov' },
                { id: 'PEMKAB', label: '🏙️ Pemkab / Pemkot' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === tab.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* INSTANSI COMPARISON CARDS & TABLE */}
            <div className="border border-slate-800 rounded-2xl bg-slate-950/40 overflow-hidden shadow-inner">
              <div className="overflow-auto max-h-[calc(100vh-180px)] min-h-[400px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                <table className="w-full text-left border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="p-3 bg-slate-900 font-bold w-32 sticky top-0 z-20 border-b border-slate-800 shadow-sm whitespace-nowrap">
                        Kode Instansi
                      </th>
                      <th className="p-3 bg-slate-900 font-bold sticky top-0 z-20 border-b border-slate-800 shadow-sm whitespace-nowrap">
                        Nama Instansi
                      </th>
                      <th className="p-3 text-center bg-slate-900 font-bold w-40 sticky top-0 z-20 border-b border-slate-800 shadow-sm whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort('FORMASI')}
                          className="inline-flex items-center justify-center gap-1.5 hover:text-white transition-colors cursor-pointer mx-auto group"
                          title="Urutkan berdasarkan Jumlah Formasi"
                        >
                          <span>Jumlah Formasi</span>
                          {sortField === 'FORMASI' ? (
                            sortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                          )}
                        </button>
                      </th>
                      <th className="p-3 text-center bg-slate-900 font-bold w-36 sticky top-0 z-20 border-b border-slate-800 shadow-sm whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort('KUOTA')}
                          className="inline-flex items-center justify-center gap-1.5 hover:text-white transition-colors cursor-pointer mx-auto group"
                          title="Urutkan berdasarkan Kuota Total"
                        >
                          <span>Kuota Total</span>
                          {sortField === 'KUOTA' ? (
                            sortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                          )}
                        </button>
                      </th>
                      <th className="p-3 text-center bg-slate-900 font-bold w-40 sticky top-0 z-20 border-b border-slate-800 shadow-sm whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1">
                          <span>Rasio Keketatan</span>
                          <div className="group relative cursor-pointer text-slate-400 hover:text-white inline-flex items-center">
                            <Info className="w-3.5 h-3.5" />
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block w-56 p-2.5 bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded-lg shadow-xl z-30 pointer-events-none text-left font-normal normal-case">
                              <p className="font-bold text-indigo-300 mb-1">Perhitungan Rasio Keketatan:</p>
                              <p className="text-slate-300 mb-1">
                                Dihitung dari <span className="font-semibold text-white">Total Pendaftar ÷ Total Kuota</span> instansi untuk jurusan terpilih.
                              </p>
                              <div className="border-t border-slate-800 pt-1 text-slate-400 space-y-0.5">
                                <p>Contoh: 10 pendaftar ÷ 2 kuota = <span className="font-mono text-rose-400 font-bold">1 : 5</span></p>
                                <div className="flex items-center gap-2 pt-0.5 text-[9px]">
                                  <span className="text-rose-400 font-bold">🔴 &gt; 1:3</span>
                                  <span className="text-indigo-400 font-bold">🔵 1:2 - 1:3</span>
                                  <span className="text-emerald-400 font-bold">🟢 &lt; 1:2</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </th>
                      <th className="p-3 text-center bg-slate-900 font-bold w-36 sticky top-0 z-20 border-b border-slate-800 shadow-sm whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredInstansiList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                          Tidak ditemukan instansi yang sesuai dengan pencarian / filter kategori.
                        </td>
                      </tr>
                    ) : (
                      visibleInstansiList.map((item) => {
                        const ratioNum =
                          item.totalKuota > 0 ? item.totalPelamar / item.totalKuota : 0;
                        const ratioStr =
                          item.totalKuota > 0
                            ? ratioNum
                                .toFixed(2)
                                .replace(/\.?0+$/, '')
                            : '0';

                        let ratioBadgeClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                        if (ratioNum > 3) {
                          ratioBadgeClass = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                        } else if (ratioNum >= 2) {
                          ratioBadgeClass = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                        }

                        return (
                          <tr
                            key={item.instansi.id}
                            className="hover:bg-slate-800/40 transition-colors align-middle"
                          >
                            {/* Kode Instansi */}
                            <td className="p-3 font-mono font-bold text-slate-300 text-xs">
                              {item.instansi.kode}
                            </td>

                            {/* Nama Instansi */}
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-white text-xs block">
                                  {item.instansi.nama}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                  <span className="uppercase font-semibold">
                                    {item.instansi.kategori
                                      ? item.instansi.kategori.replace('_', ' ')
                                      : 'Instansi'}
                                  </span>
                                  {item.instansi.provinsi && (
                                    <span>&bull; {item.instansi.provinsi}</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Jumlah Formasi */}
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 inline-block font-mono font-bold text-xs text-indigo-400">
                                {item.matchingBlocks.length} Jabatan
                              </span>
                            </td>

                            {/* Kuota Total */}
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 inline-block font-mono font-bold text-xs text-indigo-400">
                                {item.totalKuota} Kursi
                              </span>
                            </td>

                            {/* Rasio Keketatan */}
                            <td className="p-3 text-center">
                              <div className="group relative inline-block cursor-pointer">
                                <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs inline-block transition-transform group-hover:scale-105 ${ratioBadgeClass}`}>
                                  1 : {ratioStr}
                                </span>
                                {/* Tooltip Hover Interaction */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-[11px] rounded-xl shadow-xl z-30 pointer-events-none text-left">
                                  <div className="font-extrabold text-white mb-1.5 border-b border-slate-800 pb-1 flex items-center justify-between">
                                    <span>Rincian Keketatan</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${ratioBadgeClass}`}>
                                      1 : {ratioStr}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-slate-300">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400">Total Kuota:</span>
                                      <span className="font-bold font-mono text-emerald-400">{item.totalKuota} Kursi</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400">Total Pendaftar:</span>
                                      <span className="font-bold font-mono text-purple-400">{item.totalPelamar} Peserta</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Action Detail */}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectInstansi(item.instansi);
                                  onGoToFormasiTab();
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
                              >
                                <span>Lihat Detail Formasi</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* INFINITE SCROLL LOADER / STATUS */}
              {visibleInstansiList.length < filteredInstansiList.length ? (
                <div
                  ref={observerRef}
                  className="py-4 text-center border-t border-slate-800 bg-slate-900/50"
                >
                  <span className="text-xs text-indigo-400 font-semibold animate-pulse">
                    Memuat lebih banyak instansi... ({visibleInstansiList.length} dari {filteredInstansiList.length})
                  </span>
                </div>
              ) : filteredInstansiList.length > 0 ? (
                <div className="py-3 text-center border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500 font-medium">
                  Menampilkan seluruh {filteredInstansiList.length} instansi
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
