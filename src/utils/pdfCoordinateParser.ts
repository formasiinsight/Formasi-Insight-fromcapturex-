import PDFParser from 'pdf2json';
import { SSCASNParsedResult, SSCASNFormasiBlock, SSCASNPeserta, SSCASNHeader } from '../types';
import { calculateVerification } from './sampleData';
import { normalizeJenisFormasiHeader, cleanPendidikanString, sanitizeMetadataHeader } from './jenisFormasiUtils';
import { sanitizePesertaNamaAndPendidikan, sanitizePesertaList } from './pesertaSanitizer';

export interface PageError {
  page: number;
  reason: string;
}

export interface PDFCoordinateParseResult extends SSCASNParsedResult {
  pageErrors: PageError[];
}

interface PDFWord {
  x: number;
  y: number;
  w: number;
  text: string;
}

/**
 * Clean text from pdf2json URL decoding
 */
function cleanText(rawText: string): string {
  try {
    return decodeURIComponent(rawText).trim();
  } catch (e) {
    return rawText.trim();
  }
}

/**
 * Group words by Y coordinate with a given Y tolerance
 */
function groupWordsByY(words: PDFWord[], yTolerance = 0.4): PDFWord[][] {
  if (words.length === 0) return [];

  // Sort words strictly by Y ascending
  const sorted = [...words].sort((a, b) => a.y - b.y);

  const rows: PDFWord[][] = [];
  let currentRow: PDFWord[] = [];
  let currentY = sorted[0].y;

  for (const word of sorted) {
    if (Math.abs(word.y - currentY) <= yTolerance) {
      currentRow.push(word);
    } else {
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
      }
      currentRow = [word];
      currentY = word.y;
    }
  }

  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }

  return rows;
}

export function getFormasiKey(h: any): string {
  const inst = (h.instansi || h.namaInstansi || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const jab = (h.jabatanFormasi || h.namaJabatan || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const lok = (h.lokasiFormasi || h.namaLokasi || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const jen = (h.jenisFormasi || h.namaJenisFormasi || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const pen = (h.pendidikan || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${inst}|${jab}|${lok}|${jen}|${pen}`;
}

function extractFullJobCode(text: string): string {
  if (!text) return '';
  const m = text.match(/\b((?:JF|JP|[A-Z]{2,})\d+(?:\s*-\s*\d+)?)\b/i);
  if (m) {
    return m[1].replace(/\s+/g, '').toUpperCase();
  }
  return '';
}

function areJobsEqual(jab1: string, jab2: string): boolean {
  if (!jab1 || !jab2) return false;
  const norm1 = (jab1 || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const norm2 = (jab2 || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (norm1 === norm2) return true;

  const code1 = extractFullJobCode(jab1);
  const code2 = extractFullJobCode(jab2);

  if (code1 && code2) {
    if (code1 !== code2) return false;
  }

  const title1 = norm1.replace(/^(?:jf|jp|[a-z0-9]{3,15})\d*(?:[\s-]+\d+)?\s*/i, '').trim();
  const title2 = norm2.replace(/^(?:jf|jp|[a-z0-9]{3,15})\d*(?:[\s-]+\d+)?\s*/i, '').trim();

  return title1 === title2;
}

function findOrCreateFormasiBlock(
  formasiMap: Map<string, SSCASNFormasiBlock>,
  formasiOrder: string[],
  header: SSCASNHeader,
  formasiCounterRef: { val: number }
): SSCASNFormasiBlock {
  const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const targetInst = norm(header.instansi);
  const targetJab = norm(header.jabatanFormasi);
  const targetLok = norm(header.lokasiFormasi);
  const targetJen = norm(header.jenisFormasi);
  const normPen = (s: string) => cleanPendidikanString(s).toLowerCase().replace(/nilai\s+seleksi\s+kompetensi\s+dasar.*/gi, '').trim();
  const targetPen = normPen(header.pendidikan);

  const targetKodeJen = header.kodeJenisFormasi || targetJen.match(/^(\d+)/)?.[1] || targetJen;

  for (const key of formasiOrder) {
    const block = formasiMap.get(key)!;
    const h = block.header;
    const bInst = norm(h.instansi);
    const bLok = norm(h.lokasiFormasi);
    const bJen = norm(h.jenisFormasi);
    const bPen = normPen(h.pendidikan);

    const bKodeJen = h.kodeJenisFormasi || bJen.match(/^(\d+)/)?.[1] || bJen;

    // Unique per Jabatan Formasi + Lokasi Formasi + Jenis Formasi
    const isJabEqual = areJobsEqual(h.jabatanFormasi, header.jabatanFormasi);
    const isLokEqual = Boolean(bLok && targetLok && bLok === targetLok);

    // Strictly check if Jenis Formasi matches
    const isJenEqual = (bJen && targetJen)
      ? (bKodeJen === targetKodeJen || bJen === targetJen)
      : true;

    // Pendidikan juga harus jadi pembeda formasi
    const isPenEqual = (!bPen || bPen === '-' || !targetPen || targetPen === '-')
      ? true
      : bPen === targetPen;

    if (isJabEqual && isLokEqual && isJenEqual && isPenEqual) {
      if (header.jumlahKuota > 0 && (!h.jumlahKuota || h.jumlahKuota === 0)) h.jumlahKuota = header.jumlahKuota;
      if (header.kuotaInstansi && (!h.kuotaInstansi || h.kuotaInstansi === 0)) h.kuotaInstansi = header.kuotaInstansi;
      if (header.kuotaJabatan && (!h.kuotaJabatan || h.kuotaJabatan === 0)) h.kuotaJabatan = header.kuotaJabatan;
      if (header.kuotaLokasi && (!h.kuotaLokasi || h.kuotaLokasi === 0)) h.kuotaLokasi = header.kuotaLokasi;
      if (header.kuotaJenisFormasi && (!h.kuotaJenisFormasi || h.kuotaJenisFormasi === 0)) h.kuotaJenisFormasi = header.kuotaJenisFormasi;
      if (header.kuotaPendidikan && (!h.kuotaPendidikan || h.kuotaPendidikan === 0)) h.kuotaPendidikan = header.kuotaPendidikan;
      if (header.pendidikan && header.pendidikan !== '-' && (!bPen || bPen === '-' || header.pendidikan.length > (h.pendidikan || '').length)) {
        h.pendidikan = header.pendidikan;
      }
      if (targetJen && targetJen !== '-' && (!bJen || bJen === '-')) h.jenisFormasi = header.jenisFormasi;
      if (targetInst && (!bInst || bInst === 'sscasn bkn')) h.instansi = header.instansi;
      return block;
    }
  }

  // Not found -> create new block
  const newKey = getFormasiKey(header);
  const newBlock: SSCASNFormasiBlock = {
    id: `formasi-${formasiCounterRef.val++}`,
    header: { ...header },
    pesertaList: [],
    verification: calculateVerification([]),
  };
  formasiMap.set(newKey, newBlock);
  formasiOrder.push(newKey);
  return newBlock;
}

/**
 * Clean table header noise and trailing numbers from field strings
 */
function cleanHeaderNoise(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Cut off table header or footer text noise
  text = text.replace(/(?:REKAP\s+)?HASIL\s+INTEGRASI\s+SKD\s+DAN\s+SKB(?:\s+PENGADAAN\s+CPNS\s*\d*)?/gi, ' ');
  text = text.replace(/PANITIA\s+SELEKSI\s+NASIONAL\s+PENGADAAN\s+CASN\s*\d*/gi, ' ');
  text = text.replace(/Halaman\s+\d+(?:\s+dari\s+\d+\s+halaman)?/gi, ' ');
  text = text.replace(/\bKode\s+Jumlah\b/gi, ' ');
  text = text.replace(/\s+(?:Nilai|Skor)\s+SKD.*$/gi, '');
  text = text.replace(/\s+(?:Nilai|Skor)\s+SKB.*$/gi, '');
  text = text.replace(/\s+Nilai\s+Akhir.*$/gi, '');
  text = text.replace(/\s+(?<!SURAT\s+)\bKeterangan\b.*$/gi, '');
  text = text.replace(/\s+No\s+Peserta.*$/gi, '');
  text = text.replace(/\s+Nomor\s+Peserta.*$/gi, '');
  text = text.replace(/\s+IPK.*$/gi, '');
  text = text.replace(/\s+Tanggal\s+Lahir.*$/gi, '');
  text = text.replace(/\s+Laporan\s+digenerate.*$/gi, '');
  text = text.replace(/\bSKB\b/gi, '');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parse metadata labels from a page:
 * Uses spatial bounding boxes and label-to-label slicing to cleanly extract full multi-line header fields
 * without interference from the rightmost 'Jumlah' column.
 */
function extractMetadataFromPage(rows: PDFWord[][]): (Partial<SSCASNHeader> & { totalInstansiKuota?: number }) | null {
  const headerRows: PDFWord[][] = [];
  for (const row of rows) {
    const lineText = row.map((w) => w.text).join(' ');
    // Stop as soon as table header, participant list, or page footer starts
    if (
      /jumlah\s*peserta|lulus\s*akhir|tidak\s*hadir|tms-1|\baps\b|hadir\s*tidak\s*hadir|No\s*Peserta|Nomor\s*Peserta|Nilai\s*SKD|Skor\s*SKD|Nilai\s*SKB|Skor\s*SKB|Nilai\s*Akhir|\bIPK\b|Tanggal\s*Lahir|(?<!SURAT\s+)\bKeterangan\b|Laporan\s*digenerate/i.test(lineText)
    ) {
      break;
    }
    headerRows.push(row);
  }

  if (headerRows.length === 0) return null;

  const leftWords: PDFWord[] = [];
  const rightNumbers: { y: number; val: number }[] = [];

  for (const row of headerRows) {
    const lineText = row.map((w) => w.text).join(' ');
    // Ignore standalone header title lines / pagination noise lines
    if (/(?:PANITIA\s+SELEKSI|HASIL\s+INTEGRASI|REKAP\s+HASIL|PENGADAAN\s+CPNS|Halaman\s*:?\s*\d+)/i.test(lineText.trim())) {
      continue;
    }

    for (const w of row) {
      const cleanVal = w.text.trim();
      // Right side count numbers in SSCASN header table (e.g. Instansi 2314, Jabatan 16, Lokasi 2, Jenis 2, Pendidikan 2):
      // These numbers are located at far right (x >= 25.0) and consist purely of digits.
      if (w.x >= 25.0 && /^\d+$/.test(cleanVal)) {
        rightNumbers.push({ y: w.y, val: parseInt(cleanVal, 10) });
      } else {
        leftWords.push(w);
      }
    }
  }

  if (leftWords.length === 0) return null;

  // Group leftWords into distinct visual rows by Y coordinate with strict tolerance (0.25)
  // This prevents words from line N+1 being sorted ahead of line N words
  const lineRows = groupWordsByY(leftWords, 0.25);
  lineRows.sort((a, b) => a[0].y - b[0].y);

  const sortedLineTexts = lineRows.map((line) =>
    [...line].sort((a, b) => a.x - b.x).map((w) => w.text).join(' ')
  );

  let fullHeaderText = sortedLineTexts.join(' ');

  // Clean noise header titles
  fullHeaderText = fullHeaderText
    .replace(/PANITIA\s+SELEKSI\s+NASIONAL\s+PENGADAAN\s+CASN\s*\d*/gi, ' ')
    .replace(/(?:REKAP\s+)?HASIL\s+INTEGRASI\s+SKD\s+DAN\s+SKB(?:\s+PENGADAAN\s+CPNS\s*\d*)?/gi, ' ')
    .replace(/Halaman\s+\d+.*$/gi, ' ')
    .replace(/\bKode\b|\bJumlah\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Regex patterns for field labels (Pendidikan in SSCASN PDFs usually lacks a colon and appears after Jenis Formasi)
  const instansiRegex = /\bInstansi(?:\s+Formasi)?\s*:\s*/i;
  const jabatanRegex = /\bJabatan(?:\s+Formasi)?\s*:\s*/i;
  const lokasiRegex = /\bLokasi(?:\s+Formasi)?\s*:\s*/i;
  const jenisRegex = /\bJenis(?:\s+Formasi)?\s*:\s*/i;

  const mInst = fullHeaderText.match(instansiRegex);
  const mJab = fullHeaderText.match(jabatanRegex);
  const mLok = fullHeaderText.match(lokasiRegex);
  const mJen = fullHeaderText.match(jenisRegex);

  // Find Pendidikan header label strictly AFTER Jenis Formasi (or Lokasi Formasi)
  let mPenIndex: number | undefined = undefined;
  let mPenLength: number | undefined = undefined;

  const searchStart = mJen && mJen.index !== undefined
    ? mJen.index + mJen[0].length
    : mLok && mLok.index !== undefined
    ? mLok.index + mLok[0].length
    : 0;

  const textToSearch = fullHeaderText.substring(searchStart);
  const pendidikanRegex = /\bPendidikan\b(?:\s*:)?\s*/i;
  const mPenLocal = textToSearch.match(pendidikanRegex);

  if (mPenLocal && mPenLocal.index !== undefined) {
    mPenIndex = searchStart + mPenLocal.index;
    mPenLength = mPenLocal[0].length;
  }

  if (!mInst && !mJab && !mLok && !mJen && mPenIndex === undefined) {
    return null;
  }

  const labels: { key: keyof SSCASNHeader; start: number; endOfLabel: number }[] = [];

  if (mInst && mInst.index !== undefined) {
    labels.push({ key: 'instansi', start: mInst.index, endOfLabel: mInst.index + mInst[0].length });
  }
  if (mJab && mJab.index !== undefined) {
    labels.push({ key: 'jabatanFormasi', start: mJab.index, endOfLabel: mJab.index + mJab[0].length });
  }
  if (mLok && mLok.index !== undefined) {
    labels.push({ key: 'lokasiFormasi', start: mLok.index, endOfLabel: mLok.index + mLok[0].length });
  }
  if (mJen && mJen.index !== undefined) {
    labels.push({ key: 'jenisFormasi', start: mJen.index, endOfLabel: mJen.index + mJen[0].length });
  }
  if (mPenIndex !== undefined && mPenLength !== undefined) {
    labels.push({ key: 'pendidikan', start: mPenIndex, endOfLabel: mPenIndex + mPenLength });
  }

  labels.sort((a, b) => a.start - b.start);

  const metadata: Partial<SSCASNHeader> = {};

  for (let i = 0; i < labels.length; i++) {
    const cur = labels[i];
    const nextStart = i + 1 < labels.length ? labels[i + 1].start : fullHeaderText.length;
    let rawVal = fullHeaderText.substring(cur.endOfLabel, nextStart).trim();
    rawVal = rawVal.replace(/^:\s*/, '').replace(/\s+/g, ' ').trim();

    // Clean noise before checking trailing quota number
    const cleanedRaw = cleanHeaderNoise(rawVal);

    // Check for trailing quota number at the end of cleaned string (e.g. "1 - UMUM 2" or "D-IV ... 9")
    const trailingQuotaMatch = cleanedRaw.match(/\s+(\d+)$/);
    let lineQuota: number | undefined = undefined;
    if (trailingQuotaMatch) {
      const parsedVal = parseInt(trailingQuotaMatch[1], 10);
      if (!(parsedVal >= 1900 && parsedVal <= 2099)) {
        lineQuota = parsedVal;
      }
    }

    rawVal = cleanedRaw.replace(/\s+\d+$/, '').trim();

    if (cur.key === 'instansi') {
      if (lineQuota !== undefined && lineQuota >= 0) metadata.kuotaInstansi = lineQuota;
      const parts = rawVal.split('-');
      if (parts.length > 1 && /^\d+$/.test(parts[0].trim())) {
        metadata.kodeInstansi = parts[0].trim();
        metadata.namaInstansi = parts.slice(1).join('-').trim();
        metadata.instansi = `${metadata.kodeInstansi} - ${metadata.namaInstansi}`;
      } else {
        metadata.instansi = rawVal;
        metadata.namaInstansi = rawVal;
      }
    } else if (cur.key === 'jabatanFormasi') {
      if (lineQuota !== undefined && lineQuota >= 0) metadata.kuotaJabatan = lineQuota;
      const parts = rawVal.split('-');
      if (parts.length > 1 && /^(?:JF|JP|[A-Z0-9]{3,15})$/i.test(parts[0].trim())) {
        metadata.kodeJabatan = parts[0].trim();
        metadata.namaJabatan = parts.slice(1).join('-').trim();
        metadata.jabatanFormasi = `${metadata.kodeJabatan} - ${metadata.namaJabatan}`;
      } else {
        metadata.jabatanFormasi = rawVal;
        metadata.namaJabatan = rawVal;
        metadata.kodeJabatan = '';
      }
    } else if (cur.key === 'lokasiFormasi') {
      if (lineQuota !== undefined && lineQuota >= 0) metadata.kuotaLokasi = lineQuota;
      const parts = rawVal.split('-');
      if (parts.length > 1 && /^\d+$/.test(parts[0].trim())) {
        metadata.kodeLokasi = parts[0].trim();
        metadata.namaLokasi = parts.slice(1).join('-').trim();
        metadata.lokasiFormasi = `${metadata.kodeLokasi} - ${metadata.namaLokasi}`;
      } else {
        metadata.lokasiFormasi = rawVal;
        metadata.namaLokasi = rawVal;
      }
    } else if (cur.key === 'jenisFormasi') {
      if (lineQuota !== undefined && lineQuota >= 0) {
        metadata.kuotaJenisFormasi = lineQuota;
        metadata.jumlahKuota = lineQuota;
      }

      // If jenisFormasi swallowed Pendidikan or degree qualifications:
      const embeddedPenMatch = rawVal.match(/\b(Pendidikan|D-[I|V|X]+|D[1-4]|S-[1-3]|S[1-3]|SMA|SMK|SLTA|DIPLOMA|SARJANA|MAGISTER|DOKTOR|PROFESI|SPESIALIS)\b/i);
      if (embeddedPenMatch && embeddedPenMatch.index !== undefined && embeddedPenMatch.index > 0) {
        const penPart = rawVal.substring(embeddedPenMatch.index).replace(/^Pendidikan\s*:?\s*/i, '').trim();
        rawVal = rawVal.substring(0, embeddedPenMatch.index).trim();
        if (penPart) {
          metadata.pendidikan = cleanPendidikanString(penPart);
        }
      }

      const parts = rawVal.split('-');
      if (parts.length > 1 && /^\d+$/.test(parts[0].trim())) {
        metadata.kodeJenisFormasi = parts[0].trim();
        metadata.namaJenisFormasi = parts.slice(1).join('-').trim();
        metadata.jenisFormasi = `${metadata.kodeJenisFormasi} - ${metadata.namaJenisFormasi}`;
      } else {
        metadata.jenisFormasi = rawVal;
        metadata.namaJenisFormasi = rawVal;
      }
    } else if (cur.key === 'pendidikan') {
      if (lineQuota !== undefined && lineQuota >= 0) metadata.kuotaPendidikan = lineQuota;
      const cleanPen = cleanPendidikanString(rawVal);
      if (metadata.pendidikan) {
        if (!metadata.pendidikan.includes(cleanPen)) {
          metadata.pendidikan = cleanPendidikanString(`${metadata.pendidikan} ${cleanPen}`);
        }
      } else {
        metadata.pendidikan = cleanPen;
      }
    }
  }

  // Match right-side count numbers to corresponding label rows by Y vertical range
  const kuotaPerTingkat: SSCASNHeader['kuotaPerTingkat'] = {
    pendidikanCount: metadata.kuotaPendidikan,
  };

  const yInst = leftWords.find((w) => /instansi/i.test(w.text))?.y ?? null;
  const yJab = leftWords.find((w) => /jabatan/i.test(w.text))?.y ?? null;
  const yLok = leftWords.find((w) => /lokasi/i.test(w.text))?.y ?? null;
  const yJen = leftWords.find((w) => /jenis/i.test(w.text))?.y ?? null;
  const yPen = leftWords.find((w) => /pendidikan/i.test(w.text) && (yJen === null || w.y >= yJen - 0.2))?.y ?? null;

  // Define vertical Y boundaries for each field block to support multi-line labels
  const getMinMaxY = (yCurrent: number | null, yNext: number | null, defaultSpan = 20.0) => {
    if (yCurrent === null) return null;
    const minY = yCurrent - 1.2;
    const maxY = yNext !== null ? yNext - 0.2 : yCurrent + defaultSpan;
    return { minY, maxY };
  };

  const rangeInst = getMinMaxY(yInst, yJab);
  const rangeJab = getMinMaxY(yJab, yLok);
  const rangeLok = getMinMaxY(yLok, yJen);
  const rangeJen = getMinMaxY(yJen, yPen);
  const rangePen = getMinMaxY(yPen, null, 10.0); // Allow up to 10 Y units below Pendidikan label to support multi-line education text headers without missing rightmost quota counts

  for (const rn of rightNumbers) {
    if (rangeInst && rn.y >= rangeInst.minY && rn.y <= rangeInst.maxY) {
      kuotaPerTingkat.instansiCount = rn.val;
      metadata.kuotaInstansi = rn.val;
    }
    if (rangeJab && rn.y >= rangeJab.minY && rn.y <= rangeJab.maxY) {
      kuotaPerTingkat.jabatanCount = rn.val;
      metadata.kuotaJabatan = rn.val;
    }
    if (rangeLok && rn.y >= rangeLok.minY && rn.y <= rangeLok.maxY) {
      kuotaPerTingkat.lokasiCount = rn.val;
      metadata.kuotaLokasi = rn.val;
    }
    if (rangeJen && rn.y >= rangeJen.minY && rn.y <= rangeJen.maxY) {
      kuotaPerTingkat.jenisCount = rn.val;
      metadata.kuotaJenisFormasi = rn.val;
      metadata.jumlahKuota = rn.val;
    }
    if (
      !metadata.kuotaPendidikan &&
      rangePen &&
      rn.y >= rangePen.minY &&
      rn.y <= rangePen.maxY
    ) {
      kuotaPerTingkat.pendidikanCount = rn.val;
      metadata.kuotaPendidikan = rn.val;
    }
  }

  // Prioritaskan angka spesifik dari baris "Pendidikan" (kuotaPendidikan).
  // Baru kalau baris Pendidikan gagal terbaca, gunakan angka dari Jenis Formasi sebagai cadangan.
  if (typeof metadata.kuotaPendidikan === 'number' && metadata.kuotaPendidikan >= 0) {
    metadata.jumlahKuota = metadata.kuotaPendidikan;
  } else if (typeof metadata.kuotaJenisFormasi === 'number' && metadata.kuotaJenisFormasi >= 0) {
    metadata.jumlahKuota = metadata.kuotaJenisFormasi;
    // JANGAN isi metadata.kuotaPendidikan di sini — biarkan tetap kosong kalau memang gagal dibaca,
    // supaya tidak permanen tertimpa angka Jenis Formasi yang salah untuk baris Pendidikan spesifik ini.
  } else if (typeof metadata.jumlahKuota === 'number' && metadata.jumlahKuota >= 0) {
    metadata.kuotaJenisFormasi = metadata.jumlahKuota;
  }

  metadata.kuotaPerTingkat = kuotaPerTingkat;


  const cleanMeta = sanitizeMetadataHeader(metadata);

  return cleanMeta.jabatanFormasi || cleanMeta.instansi || cleanMeta.lokasiFormasi ? cleanMeta : null;
}

/**
  * Extract Tanggal Lahir and cleanly split Nama vs Pendidikan
  */
function extractTanggalLahirAndSplitNamaPendidikan(text: string) {
  let tanggalLahir = '-';
  let cleanStr = text;

  const monthNames = '(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)';
  
  // 1. Full date match: e.g. "09 Juni 2001" or "13 September 2000"
  const fullDateRegex = new RegExp(`\\b(\\d{1,2}\\s+${monthNames}\\s+(?:19|20)\\d{2})\\b`, 'i');
  const fullDateMatch = text.match(fullDateRegex);

  if (fullDateMatch) {
    tanggalLahir = fullDateMatch[1].trim();
    // Ensure month is Title Case (e.g., Juni, September)
    const parts = tanggalLahir.split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0];
      const monthRaw = parts[1].toLowerCase();
      const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
      const year = parts[2];
      tanggalLahir = `${day} ${month} ${year}`;
    }
    cleanStr = text.replace(fullDateMatch[0], ' ').replace(/\s+/g, ' ').trim();
  } else {
    // 2. Numeric date match: e.g. "19/08/1998" or "19-08-1998"
    const numDateMatch = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-](?:19|20)\d{2})\b/);
    if (numDateMatch) {
      tanggalLahir = numDateMatch[1].trim();
      cleanStr = text.replace(numDateMatch[0], ' ').replace(/\s+/g, ' ').trim();
    } else {
      // 3. Separate day, month, year
      const dayMonthRegex = new RegExp(`\\b(\\d{1,2}\\s+${monthNames})\\b`, 'i');
      const dayMonthMatch = text.match(dayMonthRegex);
      const yearMatch = text.match(/\b((?:19|20)\d{2})\b/);
      if (dayMonthMatch && yearMatch) {
        const dmParts = dayMonthMatch[1].trim().split(/\s+/);
        const day = dmParts[0];
        const mRaw = dmParts[1].toLowerCase();
        const month = mRaw.charAt(0).toUpperCase() + mRaw.slice(1);
        const year = yearMatch[1].trim();
        tanggalLahir = `${day} ${month} ${year}`;
        cleanStr = text.replace(dayMonthMatch[0], ' ').replace(yearMatch[0], ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  // Now split cleanStr into Nama and Pendidikan
  let nama = cleanStr;
  let pendidikan = '-';

  // Find degree markers
  const degreeRegex = /\b(S-[123]|S[123]|D-IV|D-III|D-II|D-I|DIV|DIII|DII|DI|PROFESI|SPESIALIS|PPDS|SEKOLAH\s+MENENGAH|SMK|SMA|SLTA)\b/i;
  const degreeMatch = cleanStr.match(degreeRegex);

  if (degreeMatch && degreeMatch.index !== undefined) {
    const idx = degreeMatch.index;
    if (idx === 0) {
      pendidikan = degreeMatch[0].trim();
      nama = cleanStr.substring(degreeMatch[0].length).trim();
    } else {
      nama = cleanStr.substring(0, idx).trim();
      pendidikan = cleanStr.substring(idx).trim();
    }
  }

  // Clean up nama (ensure uppercase and remove trailing digits/symbols)
  nama = nama.replace(/\s+\d+$/, '').replace(/\s+/g, ' ').trim();
  pendidikan = pendidikan.replace(/\s+/g, ' ').trim();

  return { nama, tanggalLahir, pendidikan };
}

/**
 * Group words in a participant row into column cell boxes (Nama, Tanggal Lahir, Pendidikan)
 * based on spatial clustering and token pattern matching. Handles multi-line cells seamlessly.
 */
function extractCellInformationByCoordinates(words: PDFWord[]): {
  nama: string;
  tanggalLahir: string;
  pendidikan: string;
} {
  if (!words || words.length === 0) {
    return { nama: '-', tanggalLahir: '-', pendidikan: '-' };
  }

  const sortWordsByPosition = (arr: PDFWord[]) =>
    [...arr].sort((a, b) => (Math.abs(a.y - b.y) >= 0.35 ? a.y - b.y : a.x - b.x));

  const monthNames = '(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER|Jan|Feb|Mar|Apr|Jun|Jul|Agt|Sep|Okt|Nov|Des)';
  const monthNamesRegex = new RegExp(`^${monthNames}$`, 'i');
  const monthWordBoundariesRegex = new RegExp(`\\b(${monthNames})\\b`, 'i');
  const yearRegex = /\b(19|20)\d{2}\b/;
  const numDateRegex = /\b\d{1,2}[\/-]\d{1,2}[\/-](19|20)\d{2}\b/;
  const degreeRegex = /\b(S-[123]|S[123]|D-IV|D-III|D-II|D-I|DIV|DIII|DII|DI|PROFESI|SPESIALIS|PPDS|SEKOLAH\s+MENENGAH|SMK|SMA|SLTA|D-4|D-3|D-2|D-1|PPDS-1)\b/i;

  // 1. Identify degree/education words first to establish the boundary of the Education column
  const degreeWords = words.filter((w) => degreeRegex.test(w.text));
  let degreeMinX: number | null = null;
  if (degreeWords.length > 0) {
    degreeMinX = Math.min(...degreeWords.map((w) => w.x));
  }

  // 2. Identify Tanggal Lahir column X range [tglColMinX, tglColMaxX]
  // In SSCASN PDFs, Tanggal Lahir column is located around x ~ 240 to 365 (before Pendidikan column)
  const tglColMinX = 240;
  const tglColMaxX = degreeMinX !== null ? degreeMinX - 0.15 : 365;

  // 3. Select words within [tglColMinX, tglColMaxX] that represent date components (numbers or month names)
  let tglWords = words.filter((w) => {
    if (w.x < tglColMinX || w.x > tglColMaxX) return false;
    const cleanText = w.text.trim();
    return (
      /^\d{1,2}$/.test(cleanText) ||
      monthNamesRegex.test(cleanText) ||
      monthWordBoundariesRegex.test(cleanText) ||
      yearRegex.test(cleanText) ||
      numDateRegex.test(cleanText)
    );
  });

  // 4. Fallback 1: If tglWords is missing a 4-digit year (e.g. year on line 2 with slight X shift),
  // find a year word in `words` located before degreeMinX and after Name column (x >= 240)
  const initialTglStr = sortWordsByPosition(tglWords).map((w) => w.text).join(' ');
  if (!/\b(19|20)\d{2}\b/.test(initialTglStr)) {
    const yearWord = words.find(
      (w) =>
        !tglWords.includes(w) &&
        yearRegex.test(w.text) &&
        w.x >= 240 &&
        (degreeMinX === null || w.x < degreeMinX - 0.1)
    );
    if (yearWord) {
      tglWords.push(yearWord);
    }
  }

  // Fallback 2: If tglWords has a year but is missing day/month words (e.g. "29 November" on line 1 at x ~ 250),
  // search for day/month tokens in `words` between x = 240 and degreeMinX
  const hasMonthOrNum = tglWords.some((w) => monthNamesRegex.test(w.text) || /^\d{1,2}$/.test(w.text));
  if (!hasMonthOrNum) {
    const extraDateWords = words.filter(
      (w) =>
        !tglWords.includes(w) &&
        w.x >= 240 &&
        (degreeMinX === null || w.x < degreeMinX - 0.1) &&
        (/^\d{1,2}$/.test(w.text) || monthNamesRegex.test(w.text) || monthWordBoundariesRegex.test(w.text))
    );
    if (extraDateWords.length > 0) {
      tglWords.push(...extraDateWords);
    }
  }

  let tanggalLahir = '-';
  let tglMinX: number | null = null;
  let tglMaxX: number | null = null;

  if (tglWords.length > 0) {
    tglMinX = Math.min(...tglWords.map((w) => w.x));
    tglMaxX = Math.max(...tglWords.map((w) => w.x + (w.w || 0.5)));

    const sortedTgl = sortWordsByPosition(tglWords);
    const rawTglStr = sortedTgl.map((w) => w.text).join(' ');
    const monthRegex = new RegExp(`\\b(${monthNames})\\b`, 'gi');
    tanggalLahir = rawTglStr.replace(monthRegex, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
    tanggalLahir = tanggalLahir.replace(/\s+/g, ' ').trim();

    // Check if tglWords comes from multiple Y lines (multi-line Tanggal Lahir)
    const uniqueYLines: number[] = [];
    for (const w of tglWords) {
      if (!uniqueYLines.some((y) => Math.abs(y - w.y) < 0.35)) {
        uniqueYLines.push(w.y);
      }
    }
    if (uniqueYLines.length > 1) {
      console.log(`[PDF Parser] Multi-line Tanggal Lahir detected (${uniqueYLines.length} lines):`, {
        rawWords: sortedTgl.map((w) => ({ text: w.text, x: w.x, y: w.y })),
        resultTanggalLahir: tanggalLahir,
      });
    }
  }

  // Calculate horizontal cell boundaries for Nama vs Pendidikan
  let namaRightBoundary = tglMinX !== null ? tglMinX - 0.2 : (degreeMinX !== null ? degreeMinX - 0.2 : 265);
  let pendLeftBoundary = degreeMinX !== null ? degreeMinX - 0.3 : (tglMaxX !== null ? tglMaxX + 0.1 : 360);

  const namaWords: PDFWord[] = [];
  const pendWords: PDFWord[] = [];

  for (const w of words) {
    if (tglWords.includes(w)) continue;

    if (degreeWords.includes(w) || degreeRegex.test(w.text) || w.x >= pendLeftBoundary) {
      pendWords.push(w);
    } else if (w.x < namaRightBoundary) {
      namaWords.push(w);
    } else {
      if (degreeMinX !== null && w.x >= degreeMinX - 0.3) {
        pendWords.push(w);
      } else {
        namaWords.push(w);
      }
    }
  }

  let nama = sortWordsByPosition(namaWords).map((w) => w.text).join(' ').trim();
  let pendidikan = sortWordsByPosition(pendWords).map((w) => w.text).join(' ').trim();

  if (!tanggalLahir || tanggalLahir === '-') {
    const fullText = sortWordsByPosition(words).map((w) => w.text).join(' ');
    const fallback = extractTanggalLahirAndSplitNamaPendidikan(fullText);
    tanggalLahir = fallback.tanggalLahir;
    if (fallback.nama && (!nama || nama === '-')) nama = fallback.nama;
    if (fallback.pendidikan && (!pendidikan || pendidikan === '-')) pendidikan = fallback.pendidikan;
  }

  nama = nama.replace(/\s+\d+$/, '').replace(/\s+/g, ' ').trim();
  pendidikan = pendidikan.replace(/\s+/g, ' ').trim() || '-';

  return { nama, tanggalLahir, pendidikan };
}

/**
 * Parse participant row from words (main row + continuation rows)
 */
function parseParticipantRow(
  mainRow: PDFWord[],
  continuationRows: PDFWord[][],
  rowIdx: number,
  defaultPendidikan = 'S-1'
): SSCASNPeserta | null {
  if (!mainRow || mainRow.length === 0) return null;

  const sortedMain = [...mainRow].sort((a, b) => a.x - b.x);
  const lineStr = sortedMain.map((w) => w.text).join(' ');

  // Must contain a 14 to 19 digit number representing No Peserta (e.g. 24651220120001209)
  const noPesertaMatch = lineStr.match(/\b\d{14,19}\b/);
  if (!noPesertaMatch) {
    return null;
  }

  const noPeserta = noPesertaMatch[0];

  // Locate noPeserta index in sortedMain
  const pesertaWordIdx = sortedMain.findIndex((w) => w.text.includes(noPeserta));
  if (pesertaWordIdx === -1) return null;

  // Keterangan is usually the last token (P/L, TL, TH, P/L-1, TMS, DISQ)
  let keterangan = 'TL';
  const ketMatch = lineStr.match(/\b(P\/L|TL|TH|P\/L-1|TMS|DISQ|P\/L-2|P\/L-U3)\b/i);
  if (ketMatch) {
    keterangan = ketMatch[0].toUpperCase();
  }

  const rightWords = sortedMain.slice(pesertaWordIdx + 1);

  // Find all floating and integer numbers in rightWords
  const scoreWords: { word: PDFWord; num: number }[] = [];
  for (const w of rightWords) {
    const cleanNumStr = w.text.replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(cleanNumStr) && !w.text.includes(noPeserta)) {
      scoreWords.push({ word: w, num: Number(cleanNumStr) });
    }
  }

  const numbers = scoreWords.map((s) => s.num);

  let ipk = 0;
  // IPK is 0-4.0 for higher education, or up to 100.0 for SLTA/SMA high school average grades
  const potentialIpk = numbers.find((n) => n >= 0 && n <= 4.0);
  if (potentialIpk !== undefined) {
    ipk = potentialIpk;
  } else if (numbers.length > 0 && numbers[0] > 4.0 && numbers[0] <= 100.0) {
    ipk = numbers[0];
  } else if (numbers.length > 0 && numbers[0] <= 4.0) {
    ipk = numbers[0];
  }

  let twk = 0;
  let tiu = 0;
  let tkp = 0;
  let totalSkd = 0;
  let skorSkd = 0;
  let skb = 0;
  let skorSkb = 0;
  let nilaiAkhir = 0;

  const len = numbers.length;
  if (len >= 9) {
    twk = numbers[len - 8] || 0;
    tiu = numbers[len - 7] || 0;
    tkp = numbers[len - 6] || 0;
    totalSkd = numbers[len - 5] || 0;
    skorSkd = numbers[len - 4] || 0;
    skb = numbers[len - 3] || 0;
    skorSkb = numbers[len - 2] || 0;
    nilaiAkhir = numbers[len - 1] || 0;
  } else if (len >= 8) {
    twk = numbers[len - 8] || 0;
    tiu = numbers[len - 7] || 0;
    tkp = numbers[len - 6] || 0;
    totalSkd = numbers[len - 5] || 0;
    skorSkd = numbers[len - 4] || 0;
    skb = numbers[len - 3] || 0;
    skorSkb = numbers[len - 2] || 0;
    nilaiAkhir = numbers[len - 1] || 0;
  } else if (len >= 4) {
    nilaiAkhir = numbers[len - 1] || 0;
    skorSkb = numbers[len - 2] || 0;
    skb = numbers[len - 3] || 0;
    skorSkd = numbers[len - 4] || 0;
    totalSkd = numbers[len - 5] || 0;
  }

  // Tokens between noPeserta and the numeric scores
  const firstScoreWord = scoreWords.length > 0 ? scoreWords[0].word : null;
  const middleWords: PDFWord[] = [];
  for (const w of rightWords) {
    if (firstScoreWord && w === firstScoreWord) break;
    if (ketMatch && w.text.toUpperCase().includes(keterangan)) continue;
    middleWords.push(w);
  }

  // Combine middleWords and continuation words into a unified word array
  const allMetaWords: PDFWord[] = [...middleWords];
  if (continuationRows && continuationRows.length > 0) {
    const contWords = continuationRows.flatMap((r) => r);
    for (const w of contWords) {
      if (firstScoreWord && w.x > firstScoreWord.x + 12.0) continue;
      if (ketMatch && w.text.toUpperCase().includes(keterangan)) continue;
      allMetaWords.push(w);
    }
  }

  // Extract each cell (Nama, Tanggal Lahir, Pendidikan) separately based on X-coordinate column boxes
  const parsedMeta = extractCellInformationByCoordinates(allMetaWords);

  let nama = parsedMeta.nama;
  let tanggalLahir = parsedMeta.tanggalLahir;
  let pendidikan = parsedMeta.pendidikan;

  // Clean extra spaces and sanitize participant name vs education column
  const sanitized = sanitizePesertaNamaAndPendidikan(nama, pendidikan, defaultPendidikan);
  nama = sanitized.nama;
  pendidikan = sanitized.pendidikan;

  // Fallback for No (Nomor Urut)
  let no = rowIdx + 1;
  const firstWord = sortedMain[0];
  if (firstWord && firstWord !== sortedMain[pesertaWordIdx]) {
    const firstNum = parseInt(firstWord.text, 10);
    if (!isNaN(firstNum) && firstNum < 10000) {
      no = firstNum;
    }
  }

  return {
    no,
    noPeserta,
    nama: nama || 'PESERTA CASN',
    tanggalLahir,
    pendidikan,
    ipk,
    twk,
    tiu,
    tkp,
    totalSkd,
    skorSkd,
    skb,
    skorSkb,
    nilaiAkhir,
    keterangan,
  };
}

/**
 * Main coordinate-based PDF parser using pdf2json without AI / OCR
 */
export async function parsePdfWithCoordinates(
  pdfBuffer: Buffer,
  fileName?: string,
  options?: { startPage?: number; endPage?: number; initialHeader?: SSCASNHeader }
): Promise<PDFCoordinateParseResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(errData.parserError || 'PDF parsing failed'));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        const pageErrors: PageError[] = [];

        let currentHeader: SSCASNHeader = options?.initialHeader
          ? { ...options.initialHeader }
          : {
              instansi: 'SSCASN BKN',
              kodeInstansi: '',
              namaInstansi: 'SSCASN BKN',
              jabatanFormasi: 'Formasi',
              kodeJabatan: '',
              namaJabatan: 'Formasi',
              lokasiFormasi: 'Lokasi',
              kodeLokasi: '',
              namaLokasi: 'Lokasi',
              jenisFormasi: '1 - UMUM',
              kodeJenisFormasi: '1',
              namaJenisFormasi: 'UMUM',
              pendidikan: '-',
              jumlahKuota: 0,
            };

        const formasiMap = new Map<string, SSCASNFormasiBlock>();
        const formasiOrder: string[] = [];
        const formasiCounterRef = { val: 1 };

        // Page continuation tracking state across PDF pages (e.g. Halaman X dari Y)
        let lastActiveBlock: SSCASNFormasiBlock | null = null;
        let lastActivePageInfo: { pageX: number; totalY: number } | null = null;

        if (options?.initialHeader && options.initialHeader.jabatanFormasi && options.initialHeader.jabatanFormasi !== 'Formasi') {
          findOrCreateFormasiBlock(formasiMap, formasiOrder, currentHeader, formasiCounterRef);
        }

        const allPages = pdfData.Pages || [];
        
        // Page extraction limits (supports options like startPage: 101, endPage: 150, or full document if unspecified)
        let startIdx = options?.startPage ? options.startPage - 1 : 0;
        let endIdx = options?.endPage ? options.endPage : allPages.length;

        if (startIdx < 0) startIdx = 0;
        if (endIdx > allPages.length) endIdx = allPages.length;

        const pages = allPages.slice(startIdx, endIdx);

        pages.forEach((page: any, pageIdx: number) => {
          const pageNum = startIdx + pageIdx + 1;
          const pageTexts = page.Texts || [];

          if (pageTexts.length === 0) {
            pageErrors.push({
              page: pageNum,
              reason: 'Halaman kosong atau berisi gambar/scanned image (memerlukan PDF berbasis teks).',
            });
            return;
          }

          // Extract words with coordinates
          const words: PDFWord[] = pageTexts.map((t: any) => ({
            x: t.x,
            y: t.y,
            w: t.w,
            text: cleanText(t.R && t.R[0] ? t.R[0].T : ''),
          })).filter((w: PDFWord) => w.text.length > 0);

          // Extract page pagination indicator "Halaman X dari Y"
          const pageFullText = words.map((w) => w.text).join(' ');
          const pagePaginationMatch = pageFullText.match(/Halaman\s*:?\s*(\d+)\s*(?:dari|\/)\s*(\d+)/i);
          const pagePagination = pagePaginationMatch
            ? { pageX: parseInt(pagePaginationMatch[1], 10), totalY: parseInt(pagePaginationMatch[2], 10) }
            : null;

          // Group into Y rows
          const rows = groupWordsByY(words, 0.45);

          // 1. Check for metadata header labels on this page
          const metadata = extractMetadataFromPage(rows);

          // Determine if this page introduces a new formasi header
          let isNewFormasiHeader = false;
          if (metadata) {
            const hasJab = Boolean(metadata.jabatanFormasi && metadata.jabatanFormasi !== 'Formasi' && metadata.jabatanFormasi.trim().length > 0);
            const hasLok = Boolean(metadata.lokasiFormasi && metadata.lokasiFormasi !== 'Lokasi' && metadata.lokasiFormasi.trim().length > 0);
            const hasJen = Boolean(metadata.jenisFormasi && metadata.jenisFormasi !== '1 - UMUM' && metadata.jenisFormasi.trim().length > 0);
            const hasPen = Boolean(metadata.pendidikan && metadata.pendidikan !== '-' && metadata.pendidikan.trim().length > 0);

            const normStr = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const curPen = normStr(currentHeader.pendidikan);
            const metaPen = normStr(metadata.pendidikan);

            const isPageOne = pagePagination ? pagePagination.pageX === 1 : true;

            const isJabChanged = hasJab && (currentHeader.jabatanFormasi === 'Formasi' || !areJobsEqual(currentHeader.jabatanFormasi, metadata.jabatanFormasi));
            const isLokChanged = hasLok && (currentHeader.lokasiFormasi === 'Lokasi' || metadata.lokasiFormasi !== currentHeader.lokasiFormasi);
            const isJenChanged = hasJen && metadata.jenisFormasi !== currentHeader.jenisFormasi;
            const isPenChanged = hasPen && isPageOne && (
              curPen === '-' ||
              curPen === 'formasi' ||
              metaPen !== curPen ||
              Boolean(metadata.kuotaPendidikan !== undefined && metadata.kuotaPendidikan !== currentHeader.kuotaPendidikan)
            );

            if (isJabChanged || isLokChanged || isJenChanged || isPenChanged) {
              isNewFormasiHeader = true;
            } else if (isPageOne && (hasJab || hasLok || hasJen || hasPen)) {
              isNewFormasiHeader = true;
            } else if (!lastActiveBlock && (hasJab || hasLok || hasJen || hasPen)) {
              isNewFormasiHeader = true;
            }
          }

          let activeBlock: SSCASNFormasiBlock | null = null;

          if (isNewFormasiHeader && metadata) {
            const newKuotaPerTingkat = {
              instansiCount: metadata.kuotaPerTingkat?.instansiCount ?? currentHeader.kuotaPerTingkat?.instansiCount,
              jabatanCount: metadata.kuotaPerTingkat?.jabatanCount ?? currentHeader.kuotaPerTingkat?.jabatanCount,
              lokasiCount: metadata.kuotaPerTingkat?.lokasiCount ?? currentHeader.kuotaPerTingkat?.lokasiCount,
              jenisCount: metadata.kuotaPerTingkat?.jenisCount ?? currentHeader.kuotaPerTingkat?.jenisCount,
              pendidikanCount: metadata.kuotaPerTingkat?.pendidikanCount ?? metadata.kuotaPendidikan ?? 0,
            };

            const hasJab = Boolean(metadata.jabatanFormasi && metadata.jabatanFormasi !== 'Formasi' && metadata.jabatanFormasi.trim().length > 0);
            const hasLok = Boolean(metadata.lokasiFormasi && metadata.lokasiFormasi !== 'Lokasi' && metadata.lokasiFormasi.trim().length > 0);
            const isJabOrLokChanged = (hasJab && !areJobsEqual(metadata.jabatanFormasi, currentHeader.jabatanFormasi)) ||
                                     (hasLok && metadata.lokasiFormasi !== currentHeader.lokasiFormasi);

            const effectivePendidikan =
              metadata.pendidikan && metadata.pendidikan !== '-'
                ? metadata.pendidikan
                : isJabOrLokChanged
                ? '-'
                : currentHeader.pendidikan && currentHeader.pendidikan !== '-'
                ? currentHeader.pendidikan
                : '-';

            currentHeader = {
              instansi: metadata.instansi || currentHeader.instansi,
              kodeInstansi: metadata.kodeInstansi || currentHeader.kodeInstansi || '',
              namaInstansi: metadata.namaInstansi || metadata.instansi || currentHeader.namaInstansi,
              jabatanFormasi: metadata.jabatanFormasi || currentHeader.jabatanFormasi,
              kodeJabatan: metadata.kodeJabatan || (metadata.jabatanFormasi ? '' : currentHeader.kodeJabatan || ''),
              namaJabatan: metadata.namaJabatan || metadata.jabatanFormasi || currentHeader.namaJabatan,
              lokasiFormasi: metadata.lokasiFormasi || currentHeader.lokasiFormasi,
              kodeLokasi: metadata.kodeLokasi || (metadata.lokasiFormasi ? '' : currentHeader.kodeLokasi || ''),
              namaLokasi: metadata.namaLokasi || metadata.lokasiFormasi || currentHeader.namaLokasi,
              jenisFormasi: metadata.jenisFormasi || currentHeader.jenisFormasi || '1 - UMUM',
              kodeJenisFormasi: metadata.kodeJenisFormasi || currentHeader.kodeJenisFormasi || '1',
              namaJenisFormasi: metadata.namaJenisFormasi || metadata.jenisFormasi || currentHeader.namaJenisFormasi || 'UMUM',
              pendidikan: effectivePendidikan,
              jumlahKuota: metadata.jumlahKuota ?? metadata.kuotaPendidikan ?? metadata.kuotaJenisFormasi ?? 0,
              kuotaJenisFormasi: metadata.kuotaJenisFormasi ?? metadata.jumlahKuota ?? currentHeader.kuotaJenisFormasi ?? 0,
              kuotaPendidikan: metadata.kuotaPendidikan ?? metadata.jumlahKuota ?? 0,
              kuotaLokasi: metadata.kuotaLokasi ?? currentHeader.kuotaLokasi ?? 0,
              kuotaJabatan: metadata.kuotaJabatan ?? currentHeader.kuotaJabatan ?? 0,
              kuotaInstansi: metadata.kuotaInstansi ?? currentHeader.kuotaInstansi ?? 0,
              kuotaPerTingkat: newKuotaPerTingkat,
            };

            activeBlock = findOrCreateFormasiBlock(formasiMap, formasiOrder, currentHeader, formasiCounterRef);
            lastActiveBlock = activeBlock;
            if (pagePagination) lastActivePageInfo = pagePagination;
          } else {
            // Check if this is a continuation page for lastActiveBlock (e.g., "Halaman X dari Y" with X > 1 or previous page X < Y)
            const isContinuationPage = lastActiveBlock !== null && (
              (pagePagination && pagePagination.pageX > 1 && pagePagination.pageX <= pagePagination.totalY) ||
              (lastActivePageInfo && lastActivePageInfo.pageX < lastActivePageInfo.totalY)
            );

            if (isContinuationPage && lastActiveBlock) {
              activeBlock = lastActiveBlock;
              if (pagePagination) lastActivePageInfo = pagePagination;

              // Append continuation education text if extracted on page 2+
              if (metadata && metadata.pendidikan && metadata.pendidikan !== '-') {
                const cleanMetaPen = cleanPendidikanString(metadata.pendidikan);
                if (cleanMetaPen && cleanMetaPen !== '-' && !activeBlock.header.pendidikan.toLowerCase().includes(cleanMetaPen.toLowerCase())) {
                  activeBlock.header.pendidikan = cleanPendidikanString(`${activeBlock.header.pendidikan} / ${cleanMetaPen}`);
                  currentHeader.pendidikan = activeBlock.header.pendidikan;
                }
              }
            } else {
              if (metadata) {
                if (metadata.instansi) currentHeader.instansi = metadata.instansi;
                if (metadata.pendidikan && metadata.pendidikan !== '-') {
                  if (!currentHeader.pendidikan || currentHeader.pendidikan === '-') {
                    currentHeader.pendidikan = metadata.pendidikan;
                  } else if (metadata.pendidikan.length > currentHeader.pendidikan.length) {
                    currentHeader.pendidikan = metadata.pendidikan;
                  } else if (currentHeader.pendidikan.length > metadata.pendidikan.length) {
                    if (!currentHeader.pendidikan.includes(metadata.pendidikan)) {
                      currentHeader.pendidikan = cleanPendidikanString(`${currentHeader.pendidikan} ${metadata.pendidikan}`);
                    }
                  }
                }
              }

              if (currentHeader.jabatanFormasi && currentHeader.jabatanFormasi !== 'Formasi') {
                activeBlock = findOrCreateFormasiBlock(formasiMap, formasiOrder, currentHeader, formasiCounterRef);
              } else if (formasiOrder.length > 0) {
                const lastKey = formasiOrder[formasiOrder.length - 1];
                activeBlock = formasiMap.get(lastKey) || null;
              }
              if (activeBlock) {
                lastActiveBlock = activeBlock;
                if (pagePagination) lastActivePageInfo = pagePagination;
              }
            }
          }

          // 2. Locate participants table rows with multi-line support
          let rIdx = 0;

          while (rIdx < rows.length) {
            const row = rows[rIdx];
            const lineStr = row.map((w) => w.text).join(' ');

            if (/No\s*Peserta|Nomor\s*Peserta/i.test(lineStr)) {
              rIdx++;
              continue;
            }

            // Check if row has a 14-19 digit NoPeserta
            const hasNoPeserta = /\b\d{14,19}\b/.test(lineStr);

            if (hasNoPeserta) {
              const mainRow = [...row];
              const continuationRows: PDFWord[][] = [];
              let nextIdx = rIdx + 1;

              while (nextIdx < rows.length) {
                const nextRow = rows[nextIdx];
                const nextStr = nextRow.map((w) => w.text).join(' ');

                // Stop if next row has its own NoPeserta or is header/footer/page separator
                if (
                  /\b\d{14,19}\b/.test(nextStr) ||
                  /No\s*Peserta|PANITIA\s*SELEKSI|REKAP\s*HASIL|HASIL\s*INTEGRASI|Jabatan\s*Formasi|Instansi|Lokasi\s*Formasi|Jenis\s*Formasi|Pendidikan|Laporan\s*digenerate|Halaman\s*\d+/i.test(nextStr)
                ) {
                  break;
                }

                continuationRows.push(nextRow);
                nextIdx++;
              }

              const peserta = parseParticipantRow(mainRow, continuationRows, 0, currentHeader.pendidikan);
              if (peserta) {
                if (!activeBlock) {
                  if (currentHeader.jabatanFormasi && currentHeader.jabatanFormasi !== 'Formasi') {
                    activeBlock = findOrCreateFormasiBlock(formasiMap, formasiOrder, currentHeader, formasiCounterRef);
                  } else if (formasiOrder.length > 0) {
                    const lastKey = formasiOrder[formasiOrder.length - 1];
                    activeBlock = formasiMap.get(lastKey) || null;
                  }
                }
                if (activeBlock && !activeBlock.pesertaList.some((p) => p.noPeserta === peserta.noPeserta)) {
                  peserta.no = activeBlock.pesertaList.length + 1;
                  activeBlock.pesertaList.push(peserta);
                }
              }
              rIdx = nextIdx;
            } else {
              rIdx++;
            }
          }
        });

        const formasiBlocks: SSCASNFormasiBlock[] = formasiOrder.map((key) => {
          const block = formasiMap.get(key)!;
          block.header = normalizeJenisFormasiHeader(block.header);
          block.pesertaList = sanitizePesertaList(block.pesertaList, block.header.pendidikan);
          block.pesertaList.forEach((p, idx) => {
            p.no = idx + 1;
          });
          block.verification = calculateVerification(block.pesertaList);

          // Prioritaskan kuota dari Pendidikan terlebih dahulu, baru Jenis Formasi sebagai cadangan
          let k = typeof block.header.kuotaPendidikan === 'number' && block.header.kuotaPendidikan >= 0
            ? block.header.kuotaPendidikan
            : (typeof block.header.kuotaPerTingkat?.pendidikanCount === 'number' && block.header.kuotaPerTingkat.pendidikanCount >= 0
              ? block.header.kuotaPerTingkat.pendidikanCount
              : (typeof block.header.kuotaJenisFormasi === 'number' && block.header.kuotaJenisFormasi >= 0
                ? block.header.kuotaJenisFormasi
                : (typeof block.header.kuotaPerTingkat?.jenisCount === 'number' && block.header.kuotaPerTingkat.jenisCount >= 0
                  ? block.header.kuotaPerTingkat.jenisCount
                  : (typeof block.header.jumlahKuota === 'number' && block.header.jumlahKuota >= 0
                    ? block.header.jumlahKuota
                    : 0))));

          if (k < 0) {
            const passedCount = block.pesertaList.filter((p) => p.keterangan && p.keterangan.startsWith('P/L')).length;
            k = passedCount;
          }
          
          block.header.jumlahKuota = k;
          block.header.kuotaPendidikan = k;
          if (typeof block.header.kuotaJenisFormasi !== 'number') {
            block.header.kuotaJenisFormasi = k;
          }
          block.header.kuotaLokasi = typeof block.header.kuotaLokasi === 'number' ? block.header.kuotaLokasi : k;
          block.header.kuotaJabatan = typeof block.header.kuotaJabatan === 'number' ? block.header.kuotaJabatan : k;
          block.header.kuotaInstansi = typeof block.header.kuotaInstansi === 'number' ? block.header.kuotaInstansi : k;

          block.header.kuotaPerTingkat = {
            pendidikanCount: k,
            jenisCount: block.header.kuotaJenisFormasi,
            lokasiCount: block.header.kuotaLokasi,
            jabatanCount: block.header.kuotaJabatan,
            instansiCount: block.header.kuotaInstansi,
          };

          return block;
        });

        // Post-processing deduplication pass: Merge duplicate blocks referring to the same formasi
        const mergedMap = new Map<string, SSCASNFormasiBlock>();
        const mergedOrder: string[] = [];

        for (const block of formasiBlocks) {
          const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const normPen = (s: string) => cleanPendidikanString(s).toLowerCase().replace(/nilai\s+seleksi\s+kompetensi\s+dasar.*/gi, '').trim();

          const h = block.header;
          const bJab = norm(h.jabatanFormasi);
          const bLok = norm(h.lokasiFormasi);
          const bJen = norm(h.jenisFormasi);
          const bKodeJen = h.kodeJenisFormasi || bJen.match(/^(\d+)/)?.[1] || bJen;
          const bPen = normPen(h.pendidikan);

          let existingBlock: SSCASNFormasiBlock | null = null;

          for (const mId of mergedOrder) {
            const candidate = mergedMap.get(mId)!;
            const cH = candidate.header;
            const cJab = norm(cH.jabatanFormasi);
            const cLok = norm(cH.lokasiFormasi);
            const cJen = norm(cH.jenisFormasi);
            const cKodeJen = cH.kodeJenisFormasi || cJen.match(/^(\d+)/)?.[1] || cJen;
            const cPen = normPen(cH.pendidikan);

            const isJabMatch = areJobsEqual(h.jabatanFormasi, cH.jabatanFormasi);
            const isLokMatch = Boolean(bLok && cLok && bLok === cLok);
            const isJenMatch = (bJen && cJen) ? (bKodeJen === cKodeJen || bJen === cJen) : true;
            const isPenMatch = (!bPen || bPen === '-' || !cPen || cPen === '-')
              ? true
              : bPen === cPen;

            if (isJabMatch && isLokMatch && isJenMatch && isPenMatch) {
              existingBlock = candidate;
              break;
            }
          }

          if (existingBlock) {
            // Merge pesertaList avoiding duplicate noPeserta
            for (const p of block.pesertaList) {
              if (!existingBlock.pesertaList.some((existing) => existing.noPeserta === p.noPeserta)) {
                existingBlock.pesertaList.push(p);
              }
            }
            existingBlock.pesertaList.forEach((p, idx) => {
              p.no = idx + 1;
            });

            // Preserve longest / most complete header info
            if (
              block.header.pendidikan &&
              block.header.pendidikan !== '-' &&
              (!existingBlock.header.pendidikan ||
                existingBlock.header.pendidikan === '-' ||
                block.header.pendidikan.length > existingBlock.header.pendidikan.length)
            ) {
              existingBlock.header.pendidikan = cleanPendidikanString(block.header.pendidikan);
            }

            if (block.header.jumlahKuota > 0 && (!existingBlock.header.jumlahKuota || existingBlock.header.jumlahKuota === 0)) {
              existingBlock.header.jumlahKuota = block.header.jumlahKuota;
            }
            existingBlock.verification = calculateVerification(existingBlock.pesertaList);
          } else {
            mergedOrder.push(block.id);
            mergedMap.set(block.id, block);
          }
        }

        const finalFormasiBlocks = mergedOrder.map((id) => mergedMap.get(id)!);

        const primaryFormasi = finalFormasiBlocks[0] || {
          header: currentHeader,
          pesertaList: [],
          verification: calculateVerification([]),
        };
        const allPeserta = finalFormasiBlocks.flatMap((b) => b.pesertaList);
        const globalVerification = calculateVerification(allPeserta);

        const result: PDFCoordinateParseResult = {
          meta: {
            docTitle: 'PANITIA SELEKSI NASIONAL PENGADAAN CASN - HASIL INTEGRASI SKD DAN SKB',
            tahun: '2024',
            parsedAt: new Date().toISOString(),
            sourceType: 'pdf',
            fileName: fileName || 'Dokumen_SSCASN.pdf',
            totalFormasiCount: finalFormasiBlocks.length,
            totalPesertaCount: allPeserta.length,
            totalPages: allPages.length,
          },
          formasiList: finalFormasiBlocks,
          header: primaryFormasi.header,
          pesertaList: primaryFormasi.pesertaList,
          verification: primaryFormasi.verification,
          pageErrors,
          lastHeader: currentHeader,
        };

        resolve(result);
      } catch (err: any) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}
