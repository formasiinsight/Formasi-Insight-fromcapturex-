import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  X,
  Building2,
  Upload,
  FileText,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Search,
  Check,
  Eye,
  RotateCcw,
  RefreshCw,
  ListChecks,
  Sliders,
  Split,
  FileUp,
  Award,
  Users,
  Briefcase,
  Play,
  Pause,
  AlertTriangle,
} from 'lucide-react';
import { InstansiItem, InstansiKategori, SSCASNParsedResult, SSCASNFormasiBlock } from '../types';
import { calculateVerification, SAMPLE_SSCASN_DATA } from '../utils/sampleData';
import { getFormasiKuota } from '../utils/kuotaUtils';
import { JurusanListDisplay } from './JurusanListDisplay';
import { LokasiDisplay } from './LokasiDisplay';

interface FormasiWizardModalProps {
  isOpen: boolean;
  initialItem?: InstansiItem | null;
  existingInstansiList?: InstansiItem[];
  onClose: () => void;
  onComplete: (instansiData: {
    nama: string;
    kode: string;
    kategori: InstansiKategori;
    provinsi?: string;
    tahun: string;
    notes?: string;
    parsedData?: SSCASNParsedResult;
    pdfFileName?: string;
  }) => Promise<void> | void;
}

export interface PDFChunk {
  id: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  formasiCount: number;
  pesertaCount: number;
  errorMessage?: string;
}

export const FormasiWizardModal: React.FC<FormasiWizardModalProps> = ({
  isOpen,
  initialItem,
  existingInstansiList = [],
  onClose,
  onComplete,
}) => {
  // Wizard Active Step: 1 = Instansi Detail, 2 = Upload PDF & Split, 3 = Preview & Konfirmasi
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Instansi Details State
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [kategori, setKategori] = useState<InstansiKategori>('kementerian');
  const [provinsi, setProvinsi] = useState('');
  const [tahun, setTahun] = useState('2024');
  const [notes, setNotes] = useState('');
  const [step1Error, setStep1Error] = useState('');

  // STEP 2: Upload & Split PDF State
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [step2Error, setStep2Error] = useState<string | null>(null);

  const [currentFileName, setCurrentFileName] = useState('');
  const [totalDocPages, setTotalDocPages] = useState(0);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [chunkSize, setChunkSize] = useState<number>(100);
  const [chunks, setChunks] = useState<PDFChunk[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [activeChunkId, setActiveChunkId] = useState<number | null>(null);

  // Extracted Result Data
  const [detectedFormasis, setDetectedFormasis] = useState<SSCASNFormasiBlock[]>([]);
  const [finalResultReady, setFinalResultReady] = useState<SSCASNParsedResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs for PDF buffer & sequential continuity
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfArrayBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfDocRef = useRef<PDFDocument | null>(null);
  const lastHeaderRef = useRef<any>(null);

  // Initialize or reset on open
  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setNama(initialItem.nama || '');
        setKode(initialItem.kode || '');
        setKategori(initialItem.kategori || 'kementerian');
        setProvinsi(initialItem.provinsi || '');
        setTahun(initialItem.tahun || '2024');
        setNotes(initialItem.notes || '');

        if (initialItem.parsedData && (initialItem.parsedData.formasiList?.length ?? 0) > 0) {
          setDetectedFormasis(initialItem.parsedData.formasiList || []);
          setFinalResultReady(initialItem.parsedData);
          setCurrentFileName(initialItem.pdfFileName || initialItem.parsedData.meta?.fileName || 'Dokumen_SSCASN.pdf');
        } else {
          setDetectedFormasis([]);
          setFinalResultReady(null);
          setCurrentFileName('');
        }
      } else {
        setNama('');
        setKode('');
        setKategori('kementerian');
        setProvinsi('');
        setTahun('2024');
        setNotes('');
        setDetectedFormasis([]);
        setFinalResultReady(null);
        setCurrentFileName('');
      }
      setCurrentStep(1);
      setStep1Error('');
      setStep2Error(null);
      setSaveError(null);
      setIsLoading(false);
      setIsSplitMode(false);
      setChunks([]);
      setIsQueueRunning(false);
      setActiveChunkId(null);
      pdfArrayBufferRef.current = null;
      pdfDocRef.current = null;
      lastHeaderRef.current = null;
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  // STEP 1 VALIDATION & PROCEED
  const validateStep1 = (): boolean => {
    const trimmedNama = nama.trim();
    const trimmedKode = kode.trim();

    if (!trimmedNama || !trimmedKode) {
      setStep1Error('Nama instansi dan Kode instansi wajib diisi sebelum lanjut.');
      return false;
    }

    // Validasi 1: Nama instansi dan Kode instansi tidak boleh sama persis
    if (trimmedNama.toLowerCase() === trimmedKode.toLowerCase()) {
      setStep1Error('Nama instansi dan Kode instansi tidak boleh sama. Masukkan nama instansi yang valid dan kode instansi BKN.');
      return false;
    }

    const cleanNama = trimmedNama.toLowerCase();
    const cleanKode = trimmedKode.toLowerCase();

    // Validasi 2: Cek apakah nama atau kode sudah terdaftar pada instansi lain
    if (existingInstansiList && existingInstansiList.length > 0) {
      const duplicateNama = existingInstansiList.find(
        (item) => item.id !== initialItem?.id && (item.nama || '').trim().toLowerCase() === cleanNama
      );
      if (duplicateNama) {
        setStep1Error(`Nama instansi "${trimmedNama}" sudah terdaftar di sistem. Nama instansi tidak boleh sama.`);
        return false;
      }

      const duplicateKode = existingInstansiList.find(
        (item) => item.id !== initialItem?.id && (item.kode || '').trim().toLowerCase() === cleanKode
      );
      if (duplicateKode) {
        setStep1Error(`Kode instansi "${trimmedKode}" sudah digunakan oleh "${duplicateKode.nama}". Kode instansi tidak boleh sama.`);
        return false;
      }
    }

    setStep1Error('');
    return true;
  };

  const handleNextFromStep1 = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateStep1()) {
      return;
    }
    setCurrentStep(2);
  };

  // Helper safe fetch JSON
  const safeFetchJson = async (url: string, options: RequestInit) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const errJson = await res.json();
        throw new Error(errJson.error || `Server error (${res.status})`);
      } else {
        throw new Error(`Koneksi server gagal (${res.status}). Payload mungkin terlalu besar.`);
      }
    }
    if (!contentType.includes('application/json')) {
      throw new Error('Respons server tidak valid.');
    }
    return await res.json();
  };

  // Helper to merge formasi blocks with deduplication (exact logic as FileUpload)
  const mergeFormasis = (
    existingList: SSCASNFormasiBlock[],
    newFormasis: SSCASNFormasiBlock[]
  ): SSCASNFormasiBlock[] => {
    const updated = [...existingList];

    const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const extractFullJobCode = (text: string): string => {
      if (!text) return '';
      const m = text.match(/\b((?:JF|JP|[A-Z]{2,})\d+(?:\s*-\s*\d+)?)\b/i);
      return m ? m[1].replace(/\s+/g, '').toUpperCase() : '';
    };

    const areJobsEqual = (j1: string, j2: string): boolean => {
      if (!j1 || !j2) return false;
      const n1 = norm(j1);
      const n2 = norm(j2);
      if (n1 === n2) return true;
      const c1 = extractFullJobCode(j1);
      const c2 = extractFullJobCode(j2);
      if (c1 && c2 && c1 !== c2) return false;
      const t1 = n1.replace(/^(?:jf|jp|[a-z0-9]{3,15})\d*(?:[\s-]+\d+)?\s*/i, '').trim();
      const t2 = n2.replace(/^(?:jf|jp|[a-z0-9]{3,15})\d*(?:[\s-]+\d+)?\s*/i, '').trim();
      return t1 === t2;
    };

    const getHeaderKey = (h: any) => {
      if (!h) return '';
      const inst = norm(h.instansi || h.namaInstansi);
      const jab = norm(h.jabatanFormasi || h.namaJabatan);
      const lok = norm(h.lokasiFormasi || h.namaLokasi);
      const jen = norm(h.jenisFormasi || h.namaJenisFormasi);
      const pen = norm(h.pendidikan);
      return `${inst}|${jab}|${lok}|${jen}|${pen}`;
    };

    const mapIndex = new Map<string, number>();
    updated.forEach((item, idx) => {
      mapIndex.set(getHeaderKey(item.header), idx);
    });

    const isSameFormasiHeader = (h1: any, h2: any) => {
      if (!h1 || !h2) return false;
      const inst1 = norm(h1.instansi || h1.namaInstansi);
      const inst2 = norm(h2.instansi || h2.namaInstansi);
      const isInst = (!inst1 || !inst2 || inst1 === 'sscasn bkn' || inst2 === 'sscasn bkn') ? true : inst1 === inst2;

      const jab1 = h1.jabatanFormasi || h1.namaJabatan || '';
      const jab2 = h2.jabatanFormasi || h2.namaJabatan || '';
      const isJab = (!jab1 || !jab2) ? true : areJobsEqual(jab1, jab2);

      const lok1 = norm(h1.lokasiFormasi || h1.namaLokasi);
      const lok2 = norm(h2.lokasiFormasi || h2.namaLokasi);
      const isLok = (!lok1 || !lok2) ? true : lok1 === lok2;

      const jen1 = norm(h1.jenisFormasi || h1.namaJenisFormasi);
      const jen2 = norm(h2.jenisFormasi || h2.namaJenisFormasi);
      const kJen1 = h1.kodeJenisFormasi || jen1.match(/^(\d+)/)?.[1] || jen1;
      const kJen2 = h2.kodeJenisFormasi || jen2.match(/^(\d+)/)?.[1] || jen2;
      const isJen = (!jen1 || !jen2) ? true : (kJen1 === kJen2 || jen1 === jen2);

      const pen1 = norm(h1.pendidikan);
      const pen2 = norm(h2.pendidikan);
      const isPen = (!pen1 || pen1 === '-' || !pen2 || pen2 === '-')
        ? true
        : pen1 === pen2;

      return isInst && isJab && isLok && isJen && isPen;
    };

    for (const newBlock of newFormasis) {
      const key = getHeaderKey(newBlock.header);
      let existingIdx = mapIndex.has(key) ? mapIndex.get(key)! : -1;

      if (existingIdx === -1) {
        existingIdx = updated.findIndex((f) => isSameFormasiHeader(f.header, newBlock.header));
      }

      if (existingIdx !== -1 && existingIdx < updated.length) {
        const existing = updated[existingIdx];
        const existingPeserta = Array.isArray(existing.pesertaList) ? existing.pesertaList : [];
        const newPeserta = Array.isArray(newBlock.pesertaList) ? newBlock.pesertaList : [];
        const existingNos = new Set(existingPeserta.map((p) => p.noPeserta));
        const freshPeserta = newPeserta.filter(
          (p) => !p.noPeserta || !existingNos.has(p.noPeserta)
        );
        const mergedPeserta = [...existingPeserta, ...freshPeserta];
        mergedPeserta.forEach((p, idx) => {
          p.no = idx + 1;
        });

        const bestPendidikan = (newBlock.header?.pendidikan && newBlock.header.pendidikan !== '-' &&
          newBlock.header.pendidikan.length > (existing.header?.pendidikan || '').length)
          ? newBlock.header.pendidikan
          : existing.header?.pendidikan;

        const bestKuota = (newBlock.header?.jumlahKuota && newBlock.header.jumlahKuota > 0)
          ? newBlock.header.jumlahKuota
          : existing.header?.jumlahKuota;

        updated[existingIdx] = {
          ...existing,
          header: {
            ...existing.header,
            ...newBlock.header,
            pendidikan: bestPendidikan,
            jumlahKuota: bestKuota,
          },
          pesertaList: mergedPeserta,
          verification: calculateVerification(mergedPeserta),
        };
      } else {
        const newIdx = updated.length;
        const freshPeserta = Array.isArray(newBlock.pesertaList) ? newBlock.pesertaList : [];
        const freshBlock = {
          ...newBlock,
          id: `formasi-${newIdx + 1}`,
          pesertaList: freshPeserta,
        };
        freshBlock.pesertaList.forEach((p, idx) => {
          p.no = idx + 1;
        });
        updated.push(freshBlock);
        mapIndex.set(getHeaderKey(newBlock.header), newIdx);
      }
    }

    return updated;
  };

  // Initialize PDF chunks based on default 100 pages chunk size
  const createChunksList = (totalPages: number, size: number = 100): PDFChunk[] => {
    const list: PDFChunk[] = [];
    const count = Math.ceil(totalPages / size);
    for (let i = 0; i < count; i++) {
      const start = i * size + 1;
      const end = Math.min((i + 1) * size, totalPages);
      list.push({
        id: i + 1,
        startPage: start,
        endPage: end,
        status: 'pending',
        formasiCount: 0,
        pesertaCount: 0,
      });
    }
    return list;
  };

  // Handle PDF file selection & Chunk Creation
  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setStep2Error('Format file harus PDF hasil integrasi SSCASN.');
      return;
    }

    setStep2Error(null);
    setIsLoading(true);
    setLoadingStep('Membaca struktur halaman PDF...');
    setCurrentFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfArrayBufferRef.current = arrayBuffer;

      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        pdfDocRef.current = pdfDoc;
      } catch (pdfErr: any) {
        console.error('pdf-lib load error:', pdfErr);
        throw new Error('Gagal membaca dokumen PDF. Pastikan file tidak rusak atau terenkripsi password.');
      }

      const numPages = pdfDoc.getPageCount();
      setTotalDocPages(numPages);

      // Default to 100 pages per chunk (e.g. <=100 pages = 1 chunk, >100 pages = per 100 pages)
      setIsSplitMode(true);
      const initialChunks = createChunksList(numPages, 100);
      setChunks(initialChunks);
      setDetectedFormasis([]);
      setFinalResultReady(null);
      lastHeaderRef.current = null;
      setIsLoading(false);
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setStep2Error(err.message || 'Gagal memproses file PDF.');
      setIsLoading(false);
    }
  };

  // Process single PDF chunk via API
  const processChunk = async (chunkId: number): Promise<boolean> => {
    const targetChunk = chunks.find((c) => c.id === chunkId);
    if (!targetChunk) return false;

    setChunks((prev) =>
      prev.map((c) => (c.id === chunkId ? { ...c, status: 'processing', errorMessage: undefined } : c))
    );
    setActiveChunkId(chunkId);

    try {
      let subPdfBase64 = '';
      if (pdfDocRef.current || pdfArrayBufferRef.current) {
        const sourcePdf =
          pdfDocRef.current || (await PDFDocument.load(pdfArrayBufferRef.current!, { ignoreEncryption: true }));
        pdfDocRef.current = sourcePdf;

        const subDoc = await PDFDocument.create();
        const pageIndices: number[] = [];
        for (let p = targetChunk.startPage - 1; p < targetChunk.endPage && p < sourcePdf.getPageCount(); p++) {
          pageIndices.push(p);
        }

        const copiedPages = await subDoc.copyPages(sourcePdf, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));
        subPdfBase64 = await subDoc.saveAsBase64();
      } else if (fileBase64) {
        subPdfBase64 = fileBase64;
      } else {
        throw new Error('Data PDF tidak ditemukan di memori.');
      }

      const result = await safeFetchJson('/api/parse-sscasn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: subPdfBase64,
          fileName: `${currentFileName}_batch_${chunkId}.pdf`,
          mimeType: 'application/pdf',
          startPage: 1,
          endPage: targetChunk.endPage - targetChunk.startPage + 1,
          initialHeader: lastHeaderRef.current || undefined,
        }),
      });

      const data: SSCASNParsedResult = result.data;
      if (data.lastHeader) {
        lastHeaderRef.current = data.lastHeader;
      } else if (data.formasiList && data.formasiList.length > 0) {
        lastHeaderRef.current = data.formasiList[data.formasiList.length - 1].header;
      }

      const batchFormasis = data.formasiList || [];
      const batchPesertaCount = batchFormasis.reduce(
        (sum, f) => sum + (f.pesertaList?.length || 0),
        0
      );

      setDetectedFormasis((prev) => {
        if (batchFormasis.length > 0) {
          return mergeFormasis(prev, batchFormasis);
        } else if (data.pesertaList && data.pesertaList.length > 0) {
          const dummyBlock: SSCASNFormasiBlock = {
            id: `formasi-${prev.length + 1}`,
            header: data.header,
            pesertaList: data.pesertaList,
            verification: calculateVerification(data.pesertaList),
          };
          return mergeFormasis(prev, [dummyBlock]);
        }
        return prev;
      });

      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunkId
            ? {
                ...c,
                status: 'completed',
                formasiCount: batchFormasis.length,
                pesertaCount: batchPesertaCount,
              }
            : c
        )
      );
      return true;
    } catch (err: any) {
      console.error(`Error chunk ${chunkId}:`, err);
      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunkId ? { ...c, status: 'error', errorMessage: err.message || 'Gagal memproses batch' } : c
        )
      );
      return false;
    } finally {
      setActiveChunkId(null);
    }
  };

  // Run all chunks sequentially
  const handleProcessAllChunks = async () => {
    setIsQueueRunning(true);
    for (const chunk of chunks) {
      if (chunk.status === 'completed') continue;
      const success = await processChunk(chunk.id);
      if (!success) {
        // Pause on error to let user inspect
        break;
      }
    }
    setIsQueueRunning(false);
  };

  // Load sample dataset
  const handleLoadSample = () => {
    setDetectedFormasis(SAMPLE_SSCASN_DATA.formasiList);
    setFinalResultReady(SAMPLE_SSCASN_DATA);
    setCurrentFileName('SAMPLE_HASIL_INTEGRASI_CPNS_2024.pdf');
    setCurrentStep(3);
  };

  // Final confirmation to Step 3
  const handleProceedToPreview = () => {
    if (detectedFormasis.length === 0) {
      setStep2Error('Belum ada formasi yang diekstrak. Silakan jalankan proses parsing PDF terlebih dahulu.');
      return;
    }

    const allPeserta = detectedFormasis.flatMap((f) => f.pesertaList || []);
    const aggregatedResult: SSCASNParsedResult = {
      meta: {
        docTitle: `PANITIA SELEKSI NASIONAL PENGADAAN CASN - ${nama.toUpperCase()}`,
        tahun: tahun || '2024',
        parsedAt: new Date().toISOString(),
        sourceType: 'pdf',
        fileName: currentFileName || `${nama.replace(/\s+/g, '_')}_2024.pdf`,
        totalPages: totalDocPages || 1,
        totalFormasiCount: detectedFormasis.length,
        totalPesertaCount: allPeserta.length,
      },
      header: detectedFormasis[0]?.header || {
        instansi: `${kode} - ${nama}`,
        jabatanFormasi: `${detectedFormasis.length} Formasi Terdeteksi`,
        lokasiFormasi: 'Lokasi Instansi',
        jenisFormasi: '1 - UMUM',
        pendidikan: '-',
        jumlahKuota: 1,
      },
      pesertaList: allPeserta,
      formasiList: detectedFormasis,
      verification: calculateVerification(allPeserta),
    };

    setFinalResultReady(aggregatedResult);
    setStep2Error(null);
    setCurrentStep(3);
  };

  // Final Complete Handler
  const handleFinalSave = async () => {
    setIsSubmitting(true);
    setSaveError(null);
    try {
      await onComplete({
        nama: nama.trim(),
        kode: kode.trim(),
        kategori,
        provinsi: provinsi.trim() || undefined,
        tahun: tahun.trim() || '2024',
        notes: notes.trim() || undefined,
        parsedData: finalResultReady || undefined,
        pdfFileName: currentFileName || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving in wizard:', err);
      const errMsg = err?.message || 'Terjadi kesalahan saat menyimpan data ke server & Supabase Cloud.';
      setSaveError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics for Preview
  const totalExtractedPeserta = detectedFormasis.reduce(
    (acc, f) => acc + (f.pesertaList?.length || f.pesertaCount || 0),
    0
  );
  const totalExtractedKuota = detectedFormasis.reduce(
    (acc, f) => acc + getFormasiKuota(f.header, f.pesertaList || []),
    0
  );
  const completedChunksCount = chunks.filter((c) => c.status === 'completed').length;

  const filteredPreviewFormasi = detectedFormasis.filter((f) => {
    if (!previewFilter.trim()) return true;
    const q = previewFilter.toLowerCase();
    const jab = (f.header?.namaJabatan || f.header?.jabatanFormasi || '').toLowerCase();
    const pen = (f.header?.pendidikan || '').toLowerCase();
    const lok = (f.header?.namaLokasi || f.header?.lokasiFormasi || '').toLowerCase();
    return jab.includes(q) || pen.includes(q) || lok.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl 2xl:max-w-7xl my-auto rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white max-h-[92vh]">
        
        {/* ========================================================================= */}
        {/* WIZARD HEADER & 3-STEP PROGRESS STEPPER */}
        {/* ========================================================================= */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Tambah / Integrasi Formasi Instansi</span>
                  {nama && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                      {nama}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Alur 3 langkah terpadu: Detail Instansi &rarr; Ekstraksi PDF & Split &rarr; Pratinjau & Simpan
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700/80 transition-all cursor-pointer"
              title="Tutup Wizard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Navigation */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-1">
            {/* Step 1 Tab */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                currentStep === 1
                  ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                  currentStep === 1
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : nama
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {nama ? <Check className="w-3.5 h-3.5" /> : '1'}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate leading-tight">Step 1: Instansi Detail</div>
                <div className="text-[10px] text-slate-400 truncate">Nama, kode, wilayah</div>
              </div>
            </button>

            {/* Step 2 Tab */}
            <button
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                currentStep === 2
                  ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                  currentStep === 2
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : detectedFormasis.length > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {detectedFormasis.length > 0 ? <Check className="w-3.5 h-3.5" /> : '2'}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate leading-tight">Step 2: Upload & Split PDF</div>
                <div className="text-[10px] text-slate-400 truncate">Ekstraksi halaman PDF</div>
              </div>
            </button>

            {/* Step 3 Tab */}
            <button
              onClick={() => {
                if (detectedFormasis.length > 0) handleProceedToPreview();
              }}
              className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                currentStep === 3
                  ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                  currentStep === 3
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : finalResultReady
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate leading-tight">Step 3: Preview</div>
                <div className="text-[10px] text-slate-400 truncate">Tabel & verifikasi data</div>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY CONTAINER (PER ACTIVE STEP) */}
        {/* ========================================================================= */}
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-180px)] space-y-6">

          {/* CRITICAL SAVE / SUPABASE DATABASE ERROR BANNER */}
          {saveError && (
            <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500/80 text-rose-100 flex items-start gap-3.5 shadow-xl shadow-rose-950/60 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Pemberitahuan Error Supabase Cloud / Database
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    DB Error
                  </span>
                </div>
                <p className="font-mono text-xs text-rose-200 bg-black/50 p-3 rounded-xl border border-white/10 break-words leading-relaxed select-text">
                  {saveError}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFinalSave}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mencoba lagi...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Simpan Lagi</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveError(null)}
                    className="text-xs text-rose-300/80 hover:text-white underline cursor-pointer"
                  >
                    Tutup pesan error
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-rose-300/60 hover:text-white transition-colors shrink-0"
                title="Tutup Pesan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* STEP 1: INSTANSI DETAIL FORM */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Building2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-200 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">Langkah 1: Identitas & Metadata Instansi</span>
                  Masukkan identitas instansi CPNS yang akan ditambahkan atau diperbarui. Pastikan kode BKN terisi sesuai kode resmi agar memudahkan pencarian formasi.
                </div>
              </div>

              {step1Error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{step1Error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Instansi */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Nama Instansi</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => {
                      setNama(e.target.value);
                      if (step1Error) setStep1Error('');
                    }}
                    placeholder="Contoh: Kementerian Kesehatan, Pemkab Banyuwangi"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Kode BKN */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Kode Instansi (BKN)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={kode}
                    onChange={(e) => {
                      setKode(e.target.value);
                      if (step1Error) setStep1Error('');
                    }}
                    placeholder="Contoh: 4001, 6511"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Kategori */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Kategori Wilayah / Lembaga
                  </label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value as InstansiKategori)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="kementerian">Kementerian</option>
                    <option value="lembaga">Lembaga Negara / Non-Kementerian</option>
                    <option value="pemprov">Pemerintah Provinsi (Pemprov)</option>
                    <option value="pemkab_pemkot">Pemerintah Kab / Kota (Pemda)</option>
                  </select>
                </div>

                {/* Tahun Pengadaan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Tahun Seleksi CASN
                  </label>
                  <input
                    type="text"
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    placeholder="2024"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Catatan Tambahan */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Catatan Formasi (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan tambahan mengenai berkas atau formasi..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* STEP 2: UPLOAD PDF & SPLIT CHUNKS */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {step2Error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{step2Error}</span>
                </div>
              )}

              {/* IF NO FILE CHOSEN YET OR ONLY INITIAL STEP */}
              {chunks.length === 0 && !isLoading && (
                <>
                  <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <FileUp className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-200 leading-relaxed">
                      <span className="font-bold text-white block mb-0.5">Langkah 2: Upload & Ekstraksi PDF Hasil Integrasi SKD & SKB</span>
                      Upload dokumen PDF pengumuman resmi CASN. Dokumen akan diproses otomatis secara stabil per 100 halaman per batch.
                    </div>
                  </div>

                  {/* Drag & Drop Upload Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
                        : 'border-slate-800 bg-slate-950/50 hover:bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                      accept=".pdf,application/pdf"
                      className="hidden"
                    />

                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg">
                      <Upload className="w-7 h-7" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">
                        Klik untuk memilih file PDF atau tarik & letakkan di sini
                      </p>
                      <p className="text-xs text-slate-400">
                        Mendukung file PDF pengumuman resmi SSCASN BKN (Kementerian, Lembaga, atau Pemda)
                      </p>
                    </div>

                    {currentFileName && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-indigo-300">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{currentFileName}</span>
                        {totalDocPages > 0 && <span>({totalDocPages} Halaman)</span>}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Loading indicator during initial read */}
              {isLoading && (
                <div className="p-8 bg-slate-950/60 border border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-sm font-semibold text-white">{loadingStep || 'Sedang membaca dokumen...'}</p>
                  <p className="text-xs text-slate-400">Mohon tunggu beberapa saat</p>
                </div>
              )}

              {/* PDF SPLIT BATCH MANAGER VIEW (EXACT UI FROM PREVIOUS CHUNKING ENGINE) */}
              {chunks.length > 0 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* TOP HEADER CONTROLS */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <Split className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                          <span>Manajemen Split PDF</span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {totalDocPages} Halaman
                          </span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          File <span className="text-indigo-300 font-medium">{currentFileName}</span> dibagi menjadi{' '}
                          <strong className="text-white">{chunks.length} Batch</strong> (default 100 halaman/batch).
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setChunks([]);
                          setIsSplitMode(false);
                          setCurrentFileName('');
                          setDetectedFormasis([]);
                          setFinalResultReady(null);
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ganti File</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleProcessAllChunks}
                        disabled={isQueueRunning || completedChunksCount === chunks.length}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                          isQueueRunning
                            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                            : completedChunksCount === chunks.length
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        }`}
                      >
                        {isQueueRunning ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Jeda Antrean</span>
                          </>
                        ) : completedChunksCount === chunks.length ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Semua Batch Selesai</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Proses Semua Antrean</span>
                          </>
                        )}
                      </button>

                      {detectedFormasis.length > 0 && (
                        <button
                          type="button"
                          onClick={handleProceedToPreview}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Lanjut ke Preview ({completedChunksCount}/{chunks.length})</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* REALTIME STATS GRID (STATUS -> TOTAL KUOTA -> TOTAL FORMASI -> TOTAL PESERTA) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. STATUS */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Status Chunk</p>
                      <p className="text-xl font-black text-cyan-400 mt-1">
                        {completedChunksCount} <span className="text-xs font-normal text-slate-400">/ {chunks.length} Selesai</span>
                      </p>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((completedChunksCount / (chunks.length || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. TOTAL KUOTA */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Kuota</p>
                      <p className="text-xl font-black text-amber-400 mt-1">{totalExtractedKuota.toLocaleString('id-ID')}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Alokasi kursi CPNS</p>
                    </div>

                    {/* 3. TOTAL FORMASI */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Formasi</p>
                      <p className="text-xl font-black text-indigo-400 mt-1">{detectedFormasis.length.toLocaleString('id-ID')}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Jabatan unik terdeteksi</p>
                    </div>

                    {/* 4. TOTAL PESERTA */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Peserta</p>
                      <p className="text-xl font-black text-purple-400 mt-1">{totalExtractedPeserta.toLocaleString('id-ID')}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Dideduplikasi No. Peserta</p>
                    </div>
                  </div>

                  {/* CHUNKS TABLE & MANUAL TRIGGER BUTTONS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-indigo-400" />
                        <span>Daftar Chunk / Batch PDF ({chunks.length} Batch)</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Klik tombol <span className="text-indigo-400 font-semibold">[Proses Batch Ini]</span> untuk mengekstrak per batch.
                      </p>
                    </div>

                    <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-80 overflow-y-auto bg-slate-950/40">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold sticky top-0 backdrop-blur-xs">
                            <th className="p-3 text-center w-16">Batch #</th>
                            <th className="p-3">Rentang Halaman</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Hasil Ekstraksi</th>
                            <th className="p-3 text-right">Aksi Trigger</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {chunks.map((chunk) => {
                            const isProcessing = chunk.status === 'processing';
                            const isCompleted = chunk.status === 'completed';
                            const isError = chunk.status === 'error';

                            return (
                              <tr
                                key={chunk.id}
                                className={`transition-colors ${
                                  isProcessing
                                    ? 'bg-indigo-950/30'
                                    : isCompleted
                                    ? 'bg-emerald-950/10'
                                    : 'hover:bg-slate-800/30'
                                }`}
                              >
                                <td className="p-3 text-center font-mono font-bold text-slate-400">#{chunk.id}</td>
                                <td className="p-3 font-medium">
                                  <span className="text-slate-200">Halaman {chunk.startPage} — {chunk.endPage}</span>
                                  <span className="text-slate-500 text-[11px] ml-2">({chunk.endPage - chunk.startPage + 1} hal)</span>
                                </td>
                                <td className="p-3 text-center">
                                  {isCompleted ? (
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px] inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Selesai
                                    </span>
                                  ) : isProcessing ? (
                                    <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold text-[11px] inline-flex items-center gap-1 animate-pulse">
                                      <Loader2 className="w-3 h-3 animate-spin" /> Memproses...
                                    </span>
                                  ) : isError ? (
                                    <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-semibold text-[11px] inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> Gagal
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold text-[11px]">
                                      Belum Diproses
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {isCompleted ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded-md font-mono text-[11px]">
                                        {chunk.formasiCount} Formasi
                                      </span>
                                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-md font-mono text-[11px]">
                                        {chunk.pesertaCount} Peserta
                                      </span>
                                    </div>
                                  ) : isError ? (
                                    <span className="text-red-400 text-[11px] line-clamp-1">{chunk.errorMessage}</span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    disabled={isProcessing}
                                    onClick={() => processChunk(chunk.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                      isCompleted
                                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                        : isError
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <>
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Ulangi Batch</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3" />
                                        <span>Proses Batch Ini</span>
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* STEP 3: PREVIEW & CONFIRMATION TABLE */}
          {/* ----------------------------------------------------------------------- */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {saveError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs space-y-1">
                    <span className="font-bold text-rose-200 block text-sm">Gagal Menyimpan ke Cloud & Supabase</span>
                    <p className="leading-relaxed font-mono break-all text-[11px] bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/20 text-rose-200">
                      {saveError}
                    </p>
                    <p className="text-slate-400 text-[11px] pt-1">
                      Data tidak dapat disimpan. Silakan periksa koneksi Supabase atau sesuaikan format data, lalu klik tombol <strong>Simpan Instansi & Formasi</strong> lagi.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Eye className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-200 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">Langkah 3: Pratinjau & Konfirmasi Data Formasi</span>
                  Periksa ringkasan hasil parsing formasi jabatan, kualifikasi pendidikan, dan kuota sebelum disimpan ke database Cloud.
                </div>
              </div>

              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Instansi</span>
                  </span>
                  <div className="text-sm font-bold text-white truncate">{nama}</div>
                  <div className="text-[10px] font-mono text-indigo-300">Kode: {kode}</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Total Formasi</span>
                  </span>
                  <div className="text-base font-extrabold text-indigo-400 font-mono">
                    {detectedFormasis.length}
                  </div>
                  <div className="text-[10px] text-slate-400">Jabatan terdeteksi</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Total Kuota</span>
                  </span>
                  <div className="text-base font-extrabold text-amber-400 font-mono">
                    {totalExtractedKuota}
                  </div>
                  <div className="text-[10px] text-slate-400">Alokasi kursi formasi</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Total Peserta</span>
                  </span>
                  <div className="text-base font-extrabold text-purple-400 font-mono">
                    {totalExtractedPeserta}
                  </div>
                  <div className="text-[10px] text-slate-400">Pelamar SKD & SKB</div>
                </div>
              </div>

              {/* Search filter in preview */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={previewFilter}
                    onChange={(e) => setPreviewFilter(e.target.value)}
                    placeholder="Cari nama jabatan, jurusan, atau lokasi unit kerja..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400 shrink-0">
                  <span className="text-[11px] text-indigo-300 font-medium hidden md:inline-flex items-center gap-1">
                    <span>&larr; &rarr; Scroll horizontal untuk melihat semua kolom</span>
                  </span>
                  <span className="font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    Menampilkan <strong className="text-white">{filteredPreviewFormasi.length}</strong> / {detectedFormasis.length} formasi
                  </span>
                </div>
              </div>

              {/* Data Table Scrollable Container */}
              <div className="border border-slate-800 rounded-2xl overflow-x-auto overflow-y-auto max-h-[460px] min-h-[320px] bg-slate-900 shadow-inner relative">
                <table className="w-full min-w-[1380px] text-left border-separate border-spacing-0 text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-2.5 text-center w-12 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">No</th>
                      <th className="p-2.5 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[260px]">Jabatan Formasi</th>
                      <th className="p-2.5 min-w-[280px] sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap">Kualifikasi Pendidikan</th>
                      <th className="p-2.5 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[90px]">Jenis</th>
                      <th className="p-2.5 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[240px]">Lokasi Unit Kerja</th>
                      <th className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[70px]">Kuota</th>
                      <th className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[75px]">Pelamar</th>
                      <th className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[85px]">Rasio</th>
                      <th className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[120px]">Min SKD (P/L)</th>
                      <th className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[100px]">Min SKB (P/L)</th>
                      <th className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[100px]">Cut-off (P/L)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredPreviewFormasi.length > 0 ? (
                      filteredPreviewFormasi.map((block, idx) => {
                        const h: any = block.header || {};
                        const pList = Array.isArray(block.pesertaList) ? block.pesertaList : [];
                        const pCount =
                          pList.length > 0
                            ? pList.length
                            : typeof block.pesertaCount === 'number'
                            ? block.pesertaCount
                            : 0;
                        const kuota = getFormasiKuota(h, pList);
                        const numRatio = kuota > 0 ? pCount / kuota : 0;
                        const ratio = numRatio.toFixed(1);

                        const passed = pList.filter((p: any) => p?.keterangan && String(p.keterangan).trim().startsWith('P/L'));
                        const cut = passed.length > 0 ? Math.min(...passed.map((p: any) => Number(p.nilaiAkhir) || 0)).toFixed(3) : '-';

                        let ratioBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                        if (numRatio > 3) {
                          ratioBadgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                        } else if (numRatio >= 2) {
                          ratioBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                        } else {
                          ratioBadgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                        }

                        let minSkdPeserta: any = null;
                        if (passed.length > 0) {
                          minSkdPeserta = passed.reduce((min: any, p: any) => (Number(p.totalSkd || 0) < Number(min.totalSkd || 0) ? p : min), passed[0]);
                        }

                        let skdBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                        if (minSkdPeserta) {
                          const skdVal = Number(minSkdPeserta.totalSkd) || 0;
                          if (skdVal > 440) skdBadgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                          else if (skdVal >= 400) skdBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                          else skdBadgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                        }

                        let minSkbVal = '-';
                        if (passed.length > 0) {
                          const minSkbNum = Math.min(...passed.map((p: any) => Number(p.skb) || 0));
                          if (minSkbNum > 0) {
                            minSkbVal = minSkbNum % 1 === 0 ? minSkbNum.toString() : minSkbNum.toFixed(2);
                          }
                        }

                        let skbBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                        if (minSkbVal !== '-') {
                          const skbNum = parseFloat(minSkbVal);
                          if (skbNum > 70) skbBadgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                          else if (skbNum >= 65) skbBadgeStyle = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                          else skbBadgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                        }

                        let kodeJab = h.kodeJabatan || '';
                        let namaJab = h.namaJabatan || h.jabatanFormasi || '-';
                        if (!kodeJab && h.jabatanFormasi) {
                          const dashIdx = h.jabatanFormasi.indexOf(' - ');
                          if (dashIdx !== -1) {
                            kodeJab = h.jabatanFormasi.substring(0, dashIdx).trim();
                            namaJab = h.jabatanFormasi.substring(dashIdx + 3).trim();
                          }
                        }

                        return (
                          <tr key={block.id || idx} className="hover:bg-slate-800/40 transition-colors align-top">
                            <td className="p-2.5 text-center font-mono text-slate-500 font-semibold whitespace-nowrap">{idx + 1}</td>
                            <td className="p-2.5 min-w-[240px] lg:min-w-[280px]">
                              {kodeJab && (
                                <span className="block text-[10px] font-mono text-indigo-400 mb-0.5 font-semibold">
                                  {kodeJab}
                                </span>
                              )}
                              <p className="text-xs font-semibold text-slate-100 leading-tight whitespace-normal">
                                {namaJab}
                              </p>
                            </td>
                            <td className="p-2.5 min-w-[260px] lg:min-w-[300px] font-medium text-slate-200">
                              <JurusanListDisplay
                                pendidikanRaw={h.pendidikan}
                                selectedJenjang="ALL"
                                selectedPendidikan="ALL"
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-medium text-[10px] inline-block border border-slate-700/80">
                                {h.jenisFormasi || 'UMUM'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300 font-medium min-w-[220px] lg:min-w-[260px]">
                              <LokasiDisplay
                                lokasiRaw={h.lokasiFormasi}
                                kodeLokasi={h.kodeLokasi}
                                namaLokasi={h.namaLokasi}
                                pendidikan={h.pendidikan}
                              />
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 font-extrabold font-mono rounded-md border border-indigo-500/20 text-xs inline-block">
                                {kuota}
                              </span>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 font-extrabold font-mono rounded-md border border-indigo-500/20 text-xs inline-block">
                                {pCount}
                              </span>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <div className="inline-flex flex-col items-center justify-center">
                                <span className={`px-2 py-0.5 font-mono font-extrabold rounded-md border text-[11px] inline-block whitespace-nowrap ${ratioBadgeStyle}`}>
                                  1 : {ratio}
                                </span>
                                {kuota > pCount && (
                                  <span className="text-[9px] font-medium text-amber-400 mt-0.5 whitespace-nowrap block">
                                    Formasi Kosong
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {minSkdPeserta ? (
                                <div className="inline-flex flex-col items-center whitespace-nowrap">
                                  <span className={`font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md border inline-block mb-0.5 whitespace-nowrap ${skdBadgeStyle}`}>
                                    {minSkdPeserta.totalSkd}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono leading-tight whitespace-nowrap">
                                    {minSkdPeserta.twk} &bull; {minSkdPeserta.tiu} &bull; {minSkdPeserta.tkp}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {minSkbVal !== '-' ? (
                                <span className={`font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md border inline-block whitespace-nowrap ${skbBadgeStyle}`}>
                                  {minSkbVal}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {cut !== '-' ? (
                                <span className="font-mono font-extrabold text-indigo-300 text-[11px] bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 inline-block whitespace-nowrap">
                                  {cut}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500">
                          Tidak ada formasi yang sesuai dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER CONTROLS */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali (Step {currentStep - 1})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleNextFromStep1}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <span>Lanjut ke Upload PDF (Step 2)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleProceedToPreview}
                disabled={detectedFormasis.length === 0}
                className={`px-5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  detectedFormasis.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                <span>Pratinjau Data (Step 3)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Instansi & Formasi</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
