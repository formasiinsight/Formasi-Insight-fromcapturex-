import React, { useState } from 'react';
import { Copy, Check, Download, FileSpreadsheet, Code, FileCode2, Maximize2, Minimize2 } from 'lucide-react';
import * as xlsx from 'xlsx';
import { SSCASNParsedResult } from '../types';
import { getFormasiHierarchyKuotas, getFormasiKuota } from '../utils/kuotaUtils';

interface JsonViewerProps {
  data: SSCASNParsedResult;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [isPretty, setIsPretty] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Clean JSON output containing all formasiList
  const jsonOutput = {
    meta: data.meta,
    totalFormasi: data.formasiList ? data.formasiList.length : 1,
    formasiList: (data.formasiList || [
      {
        id: 'formasi-1',
        header: data.header,
        pesertaList: data.pesertaList,
        verification: data.verification,
      },
    ]).map((f) => {
      const computedKuota = getFormasiKuota(f.header, f.pesertaList);
      const hierarchy = getFormasiHierarchyKuotas(f.header, f.pesertaList);

      return {
        id: f.id,
        header: {
          ...f.header,
          jumlahKuota: computedKuota,
          kuotaPendidikan: f.header.kuotaPendidikan && f.header.kuotaPendidikan > 0 ? f.header.kuotaPendidikan : computedKuota,
          kuotaJenisFormasi: f.header.kuotaJenisFormasi && f.header.kuotaJenisFormasi > 0 ? f.header.kuotaJenisFormasi : hierarchy.kuotaJen,
          kuotaLokasi: f.header.kuotaLokasi && f.header.kuotaLokasi > 0 ? f.header.kuotaLokasi : hierarchy.kuotaLok,
          kuotaJabatan: f.header.kuotaJabatan && f.header.kuotaJabatan > 0 ? f.header.kuotaJabatan : hierarchy.kuotaJab,
          kuotaInstansi: f.header.kuotaInstansi && f.header.kuotaInstansi > 0 ? f.header.kuotaInstansi : hierarchy.kuotaInst,
          kuotaPerTingkat: {
            pendidikanCount: f.header.kuotaPendidikan && f.header.kuotaPendidikan > 0 ? f.header.kuotaPendidikan : computedKuota,
            jenisCount: f.header.kuotaJenisFormasi && f.header.kuotaJenisFormasi > 0 ? f.header.kuotaJenisFormasi : hierarchy.kuotaJen,
            lokasiCount: hierarchy.kuotaLok,
            jabatanCount: hierarchy.kuotaJab,
            instansiCount: hierarchy.kuotaInst,
          },
        },
        pesertaList: (Array.isArray(f.pesertaList) ? f.pesertaList : []).map((p) => ({
          no: p.no,
          noPeserta: p.noPeserta,
          nama: p.nama,
          tanggalLahir: p.tanggalLahir,
          pendidikan: p.pendidikan,
          ipk: p.ipk,
          twk: p.twk,
          tiu: p.tiu,
          tkp: p.tkp,
          totalSkd: p.totalSkd,
          skorSkd: p.skorSkd,
          skb: p.skb,
          skorSkb: p.skorSkb,
          nilaiAkhir: p.nilaiAkhir,
          keterangan: p.keterangan,
        })),
        verification: {
          isValid: f.verification?.isValid ?? true,
          scoreAccuracyPercent: f.verification?.scoreAccuracyPercent ?? 100,
          totalRecords: f.verification?.totalRecords ?? (Array.isArray(f.pesertaList) ? f.pesertaList.length : 0),
          passedCount: f.verification?.passedCount ?? 0,
          failedCount: f.verification?.failedCount ?? 0,
        },
      };
    }),
  };

  const jsonString = isPretty
    ? JSON.stringify(jsonOutput, null, 2)
    : JSON.stringify(jsonOutput);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SSCASN_${data.header?.kodeInstansi || 'BKN'}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const wb = xlsx.utils.book_new();

    const formasiBlocks = data.formasiList && data.formasiList.length > 0
      ? data.formasiList
      : [{ id: 'formasi-1', header: data.header, pesertaList: data.pesertaList || [], verification: data.verification }];

    // 1. Ringkasan Semua Formasi
    const summaryRows = formasiBlocks.map((f, i) => ({
      'No Formasi': i + 1,
      'Jabatan Formasi': f.header?.jabatanFormasi || f.header?.namaJabatan || '-',
      'Lokasi Formasi': f.header?.lokasiFormasi || '-',
      'Jenis Formasi': f.header?.jenisFormasi || '-',
      'Pendidikan': f.header?.pendidikan || '-',
      'Jumlah Kuota': f.header?.jumlahKuota || 0,
      'Jumlah Peserta': f.pesertaList?.length || 0,
      'Jumlah Lulus (P/L)': f.verification?.passedCount || 0,
    }));
    const wsSummary = xlsx.utils.json_to_sheet(summaryRows);
    xlsx.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Formasi');

    // 2. Individual Sheet per Formasi
    formasiBlocks.forEach((f, idx) => {
      const sheetName = `Formasi ${idx + 1}`.slice(0, 31);
      const pList = Array.isArray(f.pesertaList) ? f.pesertaList : [];
      const pesertaRows = pList.map((p) => ({
        'No': p.no,
        'No Peserta': p.noPeserta,
        'Nama Peserta': p.nama,
        'Tanggal Lahir': p.tanggalLahir,
        'Pendidikan': p.pendidikan,
        'IPK': p.ipk,
        'TWK': p.twk,
        'TIU': p.tiu,
        'TKP': p.tkp,
        'Total SKD': p.totalSkd,
        'Skor SKD (40%)': p.skorSkd,
        'SKB': p.skb,
        'Skor SKB (60%)': p.skorSkb,
        'Nilai Akhir': p.nilaiAkhir,
        'Keterangan': p.keterangan,
      }));
      const ws = xlsx.utils.json_to_sheet(pesertaRows);
      xlsx.utils.book_append_sheet(wb, ws, sheetName);
    });

    xlsx.writeFile(wb, `SSCASN_Excel_${data.header?.kodeInstansi || 'Export'}_MultiFormasi.xlsx`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl mb-8">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2">
          <Code className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold">Hasil JSON Dokumen SSCASN</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
            JSON Standard
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPretty(!isPretty)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
            {isPretty ? 'Compact' : 'Prettify'}
          </button>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin!' : 'Salin JSON'}
          </button>

          <button
            onClick={handleDownloadJson}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Unduh .json
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Ekspor Excel (.xlsx)
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Kecilkan Tampilan' : 'Perbesar Tampilan'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Code Editor Container */}
      <div className={`relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden ${isExpanded ? 'h-[700px]' : 'h-96'}`}>
        <textarea
          readOnly
          value={jsonString}
          className="w-full h-full p-4 font-mono text-xs text-emerald-400 bg-transparent resize-none focus:outline-none scrollbar-thin scrollbar-thumb-slate-800"
        />
      </div>
    </div>
  );
};
