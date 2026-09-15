import { SSCASNParsedResult, SSCASNPeserta } from '../types';

export function calculateVerification(pesertaList: SSCASNPeserta[]) {
  const discrepanciesList: Array<{
    noPeserta: string;
    nama: string;
    issue: string;
    expected: string | number;
    found: string | number;
  }> = [];

  let validRecordsCount = 0;
  let passedCount = 0;
  let failedCount = 0;

  pesertaList.forEach((p) => {
    let recordValid = true;
    const calcTotalSkd = p.twk + p.tiu + p.tkp;
    const isSkdValid = calcTotalSkd === p.totalSkd;

    // Skor SKD formula: ((Total SKD / 550) * 100) * 0.40  => (Total SKD / 5.5) * 0.4
    const calcSkorSkd = Number(((p.totalSkd / 5.5) * 0.4).toFixed(3));
    const isSkorSkdValid = Math.abs(calcSkorSkd - p.skorSkd) <= 0.01;

    // Skor SKB formula: SKB * 0.60
    const calcSkorSkb = Number((p.skb * 0.6).toFixed(3));
    const isSkorSkbValid = Math.abs(calcSkorSkb - p.skorSkb) <= 0.01;

    // Nilai Akhir formula: Skor SKD + Skor SKB
    const calcNilaiAkhir = Number((p.skorSkd + p.skorSkb).toFixed(3));
    const isNilaiAkhirValid = Math.abs(calcNilaiAkhir - p.nilaiAkhir) <= 0.01;

    if (!isSkdValid) {
      recordValid = false;
      discrepanciesList.push({
        noPeserta: p.noPeserta,
        nama: p.nama,
        issue: 'Total SKD tidak cocok dengan sum(TWK+TIU+TKP)',
        expected: calcTotalSkd,
        found: p.totalSkd,
      });
    }

    if (!isSkorSkdValid) {
      recordValid = false;
      discrepanciesList.push({
        noPeserta: p.noPeserta,
        nama: p.nama,
        issue: 'Skor SKD (40%) tidak presisi',
        expected: calcSkorSkd,
        found: p.skorSkd,
      });
    }

    if (!isSkorSkbValid) {
      recordValid = false;
      discrepanciesList.push({
        noPeserta: p.noPeserta,
        nama: p.nama,
        issue: 'Skor SKB (60%) tidak presisi',
        expected: calcSkorSkb,
        found: p.skorSkb,
      });
    }

    if (!isNilaiAkhirValid) {
      recordValid = false;
      discrepanciesList.push({
        noPeserta: p.noPeserta,
        nama: p.nama,
        issue: 'Nilai Akhir != Skor SKD + Skor SKB',
        expected: calcNilaiAkhir,
        found: p.nilaiAkhir,
      });
    }

    if (recordValid) {
      validRecordsCount++;
    }

    p.verificationFlags = {
      isSkdValid,
      isSkorSkdValid,
      isSkorSkbValid,
      isNilaiAkhirValid,
    };

    if (p.keterangan.startsWith('P/L')) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  const accuracyPercent = pesertaList.length > 0
    ? Number(((validRecordsCount / pesertaList.length) * 100).toFixed(1))
    : 100;

  return {
    isValid: discrepanciesList.length === 0,
    scoreAccuracyPercent: accuracyPercent,
    totalRecords: pesertaList.length,
    discrepanciesCount: discrepanciesList.length,
    passedCount,
    failedCount,
    discrepanciesList,
  };
}

const formasi1PesertaList: SSCASNPeserta[] = [
  {
    no: 1,
    noPeserta: '24651220120001209',
    nama: 'UMI FATIKHATUL JANNAH',
    tanggalLahir: '19 Agustus 1998',
    pendidikan: 'S-1 HUKUM',
    ipk: 3.76,
    twk: 115,
    tiu: 145,
    tkp: 191,
    totalSkd: 451,
    skorSkd: 32.8,
    skb: 68.0,
    skorSkb: 40.8,
    nilaiAkhir: 73.6,
    keterangan: 'P/L',
  },
  {
    no: 2,
    noPeserta: '24651220110000551',
    nama: 'ANDHIKA DWIPUTRA W.',
    tanggalLahir: '29 Desember 1992',
    pendidikan: 'S-1 HUKUM',
    ipk: 3.5,
    twk: 100,
    tiu: 95,
    tkp: 182,
    totalSkd: 377,
    skorSkd: 27.418,
    skb: 64.0,
    skorSkb: 38.4,
    nilaiAkhir: 65.818,
    keterangan: 'P/L',
  },
  {
    no: 3,
    noPeserta: '24651220120001475',
    nama: 'SITI FATMA',
    tanggalLahir: '29 Februari 2000',
    pendidikan: 'S-1 HUKUM',
    ipk: 3.74,
    twk: 90,
    tiu: 115,
    tkp: 184,
    totalSkd: 389,
    skorSkd: 28.291,
    skb: 61.0,
    skorSkb: 36.6,
    nilaiAkhir: 64.891,
    keterangan: 'TL',
  },
  {
    no: 4,
    noPeserta: '24651220110000953',
    nama: 'MIQDAD NIDHOM FAHMI',
    tanggalLahir: '05 Maret 1999',
    pendidikan: 'S-1 HUKUM',
    ipk: 3.3,
    twk: 75,
    tiu: 120,
    tkp: 192,
    totalSkd: 387,
    skorSkd: 28.146,
    skb: 60.0,
    skorSkb: 36.0,
    nilaiAkhir: 64.146,
    keterangan: 'TL',
  },
  {
    no: 5,
    noPeserta: '24651220110000198',
    nama: 'AGUNG RIMBAWAN',
    tanggalLahir: '19 Juli 2001',
    pendidikan: 'S-1 HUKUM',
    ipk: 3.76,
    twk: 105,
    tiu: 105,
    tkp: 175,
    totalSkd: 385,
    skorSkd: 28.0,
    skb: 56.0,
    skorSkb: 33.6,
    nilaiAkhir: 61.6,
    keterangan: 'TL',
  },
  {
    no: 6,
    noPeserta: '24651220120002176',
    nama: 'AMALIA ZULFA PRITASARI',
    tanggalLahir: '16 Desember 1998',
    pendidikan: 'S-1 HUKUM',
    ipk: 3.84,
    twk: 95,
    tiu: 110,
    tkp: 174,
    totalSkd: 379,
    skorSkd: 27.564,
    skb: 51.0,
    skorSkb: 30.6,
    nilaiAkhir: 58.164,
    keterangan: 'TL',
  },
];

const formasi2PesertaList: SSCASNPeserta[] = [
  {
    no: 1,
    noPeserta: '24651220110000889',
    nama: 'BAYU ADI PRASETYO',
    tanggalLahir: '12 Mei 1996',
    pendidikan: 'S-1 ADMINISTRASI PUBLIK',
    ipk: 3.85,
    twk: 120,
    tiu: 150,
    tkp: 195,
    totalSkd: 465,
    skorSkd: 33.818,
    skb: 72.0,
    skorSkb: 43.2,
    nilaiAkhir: 77.018,
    keterangan: 'P/L',
  },
  {
    no: 2,
    noPeserta: '24651220120003112',
    nama: 'DIAN PERMATASARI',
    tanggalLahir: '04 Oktober 1997',
    pendidikan: 'S-1 ILMU KOMUNIKASI',
    ipk: 3.68,
    twk: 110,
    tiu: 130,
    tkp: 188,
    totalSkd: 428,
    skorSkd: 31.127,
    skb: 65.0,
    skorSkb: 39.0,
    nilaiAkhir: 70.127,
    keterangan: 'TL',
  },
  {
    no: 3,
    noPeserta: '24651220110001004',
    nama: 'EKO PRASETYO',
    tanggalLahir: '18 Januari 1995',
    pendidikan: 'S-1 ILMU POLITIK',
    ipk: 3.42,
    twk: 95,
    tiu: 125,
    tkp: 180,
    totalSkd: 400,
    skorSkd: 29.091,
    skb: 58.0,
    skorSkb: 34.8,
    nilaiAkhir: 63.891,
    keterangan: 'TL',
  },
];

const header1 = {
  instansi: '6512 - Pemerintah Kab. Jember',
  kodeInstansi: '6512',
  namaInstansi: 'Pemerintah Kab. Jember',
  jabatanFormasi: 'JF0000333 - PENYULUH HUKUM AHLI PERTAMA',
  kodeJabatan: 'JF0000333',
  namaJabatan: 'PENYULUH HUKUM AHLI PERTAMA',
  lokasiFormasi: '65120002 - PEMERINTAH KABUPATEN JEMBER | SEKRETARIAT DAERAH | BAGIAN HUKUM',
  kodeLokasi: '65120002',
  namaLokasi: 'PEMERINTAH KABUPATEN JEMBER | SEKRETARIAT DAERAH | BAGIAN HUKUM',
  jenisFormasi: 'UMUM',
  kodeJenisFormasi: '1',
  namaJenisFormasi: 'UMUM',
  pendidikan: 'S-1 HUKUM',
  jumlahKuota: 2,
  kuotaPendidikan: 2,
  kuotaJenisFormasi: 2,
  kuotaLokasi: 2,
  kuotaJabatan: 2,
  kuotaInstansi: 3,
  kuotaPerTingkat: {
    pendidikanCount: 2,
    jenisCount: 2,
    lokasiCount: 2,
    jabatanCount: 2,
    instansiCount: 3,
  },
};

const header2 = {
  instansi: '6512 - Pemerintah Kab. Jember',
  kodeInstansi: '6512',
  namaInstansi: 'Pemerintah Kab. Jember',
  jabatanFormasi: 'JF0000812 - ANALIS KEBIJAKAN AHLI PERTAMA',
  kodeJabatan: 'JF0000812',
  namaJabatan: 'ANALIS KEBIJAKAN AHLI PERTAMA',
  lokasiFormasi: '65120005 - PEMERINTAH KABUPATEN JEMBER | BADAN PERENCANAAN PEMBANGUNAN DAERAH',
  kodeLokasi: '65120005',
  namaLokasi: 'PEMERINTAH KABUPATEN JEMBER | BADAN PERENCANAAN PEMBANGUNAN DAERAH',
  jenisFormasi: 'UMUM',
  kodeJenisFormasi: '1',
  namaJenisFormasi: 'UMUM',
  pendidikan: 'S-1 ILMU PEMERINTAHAN / S-1 ADMINISTRASI PUBLIK / S-1 HUKUM',
  jumlahKuota: 1,
  kuotaPendidikan: 1,
  kuotaJenisFormasi: 1,
  kuotaLokasi: 1,
  kuotaJabatan: 1,
  kuotaInstansi: 3,
  kuotaPerTingkat: {
    pendidikanCount: 1,
    jenisCount: 1,
    lokasiCount: 1,
    jabatanCount: 1,
    instansiCount: 3,
  },
};

const verif1 = calculateVerification(formasi1PesertaList);
const verif2 = calculateVerification(formasi2PesertaList);

const formasiBlocks = [
  {
    id: 'formasi-1',
    header: header1,
    pesertaList: formasi1PesertaList,
    verification: verif1,
  },
  {
    id: 'formasi-2',
    header: header2,
    pesertaList: formasi2PesertaList,
    verification: verif2,
  },
];

const allPeserta = [...formasi1PesertaList, ...formasi2PesertaList];
const globalVerif = calculateVerification(allPeserta);

export const SAMPLE_SSCASN_DATA: SSCASNParsedResult = {
  meta: {
    docTitle: 'PANITIA SELEKSI NASIONAL PENGADAAN CASN 2024 - HASIL INTEGRASI SKD DAN SKB PENGADAAN CPNS 2024',
    tahun: '2024',
    parsedAt: new Date().toISOString(),
    sourceType: 'sample',
    fileName: 'HASIL_INTEGRASI_SKD_SKB_JEMBER_MULTI_FORMASI_2024.pdf',
    totalFormasiCount: 2,
    totalPesertaCount: allPeserta.length,
  },
  formasiList: formasiBlocks,
  header: header1,
  pesertaList: formasi1PesertaList,
  verification: verif1,
};
