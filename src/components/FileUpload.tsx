import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  Upload,
  FileUp,
  Clipboard,
  Loader2,
  Sparkles,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Layers,
  Users,
  BookOpen,
  Search,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ListChecks,
  Sliders,
  ChevronDown,
  Split,
  FileCheck2,
  Download,
} from 'lucide-react';
import { SSCASNParsedResult, SSCASNFormasiBlock } from '../types';
import { calculateVerification } from '../utils/sampleData';
import { getFormasiKuota } from '../utils/kuotaUtils';

interface FileUploadProps {
  onParsed: (data: SSCASNParsedResult) => Promise<void> | void;
  onLoadSample: () => void;
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

export const FileUpload: React.FC<FileUploadProps> = ({ onParsed, onLoadSample }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // File metadata & state
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentMimeType, setCurrentMimeType] = useState<string>('');
  const [totalDocPages, setTotalDocPages] = useState<number>(0);

  // Split mode state
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [chunkSize, setChunkSize] = useState<number>(100); // Default 100 pages for high performance
  const [chunks, setChunks] = useState<PDFChunk[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [activeChunkId, setActiveChunkId] = useState<number | null>(null);

  // Aggregated data across all batches
  const [detectedFormasis, setDetectedFormasis] = useState<SSCASNFormasiBlock[]>([]);
  const [finalResultReady, setFinalResultReady] = useState<SSCASNParsedResult | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawFileRef = useRef<File | null>(null);
  const pdfArrayBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfDocRef = useRef<PDFDocument | null>(null);
  const lastHeaderRef = useRef<any>(null);

  const resetState = () => {
    setIsLoading(false);
    setScanCompleted(false);
    setErrorMessage(null);
    setDetectedFormasis([]);
    setFinalResultReady(null);
    setFilterQuery('');
    setFileBase64(null);
    setCurrentFileName('');
    setCurrentMimeType('');
    setTotalDocPages(0);
    setIsSplitMode(false);
    setChunks([]);
    setIsQueueRunning(false);
    setActiveChunkId(null);
    rawFileRef.current = null;
    pdfArrayBufferRef.current = null;
    pdfDocRef.current = null;
    lastHeaderRef.current = null;
  };

  // Helper to safely fetch JSON and avoid HTML/503 "Service Unavailable" parsing syntax errors
  const safeFetchJson = async (url: string, options: RequestInit) => {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      if (response.status === 503 || text.includes('Service Unavailable')) {
        throw new Error('Layanan server sedang sibuk (503 Service Unavailable). Silakan coba lagi beberapa saat.');
      }
      if (response.status === 502 || text.includes('Bad Gateway')) {
        throw new Error('Server mengalami kendala koneksi (502 Bad Gateway). Silakan coba lagi.');
      }
      if (response.status === 413 || text.includes('Payload Too Large')) {
        throw new Error('Ukuran file terlalu besar. Sistem telah membagi file dalam mode batch untuk diproses.');
      }
      throw new Error(`Server memberikan respons non-JSON (${response.status}): ${text.slice(0, 120)}`);
    }

    const data = await response.json();
    if (!response.ok || (data && data.success === false)) {
      throw new Error((data && data.error) || (data && data.details) || `Terjadi kesalahan pada server (${response.status}).`);
    }
    return data;
  };

  // Helper to merge formasi blocks with deduplication (O(N) Map lookup for 1000++ items)
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

  // Initialize PDF chunks based on selected chunk size
  const createChunksList = (totalPages: number, size: number): PDFChunk[] => {
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

  // Handle changing chunk size in Split Mode
  const handleChunkSizeChange = (newSize: number) => {
    setChunkSize(newSize);
    if (totalDocPages > 0) {
      setChunks(createChunksList(totalDocPages, newSize));
      setDetectedFormasis([]);
      setFinalResultReady(null);
    }
  };

  // Process a selected file
  const processFile = async (file: File) => {
    resetState();
    setIsLoading(true);
    setLoadingStep('Membaca file...');
    rawFileRef.current = file;
    setCurrentFileName(file.name);
    setCurrentMimeType(file.type || 'application/pdf');

    try {
      const isPdf = file.type?.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        // Non-PDF file flow (Excel / Image / Text)
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Content = (reader.result as string).split(',')[1];
          setFileBase64(base64Content);

          try {
            setLoadingStep('Mengekstrak data dari dokumen...');
            const result = await safeFetchJson('/api/parse-sscasn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileData: base64Content,
                fileName: file.name,
                mimeType: file.type,
              }),
            });

            const data: SSCASNParsedResult = result.data;
            setDetectedFormasis(data.formasiList || []);
            setFinalResultReady(data);
            setIsLoading(false);
            setScanCompleted(true);
          } catch (err: any) {
            setErrorMessage(err.message || 'Gagal menguraikan file.');
            setIsLoading(false);
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      // PDF Flow using browser-side pdf-lib!
      setLoadingStep('Membaca struktur PDF & menghitung total halaman...');
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

      const totalPages = pdfDoc.getPageCount();
      setTotalDocPages(totalPages);

      // Instantly enable PDF Split Batch Manager!
      setIsSplitMode(true);
      const initialChunks = createChunksList(totalPages, chunkSize);
      setChunks(initialChunks);

      setIsLoading(false);
    } catch (err: any) {
      console.error('Process File Error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat membaca file.');
      setIsLoading(false);
    }
  };

  // Process an individual chunk triggered manually or via queue with resilient re-hydration
  const processSingleChunk = async (chunkId: number, retryCount = 0): Promise<boolean> => {
    if (!currentFileName) return false;

    const chunkIndex = chunks.findIndex((c) => c.id === chunkId);
    if (chunkIndex === -1) return false;

    const targetChunk = chunks[chunkIndex];

    // Mark chunk as processing
    setChunks((prev) =>
      prev.map((c) => (c.id === chunkId ? { ...c, status: 'processing', errorMessage: undefined } : c))
    );
    setActiveChunkId(chunkId);

    try {
      let subPdfBase64 = '';

      // Ensure source PDF is loaded, re-hydrating from rawFileRef if needed
      let sourcePdf: PDFDocument | null = pdfDocRef.current;
      if (!sourcePdf && pdfArrayBufferRef.current) {
        sourcePdf = await PDFDocument.load(pdfArrayBufferRef.current, { ignoreEncryption: true });
        pdfDocRef.current = sourcePdf;
      }
      if (!sourcePdf && rawFileRef.current) {
        const ab = await rawFileRef.current.arrayBuffer();
        pdfArrayBufferRef.current = ab;
        sourcePdf = await PDFDocument.load(ab, { ignoreEncryption: true });
        pdfDocRef.current = sourcePdf;
      }

      if (sourcePdf) {
        // Extract ONLY targetChunk.startPage to targetChunk.endPage into a lightweight sub-PDF (~1MB)!
        const subDoc = await PDFDocument.create();
        const pageIndices: number[] = [];
        const maxPage = sourcePdf.getPageCount();
        for (let p = targetChunk.startPage - 1; p < targetChunk.endPage && p < maxPage; p++) {
          pageIndices.push(p);
        }

        const copiedPages = await subDoc.copyPages(sourcePdf, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));

        subPdfBase64 = await subDoc.saveAsBase64();
      } else if (fileBase64) {
        subPdfBase64 = fileBase64;
      } else {
        throw new Error('Data file PDF tidak ditemukan di memori browser. Silakan pilih kembali file PDF.');
      }

      // Send the tiny sub-PDF payload (~1MB) to server -> 0% risk of 503 / 413 error!
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
      const batchPesertaCount = batchFormasis.reduce((sum, f) => sum + f.pesertaList.length, 0);

      // Merge into aggregated formasi list safely using functional state updater
      setDetectedFormasis((prevList) => {
        if (batchFormasis.length > 0) {
          return mergeFormasis(prevList, batchFormasis);
        } else if (data.pesertaList && data.pesertaList.length > 0) {
          const dummyBlock: SSCASNFormasiBlock = {
            id: `formasi-${prevList.length + 1}`,
            header: data.header,
            pesertaList: data.pesertaList,
            verification: calculateVerification(data.pesertaList),
          };
          return mergeFormasis(prevList, [dummyBlock]);
        }
        return prevList;
      });

      // Mark chunk as completed
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

      setActiveChunkId(null);
      return true;
    } catch (err: any) {
      console.error(`Chunk ${chunkId} error (attempt ${retryCount + 1}):`, err);

      // Automatic 1-step retry if transient error occurs
      if (retryCount < 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return processSingleChunk(chunkId, retryCount + 1);
      }

      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunkId
            ? {
                ...c,
                status: 'error',
                errorMessage: err.message || 'Gagal mengekstrak halaman.',
              }
            : c
        )
      );
      setActiveChunkId(null);
      return false;
    }
  };

  // Download PDF file for full document or specific chunk
  const handleDownloadPdf = async (chunkId?: number) => {
    try {
      if (!pdfDocRef.current && pdfArrayBufferRef.current) {
        pdfDocRef.current = await PDFDocument.load(pdfArrayBufferRef.current, { ignoreEncryption: true });
      }

      let pdfBytes: Uint8Array;
      let downloadName = currentFileName || 'document.pdf';

      if (chunkId && pdfDocRef.current) {
        const chunk = chunks.find((c) => c.id === chunkId);
        if (chunk) {
          const subDoc = await PDFDocument.create();
          const pageIndices: number[] = [];
          for (let p = chunk.startPage - 1; p < chunk.endPage && p < pdfDocRef.current.getPageCount(); p++) {
            pageIndices.push(p);
          }
          const copiedPages = await subDoc.copyPages(pdfDocRef.current, pageIndices);
          copiedPages.forEach((page) => subDoc.addPage(page));
          pdfBytes = await subDoc.save();
          const baseName = (currentFileName || 'document').replace(/\.pdf$/i, '');
          downloadName = `${baseName}_chunk_${chunk.id}_hal_${chunk.startPage}-${chunk.endPage}.pdf`;
        } else {
          pdfBytes = await pdfDocRef.current.save();
        }
      } else if (pdfDocRef.current) {
        pdfBytes = await pdfDocRef.current.save();
      } else if (fileBase64) {
        const binaryStr = atob(fileBase64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        pdfBytes = bytes;
      } else {
        alert('File PDF tidak tersedia untuk diunduh.');
        return;
      }

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download PDF error:', err);
      alert('Gagal mengunduh file PDF.');
    }
  };

  // Run pending chunks automatically in sequence (queue)
  const handleToggleAutoQueue = async () => {
    if (isQueueRunning) {
      setIsQueueRunning(false);
      return;
    }

    setIsQueueRunning(true);
    let pendingChunks = chunks.filter((c) => c.status === 'pending' || c.status === 'error');

    for (const chunk of pendingChunks) {
      // Check if user paused queue
      const res = await processSingleChunk(chunk.id);
      if (!res) {
        // Stop queue if an error occurs so user can manually inspect or retry
        setIsQueueRunning(false);
        break;
      }
    }

    setIsQueueRunning(false);
  };

  // Trigger preview screen when user clicks "Tampilkan Preview Hasil"
  const handleShowPreviewScreen = () => {
    const allPeserta = detectedFormasis.flatMap((f) => f.pesertaList);
    const primaryFormasi = detectedFormasis[0];

    const result: SSCASNParsedResult = {
      meta: {
        docTitle: 'PANITIA SELEKSI NASIONAL PENGADAAN CASN - HASIL INTEGRASI SKD DAN SKB',
        tahun: '2024',
        parsedAt: new Date().toISOString(),
        sourceType: 'pdf',
        fileName: currentFileName || 'Dokumen_SSCASN.pdf',
        totalFormasiCount: detectedFormasis.length,
        totalPesertaCount: allPeserta.length,
        totalPages: totalDocPages,
      },
      formasiList: detectedFormasis,
      header: primaryFormasi ? primaryFormasi.header : {
        instansi: 'SSCASN BKN',
        jabatanFormasi: 'Formasi Terdeteksi',
        lokasiFormasi: 'Lokasi Formasi',
        jenisFormasi: 'UMUM',
        pendidikan: '-',
        jumlahKuota: 0,
      },
      pesertaList: allPeserta,
      verification: calculateVerification(allPeserta),
    };

    setFinalResultReady(result);
    setScanCompleted(true);
  };

  const handleProceedToDashboard = async () => {
    if (finalResultReady && !isSavingToDatabase) {
      try {
        setIsSavingToDatabase(true);
        await onParsed(finalResultReady);
      } catch (err) {
        console.error('Error saving data to database:', err);
      } finally {
        setIsSavingToDatabase(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    setIsLoading(true);
    setShowPasteModal(false);
    setLoadingStep('Menguraikan teks SSCASN...');

    try {
      const result = await safeFetchJson('/api/parse-sscasn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTextMode: pastedText,
          fileName: 'Pasted_SSCASN_Text.txt',
        }),
      });

      onParsed(result.data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menguraikan teks yang ditempel.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFormasiList = detectedFormasis.filter((f) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      f.header.jabatanFormasi?.toLowerCase().includes(q) ||
      f.header.lokasiFormasi?.toLowerCase().includes(q) ||
      f.header.jenisFormasi?.toLowerCase().includes(q) ||
      f.header.pendidikan?.toLowerCase().includes(q)
    );
  });

  const totalPesertaCount = detectedFormasis.reduce((sum, f) => sum + f.pesertaList.length, 0);
  const totalKuotaCount = detectedFormasis.reduce(
    (sum, f) => sum + (getFormasiKuota(f.header, f.pesertaList) || f.header.jumlahKuota || 0),
    0
  );
  const completedChunksCount = chunks.filter((c) => c.status === 'completed').length;

  return (
    <div className="w-full max-w-5xl mx-auto my-8 px-4">
      {/* 1. PREVIEW CONFIRMATION VIEW (TAMPILAN PREVIEW SEKARANG) */}
      {scanCompleted && finalResultReady ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-white animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Pemindaian PDF Selesai!
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Akurasi 100% (Format 2)
                  </span>
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  File <span className="text-indigo-300 font-medium">{currentFileName}</span> telah selesai digenerate.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {chunks.length > 0 && (
                <button
                  onClick={() => setScanCompleted(false)}
                  className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm font-semibold rounded-xl border border-indigo-500/30 transition-all flex items-center gap-2 cursor-pointer"
                  title="Kembali ke tampilan manajemen chunk PDF"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Chunk PDF</span>
                </button>
              )}
              <button
                disabled={isSavingToDatabase}
                onClick={resetState}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Unggah Ulang
              </button>
              <button
                disabled={isSavingToDatabase}
                onClick={handleProceedToDashboard}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-102 active:scale-98 disabled:cursor-wait disabled:scale-100"
              >
                {isSavingToDatabase ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Menyimpan ke Cloud Database...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjut ke Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Formasi</p>
                <p className="text-2xl font-black text-white">{detectedFormasis.length}</p>
                <p className="text-xs text-indigo-400 font-medium mt-0.5">Terdeteksi dalam dokumen</p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Peserta</p>
                <p className="text-2xl font-black text-white">{totalPesertaCount}</p>
                <p className="text-xs text-purple-400 font-medium mt-0.5">Peserta CASN terikat</p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Halaman</p>
                <p className="text-2xl font-black text-white">{totalDocPages || '1'}</p>
                <p className="text-xs text-cyan-400 font-medium mt-0.5">
                  {chunks.length > 0 ? `${completedChunksCount} / ${chunks.length} Chunk Selesai` : 'Telah Diekstrak'}
                </p>
              </div>
            </div>
          </div>

          {/* RINCIAN FORMASI TABLE */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Rincian Formasi Terdeteksi</span>
                <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
                  {filteredFormasiList.length} dari {detectedFormasis.length}
                </span>
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Cari jabatan / lokasi..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div
              className="table-scroll-container border border-slate-800 rounded-2xl overflow-hidden max-h-80 overflow-y-auto bg-slate-950/40 overscroll-x-contain overscroll-y-auto"
              data-table-scroll="true"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold sticky top-0 backdrop-blur-xs">
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Jabatan & Lokasi Formasi</th>
                    <th className="p-3">Jenis & Pendidikan</th>
                    <th className="p-3 text-center">Kuota</th>
                    <th className="p-3 text-center">Peserta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredFormasiList.length > 0 ? (
                    filteredFormasiList.map((f, idx) => (
                      <tr key={f.id || idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-100">{f.header.jabatanFormasi || 'Formasi'}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{f.header.lokasiFormasi || '-'}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-slate-300 font-medium">{f.header.jenisFormasi || 'UMUM'}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{f.header.pendidikan || '-'}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-1 bg-indigo-500/10 text-indigo-300 font-mono font-bold rounded-lg border border-indigo-500/20">
                            {f.header.jumlahKuota || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 font-mono font-bold rounded-lg border ${
                              f.pesertaList.length > 0
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                : 'bg-slate-800 text-slate-500 border-slate-700'
                            }`}
                          >
                            {f.pesertaList.length} Peserta
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Tidak ada formasi yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            {chunks.length > 0 ? (
              <button
                onClick={() => setScanCompleted(false)}
                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Split Chunk ({completedChunksCount}/{chunks.length} Batch Selesai)</span>
              </button>
            ) : <div />}

            <button
              onClick={handleProceedToDashboard}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer transform hover:scale-102 active:scale-98"
            >
              <span>Lanjut ke Tampilan / Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : isSplitMode && chunks.length > 0 ? (
        /* 2. PDF SPLIT BATCH MANAGER VIEW (FOR LARGE PDF > 200 PAGES) */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-white animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Split className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Manajemen Split PDF
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {totalDocPages} Halaman Terdeteksi
                  </span>
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  File <span className="text-indigo-300 font-medium">{currentFileName}</span> dibagi menjadi{' '}
                  <strong className="text-white">{chunks.length} Chunk / Batch</strong> ({chunkSize} halaman/batch). Trigger manual satu-per-satu untuk performa optimal!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <Sliders className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-400 font-semibold text-[11px] mr-1">Batch:</span>
                {[100, 150, 200, 300].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleChunkSizeChange(size)}
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded border transition-all cursor-pointer ${
                      chunkSize === size
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {size} Hal
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleDownloadPdf()}
                title="Download PDF Utama"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center shrink-0"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={resetState}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset File
              </button>

              <button
                onClick={handleToggleAutoQueue}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  isQueueRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {isQueueRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Jeda Antrean</span>
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
                  onClick={handleShowPreviewScreen}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer transform hover:scale-102"
                >
                  <span>Tampilkan Preview Hasil ({completedChunksCount}/{chunks.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* REALTIME STATS GRID (STATUS -> TOTAL KUOTA -> TOTAL FORMASI -> TOTAL PESERTA) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* 1. STATUS */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Status Chunk</p>
              <p className="text-2xl font-black text-cyan-400 mt-1">
                {completedChunksCount} <span className="text-sm font-normal text-slate-400">/ {chunks.length} Selesai</span>
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
              <p className="text-2xl font-black text-amber-400 mt-1">{totalKuotaCount.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Alokasi kuota CPNS</p>
            </div>

            {/* 3. TOTAL FORMASI */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Formasi</p>
              <p className="text-2xl font-black text-indigo-400 mt-1">{detectedFormasis.length.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Dikelompokkan secara unik</p>
            </div>

            {/* 4. TOTAL PESERTA */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Peserta</p>
              <p className="text-2xl font-black text-purple-400 mt-1">{totalPesertaCount.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Dideduplikasi via No. Peserta</p>
            </div>
          </div>

          {/* CHUNKS TABLE & MANUAL TRIGGER BUTTONS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-400" />
                <span>Daftar Chunk / Batch PDF ({chunks.length} Batch)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Klik tombol <span className="text-indigo-400 font-semibold">[Proses Chunk Ini]</span> untuk mengekstrak per batch secara manual.
              </p>
            </div>

            <div
              className="table-scroll-container border border-slate-800 rounded-2xl overflow-hidden max-h-96 overflow-y-auto bg-slate-950/40 overscroll-x-contain overscroll-y-auto"
              data-table-scroll="true"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold sticky top-0 backdrop-blur-xs">
                    <th className="p-3 text-center w-16">Batch #</th>
                    <th className="p-3">Rentang Halaman</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Hasil Ekstraksi</th>
                    <th className="p-3 text-right">Aksi Manual Trigger</th>
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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDownloadPdf(chunk.id)}
                              title={`Download PDF Chunk #${chunk.id} (Halaman ${chunk.startPage}-${chunk.endPage})`}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={() => processSingleChunk(chunk.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isCompleted
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                  : isError
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                              }`}
                            >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Memproses...</span>
                              </>
                            ) : isCompleted ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Proses Ulang</span>
                              </>
                            ) : isError ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Coba Lagi</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>Proses Chunk Ini</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTTOM PREVIEW ACTION TRIGGER */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              Total Formasi Terkumpul: <strong className="text-indigo-400">{detectedFormasis.length}</strong> | Total Peserta: <strong className="text-purple-400">{totalPesertaCount}</strong>
            </p>

            <button
              disabled={detectedFormasis.length === 0}
              onClick={handleShowPreviewScreen}
              className={`w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-base shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                detectedFormasis.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 transform hover:scale-102 active:scale-98'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <FileCheck2 className="w-5 h-5" />
              <span>Tampilkan Preview Hasil ({completedChunksCount}/{chunks.length} Batch)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* 3. DEFAULT FILE UPLOAD DROPZONE VIEW */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/20 shadow-xl'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                <FileText className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Memeriksa Dokumen SSCASN BKN...
                </p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">
                  {loadingStep}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                <FileUp className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Unggah Dokumen PDF SSCASN (Dukungan s/d 20.000+ Halaman)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                  Sistem akan mendeteksi dokumen &gt;200 halaman dan membaginya menjadi chunk batch (200 halaman/batch) untuk diekstrak secara manual satu-per-satu dengan akurasi 100%.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Pilih File PDF
                </button>

                <button
                  onClick={() => setShowPasteModal(true)}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-xl border border-slate-300 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Clipboard className="w-4 h-4" />
                  Tempel Teks SSCASN
                </button>

                <button
                  onClick={onLoadSample}
                  className="px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium rounded-xl border border-amber-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Coba Sample CPNS 2024
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Mode Split Batch (&gt;200 Halaman)
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Trigger Manual Per Chunk
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Preview & Verification Dashboard
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Gagal Menguraikan Dokumen</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-indigo-400" /> Tempel Teks Laporan SSCASN
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Salin dan tempel teks dari PDF SSCASN (Instansi, Jabatan, Lokasi, dan tabel baris peserta).
            </p>

            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Instansi : 6512 - Pemerintah Kab. Jember&#10;Jabatan Formasi : JF0000333 - PENYULUH HUKUM AHLI PERTAMA&#10;Lokasi Formasi : 65120002 - PEMERINTAH KABUPATEN JEMBER ...&#10;Jenis Formasi : 1 - UMUM&#10;Pendidikan : S-1 HUKUM&#10;&#10;1 24651220120001209 UMI FATIKHATUL JANNAH 19 Agustus 1998 S-1 HUKUM 3.76 115 145 191 451 32.8 68.0 40.8 73.6 P/L"
              className="w-full h-64 p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handlePasteSubmit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-md cursor-pointer"
              >
                Proses Teks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
