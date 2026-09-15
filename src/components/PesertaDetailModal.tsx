import React, { useState, useEffect } from 'react';
import { X, GraduationCap, MapPin, Users, Award, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { SSCASNFormasiBlock, SSCASNPeserta } from '../types';
import { PesertaTable } from './PesertaTable';
import { VerificationBadge } from './VerificationBadge';
import { calculateVerification } from '../utils/sampleData';
import { getFormasiKuota } from '../utils/kuotaUtils';
import { cleanPendidikanString } from '../utils/jenisFormasiUtils';
import { fetchPesertaByFormasiAsync } from '../utils/instansiStorage';
import { LokasiDisplay } from './LokasiDisplay';

interface PesertaDetailModalProps {
  formasi: SSCASNFormasiBlock | null;
  instansiNama: string;
  instansiId?: string;
  onClose: () => void;
  onUpdatePesertaList: (updatedBlock: SSCASNFormasiBlock) => void;
}

export const PesertaDetailModal: React.FC<PesertaDetailModalProps> = ({
  formasi,
  instansiNama,
  instansiId,
  onClose,
  onUpdatePesertaList,
}) => {
  if (!formasi) return null;

  const header = formasi.header || ({} as any);
  const initialList = Array.isArray(formasi.pesertaList) ? formasi.pesertaList : [];
  
  // Resolve actual instansi ID
  const resolvedInstansiId = React.useMemo(() => {
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

  useEffect(() => {
    let isCancelled = false;

    if (initialList.length > 0) {
      setActivePesertaList(initialList);
      setIsLoadingPeserta(false);
      return;
    }

    // Fetch peserta on-demand directly from Supabase / cache / API
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

  const verification = calculateVerification(activePesertaList);
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
    downloadAnchor.setAttribute('download', `SSCASN_${header.kodeJabatan || 'Formasi'}_Peserta.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {instansiNama}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                KUOTA FORMASI: {kuotaFormasi}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PESERTA: {activePesertaList.length}
              </span>
              {kuotaFormasi > activePesertaList.length && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {kuotaFormasi - activePesertaList.length} SLOT KOSONG / BELUM TERISI
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-white">{header.jabatanFormasi}</h3>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <div>
                <LokasiDisplay
                  lokasiRaw={header.lokasiFormasi}
                  kodeLokasi={header.kodeLokasi}
                  namaLokasi={header.namaLokasi}
                  pendidikan={header.pendidikan}
                />
              </div>
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                {cleanPendidikanString(header.pendidikan)}
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                {header.jenisFormasi}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportFormasiJson}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Download JSON Formasi ini"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingPeserta ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Memuat rincian peserta dari database...</p>
            </div>
          ) : (
            <>
              {/* Audit Verification Badge */}
              <VerificationBadge
                verification={verification}
                pesertaList={activePesertaList}
                onAutoRepair={handleUpdatePeserta}
              />

              {/* Interactive Peserta Table */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                  <span>Daftar Peserta Integrasi SKD & SKB ({activePesertaList.length} Peserta)</span>
                  <span className="text-xs text-slate-400 font-normal">
                    Urutan berdasarkan Nilai Akhir Integrasi
                  </span>
                </h4>

                <PesertaTable
                  pesertaList={activePesertaList}
                  onUpdatePesertaList={handleUpdatePeserta}
                />
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>SSCASN BKN 100% Accurate Parser &bull; Multi-Formasi Integrated</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 cursor-pointer"
          >
            Tutup Modal
          </button>
        </div>
      </div>
    </div>
  );
};
