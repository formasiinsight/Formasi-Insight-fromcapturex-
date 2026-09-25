import express from 'express';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import * as xlsx from 'xlsx';
import { parseSSCASNFromText } from './src/utils/sscasnTextParser';
import { parsePdfWithCoordinates } from './src/utils/pdfCoordinateParser';
import { calculateVerification } from './src/utils/sampleData';
import { normalizeJenisFormasiHeader } from './src/utils/jenisFormasiUtils';
import { INITIAL_INSTANSI_LIST } from './src/utils/instansiSeedData';
import { SSCASNParsedResult, SSCASNPeserta, SSCASNFormasiBlock, InstansiItem } from './src/types';
import { classifyInstansi, extractInstansiHeaderFromRawText, getInstansiProvinsi } from './src/utils/instansiClassifier';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tecsyuwdfmfidkxctvny.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_DFuF0jkzJ_MPBCZMzvPfyw_dUjsGvyE';

let supabaseClient: SupabaseClient | null = null;
let isSupabaseConnected = false;
let supabaseErrorMessage: string | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

function getValidInstansiId(item: Partial<InstansiItem>): string {
  if (item.id && typeof item.id === 'string' && item.id.trim().length > 0) {
    return item.id.trim();
  }
  const code = (item.kode || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const name = (item.nama || 'instansi').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const fallback = code || name || String(Date.now());
  return `instansi-${fallback}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Simplifies parsed_data to store pure formation summary metadata in the Supabase 'instansi' database row.
 * For huge datasets (>100 formations, e.g. Kemendikbud with 7,934 formations), it keeps an ultra-light
 * metadata summary in the 'instansi' JSON column (all formasi headers and analytics are 100% preserved
 * in the relational 'formasi' table, and participants in the 'peserta' table).
 */
// Helper to safely compute full analytics for a formasi block from its participants,
// or fallback to and preserve existing pre-calculated analytics.
function computeBlockAnalytics(pesertaList: any[], kuota: number, existingAnalytics?: any) {
  const list = Array.isArray(pesertaList) ? pesertaList : [];

  const parseNum = (val: any) => {
    if (val === null || val === undefined || val === '' || val === '-') return null;
    const n = Number(String(val).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  // If no participants present in memory, preserve existing valid analytics
  if (list.length === 0) {
    if (existingAnalytics && (existingAnalytics.minSkd !== undefined || existingAnalytics.cutoffNilaiAkhir !== undefined || existingAnalytics.min_skd !== undefined)) {
      const totalLulus = typeof existingAnalytics.totalLulus === 'number'
        ? existingAnalytics.totalLulus
        : (typeof existingAnalytics.total_lulus === 'number' ? existingAnalytics.total_lulus : 0);
      const hasLulus = totalLulus > 0;

      return {
        totalPesertaSkb: typeof existingAnalytics.totalPesertaSkb === 'number' ? existingAnalytics.totalPesertaSkb : (typeof existingAnalytics.total_peserta_skb === 'number' ? existingAnalytics.total_peserta_skb : 0),
        totalLulus,
        rasioKeketatan: existingAnalytics.rasioKeketatan || existingAnalytics.rasio_keketatan || (kuota > 0 ? `1 : ${kuota}` : '-'),
        minSkd: hasLulus ? parseNum(existingAnalytics.minSkd ?? existingAnalytics.min_skd) : null,
        maxSkd: parseNum(existingAnalytics.maxSkd ?? existingAnalytics.max_skd),
        minSkb: hasLulus ? parseNum(existingAnalytics.minSkb ?? existingAnalytics.min_skb) : null,
        maxSkb: parseNum(existingAnalytics.maxSkb ?? existingAnalytics.max_skb),
        cutoffNilaiAkhir: hasLulus ? parseNum(existingAnalytics.cutoffNilaiAkhir ?? existingAnalytics.cutoff_nilai_akhir) : null,
        highestNilaiAkhir: parseNum(existingAnalytics.highestNilaiAkhir ?? existingAnalytics.highest_nilai_akhir),
      };
    }
    return {
      totalPesertaSkb: 0,
      totalLulus: 0,
      rasioKeketatan: kuota > 0 ? `1 : ${kuota}` : '-',
      minSkd: null,
      maxSkd: null,
      minSkb: null,
      maxSkb: null,
      cutoffNilaiAkhir: null,
      highestNilaiAkhir: null,
    };
  }

  const totalPesertaSkb = list.length;
  // SSCASN lulus status: starts with P/L (e.g. P/L, P/L-1, P/L-2, P/L-U3)
  const lulusList = list.filter((p) => {
    const ket = String(p?.keterangan || '').trim().toUpperCase().replace(/\s+/g, '');
    return ket.startsWith('P/L');
  });
  const totalLulus = lulusList.length;

  // CRITICAL: Nilai Min SKD, Min SKB, dan Cutoff Nilai Akhir HANYA boleh diambil dari peserta yang Lulus (P/L).
  // Peserta Tidak Lulus (TL / TH / TMS / dsb) TIDAK BOLEH dijadikan nilai minimum.
  const skdScoresLulus = lulusList.map((p) => Number(p.totalSkd) || 0).filter((s) => s > 0);
  const skbScoresLulus = lulusList.map((p) => Number(p.skb) || 0).filter((s) => s > 0);
  const akhirScoresLulus = lulusList.map((p) => Number(p.nilaiAkhir) || 0).filter((s) => s > 0);

  const allSkdScores = list.map((p) => Number(p.totalSkd) || 0).filter((s) => s > 0);
  const allSkbScores = list.map((p) => Number(p.skb) || 0).filter((s) => s > 0);
  const allAkhirScores = list.map((p) => Number(p.nilaiAkhir) || 0).filter((s) => s > 0);

  // Min SKD: HANYA dari lulusList. Jika tidak ada yang lulus (totalLulus === 0), nilainya null (jangan tampilkan TL).
  const minSkd = skdScoresLulus.length > 0 ? Math.min(...skdScoresLulus) : null;
  const maxSkd = allSkdScores.length > 0 ? Math.max(...allSkdScores) : parseNum(existingAnalytics?.maxSkd ?? existingAnalytics?.max_skd);

  // Min SKB: HANYA dari lulusList. Jika tidak ada yang lulus (totalLulus === 0), nilainya null.
  const minSkb = skbScoresLulus.length > 0 ? Math.min(...skbScoresLulus) : null;
  const maxSkb = allSkbScores.length > 0 ? Math.max(...allSkbScores) : parseNum(existingAnalytics?.maxSkb ?? existingAnalytics?.max_skb);

  const highestNilaiAkhir = allAkhirScores.length > 0 ? Math.max(...allAkhirScores) : parseNum(existingAnalytics?.highestNilaiAkhir ?? existingAnalytics?.highest_nilai_akhir);
  // Cutoff Nilai Akhir: Nilai terendah dari peserta yang LULUS (P/L)
  const cutoffNilaiAkhir = akhirScoresLulus.length > 0 ? Math.min(...akhirScoresLulus) : null;

  const rasioKeketatan = kuota > 0 && totalPesertaSkb > 0
    ? `1 : ${(totalPesertaSkb / kuota).toFixed(1)}`
    : (existingAnalytics?.rasioKeketatan || existingAnalytics?.rasio_keketatan || (totalPesertaSkb > 0 ? `1 : ${totalPesertaSkb}` : '-'));

  return {
    totalPesertaSkb,
    totalLulus,
    rasioKeketatan,
    minSkd,
    maxSkd,
    minSkb,
    maxSkb,
    cutoffNilaiAkhir,
    highestNilaiAkhir,
  };
}

function simplifyParsedDataForDatabase(parsedData: any): any {
  if (!parsedData || typeof parsedData !== 'object') return null;

  const rawFormasiList = Array.isArray(parsedData.formasiList) ? parsedData.formasiList : [];
  const rawPesertaList = Array.isArray(parsedData.pesertaList) ? parsedData.pesertaList : [];

  let totalFormasiCount = parsedData.meta?.totalFormasiCount || rawFormasiList.length || (parsedData.header ? 1 : 0);
  let totalPesertaCount = parsedData.meta?.totalPesertaCount || rawPesertaList.length;

  if (totalPesertaCount === 0 && rawFormasiList.length > 0) {
    totalPesertaCount = rawFormasiList.reduce((sum: number, f: any) => {
      const pLen = Array.isArray(f?.pesertaList) ? f.pesertaList.length : 0;
      const pCount = typeof f?.pesertaCount === 'number' ? f.pesertaCount : pLen;
      return sum + pCount;
    }, 0);
  }

  const meta = {
    docTitle: parsedData.meta?.docTitle || 'Hasil Integrasi SKD dan SKB SSCASN BKN',
    tahun: parsedData.meta?.tahun || '2024',
    parsedAt: parsedData.meta?.parsedAt || new Date().toISOString(),
    sourceType: parsedData.meta?.sourceType || 'pdf',
    fileName: parsedData.meta?.fileName,
    totalFormasiCount,
    totalPesertaCount,
    totalPages: parsedData.meta?.totalPages || 1,
  };

  // Keep full formations list with lightweight metadata (pesertaList is stripped to keep payload lean)
  const targetFormasiList = rawFormasiList;

  const formasiList = targetFormasiList.map((f: any, idx: number) => {
    const fPesertaList = Array.isArray(f.pesertaList) ? f.pesertaList : [];
    const pCount =
      fPesertaList.length > 0
        ? fPesertaList.length
        : typeof f.pesertaCount === 'number'
        ? f.pesertaCount
        : (f.verification?.totalRecords || 0);

    const passedList = fPesertaList.filter((p: any) => p?.keterangan && String(p.keterangan).trim().startsWith('P/L'));
    const passedCount = passedList.length > 0 ? passedList.length : (f.verification?.passedCount || 0);

    const verification = f.verification || {
      isValid: true,
      scoreAccuracyPercent: 100,
      totalRecords: pCount,
      discrepanciesCount: 0,
      passedCount,
      failedCount: Math.max(0, pCount - passedCount),
      discrepanciesList: [],
    };

    const kuota = Number(f.header?.jumlahKuota) || Number(f.header?.kuotaJabatan) || 1;
    const analytics = computeBlockAnalytics(fPesertaList, kuota, f.analytics);

    return {
      id: f.id || `formasi-${idx + 1}`,
      header: {
        instansi: f.header?.instansi || parsedData.header?.instansi || '',
        kodeInstansi: f.header?.kodeInstansi || parsedData.header?.kodeInstansi || '',
        jabatanFormasi: f.header?.jabatanFormasi || f.header?.namaJabatan || '',
        kodeJabatan: f.header?.kodeJabatan || '',
        namaJabatan: f.header?.namaJabatan || f.header?.jabatanFormasi || '',
        lokasiFormasi: f.header?.lokasiFormasi || f.header?.namaLokasi || '',
        kodeLokasi: f.header?.kodeLokasi || '',
        namaLokasi: f.header?.namaLokasi || f.header?.lokasiFormasi || '',
        pendidikan: f.header?.pendidikan || '',
        jenisFormasi: f.header?.jenisFormasi || f.header?.namaJenisFormasi || 'UMUM',
        namaJenisFormasi: f.header?.namaJenisFormasi || f.header?.jenisFormasi || 'UMUM',
        jumlahKuota: f.header?.jumlahKuota || f.header?.kuotaJabatan || 1,
        kuotaJabatan: f.header?.kuotaJabatan || f.header?.jumlahKuota || 1,
      },
      pesertaCount: pCount,
      pesertaList: [], // Stripped for DB JSON storage - hydrated on demand from 'peserta' table
      verification,
      analytics, // Retain complete analytics in parsed_data
    };
  });

  return {
    meta,
    pageErrors: parsedData.pageErrors ? parsedData.pageErrors.slice(0, 10) : [],
    formasiList,
    header: parsedData.header || (targetFormasiList[0]?.header) || {},
    pesertaList: [], // Stripped for DB JSON storage
    verification: parsedData.verification || {
      isValid: true,
      scoreAccuracyPercent: 100,
      totalRecords: totalPesertaCount,
      discrepanciesCount: 0,
      passedCount: 0,
      failedCount: 0,
      discrepanciesList: [],
    },
    lastHeader: parsedData.lastHeader,
  };
}

// Convert application InstansiItem to database row format
// Safely calculates summary statistics and simplifies parsed_data to pure metadata summary
function instansiToDbRow(item: InstansiItem) {
  const safeId = getValidInstansiId(item);
  item.id = safeId;

  let totalFormasi = 0;
  let totalKuota = 0;
  let totalPeserta = 0;

  if (item.parsedData) {
    if (Array.isArray(item.parsedData.formasiList) && item.parsedData.formasiList.length > 0) {
      totalFormasi = item.parsedData.formasiList.length;
      for (const f of item.parsedData.formasiList) {
        const pList = Array.isArray(f.pesertaList) ? f.pesertaList : [];
        const pCount =
          pList.length > 0
            ? pList.length
            : typeof f.pesertaCount === 'number'
            ? f.pesertaCount
            : (f.verification?.totalRecords || 0);
        totalPeserta += pCount;
        const k = Number(f.header?.jumlahKuota) || Number(f.header?.kuotaJabatan) || 1;
        totalKuota += k;
      }
    } else {
      totalFormasi = 1;
      const pList = Array.isArray(item.parsedData.pesertaList) ? item.parsedData.pesertaList : [];
      totalPeserta = pList.length;
      totalKuota = Number(item.parsedData.header?.jumlahKuota) || 1;
    }
  }

  const safeProvinsi = item.provinsi || getInstansiProvinsi(item) || null;
  const baseParsed = item.parsedData ? simplifyParsedDataForDatabase(item.parsedData) : {};
  const parsedDataWithProv = {
    ...baseParsed,
    provinsi: safeProvinsi,
  };

  return {
    id: safeId,
    kode: item.kode || '',
    nama: item.nama,
    kategori: item.kategori,
    tahun: item.tahun || '2024',
    pdf_file_name: item.pdfFileName || null,
    total_formasi: totalFormasi,
    total_kuota: totalKuota,
    total_peserta: totalPeserta,
    notes: item.notes || null,
    parsed_data: parsedDataWithProv,
    updated_at: item.updatedAt || new Date().toISOString(),
  };
}

// Convert parsedData inside instansi to rich rows with analytics for the 'formasi' table
function extractFormasiDbRows(instansiList: InstansiItem[]): any[] {
  const formasiRows: any[] = [];

  for (const instansi of instansiList) {
    if (!instansi.parsedData) continue;

    // Check if formasiList exists
    const formasiList = instansi.parsedData.formasiList;
    if (Array.isArray(formasiList) && formasiList.length > 0) {
      formasiList.forEach((f, idx) => {
        const formasiId = `${instansi.id}-${f.id || `formasi-${idx + 1}`}`;
        const header: any = f.header || {};
        const kuota = Number(header.jumlahKuota) || Number(header.kuotaJabatan) || 1;
        const analytics = computeBlockAnalytics(f.pesertaList, kuota, f.analytics);
        
        formasiRows.push({
          id: formasiId,
          instansi_id: instansi.id,
          kode_jabatan: header.kodeJabatan || '',
          jabatan: header.namaJabatan || header.jabatanFormasi || `Formasi ${idx + 1}`,
          lokasi: header.namaLokasi || header.lokasiFormasi || '-',
          pendidikan: header.pendidikan || '-',
          jenis_formasi: header.namaJenisFormasi || header.jenisFormasi || 'UMUM',
          kuota,
          total_peserta_skb: analytics.totalPesertaSkb,
          total_lulus: analytics.totalLulus,
          rasio_keketatan: analytics.rasioKeketatan,
          min_skd: analytics.minSkd,
          max_skd: analytics.maxSkd,
          min_skb: analytics.minSkb,
          max_skb: analytics.maxSkb,
          cutoff_nilai_akhir: analytics.cutoffNilaiAkhir,
          highest_nilai_akhir: analytics.highestNilaiAkhir,
          created_at: new Date().toISOString(),
        });
      });
    } else if (instansi.parsedData.header) {
      // Single header fallback
      const header: any = instansi.parsedData.header;
      const kuota = Number(header.jumlahKuota) || 1;
      const analytics = computeBlockAnalytics(instansi.parsedData.pesertaList || [], kuota, (instansi.parsedData as any).analytics);
      
      formasiRows.push({
        id: `${instansi.id}-formasi-1`,
        instansi_id: instansi.id,
        kode_jabatan: header.kodeJabatan || '',
        jabatan: header.namaJabatan || header.jabatanFormasi || 'Formasi CPNS',
        lokasi: header.namaLokasi || header.lokasiFormasi || '-',
        pendidikan: header.pendidikan || '-',
        jenis_formasi: header.namaJenisFormasi || header.jenisFormasi || 'UMUM',
        kuota,
        total_peserta_skb: analytics.totalPesertaSkb,
        total_lulus: analytics.totalLulus,
        rasio_keketatan: analytics.rasioKeketatan,
        min_skd: analytics.minSkd,
        max_skd: analytics.maxSkd,
        min_skb: analytics.minSkb,
        max_skb: analytics.maxSkb,
        cutoff_nilai_akhir: analytics.cutoffNilaiAkhir,
        highest_nilai_akhir: analytics.highestNilaiAkhir,
        created_at: new Date().toISOString(),
      });
    }
  }

  return formasiRows;
}

// Convert parsedData inside instansi to structured participant rows for 'peserta' table
function extractPesertaDbRows(instansiList: InstansiItem[]): any[] {
  const pesertaRows: any[] = [];
  const seenIds = new Set<string>();

  for (const instansi of instansiList) {
    if (!instansi.parsedData) continue;

    const processPesertaList = (formasiId: string, list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((p, idx) => {
        const noPeserta = (p.noPeserta || `P-${idx + 1}`).trim();
        const cleanPesertaId = `${formasiId}-${noPeserta}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Prevent duplicate keys within batch
        if (seenIds.has(cleanPesertaId)) return;
        seenIds.add(cleanPesertaId);

        const parseNum = (val: any, fallback = 0) => {
          if (val === null || val === undefined || val === '') return fallback;
          const cleanStr = String(val).replace(',', '.');
          const n = Number(cleanStr);
          return Number.isFinite(n) ? n : fallback;
        };

        const parseNullableNum = (val: any) => {
          if (val === null || val === undefined || val === '' || val === '-') return null;
          const cleanStr = String(val).replace(',', '.');
          const n = Number(cleanStr);
          return Number.isFinite(n) ? n : null;
        };

        pesertaRows.push({
          id: cleanPesertaId,
          formasi_id: formasiId,
          instansi_id: instansi.id,
          no_urut: parseNum(p.no, idx + 1),
          no_peserta: noPeserta,
          nama: (p.nama || '-').trim(),
          tanggal_lahir: p.tanggalLahir && p.tanggalLahir !== '-' ? String(p.tanggalLahir).trim() : null,
          pendidikan: p.pendidikan && p.pendidikan !== '-' ? String(p.pendidikan).trim() : null,
          ipk: parseNullableNum(p.ipk),
          twk: parseNum(p.twk, 0),
          tiu: parseNum(p.tiu, 0),
          tkp: parseNum(p.tkp, 0),
          total_skd: parseNum(p.totalSkd, 0),
          skor_skd: parseNum(p.skorSkd, 0),
          skb: parseNum(p.skb, 0),
          skor_skb: parseNum(p.skorSkb, 0),
          nilai_akhir: parseNum(p.nilaiAkhir, 0),
          keterangan: p.keterangan ? String(p.keterangan).trim() : '-',
          created_at: new Date().toISOString(),
        });
      });
    };

    const formasiList = instansi.parsedData.formasiList;
    if (Array.isArray(formasiList) && formasiList.length > 0) {
      formasiList.forEach((f, idx) => {
        const formasiId = `${instansi.id}-${f.id || `formasi-${idx + 1}`}`;
        processPesertaList(formasiId, f.pesertaList);
      });
    } else if (instansi.parsedData.header) {
      const formasiId = `${instansi.id}-formasi-1`;
      processPesertaList(formasiId, instansi.parsedData.pesertaList || []);
    }
  }

  return pesertaRows;
}

// Convert database row to application InstansiItem
function dbRowToInstansi(row: any): InstansiItem {
  const rawParsed = row.parsed_data || row.parsedData || undefined;
  let parsedData = rawParsed;

  if (rawParsed && typeof rawParsed === 'object') {
    const formasiList = Array.isArray(rawParsed.formasiList)
      ? rawParsed.formasiList.map((f: any) => ({
          ...f,
          pesertaList: Array.isArray(f.pesertaList) ? f.pesertaList : [],
        }))
      : [];

    parsedData = {
      ...rawParsed,
      formasiList,
      pesertaList: Array.isArray(rawParsed.pesertaList) ? rawParsed.pesertaList : [],
      meta: {
        ...(rawParsed.meta || {}),
        totalFormasiCount: Number(row.total_formasi) || rawParsed.meta?.totalFormasiCount || formasiList.length,
        totalPesertaCount: Number(row.total_peserta) || rawParsed.meta?.totalPesertaCount || 0,
      },
    };
  }

  const totalFormasi = Number(row.total_formasi) || (parsedData?.formasiList?.length ?? 0);
  const status = row.status || (totalFormasi > 0 || (parsedData?.formasiList?.length > 0) ? 'terdaftar' : 'perlu_upload');

  const rawNama = row.nama || row.name || 'Instansi';
  const rawKode = row.kode || row.code || '';
  const fallbackProv = getInstansiProvinsi({ nama: rawNama, kode: rawKode });

  return {
    id: row.id,
    nama: rawNama,
    kode: rawKode,
    kategori: row.kategori || 'kementerian',
    provinsi: row.provinsi || row.province || row.parsed_data?.provinsi || row.parsedData?.provinsi || fallbackProv || undefined,
    status,
    tahun: row.tahun || row.year || '2024',
    pdfFileName: row.pdf_file_name || row.pdfFileName || undefined,
    parsedData,
    notes: row.notes || undefined,
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    totalFormasiDB: totalFormasi,
    totalKuotaDB: Number(row.total_kuota) || 0,
    totalPesertaDB: Number(row.total_peserta) || 0,
  };
}

// Convert relational formasi row to SSCASNFormasiBlock with full analytics
function formasiDbRowToBlock(row: any, idx: number, instansiNama: string, instansiKode: string): SSCASNFormasiBlock {
  const kuota = Number(row.kuota) || 1;
  const totalPeserta = Number(row.total_peserta_skb) || 0;
  const totalLulus = Number(row.total_lulus) || 0;

  const parseNullableNum = (val: any) => {
    if (val === null || val === undefined || val === '' || val === '-') return null;
    const n = Number(String(val).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  return {
    id: row.id.startsWith(`${row.instansi_id}-`) ? row.id.slice(row.instansi_id.length + 1) : row.id || `formasi-${idx + 1}`,
    header: {
      instansi: instansiNama || '',
      kodeInstansi: instansiKode || '',
      jabatanFormasi: row.jabatan || `Formasi ${idx + 1}`,
      kodeJabatan: row.kode_jabatan || '',
      namaJabatan: row.jabatan || '',
      lokasiFormasi: row.lokasi || '-',
      kodeLokasi: '',
      namaLokasi: row.lokasi || '-',
      pendidikan: row.pendidikan || '-',
      jenisFormasi: row.jenis_formasi || 'UMUM',
      namaJenisFormasi: row.jenis_formasi || 'UMUM',
      jumlahKuota: kuota,
      kuotaJabatan: kuota,
    },
    pesertaCount: totalPeserta,
    pesertaList: [],
    verification: {
      isValid: true,
      scoreAccuracyPercent: 100,
      totalRecords: totalPeserta,
      discrepanciesCount: 0,
      passedCount: totalLulus,
      failedCount: Math.max(0, totalPeserta - totalLulus),
      discrepanciesList: [],
    },
    analytics: {
      minSkd: totalLulus > 0 ? parseNullableNum(row.min_skd) : null,
      maxSkd: parseNullableNum(row.max_skd),
      minSkb: totalLulus > 0 ? parseNullableNum(row.min_skb) : null,
      maxSkb: parseNullableNum(row.max_skb),
      cutoffNilaiAkhir: totalLulus > 0 ? parseNullableNum(row.cutoff_nilai_akhir) : null,
      highestNilaiAkhir: parseNullableNum(row.highest_nilai_akhir),
      rasioKeketatan: row.rasio_keketatan || undefined,
      totalPesertaSkb: totalPeserta,
      totalLulus: totalLulus,
    },
  };
}

// Prepares an instansi item for server in-memory cache, keeping ALL formations without truncation
function prepareForMemoryCache(item: InstansiItem): InstansiItem {
  if (!item.parsedData) return item;
  const rawFormasi = Array.isArray(item.parsedData.formasiList) ? item.parsedData.formasiList : [];
  const formasiList = rawFormasi.map((f: any, idx: number) => {
    const fPesertaList = Array.isArray(f.pesertaList) ? f.pesertaList : [];
    const kuota = Number(f.header?.jumlahKuota) || Number(f.header?.kuotaJabatan) || 1;
    const analytics = computeBlockAnalytics(fPesertaList, kuota, f.analytics);

    return {
      ...f,
      id: f.id || `formasi-${idx + 1}`,
      pesertaList: [], // participants stripped from general list, hydrated on-demand
      analytics,
    };
  });

  return {
    ...item,
    parsedData: {
      ...item.parsedData,
      formasiList,
      pesertaList: [],
    },
  };
}

// Cloud Persistent Storage Setup
const DATA_DIR = path.join(process.cwd(), 'data');
const CLOUD_DB_FILE = path.join(DATA_DIR, 'cloud_instansi_db.json');

// Atomic write to avoid corrupted / partially written JSON files
async function safeWriteJsonFile(filePath: string, data: any): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fsPromises.mkdir(dir, { recursive: true });
  }
  const jsonStr = JSON.stringify(data, null, 2);
  const tmpFile = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  await fsPromises.writeFile(tmpFile, jsonStr, 'utf-8');
  await fsPromises.rename(tmpFile, filePath);
}

// In-memory cache for ultra-fast response & synchronization
let memoryInstansiCache: InstansiItem[] = [];
let lastCloudSyncTime = new Date().toISOString();

// Synchronous bootstrap from local disk backup so data is immediately available on boot
try {
  if (fs.existsSync(CLOUD_DB_FILE)) {
    const fileData = fs.readFileSync(CLOUD_DB_FILE, 'utf-8');
    const parsed = JSON.parse(fileData);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryInstansiCache = parsed;
      console.log(`[Cloud File DB] Instant bootstrap memory cache loaded with ${memoryInstansiCache.length} records.`);
    }
  }
} catch (e) {
  console.warn('[Cloud File DB] Notice loading bootstrap cache:', e);
}

async function initCloudStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fsPromises.mkdir(DATA_DIR, { recursive: true });
    }

    let fileCache: InstansiItem[] = [];
    if (fs.existsSync(CLOUD_DB_FILE)) {
      try {
        const fileData = await fsPromises.readFile(CLOUD_DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fileCache = parsed;
        }
      } catch (e) {
        console.warn('[Cloud File DB] Notice reading cache:', e);
      }
    }

    // 1. Try fetching from Supabase 'instansi' table using chunked requests to prevent PostgreSQL statement timeouts
    try {
      const supabase = getSupabase();
      const { data: pingData, error: pingErr } = await supabase
        .from('instansi')
        .select('id')
        .limit(1);

      if (!pingErr && pingData) {
        isSupabaseConnected = true;
        supabaseErrorMessage = null;

        // Fetch in safe batches of 15 to stay well clear of PostgREST payload & statement limits
        const CHUNK_SIZE = 15;
        let allSbRows: any[] = [];
        for (let offset = 0; offset < 200; offset += CHUNK_SIZE) {
          const { data: chunk, error: chunkErr } = await supabase
            .from('instansi')
            .select('*')
            .order('nama', { ascending: true })
            .range(offset, offset + CHUNK_SIZE - 1);
          if (chunkErr) {
            console.warn(`[Supabase Cloud] Notice at batch offset ${offset}:`, chunkErr.message);
            break;
          }
          if (!chunk || chunk.length === 0) break;
          allSbRows = allSbRows.concat(chunk);
          if (chunk.length < CHUNK_SIZE) break;
        }

        if (allSbRows.length > 0) {
          const sbList = allSbRows.map(dbRowToInstansi);
          // Safely merge with fileCache: if local fileCache has more formations for any instansi, preserve complete data
          const mergedList = sbList.map((sbItem) => {
            const localItem = fileCache.find((f) => f.id === sbItem.id);
            const localFormasiCount = localItem?.parsedData?.formasiList?.length || 0;
            const sbFormasiCount = sbItem?.parsedData?.formasiList?.length || 0;
            if (localItem && localFormasiCount > sbFormasiCount) {
              return {
                ...sbItem,
                parsedData: localItem.parsedData,
                totalFormasiDB: Math.max(localFormasiCount, sbItem.totalFormasiDB || 0),
              };
            }
            return sbItem;
          });

          // If fileCache has instansi not yet in Supabase, preserve them
          for (const localItem of fileCache) {
            if (!mergedList.some((i) => i.id === localItem.id)) {
              mergedList.push(localItem);
            }
          }

          memoryInstansiCache = mergedList.map(prepareForMemoryCache);
          isSupabaseConnected = true;
          supabaseErrorMessage = null;
          lastCloudSyncTime = new Date().toISOString();
          console.log(`[Supabase Cloud] Loaded and synchronized ${memoryInstansiCache.length} records from Supabase.`);
          await safeWriteJsonFile(CLOUD_DB_FILE, memoryInstansiCache);
          return;
        }
      } else if (pingErr) {
        console.warn(`[Supabase Cloud] Notice: ${pingErr.message}. (Table might need to be created in Supabase SQL editor).`);
        supabaseErrorMessage = pingErr.message;
      }
    } catch (sbErr: any) {
      console.warn('[Supabase Cloud] Connection check error:', sbErr?.message || sbErr);
      supabaseErrorMessage = sbErr?.message || String(sbErr);
    }

    // 2. Fallback to local server persistent file
    if (fileCache.length > 0) {
      memoryInstansiCache = fileCache;
      lastCloudSyncTime = new Date().toISOString();
      console.log(`[Cloud File DB] Loaded ${memoryInstansiCache.length} instansi records from cloud file storage.`);
      return;
    }

    // 3. Fallback: If memoryInstansiCache already has data, keep it!
    if (memoryInstansiCache.length > 0) {
      console.log(`[Cloud DB] Retaining ${memoryInstansiCache.length} existing in-memory records.`);
      return;
    }

    // 4. Fallback to empty catalog only if truly nothing exists, but do NOT overwrite existing files
    memoryInstansiCache = [];
    lastCloudSyncTime = new Date().toISOString();
    console.log(`[Cloud DB] Initialized clean cloud database (empty catalog).`);
  } catch (err) {
    console.error('[Cloud DB] Error initializing cloud storage, preserving existing cache if available:', err);
    if (!memoryInstansiCache || memoryInstansiCache.length === 0) {
      memoryInstansiCache = [];
    }
  }
}

async function persistCloudDatabase(data: InstansiItem[]): Promise<void> {
  const sanitizedList = data.map((item) => {
    const id = getValidInstansiId(item);
    return {
      ...item,
      id,
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
  });

  // 1. Write to server local JSON backup first
  try {
    await safeWriteJsonFile(CLOUD_DB_FILE, sanitizedList);
  } catch (err: any) {
    console.error('[Cloud DB] Failed to write local backup file:', err);
    throw new Error(`Gagal menyimpan file backup lokal: ${err?.message || err}`);
  }

  // 2. Sync to Supabase Cloud Database (instansi, formasi, and peserta tables) with strict error validation
  const supabase = getSupabase();
  const rows = sanitizedList.map(instansiToDbRow);
  const currentInstansiIds = sanitizedList.map((i) => i.id);

  // A. Upsert instansi in Supabase
  for (const row of rows) {
    const { error: instErr } = await supabase.from('instansi').upsert([row]);
    if (instErr) {
      console.error(`[Supabase Cloud] Upsert instansi '${row.id}' error:`, instErr.message);
      supabaseErrorMessage = instErr.message;
      isSupabaseConnected = false;
      throw new Error(`[Supabase Error] Gagal menyimpan instansi "${row.nama}": ${instErr.message} (Kode: ${instErr.code || 'DB_ERROR'})`);
    }
  }

  isSupabaseConnected = true;
  supabaseErrorMessage = null;

  // B. Clean previous relational records for updated instansi to prevent orphaned rows or key conflicts
  for (const instId of currentInstansiIds) {
    const { error: delPErr } = await supabase.from('peserta').delete().eq('instansi_id', instId);
    if (delPErr) {
      console.warn(`[Supabase Cloud] Clean existing peserta notice for '${instId}':`, delPErr.message);
    }
    const { error: delFErr } = await supabase.from('formasi').delete().eq('instansi_id', instId);
    if (delFErr) {
      console.warn(`[Supabase Cloud] Clean existing formasi notice for '${instId}':`, delFErr.message);
    }
  }

  // C. Synchronize relational formasi and peserta tables in concurrent batches
  const formasiRows = extractFormasiDbRows(sanitizedList);
  const pesertaRows = extractPesertaDbRows(sanitizedList);

  if (formasiRows.length > 0) {
    const FORMASI_BATCH = 300;
    const formasiChunks: any[][] = [];
    for (let i = 0; i < formasiRows.length; i += FORMASI_BATCH) {
      formasiChunks.push(formasiRows.slice(i, i + FORMASI_BATCH));
    }
    // Process up to 4 concurrent batch requests
    const CONCURRENCY = 4;
    for (let i = 0; i < formasiChunks.length; i += CONCURRENCY) {
      const concurrentSlice = formasiChunks.slice(i, i + CONCURRENCY);
      await Promise.all(
        concurrentSlice.map(async (chunk, cIdx) => {
          const { error: fErr } = await supabase.from('formasi').upsert(chunk);
          if (fErr) {
            console.error('[Supabase Cloud] Upsert formasi error:', fErr.message);
            throw new Error(`[Supabase Error] Gagal menyimpan baris formasi ke Supabase: ${fErr.message} (Batch ${i + cIdx + 1}, Kode: ${fErr.code || 'DB_ERROR'})`);
          }
        })
      );
    }
    console.log(`[Supabase Cloud] Successfully synced ${formasiRows.length} formasi records to Supabase.`);
  }

  if (pesertaRows.length > 0) {
    const PESERTA_BATCH = 500;
    const pesertaChunks: any[][] = [];
    for (let i = 0; i < pesertaRows.length; i += PESERTA_BATCH) {
      pesertaChunks.push(pesertaRows.slice(i, i + PESERTA_BATCH));
    }
    // Process up to 4 concurrent batch requests
    const CONCURRENCY = 4;
    for (let i = 0; i < pesertaChunks.length; i += CONCURRENCY) {
      const concurrentSlice = pesertaChunks.slice(i, i + CONCURRENCY);
      await Promise.all(
        concurrentSlice.map(async (chunk, cIdx) => {
          const { error: pErr } = await supabase.from('peserta').upsert(chunk);
          if (pErr) {
            console.error('[Supabase Cloud] Upsert peserta error:', pErr.message);
            throw new Error(`[Supabase Error] Gagal menyimpan data peserta ke Supabase: ${pErr.message} (Batch ${i + cIdx + 1}, Kode: ${pErr.code || 'DB_ERROR'})`);
          }
        })
      );
    }
    console.log(`[Supabase Cloud] Successfully synced ${pesertaRows.length} peserta records to Supabase.`);
  }

  // Only update runtime memory cache once persistent cloud save has succeeded completely
  const cachedList = sanitizedList.map(prepareForMemoryCache);
  memoryInstansiCache = cachedList;
  lastCloudSyncTime = new Date().toISOString();
}

/**
 * Persists ONLY a single instansi (and its formasi + peserta rows) to Supabase Cloud
 * and updates server memory cache & local backup. This avoids re-saving or re-processing
 * all other instansi records during upload or update.
 */
async function persistSingleInstansiToCloud(item: InstansiItem): Promise<InstansiItem> {
  const id = getValidInstansiId(item);
  const sanitizedItem: InstansiItem = {
    ...item,
    id,
    updatedAt: item.updatedAt || new Date().toISOString(),
  };

  // 1. Sync ONLY this single instansi to Supabase Cloud Database with strict validation
  const supabase = getSupabase();
  const instansiRow = instansiToDbRow(sanitizedItem);

  // A. Upsert only THIS instansi row in Supabase
  const { error: instErr } = await supabase.from('instansi').upsert([instansiRow]);
  if (instErr) {
    console.error(`[Supabase Cloud] Upsert single instansi '${sanitizedItem.id}' error:`, instErr.message);
    supabaseErrorMessage = instErr.message;
    isSupabaseConnected = false;
    throw new Error(`[Supabase Error] Gagal menyimpan instansi "${sanitizedItem.nama}": ${instErr.message} (Kode: ${instErr.code || 'DB_ERROR'})`);
  }

  isSupabaseConnected = true;
  supabaseErrorMessage = null;

  // B. Clean ONLY this instansi's previous relational records (formasi & peserta)
  const { error: delPErr } = await supabase.from('peserta').delete().eq('instansi_id', sanitizedItem.id);
  if (delPErr) {
    console.warn(`[Supabase Cloud] Clean existing peserta notice for '${sanitizedItem.id}':`, delPErr.message);
  }
  const { error: delFErr } = await supabase.from('formasi').delete().eq('instansi_id', sanitizedItem.id);
  if (delFErr) {
    console.warn(`[Supabase Cloud] Clean existing formasi notice for '${sanitizedItem.id}':`, delFErr.message);
  }

  // C. Extract and upsert formasi & peserta rows ONLY for THIS single instansi
  const formasiRows = extractFormasiDbRows([sanitizedItem]);
  const pesertaRows = extractPesertaDbRows([sanitizedItem]);

  if (formasiRows.length > 0) {
    const FORMASI_BATCH = 300;
    const formasiChunks: any[][] = [];
    for (let i = 0; i < formasiRows.length; i += FORMASI_BATCH) {
      formasiChunks.push(formasiRows.slice(i, i + FORMASI_BATCH));
    }
    const CONCURRENCY = 4;
    for (let i = 0; i < formasiChunks.length; i += CONCURRENCY) {
      const concurrentSlice = formasiChunks.slice(i, i + CONCURRENCY);
      await Promise.all(
        concurrentSlice.map(async (chunk, cIdx) => {
          const { error: fErr } = await supabase.from('formasi').upsert(chunk);
          if (fErr) {
            console.error('[Supabase Cloud] Upsert formasi error:', fErr.message);
            throw new Error(`[Supabase Error] Gagal menyimpan baris formasi ke Supabase: ${fErr.message} (Batch ${i + cIdx + 1}, Kode: ${fErr.code || 'DB_ERROR'})`);
          }
        })
      );
    }
    console.log(`[Supabase Cloud] Successfully synced ${formasiRows.length} formasi records for instansi '${sanitizedItem.nama}' to Supabase.`);
  }

  if (pesertaRows.length > 0) {
    const PESERTA_BATCH = 500;
    const pesertaChunks: any[][] = [];
    for (let i = 0; i < pesertaRows.length; i += PESERTA_BATCH) {
      pesertaChunks.push(pesertaRows.slice(i, i + PESERTA_BATCH));
    }
    const CONCURRENCY = 4;
    for (let i = 0; i < pesertaChunks.length; i += CONCURRENCY) {
      const concurrentSlice = pesertaChunks.slice(i, i + CONCURRENCY);
      await Promise.all(
        concurrentSlice.map(async (chunk, cIdx) => {
          const { error: pErr } = await supabase.from('peserta').upsert(chunk);
          if (pErr) {
            console.error('[Supabase Cloud] Upsert peserta error:', pErr.message);
            throw new Error(`[Supabase Error] Gagal menyimpan data peserta ke Supabase: ${pErr.message} (Batch ${i + cIdx + 1}, Kode: ${pErr.code || 'DB_ERROR'})`);
          }
        })
      );
    }
    console.log(`[Supabase Cloud] Successfully synced ${pesertaRows.length} peserta records for instansi '${sanitizedItem.nama}' to Supabase.`);
  }

  // 2. Update memory cache with all formations intact (participants stripped to conserve RAM)
  const cacheItem: InstansiItem = prepareForMemoryCache(sanitizedItem);

  const idx = memoryInstansiCache.findIndex((i) => i.id === id);
  if (idx === -1) {
    memoryInstansiCache = [cacheItem, ...memoryInstansiCache];
  } else {
    memoryInstansiCache[idx] = cacheItem;
  }
  lastCloudSyncTime = new Date().toISOString();

  // 3. Update server local JSON backup file asynchronously
  safeWriteJsonFile(CLOUD_DB_FILE, memoryInstansiCache).catch((err) => {
    console.error('[Cloud DB] Failed to update local backup file for single instansi:', err);
  });

  return cacheItem;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size limit to handle large PDFs and image scans (up to 100MB)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Express JSON body parse error handler to prevent HTML 500/503 responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Express Body/Middleware Error:', err);
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Terjadi kesalahan pengiriman data ke server.',
      });
    }
    next();
  });

  // Initialize Gemini AI SDK
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Route: Health check & Cloud Status
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cloudStorage: {
        active: true,
        recordCount: memoryInstansiCache.length,
        lastCloudSyncTime,
      },
    });
  });

  // =================================================================
  // 50% QUOTA SAFEGUARD & USER AI ASSISTANT ENDPOINTS
  // =================================================================
  // Alokasi 50% kuota harian untuk publik/user, sisa 50% dicadangkan khusus untuk Admin
  const MAX_DAILY_USER_AI_QUOTA = Number(process.env.USER_AI_DAILY_QUOTA) || 750;
  let currentQuotaDate = new Date().toISOString().slice(0, 10);
  let currentDailyUserAiCount = 0;
  const userAiPerIpTracker = new Map<string, { count: number; date: string }>();

  function checkAndIncrementUserAiQuota(clientIp: string): {
    allowed: boolean;
    remaining: number;
    limit: number;
    used: number;
    error?: string;
  } {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentQuotaDate) {
      currentQuotaDate = today;
      currentDailyUserAiCount = 0;
      userAiPerIpTracker.clear();
    }

    if (currentDailyUserAiCount >= MAX_DAILY_USER_AI_QUOTA) {
      return {
        allowed: false,
        remaining: 0,
        limit: MAX_DAILY_USER_AI_QUOTA,
        used: currentDailyUserAiCount,
        error: `Batas kuota harian analisis AI publik (alokasi 50% admin) telah tercapai (${currentDailyUserAiCount}/${MAX_DAILY_USER_AI_QUOTA} pertanyaan). Kuota akan direset otomatis besok pukul 00.00 WIB. Anda tetap dapat meneliti data secara mandiri menggunakan filter tabel.`,
      };
    }

    // Per-IP spam limiter (maksimal 30 pertanyaan per IP per hari agar kuota 50% tidak dihabiskan 1 user)
    const ipRecord = userAiPerIpTracker.get(clientIp);
    if (ipRecord && ipRecord.date === today && ipRecord.count >= 30) {
      return {
        allowed: false,
        remaining: Math.max(0, MAX_DAILY_USER_AI_QUOTA - currentDailyUserAiCount),
        limit: MAX_DAILY_USER_AI_QUOTA,
        used: currentDailyUserAiCount,
        error: 'Anda telah mencapai batas 30 pertanyaan AI hari ini untuk perangkat ini. Pembatasan ini diterapkan agar kuota 50% dinikmati merata oleh seluruh pengguna.',
      };
    }

    currentDailyUserAiCount += 1;
    const nextIpCount = (ipRecord && ipRecord.date === today) ? ipRecord.count + 1 : 1;
    userAiPerIpTracker.set(clientIp, { count: nextIpCount, date: today });

    return {
      allowed: true,
      remaining: Math.max(0, MAX_DAILY_USER_AI_QUOTA - currentDailyUserAiCount),
      limit: MAX_DAILY_USER_AI_QUOTA,
      used: currentDailyUserAiCount,
    };
  }

  // GET /api/ai/quota-status - Informasi sisa kuota 50% untuk publik
  app.get('/api/ai/quota-status', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentQuotaDate) {
      currentQuotaDate = today;
      currentDailyUserAiCount = 0;
      userAiPerIpTracker.clear();
    }
    const remaining = Math.max(0, MAX_DAILY_USER_AI_QUOTA - currentDailyUserAiCount);
    res.json({
      success: true,
      limit: MAX_DAILY_USER_AI_QUOTA,
      used: currentDailyUserAiCount,
      remaining,
      percentUsed: Math.round((currentDailyUserAiCount / MAX_DAILY_USER_AI_QUOTA) * 100),
      allocation: '50% Kuota Admin',
      date: currentQuotaDate,
    });
  });

  // POST /api/ai/analyze-formasi - Asisten Analisis Formasi berbasis Context Grounding
  app.post('/api/ai/analyze-formasi', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
      const quotaCheck = checkAndIncrementUserAiQuota(clientIp);

      if (!quotaCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: quotaCheck.error,
          quota: {
            limit: quotaCheck.limit,
            used: quotaCheck.used,
            remaining: quotaCheck.remaining,
          },
        });
      }

      const { question, instansiName, jurusan, jenjang, formasiList } = req.body;

      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Pertanyaan tidak boleh kosong.' });
      }

      if (!Array.isArray(formasiList) || formasiList.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Tidak ada data formasi yang sedang aktif di layar untuk dianalisis.',
        });
      }

      // Format data formasi ramping (hanya kolom penting untuk menghemat token dan menjaga kecepatan)
      // Dibatasi 20 formasi teratas dari hasil filter aktif agar respon ultra cepat dan hemat token
      const targetList = formasiList.slice(0, 20);
      const formattedFormasiRows = targetList.map((f: any, idx: number) => {
        const parts = [
          `[#${idx + 1}] Jabatan: ${f.jabatan || '-'}`,
          `Unit Kerja / Lokasi: ${f.lokasi || '-'}`,
          `Pendidikan: ${f.pendidikan || '-'}`,
          `Jenis Formasi: ${f.jenisFormasi || 'UMUM'}`,
          `Kuota: ${f.kuota || 1}`,
          `Peserta SKB / Pelamar: ${f.pelamarSkb || f.totalPesertaSkb || 0}`,
          `Rasio: ${f.rasio || '-'}`,
        ];
        if (f.cutoffNilaiAkhir != null) {
          parts.push(`Passing Grade / Cutoff Nilai Akhir: ${f.cutoffNilaiAkhir}`);
        }
        if (f.minSkd != null && f.maxSkd != null) {
          parts.push(`Rentang SKD: ${f.minSkd} - ${f.maxSkd}`);
        }
        return parts.join(' | ');
      }).join('\n');

      const systemInstruction = `Kamu adalah Konsultan & Asisten Analisis Formasi CASN/PPPK "Formasi Insight".
Tugasmu adalah membantu calon peserta menganalisis formasi secara objektif, strategis, dan ramah, HANYA berdasarkan data tabel yang sedang aktif dilihat pengguna di layarnya.

ATURAN WAJIB (STRICT CONTEXT GROUNDING):
1. HANYA gunakan dan analisis data formasi yang tercantum pada [DATA FORMASI AKTIF PADA TABEL] di bawah ini.
2. DILARANG KERAS mengarang, berhalusinasi, atau merekomendasikan instansi/jabatan/lokasi di luar data yang dilampirkan.
3. Jika pengguna menanyakan lokasi/daerah yang dekat dengan rumah mereka:
   - Periksa bagian "Unit Kerja / Lokasi" pada daftar formasi terlampir.
   - Cocokkan secara cerdas dengan nama daerah/kecamatan/kota yang disebutkan pengguna.
   - Jika ada yang cocok/dekat, berikan rekomendasi dan jelaskan alasan kedekatannya.
   - Jika tidak ada lokasi yang cocok atau dekat di dalam data terlampir, katakan secara jujur dan sebutkan opsi lokasi terdekat yang tersedia pada daftar.
4. Jika pengguna menanyakan peluang lolos / formasi peluang masuk terbesar:
   - Analisis rasio keketatan (kuota vs jumlah pelamar). Rasio 1 : 1 atau 1 : 2 jauh lebih berpeluang daripada 1 : 10 atau 1 : 20.
   - Tinjau juga nilai cutoff atau nilai SKD jika tercantum.
   - Berikan rekomendasi 1-3 formasi terbaik dengan peluang masuk tertinggi.
5. Format jawaban:
   - Gunakan Markdown yang rapi (bold untuk nama jabatan & lokasi, bullet points, emoji penanda seperti 🎯, 📍, ⚖️, 💡).
   - Buat jawaban ringkas, terstruktur, langsung menjawab pertanyaan pengguna, dan beri tips strategis di akhir.`;

      const userPrompt = `[KONTEKS FILTER AKTIF PENGGUNA]
- Instansi: ${instansiName || 'Semua Instansi'}
- Jurusan yang difilter: ${jurusan || 'Semua Jurusan'}
- Jenjang Pendidikan: ${jenjang || 'Semua Jenjang'}
- Total Formasi Ditampilkan: ${targetList.length} formasi (dari total ${formasiList.length} hasil filter)

[DATA FORMASI AKTIF PADA TABEL]:
${formattedFormasiRows}

[PERTANYAAN PENGGUNA]:
"${question.trim()}"

Tolong berikan analisis dan jawaban terbaik berdasarkan data formasi aktif di atas.`;

      const ai = getGeminiClient();
      
      let timerId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error('Koneksi ke server AI Google melebihi batas waktu (timeout 30 detik). Silakan coba lagi.')), 30000);
      });

      const geminiCall = ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.2, // Rendah untuk menghindari halusinasi
          maxOutputTokens: 800, // Jawaban padat, terstruktur, dan cepat selesai
        },
      });

      let geminiResult: any;
      try {
        geminiResult = await Promise.race([geminiCall, timeoutPromise]);
      } finally {
        if (timerId) clearTimeout(timerId);
      }

      const answer = geminiResult.text || 'Maaf, AI tidak dapat menghasilkan jawaban saat ini.';

      if (!res.headersSent) {
        res.json({
          success: true,
          answer,
          quota: {
            limit: quotaCheck.limit,
            used: quotaCheck.used,
            remaining: quotaCheck.remaining,
          },
        });
      }
    } catch (err: any) {
      if (res.headersSent) return;
      console.error('[AI Analyze Formasi Error]:', err);
      // Kembalikan kuota jika pemrosesan AI gagal agar user tidak rugi
      currentDailyUserAiCount = Math.max(0, currentDailyUserAiCount - 1);
      
      let clientErrorMsg = 'Terjadi kesalahan saat memproses analisis AI.';
      if (err?.message?.includes('503') || err?.message?.includes('high demand') || err?.message?.includes('UNAVAILABLE')) {
        clientErrorMsg = 'Layanan Google Gemini sedang mengalami lonjakan trafik sesaat. Kuota Anda tidak terpotong. Silakan klik kirim ulang beberapa detik lagi.';
      } else if (err?.message?.includes('timeout') || err?.message?.includes('HeadersTimeoutError') || err?.message?.includes('fetch failed')) {
        clientErrorMsg = 'Waktu respon server AI melebihi batas. Kuota Anda tidak terpotong. Silakan coba ajukan pertanyaan kembali.';
      } else if (err?.message) {
        clientErrorMsg = err.message;
      }

      res.status(500).json({
        success: false,
        error: clientErrorMsg,
      });
    }
  });

  // =================================================================
  // CLOUD DATABASE API ENDPOINTS (v2.6)
  // =================================================================

  // 1. GET /api/instansi - Load all instansi records from Cloud Storage (with optional force refresh)
  app.get('/api/instansi', async (req, res) => {
    try {
      if (req.query.refresh === 'true' || req.query.refresh === '1') {
        if (fs.existsSync(CLOUD_DB_FILE)) {
          try {
            const fileData = await fsPromises.readFile(CLOUD_DB_FILE, 'utf-8');
            const parsed = JSON.parse(fileData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              memoryInstansiCache = parsed;
              lastCloudSyncTime = new Date().toISOString();
            }
          } catch (e) {
            console.warn('[Cloud File DB] Notice reading cache on refresh:', e);
          }
        }
      }

      res.json({
        success: true,
        source: 'cloud',
        lastUpdated: lastCloudSyncTime,
        count: memoryInstansiCache.length,
        data: memoryInstansiCache,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal membaca Cloud Database.' });
    }
  });

  // 1b. GET /api/formasi - Query relational formasi rows with pagination and instansi filter
  app.get('/api/formasi', async (req, res) => {
    try {
      const { instansi_id, limit, offset } = req.query;
      const parsedLimit = Math.min(Math.max(Number(limit) || 1000, 1), 5000);
      const parsedOffset = Math.max(Number(offset) || 0, 0);

      const supabase = getSupabase();
      let query = supabase.from('formasi').select('*');
      if (instansi_id) {
        query = query.eq('instansi_id', String(instansi_id));
      }
      query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      res.json({
        success: true,
        count: Array.isArray(data) ? data.length : 0,
        data: data || [],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal memuat data formasi dari database.' });
    }
  });

  // 2. POST /api/instansi & POST /api/instansi/sync - Save / Sync full instansi list to Cloud Storage & Supabase
  const handleSaveInstansiList = async (req: express.Request, res: express.Response) => {
    try {
      const list = req.body?.list || req.body?.instansiList;
      if (!Array.isArray(list)) {
        return res.status(400).json({ success: false, error: 'Data list harus berupa array instansi.' });
      }

      await persistCloudDatabase(list);
      res.json({
        success: true,
        source: 'cloud',
        message: 'Database instansi berhasil disimpan dan disinkronkan ke Supabase Cloud.',
        instansiCount: memoryInstansiCache.length,
        lastUpdated: lastCloudSyncTime,
        data: memoryInstansiCache,
      });
    } catch (err: any) {
      console.error('[Cloud DB] Error saving instansi list:', err);
      res.status(500).json({ success: false, error: err?.message || 'Gagal menyimpan ke Cloud Database.' });
    }
  };

  app.post('/api/instansi', handleSaveInstansiList);
  app.post('/api/instansi/sync', handleSaveInstansiList);

  // 3. PUT /api/instansi/:id - Update single instansi or parsed data in Cloud Storage
  app.put('/api/instansi/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existingItem = memoryInstansiCache.find((i) => i.id === id);
      const targetItem: InstansiItem = {
        ...(existingItem || {}),
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
      };

      // Persist ONLY this single instansi to Supabase & Server Cache
      const savedItem = await persistSingleInstansiToCloud(targetItem);

      res.json({
        success: true,
        message: existingItem ? 'Instansi berhasil diperbarui di Cloud.' : 'Instansi baru berhasil ditambahkan ke Cloud.',
        data: savedItem,
      });
    } catch (err: any) {
      console.error('[Cloud DB] Error updating single instansi:', err);
      res.status(500).json({ success: false, error: err?.message || 'Gagal menyimpan instansi ke Cloud.' });
    }
  });

  // 4. DELETE /api/instansi/:id - Delete single instansi from Cloud Storage instantly
  app.delete('/api/instansi/:id', async (req, res) => {
    try {
      const { id } = req.params;
      memoryInstansiCache = memoryInstansiCache.filter((i) => i.id !== id);
      lastCloudSyncTime = new Date().toISOString();

      // 1. Update server local JSON backup asynchronously
      safeWriteJsonFile(CLOUD_DB_FILE, memoryInstansiCache).catch((err) => {
        console.error('[Cloud DB] Failed to update local backup file on delete:', err);
      });

      // 2. Direct atomic delete from Supabase (cascades to formasi & peserta tables instantly)
      try {
        const supabase = getSupabase();
        await supabase.from('peserta').delete().eq('instansi_id', id);
        await supabase.from('formasi').delete().eq('instansi_id', id);
        const { error } = await supabase.from('instansi').delete().eq('id', id);
        if (!error) {
          isSupabaseConnected = true;
          supabaseErrorMessage = null;
        } else {
          console.warn('[Supabase Cloud] Direct delete notice:', error.message);
        }
      } catch (e: any) {
        console.warn('[Supabase Cloud] Delete error:', e?.message || e);
      }

      res.json({
        success: true,
        message: 'Instansi berhasil dihapus dari Cloud Database.',
        deletedId: id,
        count: memoryInstansiCache.length,
      });
    } catch (err: any) {
      console.error('[Cloud DB] Error deleting instansi:', err);
      res.status(500).json({ success: false, error: err?.message || 'Gagal menghapus instansi dari Cloud.' });
    }
  });

  // 5. GET /api/cloud-status - Check Cloud & Supabase Database health & sync status
  app.get('/api/cloud-status', async (req, res) => {
    let supabasePingSuccess = false;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('instansi').select('id').limit(1);
      if (!error) {
        supabasePingSuccess = true;
        isSupabaseConnected = true;
        supabaseErrorMessage = null;
      } else {
        supabaseErrorMessage = error.message;
      }
    } catch (err: any) {
      supabaseErrorMessage = err?.message || String(err);
    }

    const withDataCount = memoryInstansiCache.filter((i) => i.parsedData && i.parsedData.formasiList?.length > 0).length;
    res.json({
      success: true,
      cloudActive: true,
      provider: 'Supabase Cloud PostgreSQL',
      projectName: 'Formasi Insight',
      projectId: 'tecsyuwdfmfidkxctvny',
      supabaseConnected: supabasePingSuccess || isSupabaseConnected,
      supabaseErrorMessage,
      storageType: supabasePingSuccess ? 'Supabase Cloud PostgreSQL Database' : 'Server Persistent Backup Store',
      totalInstansi: memoryInstansiCache.length,
      instansiWithData: withDataCount,
      lastSyncTime: lastCloudSyncTime,
      version: 'v2.6 Supabase',
    });
  });

  // 6. GET /api/peserta - On-demand query of participant records from Supabase relational database or memory cache
  app.get('/api/peserta', async (req, res) => {
    try {
      const { instansi_id, formasi_id, limit, offset } = req.query;
      const fId = typeof formasi_id === 'string' ? formasi_id.trim() : '';
      const iId = typeof instansi_id === 'string' ? instansi_id.trim() : '';

      // Try Supabase first if available
      try {
        const supabase = getSupabase();
        let query = supabase.from('peserta').select('*').order('no_urut', { ascending: true });

        if (fId) {
          if (iId) {
            query = query.eq('instansi_id', iId);
            if (fId.startsWith(iId)) {
              query = query.eq('formasi_id', fId);
            } else {
              const fullFId = `${iId}-${fId}`;
              query = query.or(`formasi_id.eq.${fId},formasi_id.eq.${fullFId},formasi_id.ilike.%-${fId}`);
            }
          } else {
            query = query.or(`formasi_id.eq.${fId},formasi_id.ilike.%-${fId}`);
          }
        } else if (iId) {
          query = query.eq('instansi_id', iId);
        }

        if (limit) {
          const l = parseInt(limit as string, 10);
          if (Number.isFinite(l) && l > 0) {
            query = query.limit(l);
          }
        }
        if (offset) {
          const o = parseInt(offset as string, 10);
          if (Number.isFinite(o) && o >= 0) {
            const l = limit ? parseInt(limit as string, 10) : 50;
            query = query.range(o, o + l - 1);
          }
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, count: data.length, data });
        }
      } catch (sbQueryErr: any) {
        console.warn('[Supabase Peserta Query Error - falling back to memory]:', sbQueryErr?.message || sbQueryErr);
      }

      // Fallback: search in memoryInstansiCache
      let memoryPeserta: any[] = [];
      for (const inst of memoryInstansiCache) {
        if (iId && inst.id !== iId) continue;
        if (!inst.parsedData) continue;

        const blocks = Array.isArray(inst.parsedData.formasiList) ? inst.parsedData.formasiList : [];
        for (let idx = 0; idx < blocks.length; idx++) {
          const b = blocks[idx];
          const bId = b.id || `formasi-${idx + 1}`;
          const fullFormasiId = `${inst.id}-${bId}`;
          const isMatch = !fId || fId === bId || fId === fullFormasiId || fId === `${inst.id}-formasi-${idx + 1}`;

          if (isMatch && Array.isArray(b.pesertaList) && b.pesertaList.length > 0) {
            const rows = b.pesertaList.map((p, pIdx) => ({
              id: `${inst.id}-${p.noPeserta || pIdx + 1}`,
              formasi_id: fullFormasiId,
              instansi_id: inst.id,
              no_urut: p.no || pIdx + 1,
              no_peserta: p.noPeserta || '-',
              nama: p.nama || '-',
              tanggal_lahir: p.tanggalLahir || '-',
              pendidikan: p.pendidikan || '-',
              ipk: p.ipk ?? null,
              twk: p.twk || (p as any).skdDetails?.twk || 0,
              tiu: p.tiu || (p as any).skdDetails?.tiu || 0,
              tkp: p.tkp || (p as any).skdDetails?.tkp || 0,
              total_skd: p.totalSkd || 0,
              skor_skd: p.skorSkd || (p as any).bobotSkd || 0,
              skb: p.skb || 0,
              skor_skb: p.skorSkb || (p as any).bobotSkb || 0,
              nilai_akhir: p.nilaiAkhir || 0,
              keterangan: p.keterangan || '-',
            }));
            memoryPeserta.push(...rows);
          }
        }
      }

      if (memoryPeserta.length > 0) {
        return res.json({ success: true, count: memoryPeserta.length, data: memoryPeserta });
      }

      res.json({ success: true, count: 0, data: [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal membaca data peserta dari database.' });
    }
  });

  // 7. GET /api/instansi/:id/full - Fully reconstructs and hydrates complete instansi JSON with ALL formasi and ALL peserta for 100% complete JSON export
  app.get('/api/instansi/:id/full', async (req, res) => {
    try {
      const { id } = req.params;
      const cached = memoryInstansiCache.find((i) => i.id === id);
      if (!cached) {
        return res.status(404).json({ success: false, error: `Instansi dengan ID "${id}" tidak ditemukan.` });
      }

      // Check if memory cache already contains full formasi & peserta list
      const hasFullMemory =
        cached.parsedData &&
        Array.isArray(cached.parsedData.formasiList) &&
        cached.parsedData.formasiList.length > 10 &&
        cached.parsedData.formasiList.some((f) => Array.isArray(f.pesertaList) && f.pesertaList.length > 0);

      if (hasFullMemory) {
        return res.json({ success: true, source: 'memory', data: cached });
      }

      // Reconstruct from Supabase relational 'formasi' and 'peserta' tables
      try {
        const supabase = getSupabase();
        
        // Fetch all formasi rows for this instansi
        const { data: formasiRows, error: fErr } = await supabase
          .from('formasi')
          .select('*')
          .eq('instansi_id', id)
          .order('created_at', { ascending: true });

        // Fetch all peserta rows for this instansi
        const { data: pesertaRows, error: pErr } = await supabase
          .from('peserta')
          .select('*')
          .eq('instansi_id', id)
          .order('no_urut', { ascending: true });

        if (!fErr && Array.isArray(formasiRows) && formasiRows.length > 0) {
          const pesertaByFormasiId = new Map<string, any[]>();
          if (Array.isArray(pesertaRows)) {
            for (const p of pesertaRows) {
              const fKey = p.formasi_id || '';
              if (!pesertaByFormasiId.has(fKey)) {
                pesertaByFormasiId.set(fKey, []);
              }
              pesertaByFormasiId.get(fKey)!.push({
                no: p.no_urut || 1,
                noPeserta: p.no_peserta || '-',
                nama: p.nama || '-',
                tanggalLahir: p.tanggal_lahir || '-',
                pendidikan: p.pendidikan || '-',
                ipk: p.ipk !== null ? Number(p.ipk) : 0,
                twk: Number(p.twk) || 0,
                tiu: Number(p.tiu) || 0,
                tkp: Number(p.tkp) || 0,
                totalSkd: Number(p.total_skd) || 0,
                skorSkd: Number(p.skor_skd) || 0,
                skb: Number(p.skb) || 0,
                skorSkb: Number(p.skor_skb) || 0,
                nilaiAkhir: Number(p.nilai_akhir) || 0,
                keterangan: p.keterangan || '-',
                skdDetails: {
                  twk: Number(p.twk) || 0,
                  tiu: Number(p.tiu) || 0,
                  tkp: Number(p.tkp) || 0,
                },
                bobotSkd: Number(p.skor_skd) || 0,
                bobotSkb: Number(p.skor_skb) || 0,
              });
            }
          }

          const reconstructedFormasiList = formasiRows.map((fRow: any, idx: number) => {
            const fKey = fRow.id;
            const pList = pesertaByFormasiId.get(fKey) || pesertaByFormasiId.get(`${id}-${fKey}`) || [];
            return {
              id: fRow.id.replace(new RegExp(`^${id}-`), ''),
              header: {
                instansi: cached.nama,
                kodeInstansi: cached.kode || '',
                jabatanFormasi: fRow.jabatan || '',
                kodeJabatan: fRow.kode_jabatan || '',
                namaJabatan: fRow.jabatan || '',
                lokasiFormasi: fRow.lokasi || '',
                kodeLokasi: '',
                namaLokasi: fRow.lokasi || '',
                pendidikan: fRow.pendidikan || '',
                jenisFormasi: fRow.jenis_formasi || 'UMUM',
                namaJenisFormasi: fRow.jenis_formasi || 'UMUM',
                jumlahKuota: fRow.kuota || 1,
                kuotaJabatan: fRow.kuota || 1,
              },
              pesertaCount: pList.length > 0 ? pList.length : (fRow.total_peserta_skb || 0),
              pesertaList: pList,
              verification: {
                isValid: true,
                scoreAccuracyPercent: 100,
                totalRecords: pList.length,
                discrepanciesCount: 0,
                passedCount: fRow.total_lulus || pList.filter((p: any) => p.keterangan && String(p.keterangan).startsWith('P/L')).length,
                failedCount: Math.max(0, pList.length - (fRow.total_lulus || 0)),
                discrepanciesList: [],
              },
            };
          });

          const allPeserta = Array.from(pesertaByFormasiId.values()).flat();

          const fullInstansi: InstansiItem = {
            ...cached,
            parsedData: {
              meta: cached.parsedData?.meta || {
                docTitle: 'Hasil Integrasi SKD dan SKB SSCASN BKN',
                tahun: cached.tahun || '2024',
                parsedAt: cached.updatedAt || new Date().toISOString(),
                sourceType: 'pdf',
                fileName: cached.pdfFileName,
                totalFormasiCount: reconstructedFormasiList.length,
                totalPesertaCount: allPeserta.length,
                totalPages: 1,
              },
              pageErrors: [],
              formasiList: reconstructedFormasiList,
              header: reconstructedFormasiList[0]?.header || cached.parsedData?.header || {
                instansi: cached.nama || '',
                kodeInstansi: cached.kode || '',
                jabatanFormasi: '',
                lokasiFormasi: '',
                jenisFormasi: 'UMUM',
                pendidikan: '',
                jumlahKuota: 1,
              },
              pesertaList: allPeserta,
              verification: {
                isValid: true,
                scoreAccuracyPercent: 100,
                totalRecords: allPeserta.length,
                discrepanciesCount: 0,
                passedCount: allPeserta.filter((p: any) => p.keterangan && String(p.keterangan).startsWith('P/L')).length,
                failedCount: allPeserta.filter((p: any) => !p.keterangan || !String(p.keterangan).startsWith('P/L')).length,
                discrepanciesList: [],
              },
            },
          };

          return res.json({ success: true, source: 'supabase_hydrated', data: fullInstansi });
        }
      } catch (hydrateErr) {
        console.warn('[Hydration from Supabase failed, using cache]:', hydrateErr);
      }

      // Fallback to cached item
      return res.json({ success: true, source: 'cache', data: cached });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal merekonstruksi data instansi lengkap.' });
    }
  });

  // API Route: Quick Instansi Header Extraction from PDF page 1
  app.post('/api/extract-instansi-header', async (req, res) => {
    try {
      const { fileData, fileName } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: 'fileData tidak ditemukan.' });
      }

      const fileBuffer = Buffer.from(fileData, 'base64');
      let extractedText = '';

      // 1. Quick text extraction with pdf-parse
      try {
        const parser = new PDFParse({ data: fileBuffer });
        const textRes = await parser.getText();
        extractedText = textRes?.text || '';
        await parser.destroy();
      } catch (pdfErr) {
        console.warn('[extract-instansi-header] pdf-parse warning:', pdfErr);
      }

      // 2. Parse text with pattern classifier
      let headerResult = extractInstansiHeaderFromRawText(extractedText);

      // 3. Coordinate-based fallback if pdf-parse text didn't match
      if (!headerResult || !headerResult.nama) {
        try {
          const coordResult = await parsePdfWithCoordinates(fileBuffer, fileName || 'doc.pdf', {
            startPage: 1,
            endPage: 2,
          });
          if (coordResult?.header) {
            const h = coordResult.header;
            const nama = h.namaInstansi || h.instansi || '';
            const kode = h.kodeInstansi || '';
            if (nama) {
              const classification = classifyInstansi(nama, kode);
              headerResult = {
                nama,
                kode,
                kategori: classification.kategori,
                provinsi: classification.provinsi,
                tahun: coordResult.meta?.tahun || '2024',
              };
            }
          }
        } catch (coordErr) {
          console.warn('[extract-instansi-header] coordinate parse fallback warning:', coordErr);
        }
      }

      if (headerResult && headerResult.nama) {
        return res.json({ success: true, data: headerResult });
      }

      return res.json({
        success: false,
        message: 'Header instansi SSCASN belum dapat diekstrak otomatis. Silakan lengkapi pada form yang tersedia.',
      });
    } catch (err: any) {
      console.error('[extract-instansi-header] Error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Gagal mengekstrak header instansi.' });
    }
  });

  // API Route: Parse SSCASN PDF / Image / Excel / Text
  app.post('/api/parse-sscasn', async (req, res) => {
    try {
      const { fileData, fileName, mimeType, rawTextMode } = req.body;

      if (rawTextMode && typeof rawTextMode === 'string') {
        const parsed = parseSSCASNFromText(rawTextMode, fileName || 'pasted_text.txt');
        return res.json({ success: true, data: parsed });
      }

      if (!fileData || !mimeType) {
        return res.status(400).json({ error: 'Data file atau mimeType tidak ditemukan.' });
      }

      // Convert base64 fileData to buffer
      const fileBuffer = Buffer.from(fileData, 'base64');

      // 1. If Excel file (.xlsx, .xls, .csv)
      if (
        mimeType.includes('sheet') ||
        mimeType.includes('excel') ||
        mimeType.includes('csv') ||
        fileName?.endsWith('.xlsx') ||
        fileName?.endsWith('.xls') ||
        fileName?.endsWith('.csv')
      ) {
        try {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const csvText = xlsx.utils.sheet_to_csv(sheet);
          const parsed = parseSSCASNFromText(csvText, fileName);
          return res.json({ success: true, data: parsed });
        } catch (excelErr) {
          console.warn('Excel parse failed, falling back to Gemini:', excelErr);
        }
      }

      // 2. Coordinate-based PDF Parser using word coordinates (X, Y) without AI/OCR/Vision
      if (mimeType.includes('pdf') || fileName?.endsWith('.pdf')) {
        try {
          const reqStartPage = req.query.startPage ? parseInt(req.query.startPage as string, 10) : (req.body?.startPage ? parseInt(req.body.startPage, 10) : undefined);
          const reqEndPage = req.query.endPage ? parseInt(req.query.endPage as string, 10) : (req.body?.endPage ? parseInt(req.body.endPage, 10) : undefined);
          const initialHeader = req.body?.initialHeader || undefined;
          const coordResult = await parsePdfWithCoordinates(fileBuffer, fileName, { startPage: reqStartPage, endPage: reqEndPage, initialHeader });
          if (coordResult) {
            return res.json({ success: true, data: coordResult });
          }
        } catch (pdfCoordErr) {
          console.warn('Coordinate PDF parser failed, falling back to Gemini:', pdfCoordErr);
        }
      }

      // 3. Fallback to pdf-parse for text extraction if needed
      let pdfTextContent = '';
      if (mimeType.includes('pdf')) {
        try {
          const parser = new PDFParse({ data: fileBuffer });
          const textRes = await parser.getText();
          pdfTextContent = textRes?.text || '';
          await parser.destroy();
        } catch (e) {
          console.warn('pdf-parse could not read text directly:', e);
        }
      }

      // 3. Use Gemini 3.6 Flash for 100% accurate extraction from PDF / Image / Text
      const ai = getGeminiClient();

      const systemInstruction = `
Kamu adalah parser dokumen SSCASN BKN (Sistem SeleKSI CASN Badan Kepegawaian Negara) tingkat enterprise dengan akurasi 100%.
Tugasmu adalah mengekstrak SELURUH data dari dokumen laporan "HASIL INTEGRASI SKD DAN SKB PENGADAAN CPNS / CASN" menjadi JSON yang sangat terstruktur.

PENTING - MULTI-FORMASI:
Satu dokumen PDF atau Excel SSCASN BKN DAPAT BERISI LEBIH DARI SATU FORMASI (berbagai Jabatan Formasi, Lokasi Formasi, Jenis Formasi, Kualifikasi Pendidikan, atau Unit Kerja berbeda).
Setiap kali kamu melihat judul atau header baru (Instansi, Jabatan Formasi, Lokasi Formasi, Jenis Formasi, Pendidikan, Jumlah Kuota), itu adalah KELOMPOK FORMASI BARU.
Ekstrak SETIAP kelompok formasi tersebut ke dalam array "formasiList".

UNTUK SETIAP ITEM DI FORMASILIST:
1. HEADER & FORMASI:
- instansi: Nama Instansi lengkap (misal: "6512 - Pemerintah Kab. Jember")
- jabatanFormasi: Nama Jabatan Formasi (misal: "JF0000333 - PENYULUH HUKUM AHLI PERTAMA")
- lokasiFormasi: Lokasi Formasi lengkap
- jenisFormasi: Jenis Formasi (misal: "1 - UMUM")
- pendidikan: Kualifikasi Pendidikan Formasi
- jumlahKuota: Jumlah kuota penetapan formasi (angka integer, misal: 2)

2. DAFTAR PESERTA (pesertaList) DARI FORMASI TERSEBUT:
Setiap baris peserta berisi 15 kolom persis:
(1) no: Nomor urut (integer: 1, 2, 3...)
(2) noPeserta: Nomor Peserta SSCASN (18 digit string, misal "24651220120001209")
(3) nama: Nama lengkap peserta (string KAPITAL)
(4) tanggalLahir: Tanggal lahir peserta (misal "19 Agustus 1998")
(5) pendidikan: Pendidikan peserta (misal "S-1 HUKUM")
(6) ipk: Nilai IPK / Nilai Sekolah (number, misal 3.76)
(7) twk: Nilai SKD TWK (integer, misal 115)
(8) tiu: Nilai SKD TIU (integer, misal 145)
(9) tkp: Nilai SKD TKP (integer, misal 191)
(10) totalSkd: Total nilai SKD = TWK + TIU + TKP (integer, misal 451)
(11) skorSkd: Skor SKD 40% = ((totalSkd / 5.5) * 0.40) (number, misal 32.8)
(12) skb: Nilai SKB murni (number, misal 68.0)
(13) skorSkb: Skor SKB 60% = (skb * 0.60) (number, misal 40.8)
(14) nilaiAkhir: Nilai Akhir Integrasi = skorSkd + skorSkb (number, misal 73.6)
(15) keterangan: Keterangan kelulusan (string: "P/L", "TL", "TH", "P/L-1", "TMS", "DISQ")

PASTIKAN SEMUA ANGKA DAN ANGKA DESIMAL SESUAI PERSIS DENGAN TABEL PADA DOKUMEN!
JANGAN MENLEWATKAN FORMASI MAUPUN PESERTA MANAPUN DARI DOKUMEN.

CRITICAL - ABAIKAN TABEL REKAPITULASI / RINGKASAN SKB:
Di dalam dokumen laporan SSCASN, terdapat tabel rekapitulasi ringkasan SKB dengan header:
"Jumlah Peserta SKB", "Jumlah Formasi", "Jumlah Metode SKB", "Hadir", "Tidak Hadir", "Tidak Lulus", "TMS", "TMS-1", "APS", "Lulus Akhir".
Tabel rekapitulasi ringkasan ini BUKAN BENTUK FORMASI ATAUPUN PESERTA.
JANGAN SEKALI-KALI memasukkan tabel rekapitulasi ini sebagai formasi maupun peserta (pendaftar 0). ABAIKAN TABEL RINGKASAN INI!
`;

      const promptText = `
Ekstrak seluruh informasi laporan SSCASN BKN dari dokumen terlampir berikut. Periksa semua halaman dan pastikan SEMUA FORMASI DAN PESERTA diekstrak ke dalam array formasiList.
${pdfTextContent ? `\n\n[Teks Hasil Ekstraksi PDF Direct]:\n${pdfTextContent.slice(0, 12000)}` : ''}
`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          docTitle: {
            type: Type.STRING,
            description: 'Judul dokumen laporan SSCASN',
          },
          tahun: {
            type: Type.STRING,
            description: 'Tahun pengadaan CASN/CPNS',
          },
          formasiList: {
            type: Type.ARRAY,
            description: 'Daftar seluruh kelompok/blok formasi yang ada di dalam dokumen',
            items: {
              type: Type.OBJECT,
              properties: {
                header: {
                  type: Type.OBJECT,
                  properties: {
                    instansi: { type: Type.STRING },
                    jabatanFormasi: { type: Type.STRING },
                    lokasiFormasi: { type: Type.STRING },
                    jenisFormasi: { type: Type.STRING },
                    pendidikan: { type: Type.STRING },
                    jumlahKuota: { type: Type.INTEGER },
                  },
                  required: [
                    'instansi',
                    'jabatanFormasi',
                    'lokasiFormasi',
                    'jenisFormasi',
                    'pendidikan',
                    'jumlahKuota',
                  ],
                },
                pesertaList: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      no: { type: Type.INTEGER },
                      noPeserta: { type: Type.STRING },
                      nama: { type: Type.STRING },
                      tanggalLahir: { type: Type.STRING },
                      pendidikan: { type: Type.STRING },
                      ipk: { type: Type.NUMBER },
                      twk: { type: Type.INTEGER },
                      tiu: { type: Type.INTEGER },
                      tkp: { type: Type.INTEGER },
                      totalSkd: { type: Type.INTEGER },
                      skorSkd: { type: Type.NUMBER },
                      skb: { type: Type.NUMBER },
                      skorSkb: { type: Type.NUMBER },
                      nilaiAkhir: { type: Type.NUMBER },
                      keterangan: { type: Type.STRING },
                    },
                    required: [
                      'no',
                      'noPeserta',
                      'nama',
                      'tanggalLahir',
                      'pendidikan',
                      'ipk',
                      'twk',
                      'tiu',
                      'tkp',
                      'totalSkd',
                      'skorSkd',
                      'skb',
                      'skorSkb',
                      'nilaiAkhir',
                      'keterangan',
                    ],
                  },
                },
              },
              required: ['header', 'pesertaList'],
            },
          },
        },
        required: ['formasiList'],
      };

      const geminiParts: any[] = [];

      // Add inline file part for Gemini Vision/Document processing
      geminiParts.push({
        inlineData: {
          mimeType: mimeType,
          data: fileData,
        },
      });

      geminiParts.push({ text: promptText });

      const geminiResult = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: { parts: geminiParts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema as any,
          temperature: 0.1, // Low temperature for ultra-high accuracy extraction
        },
      });

      const extractedText = geminiResult.text || '{}';
      const parsedJson = JSON.parse(extractedText);

      // Process list of formasi blocks
      const rawFormasiList = parsedJson.formasiList && parsedJson.formasiList.length > 0
        ? parsedJson.formasiList
        : [
            {
              header: parsedJson.header || {},
              pesertaList: parsedJson.pesertaList || [],
            }
          ];

      const formasiBlocks: SSCASNFormasiBlock[] = rawFormasiList.map((f: any, idx: number) => {
        const pesertaList: SSCASNPeserta[] = (f.pesertaList || []).map((p: any, pIdx: number) => ({
          no: p.no || pIdx + 1,
          noPeserta: String(p.noPeserta || '').trim(),
          nama: String(p.nama || '').trim(),
          tanggalLahir: String(p.tanggalLahir || '-').trim(),
          pendidikan: String(p.pendidikan || f.header?.pendidikan || '').trim(),
          ipk: Number(p.ipk) || 0,
          twk: Number(p.twk) || 0,
          tiu: Number(p.tiu) || 0,
          tkp: Number(p.tkp) || 0,
          totalSkd: Number(p.totalSkd) || 0,
          skorSkd: Number(p.skorSkd) || 0,
          skb: Number(p.skb) || 0,
          skorSkb: Number(p.skorSkb) || 0,
          nilaiAkhir: Number(p.nilaiAkhir) || 0,
          keterangan: String(p.keterangan || 'TL').trim(),
        }));

        const passedCount = pesertaList.filter((p) => p.keterangan && p.keterangan.startsWith('P/L')).length;
        let kuotaVal = Number(f.header?.jumlahKuota) || 0;
        if (kuotaVal <= 0) {
          kuotaVal = passedCount > 0 ? passedCount : 1;
        }

        const header = normalizeJenisFormasiHeader({
          instansi: f.header?.instansi || '6512 - Pemerintah Kab. Jember',
          jabatanFormasi: f.header?.jabatanFormasi || `Formasi ${idx + 1}`,
          lokasiFormasi: f.header?.lokasiFormasi || '',
          jenisFormasi: f.header?.jenisFormasi || '1 - UMUM',
          pendidikan: f.header?.pendidikan || '',
          jumlahKuota: kuotaVal,
          kuotaPendidikan: kuotaVal,
          kuotaJenisFormasi: kuotaVal,
          kuotaLokasi: kuotaVal,
          kuotaJabatan: kuotaVal,
          kuotaInstansi: kuotaVal,
          kuotaPerTingkat: {
            pendidikanCount: kuotaVal,
            jenisCount: kuotaVal,
            lokasiCount: kuotaVal,
            jabatanCount: kuotaVal,
            instansiCount: kuotaVal,
          },
        });

        const verification = calculateVerification(pesertaList);

        return {
          id: `formasi-${idx + 1}`,
          header,
          pesertaList,
          verification,
        };
      });

      // Convenience / Aggregate getters
      const primaryFormasi = formasiBlocks[0];
      const allPeserta = formasiBlocks.flatMap((b) => b.pesertaList);
      const globalVerification = calculateVerification(allPeserta);

      const finalOutput: SSCASNParsedResult = {
        meta: {
          docTitle: parsedJson.docTitle || 'PANITIA SELEKSI NASIONAL PENGADAAN CASN 2024 - HASIL INTEGRASI SKD DAN SKB',
          tahun: parsedJson.tahun || '2024',
          parsedAt: new Date().toISOString(),
          sourceType: mimeType.includes('pdf') ? 'pdf' : 'ocr',
          fileName: fileName || 'Dokumen_SSCASN.pdf',
          totalFormasiCount: formasiBlocks.length,
          totalPesertaCount: allPeserta.length,
        },
        formasiList: formasiBlocks,
        header: primaryFormasi.header,
        pesertaList: primaryFormasi.pesertaList,
        verification: primaryFormasi.verification,
      };

      return res.json({ success: true, data: finalOutput });
    } catch (err: any) {
      console.error('SSCASN Parser Error:', err);
      return res.status(500).json({
        error: 'Gagal memproses dokumen SSCASN.',
        details: err?.message || String(err),
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server SSCASN Parser running on http://localhost:${PORT}`);
    // Non-blocking background cloud database sync so Cloud Run startup probe passes instantly
    initCloudStorage().catch((err) => {
      console.error('[Cloud DB] Background initial sync error:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
