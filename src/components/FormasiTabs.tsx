import React from 'react';
import { SSCASNFormasiBlock } from '../types';
import { Layers, Briefcase, Users, CheckCircle2 } from 'lucide-react';

interface FormasiTabsProps {
  formasiList: SSCASNFormasiBlock[];
  selectedFormasiId: string; // 'all' or 'formasi-1', etc.
  onSelectFormasi: (id: string) => void;
}

export const FormasiTabs: React.FC<FormasiTabsProps> = ({
  formasiList,
  selectedFormasiId,
  onSelectFormasi,
}) => {
  if (!formasiList || !Array.isArray(formasiList) || formasiList.length <= 1) {
    return null; // No tabs needed if single formasi
  }

  const totalPeserta = formasiList.reduce(
    (acc, f) => acc + (f?.pesertaList?.length || (typeof f?.pesertaCount === 'number' ? f.pesertaCount : 0) || f?.verification?.totalRecords || 0),
    0
  );
  const totalKuota = formasiList.reduce((acc, f) => acc + (f?.header?.jumlahKuota || 0), 0);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Dokumen Memiliki {formasiList.length} Formasi Jabatan
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Multi-Formasi SSCASN
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Pilih tab formasi di bawah untuk memfilter analisis & data tabel per-jabatan:
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Total: <strong>{totalPeserta}</strong> Peserta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kuota Total: <strong>{totalKuota}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
        <button
          onClick={() => onSelectFormasi('all')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            selectedFormasiId === 'all'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/30'
              : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-300" />
          <span>Semua Formasi ({formasiList.length})</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
            {totalPeserta} peserta
          </span>
        </button>

        {formasiList.map((formasi, index) => {
          if (!formasi) return null;
          const isSelected = selectedFormasiId === formasi.id;
          const namaJabatan = formasi.header?.namaJabatan || formasi.header?.jabatanFormasi || `Formasi ${index + 1}`;
          const count =
            formasi.pesertaList?.length ||
            (typeof formasi.pesertaCount === 'number' ? formasi.pesertaCount : 0) ||
            formasi.verification?.totalRecords ||
            0;
          const kuota = formasi.header?.jumlahKuota || 0;

          return (
            <button
              key={formasi.id}
              onClick={() => onSelectFormasi(formasi.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30 font-semibold'
                  : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800/50'
              }`}
            >
              <Briefcase className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
              <span className="max-w-[200px] sm:max-w-[280px] truncate" title={namaJabatan}>
                {index + 1}. {namaJabatan}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                count === 0 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : isSelected 
                  ? 'bg-indigo-700/60 text-indigo-100' 
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {kuota > 0 ? `${kuota} Kuota • ` : ''}
                {count === 0 ? '0 Pendaftar' : `${count} Peserta`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
