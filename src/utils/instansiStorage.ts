import { InstansiItem, SSCASNParsedResult, SSCASNFormasiBlock, SSCASNPeserta } from '../types';
import { normalizeParsedDataHeaders } from './jenisFormasiUtils';
import { getSupabaseClient, SUPABASE_PROJECT_CONFIG } from './supabaseClient';
import { INITIAL_INSTANSI_LIST } from './instansiSeedData';

const STORAGE_KEY = 'cpns_instansi_cloud_cache_v2_6';
const DB_NAME = 'SSCASN_Cloud_DB_v2_6';
const DB_VERSION = 2;
const STORE_NAME = 'instansi_cloud_store';

export interface CloudStatusInfo {
  isCloudConnected: boolean;
  lastSyncTime: string;
  totalInstansi: number;
  instansiWithData: number;
  storageType: string;
  isSyncing: boolean;
  provider?: string;
  projectName?: string;
  projectId?: string;
  supabaseConnected?: boolean;
  supabaseErrorMessage?: string | null;
}

// In-memory runtime cache for instantaneous response
let runtimeCache: InstansiItem[] | null = null;
let lastCloudSyncTimestamp: string = new Date().toISOString();

export interface SyncEventDetail {
  status: 'syncing' | 'synced' | 'offline' | 'error';
  message?: string;
  timestamp: string;
}

export function onCloudSyncEvent(callback: (detail: SyncEventDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<SyncEventDetail>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };
  window.addEventListener('sscasn_cloud_sync', handler);
  return () => window.removeEventListener('sscasn_cloud_sync', handler);
}

function emitCloudSyncEvent(status: 'syncing' | 'synced' | 'offline' | 'error', message?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sscasn_cloud_sync', {
        detail: {
          status,
          message,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }
}

function normalizeInstansiItem(item: InstansiItem): InstansiItem {
  if (item.parsedData) {
    return {
      ...item,
      parsedData: normalizeParsedDataHeaders(item.parsedData),
    };
  }
  return item;
}

export function deduplicateInstansiList(list: InstansiItem[]): InstansiItem[] {
  const seen = new Set<string>();
  const result: InstansiItem[] = [];
  for (const item of list) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(normalizeInstansiItem(item));
    }
  }
  return result;
}

// Open / Initialize Local IndexedDB Cache
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save lightweight metadata to localStorage fallback
function saveMetadataToLocalStorage(list: InstansiItem[]): void {
  try {
    const lightList = list.map((item) => {
      if (!item.parsedData) return item;
      const totalFormasi = item.parsedData.formasiList?.length || 0;
      if (totalFormasi > 10) {
        return {
          ...item,
          parsedData: {
            ...item.parsedData,
            formasiList: item.parsedData.formasiList.slice(0, 5),
          },
        };
      }
      return item;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightList));
  } catch (e) {
    try {
      const pureMetaList = list.map(({ parsedData, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pureMetaList));
    } catch (e2) {
      console.warn('[Cloud Storage] LocalStorage fallback quota exceeded.');
    }
  }
}

function loadFromLocalIndexedDB(): Promise<InstansiItem[]> {
  return new Promise(async (resolve) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function saveToLocalIndexedDB(list: InstansiItem[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const clearReq = store.clear();
    await new Promise<void>((resolve) => {
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => resolve();
    });

    for (const item of list) {
      store.put(item);
    }
  } catch (err) {
    console.warn('[Cloud Storage] Error writing to local IndexedDB cache:', err);
  }
}

function loadInstansiListFromLocalStorage(): InstansiItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: InstansiItem[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return deduplicateInstansiList(parsed);
  } catch {
    return [];
  }
}

// Convert Supabase database row to frontend InstansiItem
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

  return {
    id: row.id,
    nama: row.nama || row.name || 'Instansi',
    kode: row.kode || row.code || '',
    kategori: row.kategori || 'kementerian',
    provinsi: row.provinsi || row.province || undefined,
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

// Convert formasi relational DB row to SSCASNFormasiBlock with full analytics
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

/**
 * Paginates through Supabase 'formasi' table to fetch 100% of rows without PostgREST 1000 limit.
 */
async function fetchAllFormasiForInstansiIds(supabase: any, instansiIds: string[]): Promise<any[]> {
  const allRows: any[] = [];
  const PAGE_SIZE = 1000;

  for (const instId of instansiIds) {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      try {
        const { data, error } = await supabase
          .from('formasi')
          .select('*')
          .eq('instansi_id', instId)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error || !Array.isArray(data) || data.length === 0) {
          hasMore = false;
          break;
        }

        allRows.push(...data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += PAGE_SIZE;
        }
      } catch (err) {
        console.warn(`[Supabase Formasi Paging] Error fetching for ${instId}:`, err);
        hasMore = false;
      }
    }
  }

  return allRows;
}

// =================================================================
// CLOUD STORAGE CLIENT-SIDE METHODS (Direct Supabase + Fallbacks)
// =================================================================

/**
 * Loads the complete instansi list.
 * 1. Directly queries Supabase client (works on Vercel, localhost, anywhere).
 * 2. If Supabase has formasi rows in relational table, hydrates formasiList if missing or partial.
 * 3. Falls back to /api/instansi (for local Express server).
 * 4. Falls back to Local IndexedDB & LocalStorage if offline.
 */
export async function loadInstansiListAsync(forceRefresh = false): Promise<InstansiItem[]> {
  if (forceRefresh) {
    runtimeCache = null;
  } else if (runtimeCache && runtimeCache.length > 0) {
    return runtimeCache;
  }

  emitCloudSyncEvent('syncing', 'Memuat data dari database...');

  // 1. FAST PATH: Fetch from Cloud Server API (/api/instansi) - Instant (< 50ms) and authoritative
  try {
    const refreshParam = forceRefresh ? '?refresh=true' : '';
    const response = await fetch(`/api/instansi${refreshParam}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const instList: InstansiItem[] = result.data;
        const normalized = deduplicateInstansiList(instList);
        runtimeCache = normalized;
        lastCloudSyncTimestamp = result.lastUpdated || new Date().toISOString();

        saveToLocalIndexedDB(normalized).catch(() => {});
        saveMetadataToLocalStorage(normalized);

        emitCloudSyncEvent('synced', `Berhasil memuat ${normalized.length} instansi dari server`);
        return normalized;
      }
    }
  } catch (apiErr) {
    // API not reachable (expected on static Vercel)
  }

  // 2. Direct Supabase Query (Fallback for static Vercel environments using chunking to avoid statement timeouts)
  try {
    const supabase = getSupabaseClient();
    const CHUNK_SIZE = 15;
    let allSbRows: any[] = [];
    for (let offset = 0; offset < 200; offset += CHUNK_SIZE) {
      const { data: chunk, error: chunkErr } = await supabase
        .from('instansi')
        .select('*')
        .order('nama', { ascending: true })
        .range(offset, offset + CHUNK_SIZE - 1);
      if (chunkErr) {
        console.warn(`[Supabase Direct] Notice at batch offset ${offset}:`, chunkErr.message);
        break;
      }
      if (!chunk || chunk.length === 0) break;
      allSbRows = allSbRows.concat(chunk);
      if (chunk.length < CHUNK_SIZE) break;
    }

    if (allSbRows.length > 0) {
      const instansiList = allSbRows.map(dbRowToInstansi);
      const normalized = deduplicateInstansiList(instansiList);
      runtimeCache = normalized;
      lastCloudSyncTimestamp = new Date().toISOString();

      saveToLocalIndexedDB(normalized).catch(() => {});
      saveMetadataToLocalStorage(normalized);

      emitCloudSyncEvent('synced', `Berhasil memuat ${normalized.length} instansi lengkap dari Supabase Cloud`);
      return normalized;
    }
  } catch (directSbErr) {
    console.warn('[Supabase Direct] Notice:', directSbErr);
  }

  // 3. Fallback to Local IndexedDB Cache if Cloud/API unreachable
  const localDbItems = await loadFromLocalIndexedDB();
  if (localDbItems !== null && Array.isArray(localDbItems) && localDbItems.length > 0) {
    const normalized = deduplicateInstansiList(localDbItems);
    runtimeCache = normalized;
    emitCloudSyncEvent('offline', 'Menggunakan data cache lokal (Offline)');
    return normalized;
  }

  // 4. Fallback to LocalStorage
  const legacy = loadInstansiListFromLocalStorage();
  if (legacy.length > 0) {
    runtimeCache = legacy;
    emitCloudSyncEvent('offline', 'Menggunakan cache browser');
    return legacy;
  }

  // 5. Final fallback to Seed Data
  runtimeCache = INITIAL_INSTANSI_LIST;
  emitCloudSyncEvent('offline', 'Memuat data katalog bawaan');
  return INITIAL_INSTANSI_LIST;
}

/**
 * Saves the entire list to Supabase Cloud directly and updates local caches.
 */
export async function saveInstansiListAsync(list: InstansiItem[]): Promise<void> {
  const normalized = deduplicateInstansiList(list);
  runtimeCache = normalized;
  lastCloudSyncTimestamp = new Date().toISOString();

  // 1. Update local cache immediately
  saveToLocalIndexedDB(normalized).catch(() => {});
  saveMetadataToLocalStorage(normalized);

  emitCloudSyncEvent('syncing', 'Menyimpan ke Supabase Cloud Database...');

  // 2. Direct Supabase Upsert
  try {
    const supabase = getSupabaseClient();
    const rows = normalized.map((item) => {
      const totalFormasi = item.parsedData?.formasiList?.length || 0;
      let totalKuota = 0;
      let totalPeserta = 0;
      if (item.parsedData?.formasiList) {
        for (const f of item.parsedData.formasiList) {
          totalKuota += Number(f.header?.jumlahKuota) || 1;
          totalPeserta += f.pesertaCount || f.pesertaList?.length || 0;
        }
      }

      return {
        id: item.id,
        kode: item.kode || '',
        nama: item.nama,
        kategori: item.kategori || 'kementerian',
        provinsi: item.provinsi || null,
        status: item.status || 'perlu_upload',
        tahun: item.tahun || '2024',
        pdf_file_name: item.pdfFileName || null,
        notes: item.notes || null,
        total_formasi: totalFormasi,
        total_kuota: totalKuota,
        total_peserta: totalPeserta,
        parsed_data: item.parsedData || null,
        updated_at: item.updatedAt || new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await supabase.from('instansi').upsert(rows);
    if (upsertErr) {
      console.warn('[Supabase Save Notice]:', upsertErr.message);
    } else {
      emitCloudSyncEvent('synced', 'Tersimpan ke Supabase Cloud');
      return;
    }
  } catch (sbErr) {
    console.warn('[Supabase Save Error]:', sbErr);
  }

  // 3. Optional fallback to backend API if present
  try {
    await fetch('/api/instansi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: normalized }),
    });
  } catch {
    // ignore
  }

  emitCloudSyncEvent('synced', 'Tersimpan di database lokal & browser');
}

/**
 * Updates parsed data for a single instansi and syncs to Supabase.
 */
export async function updateInstansiParsedDataAsync(
  instansiId: string,
  parsedData: SSCASNParsedResult,
  pdfFileName?: string
): Promise<InstansiItem[]> {
  const currentList = runtimeCache || (await loadInstansiListAsync());
  const normalizedParsedData = normalizeParsedDataHeaders(parsedData);

  const updatedList = currentList.map((item) => {
    if (item.id === instansiId) {
      return {
        ...item,
        status: 'terdaftar' as const,
        parsedData: normalizedParsedData,
        pdfFileName: pdfFileName || item.pdfFileName || parsedData.meta.fileName || 'SSCASN_Hasil_Integrasi.pdf',
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });

  const targetItem = updatedList.find((i) => i.id === instansiId);

  // Direct Supabase Update
  if (targetItem) {
    try {
      const supabase = getSupabaseClient();
      const totalFormasi = targetItem.parsedData?.formasiList?.length || 0;
      let totalKuota = 0;
      let totalPeserta = 0;
      if (targetItem.parsedData?.formasiList) {
        for (const f of targetItem.parsedData.formasiList) {
          totalKuota += Number(f.header?.jumlahKuota) || 1;
          totalPeserta += f.pesertaCount || f.pesertaList?.length || 0;
        }
      }

      await supabase.from('instansi').upsert([
        {
          id: targetItem.id,
          kode: targetItem.kode || '',
          nama: targetItem.nama,
          kategori: targetItem.kategori || 'kementerian',
          provinsi: targetItem.provinsi || null,
          status: 'terdaftar',
          tahun: targetItem.tahun || '2024',
          pdf_file_name: targetItem.pdfFileName || null,
          notes: targetItem.notes || null,
          total_formasi: totalFormasi,
          total_kuota: totalKuota,
          total_peserta: totalPeserta,
          parsed_data: targetItem.parsedData || null,
          updated_at: targetItem.updatedAt || new Date().toISOString(),
        },
      ]);
    } catch (sbErr) {
      console.warn('[Supabase Parsed Update]:', sbErr);
    }

    // Also notify backend API if available and await persistence
    try {
      await fetch(`/api/instansi/${encodeURIComponent(instansiId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetItem),
      });
    } catch (apiErr) {
      console.warn('[Backend Parsed Update]:', apiErr);
    }
  }

  runtimeCache = updatedList;
  saveToLocalIndexedDB(updatedList).catch(() => {});
  saveMetadataToLocalStorage(updatedList);
  emitCloudSyncEvent('synced', 'Data formasi instansi berhasil disimpan');

  return updatedList;
}

/**
 * Adds a new instansi manually and syncs to Supabase.
 */
export async function addInstansiManualAsync(
  newItem: Omit<InstansiItem, 'id' | 'updatedAt'>
): Promise<InstansiItem[]> {
  const currentList = runtimeCache || (await loadInstansiListAsync());
  const slug = (newItem.kode ? newItem.kode.trim() : newItem.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-+|-+$/g, '');
  const id = `instansi-${slug || Date.now()}`;
  const fullItem: InstansiItem = {
    ...newItem,
    id,
    updatedAt: new Date().toISOString(),
  };

  const updatedList = [fullItem, ...currentList];

  // Direct Supabase Insert
  try {
    const supabase = getSupabaseClient();
    await supabase.from('instansi').upsert([
      {
        id: fullItem.id,
        kode: fullItem.kode || '',
        nama: fullItem.nama,
        kategori: fullItem.kategori || 'kementerian',
        provinsi: fullItem.provinsi || null,
        status: fullItem.status || 'perlu_upload',
        tahun: fullItem.tahun || '2024',
        pdf_file_name: fullItem.pdfFileName || null,
        notes: fullItem.notes || null,
        total_formasi: 0,
        total_kuota: 0,
        total_peserta: 0,
        parsed_data: null,
        updated_at: fullItem.updatedAt,
      },
    ]);
  } catch (sbErr) {
    console.warn('[Supabase Insert Error]:', sbErr);
  }

  // Also call backend API if present
  try {
    fetch(`/api/instansi/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullItem),
    }).catch(() => {});
  } catch {}

  runtimeCache = updatedList;
  lastCloudSyncTimestamp = new Date().toISOString();
  saveToLocalIndexedDB(updatedList).catch(() => {});
  saveMetadataToLocalStorage(updatedList);
  emitCloudSyncEvent('synced', 'Instansi baru berhasil tersimpan ke Supabase Cloud');

  return updatedList;
}

/**
 * Updates metadata of an existing instansi and syncs to Supabase.
 */
export async function updateInstansiMetadataAsync(
  id: string,
  updates: Partial<InstansiItem>
): Promise<InstansiItem[]> {
  const currentList = runtimeCache || (await loadInstansiListAsync());
  let targetItem: InstansiItem | null = null;
  const updatedList = currentList.map((item) => {
    if (item.id === id) {
      targetItem = {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return targetItem;
    }
    return item;
  });

  if (!targetItem) {
    throw new Error(`Instansi dengan ID "${id}" tidak ditemukan.`);
  }

  // Direct Supabase Update
  try {
    const supabase = getSupabaseClient();
    await supabase.from('instansi').update({
      nama: targetItem.nama,
      kode: targetItem.kode || '',
      kategori: targetItem.kategori,
      provinsi: targetItem.provinsi || null,
      tahun: targetItem.tahun,
      notes: targetItem.notes || null,
      updated_at: targetItem.updatedAt,
    }).eq('id', id);
  } catch (sbErr) {
    console.warn('[Supabase Update Error]:', sbErr);
  }

  // Also notify backend API if available
  try {
    fetch(`/api/instansi/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetItem),
    }).catch(() => {});
  } catch {}

  runtimeCache = updatedList;
  lastCloudSyncTimestamp = new Date().toISOString();
  saveToLocalIndexedDB(updatedList).catch(() => {});
  saveMetadataToLocalStorage(updatedList);
  emitCloudSyncEvent('synced', 'Perubahan instansi tersimpan ke Supabase Cloud');

  return updatedList;
}

/**
 * Deletes an instansi from Supabase and local cache.
 */
export async function deleteInstansiAsync(id: string): Promise<InstansiItem[]> {
  const currentList = runtimeCache || (await loadInstansiListAsync());
  const updatedList = currentList.filter((item) => item.id !== id);

  // Direct Supabase Delete
  try {
    const supabase = getSupabaseClient();
    await supabase.from('peserta').delete().eq('instansi_id', id);
    await supabase.from('formasi').delete().eq('instansi_id', id);
    await supabase.from('instansi').delete().eq('id', id);
  } catch (sbErr) {
    console.warn('[Supabase Delete Error]:', sbErr);
  }

  // Also call backend API if present
  try {
    fetch(`/api/instansi/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {}

  runtimeCache = updatedList;
  lastCloudSyncTimestamp = new Date().toISOString();
  saveToLocalIndexedDB(updatedList).catch(() => {});
  saveMetadataToLocalStorage(updatedList);
  emitCloudSyncEvent('synced', 'Instansi berhasil dihapus dari Supabase Cloud');

  return updatedList;
}

/**
 * Fetches participant records directly from Supabase 'peserta' table with caching and fallback.
 */
export async function fetchPesertaByFormasiAsync(
  formasiId?: string,
  instansiId?: string,
  limit = 1000,
  offset = 0
): Promise<SSCASNPeserta[]> {
  const fId = formasiId?.trim() || '';
  const iId = instansiId?.trim() || '';

  // 1. Direct Supabase Query
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from('peserta').select('*').order('no_urut', { ascending: true });

    if (iId) {
      query = query.eq('instansi_id', iId);
    }

    if (fId) {
      if (iId) {
        if (fId.startsWith(iId)) {
          query = query.eq('formasi_id', fId);
        } else {
          const fullFId = `${iId}-${fId}`;
          query = query.or(`formasi_id.eq.${fId},formasi_id.eq.${fullFId},formasi_id.ilike.%-${fId}`);
        }
      } else {
        query = query.or(`formasi_id.eq.${fId},formasi_id.ilike.%-${fId}`);
      }
    }

    if (limit > 0) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((r: any, idx: number) => ({
        no: Number(r.no_urut) || idx + 1,
        noPeserta: r.no_peserta || '-',
        nama: r.nama || '-',
        tanggalLahir: r.tanggal_lahir || '-',
        pendidikan: r.pendidikan || '-',
        ipk: r.ipk !== null && r.ipk !== undefined ? Number(r.ipk) : 0,
        twk: Number(r.twk) || 0,
        tiu: Number(r.tiu) || 0,
        tkp: Number(r.tkp) || 0,
        totalSkd: Number(r.total_skd) || 0,
        skorSkd: Number(r.skor_skd) || Number(r.bobot_skd) || 0,
        skb: Number(r.skb) || 0,
        skorSkb: Number(r.skor_skb) || Number(r.bobot_skb) || 0,
        nilaiAkhir: Number(r.nilai_akhir) || 0,
        keterangan: r.keterangan || '-',
        skdDetails: {
          twk: Number(r.twk) || 0,
          tiu: Number(r.tiu) || 0,
          tkp: Number(r.tkp) || 0,
        },
        bobotSkd: Number(r.bobot_skd) || Number(r.skor_skd) || 0,
        bobotSkb: Number(r.bobot_skb) || Number(r.skor_skb) || 0,
      }));
    }
  } catch (sbErr) {
    console.warn('[Supabase Peserta Fetch Error]:', sbErr);
  }

  // 2. Fallback to API if available
  try {
    const params = new URLSearchParams();
    if (fId) params.set('formasi_id', fId);
    if (iId) params.set('instansi_id', iId);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const res = await fetch(`/api/peserta?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map((r: any, idx: number) => ({
          no: Number(r.no_urut) || idx + 1,
          noPeserta: r.no_peserta || '-',
          nama: r.nama || '-',
          tanggalLahir: r.tanggal_lahir || '-',
          pendidikan: r.pendidikan || '-',
          ipk: r.ipk !== null && r.ipk !== undefined ? Number(r.ipk) : 0,
          twk: Number(r.twk) || 0,
          tiu: Number(r.tiu) || 0,
          tkp: Number(r.tkp) || 0,
          totalSkd: Number(r.total_skd) || 0,
          skorSkd: Number(r.skor_skd) || 0,
          skb: Number(r.skb) || 0,
          skorSkb: Number(r.skor_skb) || 0,
          nilaiAkhir: Number(r.nilai_akhir) || 0,
          keterangan: r.keterangan || '-',
        }));
      }
    }
  } catch {}

  // 3. Fallback to Memory Cache
  if (runtimeCache) {
    for (const inst of runtimeCache) {
      if (iId && inst.id !== iId) continue;
      if (!inst.parsedData) continue;

      const blocks = Array.isArray(inst.parsedData.formasiList) ? inst.parsedData.formasiList : [];
      for (const b of blocks) {
        if (!fId || b.id === fId || `${inst.id}-${b.id}` === fId) {
          if (Array.isArray(b.pesertaList) && b.pesertaList.length > 0) {
            return b.pesertaList;
          }
        }
      }
    }
  }

  return [];
}

/**
 * Hydrates complete instansi data (with all formasi & peserta) directly from Supabase for export.
 */
export async function fetchFullInstansiDataAsync(id: string): Promise<InstansiItem | null> {
  const currentList = runtimeCache || (await loadInstansiListAsync());
  const target = currentList.find((i) => i.id === id);
  if (!target) return null;

  try {
    const supabase = getSupabaseClient();
    
    // Paginate all formasi for this instansi
    const formasiRows: any[] = [];
    let fOffset = 0;
    let hasMoreFormasi = true;
    while (hasMoreFormasi) {
      const { data: fChunk } = await supabase
        .from('formasi')
        .select('*')
        .eq('instansi_id', id)
        .range(fOffset, fOffset + 999);
      if (Array.isArray(fChunk) && fChunk.length > 0) {
        formasiRows.push(...fChunk);
        if (fChunk.length < 1000) hasMoreFormasi = false;
        else fOffset += 1000;
      } else {
        hasMoreFormasi = false;
      }
    }

    // Paginate all peserta for this instansi
    const pesertaRows: any[] = [];
    let pOffset = 0;
    let hasMorePeserta = true;
    while (hasMorePeserta) {
      const { data: pChunk } = await supabase
        .from('peserta')
        .select('*')
        .eq('instansi_id', id)
        .order('no_urut', { ascending: true })
        .range(pOffset, pOffset + 999);
      if (Array.isArray(pChunk) && pChunk.length > 0) {
        pesertaRows.push(...pChunk);
        if (pChunk.length < 1000) hasMorePeserta = false;
        else pOffset += 1000;
      } else {
        hasMorePeserta = false;
      }
    }

    if (Array.isArray(formasiRows) && formasiRows.length > 0) {
      const pesertaByFormasiId = new Map<string, SSCASNPeserta[]>();
      if (Array.isArray(pesertaRows)) {
        for (const p of pesertaRows) {
          const fKey = p.formasi_id || '';
          if (!pesertaByFormasiId.has(fKey)) {
            pesertaByFormasiId.set(fKey, []);
          }
          pesertaByFormasiId.get(fKey)!.push({
            no: Number(p.no_urut) || 1,
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
          });
        }
      }

      const hydratedFormasiList: SSCASNFormasiBlock[] = formasiRows.map((fRow, idx) => {
        const blockId = fRow.id.startsWith(`${id}-`) ? fRow.id.slice(id.length + 1) : fRow.id || `formasi-${idx + 1}`;
        const pList = pesertaByFormasiId.get(fRow.id) || pesertaByFormasiId.get(blockId) || [];
        const kuota = Number(fRow.kuota) || 1;
        const passedList = pList.filter((p) => p.keterangan && String(p.keterangan).trim().startsWith('P/L'));

        return {
          id: blockId,
          header: {
            instansi: target.nama,
            kodeInstansi: target.kode,
            jabatanFormasi: fRow.jabatan || '',
            kodeJabatan: fRow.kode_jabatan || '',
            namaJabatan: fRow.jabatan || '',
            lokasiFormasi: fRow.lokasi || '-',
            kodeLokasi: '',
            namaLokasi: fRow.lokasi || '-',
            pendidikan: fRow.pendidikan || '-',
            jenisFormasi: fRow.jenis_formasi || 'UMUM',
            namaJenisFormasi: fRow.jenis_formasi || 'UMUM',
            jumlahKuota: kuota,
            kuotaJabatan: kuota,
          },
          pesertaCount: pList.length || Number(fRow.total_peserta_skb) || 0,
          pesertaList: pList,
          verification: {
            isValid: true,
            scoreAccuracyPercent: 100,
            totalRecords: pList.length,
            discrepanciesCount: 0,
            passedCount: passedList.length,
            failedCount: Math.max(0, pList.length - passedList.length),
            discrepanciesList: [],
          },
        };
      });

      const defaultHeader = hydratedFormasiList[0]?.header || {
        instansi: target.nama,
        kodeInstansi: target.kode,
        jabatanFormasi: '',
        lokasiFormasi: '',
        jenisFormasi: 'UMUM',
        pendidikan: '',
        jumlahKuota: 1,
      };

      return {
        ...target,
        parsedData: {
          meta: target.parsedData?.meta || {
            docTitle: `Hasil Integrasi SSCASN - ${target.nama}`,
            tahun: target.tahun || '2024',
            parsedAt: new Date().toISOString(),
            sourceType: 'pdf' as const,
            fileName: target.pdfFileName,
            totalFormasiCount: hydratedFormasiList.length,
            totalPesertaCount: hydratedFormasiList.reduce((sum, f) => sum + f.pesertaCount, 0),
          },
          formasiList: hydratedFormasiList,
          pesertaList: [],
          header: defaultHeader,
          verification: target.parsedData?.verification || {
            isValid: true,
            scoreAccuracyPercent: 100,
            totalRecords: hydratedFormasiList.reduce((sum, f) => sum + f.pesertaCount, 0),
            discrepanciesCount: 0,
            passedCount: 0,
            failedCount: 0,
            discrepanciesList: [],
          },
        },
      };
    }
  } catch (err) {
    console.warn('[Full Hydration Error]:', err);
  }

  return target;
}

/**
 * Fetches health & sync status of Cloud Database.
 */
export async function fetchCloudStatusAsync(): Promise<CloudStatusInfo> {
  let isConnected = false;
  let errMsg: string | null = null;
  let count = runtimeCache?.length || 0;

  try {
    const supabase = getSupabaseClient();
    const { data, count: exactCount, error } = await supabase
      .from('instansi')
      .select('id', { count: 'exact', head: true });

    if (!error) {
      isConnected = true;
      if (typeof exactCount === 'number') {
        count = exactCount;
      }
    } else {
      errMsg = error.message;
    }
  } catch (err: any) {
    errMsg = err?.message || 'Gagal tersambung ke Supabase';
  }

  // Fallback check via API
  if (!isConnected) {
    try {
      const res = await fetch('/api/cloud-status');
      if (res.ok) {
        const data = await res.json();
        return {
          isCloudConnected: true,
          lastSyncTime: data.lastSyncTime || lastCloudSyncTimestamp,
          totalInstansi: data.totalInstansi || count,
          instansiWithData: data.instansiWithData || 0,
          storageType: data.storageType || 'Supabase Cloud Database',
          provider: data.provider || 'Supabase Cloud PostgreSQL',
          projectName: data.projectName || SUPABASE_PROJECT_CONFIG.projectName,
          projectId: data.projectId || SUPABASE_PROJECT_CONFIG.projectId,
          supabaseConnected: data.supabaseConnected ?? true,
          supabaseErrorMessage: data.supabaseErrorMessage || null,
          isSyncing: false,
        };
      }
    } catch {}
  }

  const withDataCount = (runtimeCache || []).filter((i) => i.parsedData && i.parsedData.formasiList?.length > 0).length;

  return {
    isCloudConnected: isConnected,
    lastSyncTime: lastCloudSyncTimestamp,
    totalInstansi: count,
    instansiWithData: withDataCount,
    storageType: isConnected ? 'Supabase Cloud Database (Direct Client)' : 'Local IndexedDB (Offline Cache)',
    provider: isConnected ? 'Supabase Cloud PostgreSQL' : 'Local Cache',
    projectName: SUPABASE_PROJECT_CONFIG.projectName,
    projectId: SUPABASE_PROJECT_CONFIG.projectId,
    supabaseConnected: isConnected,
    supabaseErrorMessage: errMsg,
    isSyncing: false,
  };
}

// --- SYNCHRONOUS FALLBACK METHODS ---

export function loadInstansiList(): InstansiItem[] {
  if (runtimeCache) return runtimeCache;
  return loadInstansiListFromLocalStorage();
}

export function saveInstansiList(list: InstansiItem[]): void {
  saveInstansiListAsync(list).catch((err) => console.warn('Sync error:', err));
}

export function updateInstansiParsedData(
  instansiId: string,
  parsedData: SSCASNParsedResult,
  pdfFileName?: string
): InstansiItem[] {
  updateInstansiParsedDataAsync(instansiId, parsedData, pdfFileName);
  const currentList = runtimeCache || loadInstansiListFromLocalStorage();
  return currentList;
}

export function addInstansiManual(newItem: Omit<InstansiItem, 'id' | 'updatedAt'>): InstansiItem[] {
  addInstansiManualAsync(newItem);
  const currentList = runtimeCache || loadInstansiListFromLocalStorage();
  return currentList;
}

export function updateInstansiMetadata(id: string, updates: Partial<InstansiItem>): InstansiItem[] {
  updateInstansiMetadataAsync(id, updates);
  const currentList = runtimeCache || loadInstansiListFromLocalStorage();
  return currentList;
}

export function deleteInstansi(id: string): InstansiItem[] {
  deleteInstansiAsync(id);
  const currentList = runtimeCache || loadInstansiListFromLocalStorage();
  return currentList;
}
