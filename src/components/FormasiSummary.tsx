import React, { useState } from 'react';
import { Building2, Briefcase, MapPin, Layers, GraduationCap, Copy, Check, Info } from 'lucide-react';
import { SSCASNHeader } from '../types';
import { getFormasiHierarchyKuotas } from '../utils/kuotaUtils';
import { cleanPendidikanString } from '../utils/jenisFormasiUtils';
import { LokasiDisplay } from './LokasiDisplay';

interface FormasiSummaryProps {
  header: SSCASNHeader;
}

export const FormasiSummary: React.FC<FormasiSummaryProps> = ({ header }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const { kuotaPen, kuotaJen, kuotaLok, kuotaJab, kuotaInst } = getFormasiHierarchyKuotas(header);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mb-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Hasil Integrasi SKD & SKB Pengadaan CPNS
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rincian header formasi & alokasi kuota berjenjang (Jabatan, Lokasi, Jenis Formasi, dan Pendidikan)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <Info className="w-3.5 h-3.5 text-indigo-500" />
          <span>1 Formasi Unik = Jabatan + Lokasi + Pendidikan</span>
        </div>
      </div>

      {/* BKN HEADER LAYOUT BOX */}
      <div className="space-y-3 font-sans">
        {/* INSTANSI */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Instansi</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{header.instansi || '-'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-slate-200 dark:border-slate-800 pt-2 md:pt-0">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-medium block">Total Kuota Instansi</span>
              <span className="text-sm font-extrabold font-mono text-slate-700 dark:text-slate-300">{kuotaInst}</span>
            </div>
            <button
              onClick={() => handleCopy(header.instansi, 'instansi')}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              {copiedField === 'instansi' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* JABATAN FORMASI (BOX MERAH ACCENT) */}
        <div className="bg-rose-500/5 border-2 border-rose-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0 font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400 tracking-wider flex items-center gap-1">
                <span>Jabatan Formasi</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300">Level Jabatan</span>
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{header.jabatanFormasi || '-'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-rose-500/20 pt-2 md:pt-0">
            <div className="text-right">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">Kuota Jabatan</span>
              <span className="text-base font-black font-mono text-rose-600 dark:text-rose-300">{kuotaJab}</span>
            </div>
            <button
              onClick={() => handleCopy(header.jabatanFormasi, 'jabatan')}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg hover:bg-rose-500/10"
            >
              {copiedField === 'jabatan' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* LOKASI FORMASI (BOX OREN ACCENT) */}
        <div className="bg-amber-500/5 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                <span>Lokasi Formasi</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">Level Lokasi</span>
              </span>
              <div className="mt-0.5">
                <LokasiDisplay
                  lokasiRaw={header.lokasiFormasi}
                  kodeLokasi={header.kodeLokasi}
                  namaLokasi={header.namaLokasi}
                  pendidikan={header.pendidikan}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-amber-500/20 pt-2 md:pt-0">
            <div className="text-right">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">Kuota Lokasi</span>
              <span className="text-base font-black font-mono text-amber-600 dark:text-amber-300">{kuotaLok}</span>
            </div>
            <button
              onClick={() => handleCopy(header.lokasiFormasi, 'lokasi')}
              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 rounded-lg hover:bg-amber-500/10"
            >
              {copiedField === 'lokasi' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* JENIS FORMASI (BOX HIJAU ACCENT) */}
        <div className="bg-emerald-500/5 border-2 border-emerald-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                <span>Jenis Formasi</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">Level Jenis</span>
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{header.jenisFormasi || '-'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-emerald-500/20 pt-2 md:pt-0">
            <div className="text-right">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Kuota Jenis Formasi</span>
              <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-300">{kuotaJen}</span>
            </div>
            <button
              onClick={() => handleCopy(header.jenisFormasi, 'jenis')}
              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10"
            >
              {copiedField === 'jenis' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* PENDIDIKAN (BOX BIRU ACCENT) */}
        <div className="bg-blue-500/10 border-2 border-blue-500/50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-500 flex items-center justify-center shrink-0 font-bold">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1">
                <span>Pendidikan Formasi</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-600 dark:text-blue-300">Kuota Lolos P/L</span>
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">{cleanPendidikanString(header.pendidikan) || '-'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-blue-500/20 pt-2 md:pt-0">
            <div className="text-right">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block">Kuota Formasi (P/L)</span>
              <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-300">{kuotaPen}</span>
            </div>
            <button
              onClick={() => handleCopy(cleanPendidikanString(header.pendidikan), 'pendidikan')}
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 rounded-lg hover:bg-blue-500/10"
            >
              {copiedField === 'pendidikan' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

