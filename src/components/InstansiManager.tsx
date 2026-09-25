import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  BarChart2,
  Table,
  Edit2,
  Trash2,
  Code,
  CheckCircle2,
  MapPin,
  Filter,
  Cloud,
  Download,
  RefreshCw,
  FileJson,
  UploadCloud,
  Database,
  Copy,
  Check,
  Award,
  Users,
  Briefcase,
  Layers,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { InstansiItem, InstansiKategori, SSCASNParsedResult } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { getFormasiKuota } from '../utils/kuotaUtils';
import { saveInstansiListAsync, loadInstansiListAsync, fetchFullInstansiDataAsync } from '../utils/instansiStorage';
import { getInstansiProvinsi } from '../utils/instansiClassifier';

export type InstansiSortField = 'NONE' | 'KODE' | 'NAMA' | 'KATEGORI' | 'FORMASI' | 'KUOTA' | 'PESERTA' | 'STATUS';
export type SortDirection = 'asc' | 'desc';

interface InstansiManagerProps {
  instansiList: InstansiItem[];
  onSelectForDashboard: (instansi: InstansiItem) => void;
  onSelectForFormasi: (instansi: InstansiItem) => void;
  onOpenUploadModal: (instansiId: string) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (instansi: InstansiItem) => void;
  onOpenJsonModal: (parsedData: SSCASNParsedResult) => void;
  onDeleteInstansi: (id: string) => void;
  onListUpdated?: (newList: InstansiItem[]) => void;
}

export const InstansiManager: React.FC<InstansiManagerProps> = ({
  instansiList,
  onSelectForDashboard,
  onSelectForFormasi,
  onOpenUploadModal,
  onOpenAddModal,
  onOpenEditModal,
  onOpenJsonModal,
  onDeleteInstansi,
  onListUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<InstansiKategori | 'ALL'>('ALL');
  const [selectedProvinsi, setSelectedProvinsi] = useState<string>('ALL');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [sortField, setSortField] = useState<InstansiSortField>('NONE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Delete Confirm Modal State
  const [deletingInstansiItem, setDeletingInstansiItem] = useState<InstansiItem | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudNotification, setCloudNotification] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- STRUKTUR TABEL SUPABASE DATABASE SSCASN (BERSIH & TERSTRUKTUR)
-- =========================================================================

-- 1. TABEL UTAMA: Master Instansi
CREATE TABLE IF NOT EXISTS instansi (
    id TEXT PRIMARY KEY,
    kode TEXT,
    nama TEXT NOT NULL,
    kategori TEXT NOT NULL,
    provinsi TEXT,
    tahun TEXT DEFAULT '2024',
    pdf_file_name TEXT,
    total_formasi INTEGER DEFAULT 0,
    total_kuota INTEGER DEFAULT 0,
    total_peserta INTEGER DEFAULT 0,
    notes TEXT,
    parsed_data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Pastikan kolom provinsi tersedia jika tabel sudah pernah dibuat sebelumnya
ALTER TABLE instansi ADD COLUMN IF NOT EXISTS provinsi TEXT;

-- 2. TABEL RELASIONAL: Rincian Jabatan & Formasi
CREATE TABLE IF NOT EXISTS formasi (
    id TEXT PRIMARY KEY,
    instansi_id TEXT REFERENCES instansi(id) ON DELETE CASCADE,
    kode_jabatan TEXT,
    jabatan TEXT NOT NULL,
    lokasi TEXT,
    pendidikan TEXT,
    jenis_formasi TEXT DEFAULT 'UMUM',
    kuota INTEGER DEFAULT 1,
    total_peserta_skb INTEGER DEFAULT 0,
    total_lulus INTEGER DEFAULT 0,
    rasio_keketatan TEXT,
    min_skd NUMERIC,
    max_skd NUMERIC,
    min_skb NUMERIC,
    max_skb NUMERIC,
    cutoff_nilai_akhir NUMERIC,
    highest_nilai_akhir NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABEL RELASIONAL: Data Peserta SKD/SKB & Nilai Akhir
CREATE TABLE IF NOT EXISTS peserta (
    id TEXT PRIMARY KEY,
    formasi_id TEXT REFERENCES formasi(id) ON DELETE CASCADE,
    instansi_id TEXT REFERENCES instansi(id) ON DELETE CASCADE,
    no_urut INTEGER,
    no_peserta TEXT NOT NULL,
    nama TEXT,
    tanggal_lahir TEXT,
    pendidikan TEXT,
    ipk NUMERIC,
    twk NUMERIC,
    tiu NUMERIC,
    tkp NUMERIC,
    total_skd NUMERIC,
    skor_skd NUMERIC,
    skb NUMERIC,
    skor_skb NUMERIC,
    nilai_akhir NUMERIC,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Indeks Performa & Pencarian Kilat
CREATE INDEX IF NOT EXISTS idx_instansi_kode ON instansi(kode);
CREATE INDEX IF NOT EXISTS idx_instansi_kategori ON instansi(kategori);
CREATE INDEX IF NOT EXISTS idx_formasi_instansi ON formasi(instansi_id);
CREATE INDEX IF NOT EXISTS idx_formasi_jabatan ON formasi(jabatan);
CREATE INDEX IF NOT EXISTS idx_peserta_formasi ON peserta(formasi_id);
CREATE INDEX IF NOT EXISTS idx_peserta_instansi ON peserta(instansi_id);
CREATE INDEX IF NOT EXISTS idx_peserta_no ON peserta(no_peserta);

-- 5. Hak Akses (RLS & Grants)
GRANT ALL ON TABLE instansi TO anon, authenticated, service_role;
GRANT ALL ON TABLE formasi TO anon, authenticated, service_role;
GRANT ALL ON TABLE peserta TO anon, authenticated, service_role;

ALTER TABLE instansi ENABLE ROW LEVEL SECURITY;
ALTER TABLE formasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE peserta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write for instansi" ON instansi;
CREATE POLICY "Allow public read-write for instansi" ON instansi FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write for formasi" ON formasi;
CREATE POLICY "Allow public read-write for formasi" ON formasi FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read-write for peserta" ON peserta;
CREATE POLICY "Allow public read-write for peserta" ON peserta FOR ALL TO public USING (true) WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Sync to Cloud function (Direct Supabase + API)
  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    setCloudNotification(null);
    try {
      await saveInstansiListAsync(instansiList);
      setCloudNotification(`Sinkronisasi Sukses: ${instansiList.length} instansi tersimpan di Supabase Cloud.`);
    } catch (err: any) {
      console.warn('Cloud sync error:', err);
      setCloudNotification('Tersimpan di Local Database Browser.');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setCloudNotification(null), 6000);
    }
  };

  // Pull from Cloud function (Direct Supabase + API)
  const handlePullFromCloud = async () => {
    setIsSyncingCloud(true);
    setCloudNotification(null);
    try {
      const freshList = await loadInstansiListAsync();
      if (Array.isArray(freshList) && freshList.length > 0) {
        if (onListUpdated) {
          onListUpdated(freshList);
        }
        setCloudNotification(`Berhasil memuat ${freshList.length} instansi terbaru dari Supabase Cloud.`);
      } else {
        setCloudNotification('Cloud database belum memiliki instansi baru.');
      }
    } catch (err: any) {
      console.error('Failed to pull from cloud:', err);
      setCloudNotification('Gagal mengambil data dari Supabase Cloud.');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setCloudNotification(null), 6000);
    }
  };

  // Export JSON function with complete hydration support for large datasets
  const handleExportJson = async () => {
    try {
      setCloudNotification('Menyiapkan ekspor database lengkap...');
      
      // Hydrate all instansi items that have data
      const fullyHydratedList = await Promise.all(
        instansiList.map(async (inst) => {
          if (!inst.parsedData || (inst.parsedData.formasiList?.length ?? 0) === 0) {
            return inst;
          }
          try {
            const hydrated = await fetchFullInstansiDataAsync(inst.id);
            if (hydrated) return hydrated;
          } catch (e) {
            console.warn(`Could not hydrate instansi ${inst.id}, using local memory state.`);
          }
          return inst;
        })
      );

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullyHydratedList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `instansi_database_cpns_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setCloudNotification('Database JSON lengkap berhasil diekspor.');
    } catch (err: any) {
      console.error('Export JSON error:', err);
      setCloudNotification('Gagal mengekspor data: ' + (err?.message || 'Error'));
    } finally {
      setTimeout(() => setCloudNotification(null), 4000);
    }
  };

  // Import JSON function
  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
          if (onListUpdated) {
            onListUpdated(json);
          }
          await saveInstansiListAsync(json);
          setCloudNotification(`Berhasil mengimpor ${json.length} instansi dari file JSON.`);
        } else {
          alert('Format file JSON tidak valid. Format harus array instansi.');
        }
      } catch (err) {
        alert('Gagal membaca file JSON: Format tidak valid');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Compute Total Metrics across ALL instansi
  const safeList = Array.isArray(instansiList) ? instansiList : [];
  const totalInstansi = safeList.length;

  let totalFormasi = 0;
  let totalKuota = 0;
  let totalPeserta = 0;

  safeList.forEach((inst) => {
    if (inst && inst.parsedData && Array.isArray(inst.parsedData.formasiList)) {
      totalFormasi += inst.parsedData.formasiList.length;
      inst.parsedData.formasiList.forEach((f) => {
        if (!f) return;
        const pList = Array.isArray(f.pesertaList) ? f.pesertaList : [];
        const count =
          pList.length > 0
            ? pList.length
            : typeof f.pesertaCount === 'number'
            ? f.pesertaCount
            : (f.verification?.totalRecords || 0);

        totalPeserta += count;
        totalKuota += getFormasiKuota(f.header, pList);
      });
    }
  });

  // List of unique provinces for Pemkab/Pemkot category with counts
  const pemkabProvincesWithCount = useMemo(() => {
    const countMap: Record<string, number> = {};
    safeList.forEach((inst) => {
      if (inst && inst.kategori === 'pemkab_pemkot') {
        const prov = getInstansiProvinsi(inst) || 'Lainnya';
        countMap[prov] = (countMap[prov] || 0) + 1;
      }
    });

    return Object.entries(countMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [safeList]);

  const totalPemkabCount = useMemo(() => {
    return safeList.filter((inst) => inst?.kategori === 'pemkab_pemkot').length;
  }, [safeList]);

  // Filtering logic
  const filteredList = safeList.filter((inst) => {
    if (!inst) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (inst.nama || '').toLowerCase().includes(q);
      const matchKode = (inst.kode || '').toLowerCase().includes(q);
      if (!matchName && !matchKode) return false;
    }

    if (selectedKategori !== 'ALL') {
      if (selectedKategori === 'pemkab_pemkot') {
        const isPemkab = inst.kategori === 'pemkab_pemkot';
        const isPemprov = inst.kategori === 'pemprov';

        if (selectedProvinsi !== 'ALL') {
          // Ketika filter provinsi dipilih: munculkan seluruh Pemkab/Pemkot dan Provinsi Induk (Pemprov) di wilayah ini
          const prov = getInstansiProvinsi(inst) || '';
          const matchesProv = prov.toLowerCase() === selectedProvinsi.toLowerCase();
          if (!(isPemkab || isPemprov) || !matchesProv) {
            return false;
          }
        } else {
          if (!isPemkab) return false;
        }
      } else if (inst.kategori !== selectedKategori) {
        return false;
      }
    }

    return true;
  });

  // Sorting handler
  const handleSort = (field: InstansiSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField('NONE');
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      // For numerical metrics & status, default to descending (highest first)
      if (field === 'FORMASI' || field === 'KUOTA' || field === 'PESERTA' || field === 'STATUS') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const getSortLabel = (field: InstansiSortField): string => {
    switch (field) {
      case 'KODE':
        return 'Kode Instansi';
      case 'NAMA':
        return 'Nama Instansi';
      case 'KATEGORI':
        return 'Kategori';
      case 'FORMASI':
        return 'Total Formasi';
      case 'KUOTA':
        return 'Total Kuota';
      case 'PESERTA':
        return 'Total Peserta';
      case 'STATUS':
        return 'Ketersediaan Data';
      default:
        return '';
    }
  };

  // Pre-calculate per-instansi statistics and apply sorting
  const sortedList = useMemo(() => {
    const listWithStats = filteredList.map((inst) => {
      const formasiCount = inst.parsedData?.formasiList?.length || 0;
      let instKuota = 0;
      let instPeserta = 0;

      if (formasiCount > 0 && inst.parsedData?.formasiList) {
        inst.parsedData.formasiList.forEach((f) => {
          const pList = Array.isArray(f.pesertaList) ? f.pesertaList : [];
          const count =
            pList.length > 0
              ? pList.length
              : typeof f.pesertaCount === 'number'
              ? f.pesertaCount
              : (f.verification?.totalRecords || 0);

          instPeserta += count;
          instKuota += getFormasiKuota(f.header, pList);
        });
      }

      return {
        ...inst,
        _formasiCount: formasiCount,
        _kuotaCount: instKuota,
        _pesertaCount: instPeserta,
        _hasData: formasiCount > 0,
      };
    });

    if (sortField === 'NONE') {
      if (selectedKategori === 'pemkab_pemkot' && selectedProvinsi !== 'ALL') {
        return [...listWithStats].sort((a, b) => {
          if (a.kategori === 'pemprov' && b.kategori !== 'pemprov') return -1;
          if (b.kategori === 'pemprov' && a.kategori !== 'pemprov') return 1;
          return (a.nama || '').localeCompare(b.nama || '');
        });
      }
      return listWithStats;
    }

    return [...listWithStats].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'KODE': {
          const codeA = (a.kode || '').trim().toLowerCase();
          const codeB = (b.kode || '').trim().toLowerCase();
          comparison = codeA.localeCompare(codeB, undefined, { numeric: true });
          break;
        }
        case 'NAMA': {
          const nameA = (a.nama || '').trim().toLowerCase();
          const nameB = (b.nama || '').trim().toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'KATEGORI': {
          const catA = (a.kategori || '').toLowerCase();
          const catB = (b.kategori || '').toLowerCase();
          comparison = catA.localeCompare(catB);
          break;
        }
        case 'FORMASI': {
          comparison = a._formasiCount - b._formasiCount;
          break;
        }
        case 'KUOTA': {
          comparison = a._kuotaCount - b._kuotaCount;
          break;
        }
        case 'PESERTA': {
          comparison = a._pesertaCount - b._pesertaCount;
          break;
        }
        case 'STATUS': {
          const statusA = a._hasData ? 1 : 0;
          const statusB = b._hasData ? 1 : 0;
          comparison = statusA - statusB;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredList, sortField, sortDirection]);

  const getKategoriBadge = (kategori: InstansiKategori) => {
    switch (kategori) {
      case 'kementerian':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
            Kementerian
          </span>
        );
      case 'lembaga':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
            Lembaga
          </span>
        );
      case 'pemprov':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
            Pemprov
          </span>
        );
      case 'pemkab_pemkot':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
            Pemkab / Pemkot
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* CLOUD NOTIFICATION BANNER */}
      {cloudNotification && (
        <div className="bg-indigo-950/80 border border-indigo-700/80 text-indigo-200 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{cloudNotification}</span>
          </div>
          <button
            onClick={() => setCloudNotification(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* 4 CORE ANALYTICS CARDS ONLY (NO PAGE HEADER) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Instansi */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Total Instansi</span>
            <div className="text-2xl font-black text-white">{totalInstansi.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Instansi Terdaftar</span>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Formasi */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Total Formasi</span>
            <div className="text-2xl font-black text-indigo-400">{totalFormasi.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Jabatan / Unit Kerja</span>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Total Kuota */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Total Kuota</span>
            <div className="text-2xl font-black text-amber-400">{totalKuota.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Alokasi Penerimaan</span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Total Peserta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Total Peserta</span>
            <div className="text-2xl font-black text-purple-400">{totalPeserta.toLocaleString('id-ID')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Peserta SKD / SKB</span>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & ACTIONS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama instansi atau kode..."
              className="w-full h-10 pl-9 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* ACTION BUTTONS: TAMBAH INSTANSI & MORE ACTIONS */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddModal}
              className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Instansi</span>
            </button>

            {/* MORE ACTIONS DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`h-10 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isMoreMenuOpen ? 'bg-slate-800 text-white border-slate-700' : ''
                }`}
                title="Aksi Lainnya"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Aksi Lainnya</span>
              </button>

              {isMoreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMoreMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-800/60">
                    <div className="p-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleSyncToCloud();
                        }}
                        disabled={isSyncingCloud}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <UploadCloud className={`w-4 h-4 text-emerald-400 ${isSyncingCloud ? 'animate-pulse' : ''}`} />
                        <span>{isSyncingCloud ? 'Menyinkronkan...' : 'Sinkron ke Cloud'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handlePullFromCloud();
                        }}
                        disabled={isSyncingCloud}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 text-indigo-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                        <span>Tarik dari Cloud</span>
                      </button>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleExportJson();
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-sky-400" />
                        <span>Ekspor Database (JSON)</span>
                      </button>

                      <label className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer">
                        <FileJson className="w-4 h-4 text-purple-400" />
                        <span>Impor Database (JSON)</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            setIsMoreMenuOpen(false);
                            handleImportJson(e);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsSupabaseModalOpen(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Database className="w-4 h-4 text-emerald-400" />
                        <span>Pengaturan Supabase</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CATEGORY TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-slate-800/80">
          {[
            { key: 'ALL', label: 'Semua Kategori' },
            { key: 'kementerian', label: 'Kementerian' },
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'pemprov', label: 'Pemprov' },
            { key: 'pemkab_pemkot', label: 'Pemkab/Pemkot' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedKategori(tab.key as any);
                if (tab.key !== 'pemkab_pemkot') {
                  setSelectedProvinsi('ALL');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                selectedKategori === tab.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* PROVINSI FILTER (Muncul saat chip Pemkab/Pemkot dipilih) */}
        {selectedKategori === 'pemkab_pemkot' && (
          <div className="pt-2.5 pb-1 border-t border-slate-800/60 flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-xl shrink-0">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Filter Provinsi:</span>
            </div>

            {/* Quick province chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <button
                type="button"
                onClick={() => setSelectedProvinsi('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  selectedProvinsi === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                    : 'bg-slate-950/90 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Semua Provinsi ({totalPemkabCount})
              </button>

              {pemkabProvincesWithCount.map(({ name, count }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedProvinsi(name)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    selectedProvinsi === name
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                      : 'bg-slate-950/90 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {name} ({count})
                </button>
              ))}
            </div>

            {/* Dropdown Selector */}
            <div className="relative ml-auto sm:ml-0">
              <select
                value={selectedProvinsi}
                onChange={(e) => setSelectedProvinsi(e.target.value)}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-200 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer shadow-inner transition-colors"
              >
                <option value="ALL">-- Pilih Provinsi ({totalPemkabCount}) --</option>
                {pemkabProvincesWithCount.map(({ name, count }) => (
                  <option key={name} value={name} className="bg-slate-900 text-white">
                    {name} ({count} Pemkab/Pemkot)
                  </option>
                ))}
              </select>
            </div>

            {selectedProvinsi !== 'ALL' && (
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <span>🏛️ Termasuk Provinsi Induk</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProvinsi('ALL')}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 cursor-pointer transition-colors"
                  title="Reset filter provinsi"
                >
                  <span>Reset: {selectedProvinsi}</span>
                  <span className="font-bold">✕</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1 UNIFIED TABLE WITH KATALOG FORMASI TABLE STYLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
        {/* Table Top Bar */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-semibold">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>
                Menampilkan <strong className="text-white">{sortedList.length}</strong> instansi
              </span>
            </div>

            {sortField !== 'NONE' && (
              <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-lg text-xs animate-fadeIn">
                <span>
                  Urutan: <strong>{getSortLabel(sortField)}</strong> ({sortDirection === 'asc' ? 'A → Z / Terendah' : 'Z → A / Tertinggi'})
                </span>
                <button
                  onClick={() => {
                    setSortField('NONE');
                    setSortDirection('asc');
                  }}
                  className="hover:text-white cursor-pointer ml-1 p-0.5 text-indigo-400 hover:bg-indigo-500/20 rounded transition-colors"
                  title="Reset urutan"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 hidden sm:inline">Urutkan:</span>
              <select
                value={sortField === 'NONE' ? 'NONE' : `${sortField}_${sortDirection}`}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'NONE') {
                    setSortField('NONE');
                    setSortDirection('asc');
                  } else {
                    const [f, dir] = val.split('_');
                    setSortField(f as InstansiSortField);
                    setSortDirection(dir as SortDirection);
                  }
                }}
                className="bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="NONE">Urutan Bawaan</option>
                <option value="NAMA_asc">Nama Instansi (A → Z)</option>
                <option value="NAMA_desc">Nama Instansi (Z → A)</option>
                <option value="KODE_asc">Kode Instansi (0-9 / A-Z)</option>
                <option value="KODE_desc">Kode Instansi (Z-A / 9-0)</option>
                <option value="FORMASI_desc">Total Formasi (Terbanyak)</option>
                <option value="FORMASI_asc">Total Formasi (Tersedikit)</option>
                <option value="KUOTA_desc">Total Kuota (Terbanyak)</option>
                <option value="KUOTA_asc">Total Kuota (Tersedikit)</option>
                <option value="PESERTA_desc">Total Peserta (Terbanyak)</option>
                <option value="PESERTA_asc">Total Peserta (Tersedikit)</option>
                <option value="STATUS_desc">Status (Ada Data Formasi)</option>
                <option value="KATEGORI_asc">Kategori (A → Z)</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              {sortedList.filter((i) => i._hasData).length} instansi memiliki data
            </span>
          </div>
        </div>

        {/* Table Content */}
        {sortedList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-bold text-sm">Tidak ada instansi yang sesuai dengan filter.</p>
            <p className="text-xs text-slate-500">Coba ubah kata kunci pencarian atau tambah instansi baru.</p>
            <button
              onClick={onOpenAddModal}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md"
            >
              + Tambah Instansi
            </button>
          </div>
        ) : (
          <div className="table-scroll-container overflow-x-auto overscroll-x-contain overscroll-y-auto" data-table-scroll="true">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-2.5 text-center static md:sticky md:top-0 md:left-0 md:z-30 bg-slate-900 border-b border-slate-800 w-12 md:shadow-[2px_0_5px_rgba(0,0,0,0.3)] select-none">
                    No
                  </th>

                  {/* KODE */}
                  <th
                    onClick={() => handleSort('KODE')}
                    className="p-2.5 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 whitespace-nowrap min-w-[95px] cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Kode Instansi"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span className={sortField === 'KODE' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Kode
                      </span>
                      {sortField === 'KODE' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* NAMA INSTANSI */}
                  <th
                    onClick={() => handleSort('NAMA')}
                    className="p-2.5 min-w-[280px] lg:min-w-[340px] sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Nama Instansi"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span className={sortField === 'NAMA' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Nama Instansi & Keterangan
                      </span>
                      {sortField === 'NAMA' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* KATEGORI */}
                  <th
                    onClick={() => handleSort('KATEGORI')}
                    className="p-2.5 sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[150px] cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Kategori"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span className={sortField === 'KATEGORI' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Kategori & Wilayah
                      </span>
                      {sortField === 'KATEGORI' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* TOTAL FORMASI */}
                  <th
                    onClick={() => handleSort('FORMASI')}
                    className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[110px] cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Total Formasi"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className={sortField === 'FORMASI' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Total Formasi
                      </span>
                      {sortField === 'FORMASI' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* TOTAL KUOTA */}
                  <th
                    onClick={() => handleSort('KUOTA')}
                    className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[110px] cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Total Kuota"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className={sortField === 'KUOTA' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Total Kuota
                      </span>
                      {sortField === 'KUOTA' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* TOTAL PESERTA */}
                  <th
                    onClick={() => handleSort('PESERTA')}
                    className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[110px] cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Total Peserta"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className={sortField === 'PESERTA' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Total Peserta
                      </span>
                      {sortField === 'PESERTA' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* AKSES MODUL */}
                  <th
                    onClick={() => handleSort('STATUS')}
                    className="p-2.5 text-center sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm whitespace-nowrap min-w-[170px] cursor-pointer hover:bg-slate-800/80 transition-colors select-none group/th"
                    title="Klik untuk mengurutkan berdasarkan Ketersediaan Data"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className={sortField === 'STATUS' ? 'text-indigo-400 font-bold' : 'group-hover/th:text-white'}>
                        Akses Modul
                      </span>
                      {sortField === 'STATUS' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-400 opacity-60 shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* AKSI */}
                  <th className="p-2.5 text-right static md:sticky md:top-0 md:right-0 md:z-30 bg-slate-900 border-b border-slate-800 md:border-l border-slate-800/80 md:shadow-[-4px_0_10px_rgba(0,0,0,0.4)] whitespace-nowrap min-w-[110px]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {sortedList.map((inst, index) => {
                  const formasiCount = inst._formasiCount;
                  const hasData = inst._hasData;
                  const instKuota = inst._kuotaCount;
                  const instPeserta = inst._pesertaCount;

                  return (
                    <tr
                      key={inst.id}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* NO (Sticky Left on Desktop, Static on Mobile) */}
                      <td className="p-2.5 text-center text-slate-500 font-mono text-[11px] static md:sticky md:left-0 md:z-20 bg-slate-900 group-hover:bg-slate-800/90 md:shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        {index + 1}
                      </td>

                      {/* KODE INSTANSI */}
                      <td className="p-2.5 font-mono font-bold text-indigo-400 text-xs whitespace-nowrap">
                        {inst.kode || '-'}
                      </td>

                      {/* NAMA INSTANSI & CATATAN */}
                      <td className="p-2.5">
                        <div className="font-bold text-white text-xs leading-snug group-hover:text-indigo-300 transition-colors">
                          {inst.nama}
                        </div>
                        {inst.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic">
                            {inst.notes}
                          </div>
                        )}
                        {inst.pdfFileName && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate flex items-center gap-1 font-mono">
                            <span>📄 {inst.pdfFileName}</span>
                          </div>
                        )}
                      </td>

                      {/* KATEGORI & WILAYAH */}
                      <td className="p-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getKategoriBadge(inst.kategori)}
                            {inst.kategori === 'pemprov' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                🏛️ Provinsi Induk
                              </span>
                            )}
                          </div>
                          {(() => {
                            const provName = getInstansiProvinsi(inst);
                            return provName ? (
                              <div className="flex items-center gap-1 text-[10px] text-amber-300 font-medium truncate">
                                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{provName}</span>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </td>

                      {/* TOTAL FORMASI */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        {hasData ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {formasiCount.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* TOTAL KUOTA */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        {hasData ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {instKuota.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* TOTAL PESERTA */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        {hasData ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {instPeserta.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* AKSES MODUL BUTTONS */}
                      <td className="p-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasData ? (
                            <>
                              <button
                                onClick={() => onSelectForDashboard(inst)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Buka Dashboard Analytics Instansi Ini"
                              >
                                <BarChart2 className="w-3.5 h-3.5" />
                                <span>Dashboard</span>
                              </button>
                              <button
                                onClick={() => onSelectForFormasi(inst)}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Buka Tabel Formasi & Jurusan Instansi Ini"
                              >
                                <Table className="w-3.5 h-3.5" />
                                <span>Formasi</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => onOpenEditModal(inst)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Kelola</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* AKSI KELOLA (Sticky Right on Desktop, Static on Mobile) */}
                      <td className="p-2.5 text-right static md:sticky md:right-0 md:z-20 bg-slate-900 group-hover:bg-slate-800/90 md:border-l border-slate-800/80 md:shadow-[-4px_0_10px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center justify-end gap-1">
                          {inst.parsedData && (
                            <button
                              onClick={() => onOpenJsonModal(inst.parsedData!)}
                              className="p-1.5 hover:text-white hover:bg-slate-800 text-slate-400 rounded-lg transition-all cursor-pointer"
                              title="Inspeksi Data JSON"
                            >
                              <Code className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                          )}

                          <button
                            onClick={() => onOpenEditModal(inst)}
                            className="p-1.5 hover:text-white hover:bg-slate-800 text-slate-400 rounded-lg transition-all cursor-pointer"
                            title="Edit Informasi & Formasi Instansi"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                          </button>

                          <button
                            onClick={() => setDeletingInstansiItem(inst)}
                            className="p-1.5 hover:text-rose-300 hover:bg-rose-950/40 text-slate-400 rounded-lg transition-all cursor-pointer"
                            title="Hapus Instansi Dari Database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL: DELETE SINGLE INSTANSI */}
      <ConfirmDeleteModal
        isOpen={deletingInstansiItem !== null}
        title="Hapus Instansi Dari Database"
        message="Apakah Anda yakin ingin menghapus instansi ini? Seluruh data metadata serta hasil ekstraksi PDF/JSON yang tersimpan untuk instansi ini akan dihapus permanen dari browser Anda."
        itemName={deletingInstansiItem?.nama}
        confirmText="Hapus Instansi"
        confirmVariant="danger"
        onConfirm={() => {
          if (deletingInstansiItem) {
            onDeleteInstansi(deletingInstansiItem.id);
            setDeletingInstansiItem(null);
          }
        }}
        onClose={() => setDeletingInstansiItem(null)}
      />

      {/* SUPABASE CLOUD DATABASE CONFIG MODAL */}
      {isSupabaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Supabase Cloud Database
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                      Formasi Insight
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">PostgreSQL Cloud Persistence & Real-Time Sync</p>
                </div>
              </div>
              <button
                onClick={() => setIsSupabaseModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-300">
              {/* Project Status Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Proyek Supabase:</span>
                  <span className="font-semibold text-emerald-400 text-sm">Formasi Insight</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Project ID:</span>
                  <span className="font-mono text-white text-xs">tecsyuwdfmfidkxctvny</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Status Integrasi:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung
                  </span>
                </div>
              </div>

              {/* Step instructions */}
              <div className="bg-indigo-950/30 border border-indigo-900/60 p-3.5 rounded-xl space-y-1.5 text-indigo-200">
                <div className="font-bold flex items-center gap-1.5 text-indigo-300">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Instruksi Setup Tabel Supabase
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-200/90">
                  Kredensial API telah dikonfigurasi ke server backend. Pastikan tabel <code>instansi</code> sudah dibuat di menu <strong>SQL Editor</strong> dashboard Supabase Anda dengan script berikut:
                </p>
              </div>

              {/* SQL Schema Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-300 text-[11px]">Script SQL Schema (Supabase SQL Editor):</span>
                  <button
                    onClick={handleCopySql}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin Script SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={async () => {
                  setIsSyncingCloud(true);
                  try {
                    await saveInstansiListAsync(instansiList);
                    setCloudNotification('Berhasil disinkronkan ke Supabase Cloud Database!');
                  } catch (e: any) {
                    setCloudNotification('Gagal sinkronisasi: ' + (e?.message || 'Error'));
                  } finally {
                    setIsSyncingCloud(false);
                    setTimeout(() => setCloudNotification(null), 4000);
                  }
                }}
                disabled={isSyncingCloud}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? 'Menyinkronkan...' : 'Sinkronkan Data ke Supabase Sekarang'}</span>
              </button>

              <button
                onClick={() => setIsSupabaseModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
