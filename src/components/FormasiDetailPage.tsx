import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  LayoutDashboard,
  TableProperties,
  Building2,
  Briefcase,
  GraduationCap,
  MapPin,
  Users,
  Award,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Loader2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  BadgePercent,
  Layers,
} from 'lucide-react';
import { SSCASNFormasiBlock, SSCASNPeserta } from '../types';
import { PesertaTable } from './PesertaTable';
import { LokasiDisplay } from './LokasiDisplay';
import { calculateVerification } from '../utils/sampleData';
import { getFormasiKuota } from '../utils/kuotaUtils';
import { cleanPendidikanString } from '../utils/jenisFormasiUtils';
import { fetchPesertaByFormasiAsync } from '../utils/instansiStorage';
import { Breadcrumbs } from './Breadcrumbs';

export interface FormasiDetailPageProps {
  formasi: SSCASNFormasiBlock | null;
  instansiNama: string;
  instansiId?: string;
  fromTab?: 'dashboard' | 'formasi' | 'instansi' | 'users';
  onBack: () => void;
  onNavigate?: (tab: 'dashboard' | 'formasi' | 'instansi' | 'users') => void;
  onSelectInstansi?: (instansiId: string) => void;
  onUpdatePesertaList: (updatedBlock: SSCASNFormasiBlock) => void;
}

export const FormasiDetailPage: React.FC<FormasiDetailPageProps> = ({
  formasi,
  instansiNama,
  instansiId,
  fromTab = 'formasi',
  onBack,
  onNavigate,
  onSelectInstansi,
  onUpdatePesertaList,
}) => {
  if (!formasi) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-4">
        <p className="text-base">Data detail formasi tidak ditemukan atau belum dipilih.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Formasi</span>
        </button>
      </div>
    );
  }

  const header = formasi.header || ({} as any);
  const initialList = Array.isArray(formasi.pesertaList) ? formasi.pesertaList : [];

  // Resolve actual instansi ID
  const resolvedInstansiId = useMemo(() => {
    if (instansiId && instansiId !== 'ALL') return instansiId;
    if (header.kodeInstansi) return `instansi-${header.kodeInstansi}`;
    if (typeof header.instansi === 'string') {
      const match = header.instansi.match(/^(\d+)/);
      if (match) return `instansi-${match[1]}`;
    }
    return '';
  }, [instansiId, header.kodeInstansi, header.instansi]);

  const [activePesertaList, setActivePesertaList] = useState<SSCASNPeserta[]>(initialList);
  const [isLoadingPeserta, setIsLoadingPeserta] = useState<boolean>(initialList.length === 0);
  const [hasCopied, setHasCopied] = useState(false);

  // Load peserta on-demand if not already hydrated
  useEffect(() => {
    let isCancelled = false;

    if (initialList.length > 0) {
      setActivePesertaList(initialList);
      setIsLoadingPeserta(false);
      return;
    }

    setIsLoadingPeserta(true);
    fetchPesertaByFormasiAsync(formasi.id, resolvedInstansiId, 1000)
      .then((mapped) => {
        if (isCancelled) return;
        setActivePesertaList(mapped || []);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('Could not fetch peserta details:', err);
        setActivePesertaList([]);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPeserta(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [formasi.id, resolvedInstansiId, initialList.length, header.pendidikan]);

  // Handle mobile / browser back button
  useEffect(() => {
    window.history.pushState({ isFormasiDetail: true }, '');

    const handlePopState = () => {
      onBack();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack]);

  const kuotaFormasi = getFormasiKuota(header, activePesertaList);

  const handleUpdatePeserta = (newList: SSCASNPeserta[]) => {
    setActivePesertaList(newList);
    const newVerification = calculateVerification(newList);
    onUpdatePesertaList({
      ...formasi,
      pesertaList: newList,
      verification: newVerification,
    });
  };

  const handleExportFormasiJson = () => {
    const exportBlock = {
      ...formasi,
      pesertaList: activePesertaList,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportBlock, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SSCASN_${header.kodeJabatan || 'Formasi'}_${instansiNama || 'Instansi'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopySummary = async () => {
    try {
      const summaryText = [
        `=== DETAIL FORMASI SSCASN CPNS ===`,
        `Instansi: ${instansiNama}`,
        `Jabatan Formasi: ${header.jabatanFormasi || '-'}`,
        `Lokasi Penempatan: ${header.lokasiFormasi || header.namaLokasi || '-'}`,
        `Jenis Formasi: ${header.jenisFormasi || 'UMUM'}`,
        `Kualifikasi Pendidikan: ${cleanPendidikanString(header.pendidikan)}`,
        `Kuota Formasi: ${kuotaFormasi} kursi`,
        `Jumlah Peserta Integrasi: ${activePesertaList.length} orang`,
        `Peluang/Keketatan: 1 : ${kuotaFormasi > 0 ? (activePesertaList.length / kuotaFormasi).toFixed(1) : '-'}`,
        `Status Kuota: ${kuotaFormasi > activePesertaList.length ? `${kuotaFormasi - activePesertaList.length} Slot Kosong` : '100% Terisi'}`,
      ].join('\n');

      await navigator.clipboard.writeText(summaryText);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Fallback
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  // Breadcrumb handlers
  const handleBreadcrumbDashboard = () => {
    if (onNavigate) {
      onNavigate('dashboard');
    } else {
      onBack();
    }
  };

  const handleBreadcrumbFormasi = () => {
    if (onNavigate) {
      onNavigate('formasi');
    } else {
      onBack();
    }
  };

  const handleBreadcrumbInstansi = () => {
    if (onSelectInstansi && instansiId) {
      onSelectInstansi(instansiId);
    }
    if (onNavigate) {
      onNavigate('formasi');
    } else {
      onBack();
    }
  };

  const ratio = kuotaFormasi > 0 ? (activePesertaList.length / kuotaFormasi).toFixed(1) : '-';
  const slotKosong = Math.max(0, kuotaFormasi - activePesertaList.length);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. BREADCRUMBS NAVIGATION BAR */}
      <Breadcrumbs
        className="!mb-0"
        items={[
          {
            label: 'Portal SSCASN',
            icon: Home,
            onClick: handleBreadcrumbDashboard,
            title: 'Kembali ke Beranda Utama',
          },
          {
            label: fromTab === 'dashboard' ? 'Analisis Instansi' : 'Katalog Formasi',
            icon: fromTab === 'dashboard' ? LayoutDashboard : TableProperties,
            onClick: fromTab === 'dashboard' ? handleBreadcrumbDashboard : handleBreadcrumbFormasi,
            title: fromTab === 'dashboard' ? 'Kembali ke Analisis Instansi' : 'Kembali ke Katalog Formasi',
          },
          {
            label: instansiNama || 'Instansi',
            icon: Building2,
            onClick: handleBreadcrumbInstansi,
            title: `Kembali ke Formasi ${instansiNama || 'Instansi'}`,
          },
          {
            label: header.jabatanFormasi || 'Detail Formasi',
            icon: Briefcase,
            active: true,
            title: header.jabatanFormasi,
          },
        ]}
      />

      {/* 2. FORMASI HERO HEADER CARD */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Title & Metadata */}
          <div className="space-y-4 max-w-4xl">
            {/* Top Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                {instansiNama}
              </span>

              {header.jenisFormasi && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {header.jenisFormasi}
                </span>
              )}

              {header.kodeJabatan && (
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
                  Kode: {header.kodeJabatan}
                </span>
              )}
            </div>

            {/* Main Formasi Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                {header.jabatanFormasi || 'Formasi Jabatan CPNS'}
              </h1>
            </div>

            {/* Location & Education Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Lokasi Penempatan
                  </span>
                  <div className="mt-0.5 font-medium text-slate-200">
                    <LokasiDisplay
                      lokasiRaw={header.lokasiFormasi}
                      kodeLokasi={header.kodeLokasi}
                      namaLokasi={header.namaLokasi}
                      pendidikan={header.pendidikan}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <GraduationCap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Kualifikasi Pendidikan
                  </span>
                  <span className="mt-0.5 font-medium text-slate-200 line-clamp-2" title={header.pendidikan}>
                    {cleanPendidikanString(header.pendidikan) || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center lg:flex-col gap-2.5 shrink-0 self-start">
            <button
              onClick={handleExportFormasiJson}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-sm w-full justify-center"
              title="Download data formasi dan peserta dalam format JSON"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-sm w-full justify-center"
              title="Salin ringkasan info formasi ke clipboard"
            >
              {hasCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-400" />
                  <span>Salin Info</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. KEY METRIC STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
          {/* Metric 1: Kuota Formasi */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Kuota Formasi
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-emerald-400">{kuotaFormasi}</span>
              <span className="text-xs text-slate-400 font-medium">Kursi</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Alokasi resmi SSCASN</span>
          </div>

          {/* Metric 2: Total Peserta */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Pelamar
              </span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-indigo-400">{activePesertaList.length}</span>
              <span className="text-xs text-slate-400 font-medium">Peserta</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Mengikuti tahap SKD/SKB</span>
          </div>

          {/* Metric 3: Keketatan Persaingan */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Keketatan
              </span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-purple-400">1 : {ratio}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Peluang persaingan per kursi</span>
          </div>

          {/* Metric 4: Status Kuota */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Status Keterisian
              </span>
              {slotKosong > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div className="mt-1">
              {slotKosong > 0 ? (
                <span className="text-base sm:text-lg font-black font-mono text-amber-400">
                  {slotKosong} Kosong
                </span>
              ) : (
                <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                  100% Terisi
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">
              {slotKosong > 0 ? 'Pelamar kurang dari kuota' : 'Seluruh kuota terpenuhi'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. TABEL DAFTAR PESERTA INTEGRASI SKD & SKB */}
      {isLoadingPeserta ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center text-slate-400 space-y-3 shadow-lg">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-300">Memuat rincian peserta dari database...</p>
          <span className="text-xs text-slate-500">Mengambil data integrasi nilai SKD & SKB lengkap SSCASN</span>
        </div>
      ) : (
        <div className="space-y-4">
          <PesertaTable
            pesertaList={activePesertaList}
            onUpdatePesertaList={handleUpdatePeserta}
          />
        </div>
      )}

      {/* 6. CLEAN BOTTOM NAVIGATION BAR */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-6 text-xs text-slate-500">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Daftar Formasi</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportFormasiJson}
            className="inline-flex items-center gap-1.5 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
