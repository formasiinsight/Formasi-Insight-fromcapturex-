import { SSCASNHeader, SSCASNPeserta } from '../types';

/**
 * Calculates formasi quota ensuring kuota is NEVER 0.
 * In CPNS SSCASN, quota for any declared formasi is always at least 1 seat.
 * Candidate/participant count can be 0.
 */
export function getFormasiKuota(
  header?: Partial<SSCASNHeader> | null,
  pesertaList?: SSCASNPeserta[]
): number {
  if (!header) return 1;

  // 1. Strictly prioritize kuotaPendidikan / pendidikanCount if available (including 0 if explicitly defined)
  if (typeof header.kuotaPendidikan === 'number' && header.kuotaPendidikan >= 0) {
    return header.kuotaPendidikan;
  }
  if (typeof header.kuotaPerTingkat?.pendidikanCount === 'number' && header.kuotaPerTingkat.pendidikanCount >= 0) {
    return header.kuotaPerTingkat.pendidikanCount;
  }

  // 2. Next prioritize kuotaJenisFormasi / jenisCount / jumlahKuota
  if (typeof header.kuotaJenisFormasi === 'number' && header.kuotaJenisFormasi >= 0) {
    return header.kuotaJenisFormasi;
  }
  if (typeof header.kuotaPerTingkat?.jenisCount === 'number' && header.kuotaPerTingkat.jenisCount >= 0) {
    return header.kuotaPerTingkat.jenisCount;
  }
  if (typeof header.jumlahKuota === 'number' && header.jumlahKuota >= 0) {
    return header.jumlahKuota;
  }

  // 3. Default fallback minimum kuota is 1 when no kuota value is defined at all
  return 1;
}

/**
 * Returns hierarchical kuotas for header summary boxes
 */
export function getFormasiHierarchyKuotas(
  header?: Partial<SSCASNHeader> | null,
  pesertaList?: SSCASNPeserta[]
) {
  const kuotaPen = getFormasiKuota(header, pesertaList);

  const kuotaJen =
    typeof header?.kuotaJenisFormasi === 'number' && header.kuotaJenisFormasi >= 0
      ? header.kuotaJenisFormasi
      : typeof header?.kuotaPerTingkat?.jenisCount === 'number' && header.kuotaPerTingkat.jenisCount >= 0
      ? header.kuotaPerTingkat.jenisCount
      : kuotaPen;

  const kuotaLok =
    typeof header?.kuotaLokasi === 'number' && header.kuotaLokasi >= 0
      ? header.kuotaLokasi
      : typeof header?.kuotaPerTingkat?.lokasiCount === 'number' && header.kuotaPerTingkat.lokasiCount >= 0
      ? header.kuotaPerTingkat.lokasiCount
      : kuotaJen;

  const kuotaJab =
    typeof header?.kuotaJabatan === 'number' && header.kuotaJabatan >= 0
      ? header.kuotaJabatan
      : typeof header?.kuotaPerTingkat?.jabatanCount === 'number' && header.kuotaPerTingkat.jabatanCount >= 0
      ? header.kuotaPerTingkat.jabatanCount
      : kuotaLok;

  const kuotaInst =
    typeof header?.kuotaInstansi === 'number' && header.kuotaInstansi >= 0
      ? header.kuotaInstansi
      : typeof header?.kuotaPerTingkat?.instansiCount === 'number' && header.kuotaPerTingkat.instansiCount >= 0
      ? header.kuotaPerTingkat.instansiCount
      : kuotaJab;

  return {
    kuotaPen,
    kuotaJen,
    kuotaLok,
    kuotaJab,
    kuotaInst,
  };
}
