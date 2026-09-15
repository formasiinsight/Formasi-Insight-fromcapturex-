import React from 'react';
import { X, Code } from 'lucide-react';
import { JsonViewer } from './JsonViewer';
import { SSCASNParsedResult } from '../types';

interface JsonViewerModalProps {
  isOpen: boolean;
  data: SSCASNParsedResult | null;
  onClose: () => void;
}

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({
  isOpen,
  data,
  onClose,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Inspeksi Hasil Ekstraksi JSON
              </h3>
              <p className="text-xs text-slate-400">
                Struktur JSON terenkapsulasi untuk integrasi sistem & analisis data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <JsonViewer data={data} />
        </div>
      </div>
    </div>
  );
};
