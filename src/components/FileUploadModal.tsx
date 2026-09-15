import React, { useState } from 'react';
import { X, Upload, Building2, AlertTriangle } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { SSCASNParsedResult, InstansiItem } from '../types';

interface FileUploadModalProps {
  isOpen: boolean;
  targetInstansi: InstansiItem | null;
  onClose: () => void;
  onParsed: (parsedData: SSCASNParsedResult) => Promise<void> | void;
  onLoadSample: () => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  targetInstansi,
  onClose,
  onParsed,
  onLoadSample,
}) => {
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl my-8 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Upload & Ekstrak PDF SSCASN</span>
                {targetInstansi && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                    {targetInstansi.nama}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Pilih file PDF Hasil Integrasi SKD & SKB untuk diuraikan ke dalam database
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setModalError(null);
              onClose();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR BANNER IF SERVER/SUPABASE FAILS */}
        {modalError && (
          <div className="m-6 mb-0 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1">
              <span className="font-bold text-rose-200 block text-sm">Gagal Menyimpan ke Cloud & Supabase</span>
              <p className="leading-relaxed font-mono break-all text-[11px] bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/20 text-rose-200">
                {modalError}
              </p>
            </div>
          </div>
        )}

        {/* MODAL BODY CONTENT */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <FileUpload
            onParsed={async (data) => {
              setModalError(null);
              setIsSubmitting(true);
              try {
                await onParsed(data);
                onClose();
              } catch (err: any) {
                console.error('Error saving parsed data to database:', err);
                setModalError(err?.message || 'Gagal menyimpan hasil parsing ke database server & Supabase.');
              } finally {
                setIsSubmitting(false);
              }
            }}
            onLoadSample={() => {
              setModalError(null);
              onLoadSample();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
