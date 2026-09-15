import React from 'react';
import { FileText, Cpu, CheckCircle2, ShieldCheck, RefreshCw, Sparkles } from 'lucide-react';

interface HeaderProps {
  onLoadSample: () => void;
  onReset: () => void;
  hasData: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onLoadSample, onReset, hasData }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white py-6 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Hasil Seleksi CPNS
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Akurasi 100% Verified
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Pengurai Otomatis Dokumen Laporan Hasil Integrasi SKD & SKB BKN (CPNS / PPPK) ke Format JSON Standar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLoadSample}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 mr-2 text-amber-400" />
            Contoh SSCASN 2024
          </button>

          {hasData && (
            <button
              onClick={onReset}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset Parser
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
