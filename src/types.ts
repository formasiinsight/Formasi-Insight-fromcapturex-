export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  instansi?: string;
  status: 'active' | 'inactive';
  avatarColor?: string;
  createdAt: string;
  lastLogin?: string;
}

export type InstansiKategori = 'kementerian' | 'lembaga' | 'pemprov' | 'pemkab_pemkot';

export interface InstansiItem {
  id: string;
  nama: string;
  kode: string;
  kategori: InstansiKategori;
  provinsi?: string;
  status?: 'terdaftar' | 'perlu_upload';
  tahun: string;
  updatedAt: string;
  parsedData?: SSCASNParsedResult;
  pdfFileName?: string;
  notes?: string;
  totalFormasiDB?: number;
  totalKuotaDB?: number;
  totalPesertaDB?: number;
}

export interface FormasiFilterParams {
  instansiId?: string;
  searchQuery?: string;
  pendidikan?: string;
  lokasi?: string;
  jenisFormasi?: string;
  onlyWithKuota?: boolean;
}

export interface SSCASNHeader {
  instansi: string;
  kodeInstansi?: string;
  namaInstansi?: string;
  jabatanFormasi: string;
  kodeJabatan?: string;
  namaJabatan?: string;
  lokasiFormasi: string;
  kodeLokasi?: string;
  namaLokasi?: string;
  jenisFormasi: string;
  kodeJenisFormasi?: string;
  namaJenisFormasi?: string;
  pendidikan: string;
  jumlahKuota: number;
  kuotaInstansi?: number;
  kuotaJabatan?: number;
  kuotaLokasi?: number;
  kuotaJenisFormasi?: number;
  kuotaPendidikan?: number;
  kuotaPerTingkat?: {
    instansiCount?: number;
    jabatanCount?: number;
    lokasiCount?: number;
    jenisCount?: number;
    pendidikanCount?: number;
  };
}

export interface SSCASNPeserta {
  no: number;
  noPeserta: string;
  nama: string;
  tanggalLahir: string;
  pendidikan: string;
  ipk: number;
  twk: number;
  tiu: number;
  tkp: number;
  totalSkd: number;
  skorSkd: number; // 40%
  skb: number;
  skorSkb: number; // 60%
  nilaiAkhir: number;
  keterangan: string; // e.g. "P/L", "TL", "TH", "P/L-1", "TMS"
  
  // Internal validation flags
  verificationFlags?: {
    isSkdValid: boolean;
    isSkorSkdValid: boolean;
    isSkorSkbValid: boolean;
    isNilaiAkhirValid: boolean;
    details?: string[];
  };
}

export interface SSCASNVerificationResult {
  isValid: boolean;
  scoreAccuracyPercent: number;
  totalRecords: number;
  discrepanciesCount: number;
  passedCount: number;
  failedCount: number;
  discrepanciesList: Array<{
    noPeserta: string;
    nama: string;
    issue: string;
    expected: string | number;
    found: string | number;
  }>;
}

export interface SSCASNFormasiAnalytics {
  minSkd?: number | null;
  maxSkd?: number | null;
  minSkb?: number | null;
  maxSkb?: number | null;
  cutoffNilaiAkhir?: number | null;
  highestNilaiAkhir?: number | null;
  rasioKeketatan?: string;
  totalPesertaSkb?: number;
  totalLulus?: number;
}

export interface SSCASNFormasiBlock {
  id: string;
  header: SSCASNHeader;
  pesertaList: SSCASNPeserta[];
  pesertaCount?: number;
  verification?: SSCASNVerificationResult;
  analytics?: SSCASNFormasiAnalytics;
}

export interface SSCASNParsedResult {
  meta: {
    docTitle: string;
    tahun: string;
    parsedAt: string;
    sourceType: 'pdf' | 'excel' | 'ocr' | 'sample' | 'text';
    fileName?: string;
    totalFormasiCount?: number;
    totalPesertaCount?: number;
    totalPages?: number;
  };
  pageErrors?: Array<{
    page: number;
    reason: string;
  }>;
  // Array of all formations detected in the file
  formasiList: SSCASNFormasiBlock[];
  
  // Backward compatibility / convenience getters for aggregate view
  header: SSCASNHeader;
  pesertaList: SSCASNPeserta[];
  verification?: SSCASNVerificationResult;
  lastHeader?: SSCASNHeader;
}

