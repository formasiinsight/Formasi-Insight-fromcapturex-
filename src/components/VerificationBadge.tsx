import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Calculator, CheckCircle2, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { SSCASNVerificationResult, SSCASNPeserta } from '../types';
import { calculateVerification } from '../utils/sampleData';

interface VerificationBadgeProps {
  verification: SSCASNVerificationResult;
  pesertaList: SSCASNPeserta[];
  pageErrors?: Array<{ page: number; reason: string }>;
  onAutoRepair: (repairedList: SSCASNPeserta[]) => void;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  verification,
  pesertaList,
  pageErrors,
  onAutoRepair,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleFixMath = () => {
    const repaired = pesertaList.map((p) => {
      const totalSkd = p.twk + p.tiu + p.tkp;
      const skorSkd = Number(((totalSkd / 5.5) * 0.4).toFixed(3));
      const skorSkb = Number((p.skb * 0.6).toFixed(3));
      const nilaiAkhir = Number((skorSkd + skorSkb).toFixed(3));

      return {
        ...p,
        totalSkd,
        skorSkd,
        skorSkb,
        nilaiAkhir,
      };
    });

    onAutoRepair(repaired);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 mb-6 shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div
            className={`p-3 rounded-xl border ${
              verification.isValid
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            {verification.isValid ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-base">
                Audit & Verifikasi Otomatis Dokumen SSCASN
              </h3>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  verification.isValid
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                Akurasi Skor: {verification.scoreAccuracyPercent}%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {verification.isValid
                ? `Semua ${verification.totalRecords} data peserta terverifikasi 100% konsisten secara matematis (SKD, SKB, Skor 40%-60%, & Nilai Akhir).`
                : `Ditemukan ${verification.discrepanciesCount} ketidakcocokan nilai matematis yang perlu ditinjau.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {!verification.isValid && (
            <button
              onClick={handleFixMath}
              className="px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              Koreksi Otomatis Rumus
            </button>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-400" />
            Aturan Rumus
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <span className="text-indigo-400 font-semibold block">1. Total SKD</span>
            <code className="text-slate-300 block font-mono text-[11px]">
              TWK (7) + TIU (8) + TKP (9) = Total (10)
            </code>
          </div>
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <span className="text-indigo-400 font-semibold block">2. Skor SKD (40%)</span>
            <code className="text-slate-300 block font-mono text-[11px]">
              ((Total SKD / 5.5) × 40%) = Skor (11)
            </code>
          </div>
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <span className="text-indigo-400 font-semibold block">3. Skor SKB (60%)</span>
            <code className="text-slate-300 block font-mono text-[11px]">
              Nilai SKB (12) × 60% = Skor (13)
            </code>
          </div>
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <span className="text-indigo-400 font-semibold block">4. Nilai Akhir Integrasi</span>
            <code className="text-slate-300 block font-mono text-[11px]">
              Skor SKD (11) + Skor SKB (13) = Nilai (14)
            </code>
          </div>
        </div>
      )}

      {pageErrors && pageErrors.length > 0 && (
        <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl space-y-1.5 text-xs text-amber-200">
          <p className="font-bold text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Laporan Catatan/Kegagalan Ekstraksi Per Halaman ({pageErrors.length} Halaman):
          </p>
          <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-amber-300/90">
            {pageErrors.map((err, idx) => (
              <li key={idx}>
                <strong>Halaman {err.page}:</strong> {err.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {verification?.discrepanciesList && verification.discrepanciesList.length > 0 && showDetails && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-900/50 rounded-xl space-y-2 text-xs text-red-200">
          <p className="font-bold text-red-400">Daftar Peringatan Ketidakcocokan Matematis:</p>
          <ul className="list-disc list-inside space-y-1 font-mono">
            {verification.discrepanciesList.map((disc, idx) => (
              <li key={idx}>
                [{disc.noPeserta}] {disc.nama}: {disc.issue} (Hasil Hitung: {disc.expected}, Pada Dokumen: {disc.found})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
