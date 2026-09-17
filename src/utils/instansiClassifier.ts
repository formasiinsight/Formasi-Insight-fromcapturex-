import { InstansiKategori } from '../types';

export const DAFTAR_PROVINSI_INDONESIA: string[] = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Bengkulu',
  'Lampung',
  'DKI Jakarta',
  'Jawa Barat',
  'Banten',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Gorontalo',
  'Sulawesi Tengah',
  'Sulawesi Barat',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Selatan',
  'Papua Tengah',
  'Papua Pegunungan',
  'Papua Barat Daya',
];

// Map of common cities and regencies in Indonesia to their respective provinces
const KOTA_KABUPATEN_PROVINSI_MAP: Record<string, string> = {
  // Jawa Timur
  'surabaya': 'Jawa Timur',
  'malang': 'Jawa Timur',
  'jember': 'Jawa Timur',
  'banyuwangi': 'Jawa Timur',
  'sidoarjo': 'Jawa Timur',
  'gresik': 'Jawa Timur',
  'pasuruan': 'Jawa Timur',
  'probolinggo': 'Jawa Timur',
  'kediri': 'Jawa Timur',
  'blitar': 'Jawa Timur',
  'madiun': 'Jawa Timur',
  'mojokerto': 'Jawa Timur',
  'batu': 'Jawa Timur',
  'tuban': 'Jawa Timur',
  'lamongan': 'Jawa Timur',
  'bojonegoro': 'Jawa Timur',
  'ngawi': 'Jawa Timur',
  'magetan': 'Jawa Timur',
  'ponorogo': 'Jawa Timur',
  'pacitan': 'Jawa Timur',
  'trenggalek': 'Jawa Timur',
  'tulungagung': 'Jawa Timur',
  'nganjuk': 'Jawa Timur',
  'jombang': 'Jawa Timur',
  'lumajang': 'Jawa Timur',
  'bondowoso': 'Jawa Timur',
  'situbondo': 'Jawa Timur',
  'bangka': 'Kepulauan Bangka Belitung',
  'bangkalan': 'Jawa Timur',
  'sampang': 'Jawa Timur',
  'pamekasan': 'Jawa Timur',
  'sumenep': 'Jawa Timur',

  // Jawa Barat
  'bandung': 'Jawa Barat',
  'bogor': 'Jawa Barat',
  'bekasi': 'Jawa Barat',
  'depok': 'Jawa Barat',
  'cimahi': 'Jawa Barat',
  'tasikmalaya': 'Jawa Barat',
  'cirebon': 'Jawa Barat',
  'sukabumi': 'Jawa Barat',
  'banjar': 'Jawa Barat',
  'karawang': 'Jawa Barat',
  'purwakarta': 'Jawa Barat',
  'subang': 'Jawa Barat',
  'indramayu': 'Jawa Barat',
  'majalengka': 'Jawa Barat',
  'kuningan': 'Jawa Barat',
  'sumedang': 'Jawa Barat',
  'garut': 'Jawa Barat',
  'cianjur': 'Jawa Barat',
  'pangandaran': 'Jawa Barat',

  // Jawa Tengah
  'semarang': 'Jawa Tengah',
  'surakarta': 'Jawa Tengah',
  'solo': 'Jawa Tengah',
  'magelang': 'Jawa Tengah',
  'pekalongan': 'Jawa Tengah',
  'salatiga': 'Jawa Tengah',
  'tegal': 'Jawa Tengah',
  'banyumas': 'Jawa Tengah',
  'purwokerto': 'Jawa Tengah',
  'cilacap': 'Jawa Tengah',
  'kudus': 'Jawa Tengah',
  'pati': 'Jawa Tengah',
  'jepara': 'Jawa Tengah',
  'demak': 'Jawa Tengah',
  'kendal': 'Jawa Tengah',
  'batang': 'Jawa Tengah',
  'brebes': 'Jawa Tengah',
  'pemalang': 'Jawa Tengah',
  'klaten': 'Jawa Tengah',
  'boyolali': 'Jawa Tengah',
  'sukoharjo': 'Jawa Tengah',
  'wonogiri': 'Jawa Tengah',
  'karanganyar': 'Jawa Tengah',
  'sragen': 'Jawa Tengah',
  'grobogan': 'Jawa Tengah',
  'blora': 'Jawa Tengah',
  'rembang': 'Jawa Tengah',
  'kebumen': 'Jawa Tengah',
  'purworejo': 'Jawa Tengah',
  'wonosobo': 'Jawa Tengah',
  'temanggung': 'Jawa Tengah',
  'banjarnegara': 'Jawa Tengah',
  'purbalingga': 'Jawa Tengah',

  // DKI & Banten
  'jakarta': 'DKI Jakarta',
  'serang': 'Banten',
  'cilegon': 'Banten',
  'tangerang': 'Banten',
  'tangerang selatan': 'Banten',
  'lebak': 'Banten',
  'pandeglang': 'Banten',

  // DI Yogyakarta
  'yogyakarta': 'DI Yogyakarta',
  'jogja': 'DI Yogyakarta',
  'sleman': 'DI Yogyakarta',
  'bantul': 'DI Yogyakarta',
  'kulon progo': 'DI Yogyakarta',
  'gunungkidul': 'DI Yogyakarta',

  // Bali & Nusa Tenggara
  'denpasar': 'Bali',
  'badung': 'Bali',
  'gianyar': 'Bali',
  'buleleng': 'Bali',
  'tabanan': 'Bali',
  'klungkung': 'Bali',
  'bangli': 'Bali',
  'karangasem': 'Bali',
  'jembrana': 'Bali',
  'mataram': 'Nusa Tenggara Barat',
  'bima': 'Nusa Tenggara Barat',
  'lombok': 'Nusa Tenggara Barat',
  'sumbawa': 'Nusa Tenggara Barat',
  'kupang': 'Nusa Tenggara Timur',
  'manggarai': 'Nusa Tenggara Timur',
  'flores': 'Nusa Tenggara Timur',
  'sumba': 'Nusa Tenggara Timur',

  // Sumatera
  'medan': 'Sumatera Utara',
  'deli serdang': 'Sumatera Utara',
  'padang': 'Sumatera Barat',
  'pekanbaru': 'Riau',
  'dumai': 'Riau',
  'batam': 'Kepulauan Riau',
  'tanjungpinang': 'Kepulauan Riau',
  'palembang': 'Sumatera Selatan',
  'bengkulu': 'Bengkulu',
  'jambi': 'Jambi',
  'bandar lampung': 'Lampung',
  'metro': 'Lampung',
  'pangkalpinang': 'Kepulauan Bangka Belitung',
  'banda aceh': 'Aceh',

  // Kalimantan
  'pontianak': 'Kalimantan Barat',
  'singkawang': 'Kalimantan Barat',
  'palangkaraya': 'Kalimantan Tengah',
  'banjarmasin': 'Kalimantan Selatan',
  'banjarbaru': 'Kalimantan Selatan',
  'samarinda': 'Kalimantan Timur',
  'balikpapan': 'Kalimantan Timur',
  'bontang': 'Kalimantan Timur',
  'tarakan': 'Kalimantan Utara',

  // Sulawesi
  'makassar': 'Sulawesi Selatan',
  'gowa': 'Sulawesi Selatan',
  'maros': 'Sulawesi Selatan',
  'parepare': 'Sulawesi Selatan',
  'palopo': 'Sulawesi Selatan',
  'manado': 'Sulawesi Utara',
  'tomohon': 'Sulawesi Utara',
  'bitung': 'Sulawesi Utara',
  'kotamobagu': 'Sulawesi Utara',
  'palu': 'Sulawesi Tengah',
  'kendari': 'Sulawesi Tenggara',
  'bau-bau': 'Sulawesi Tenggara',
  'gorontalo': 'Gorontalo',
  'mamuju': 'Sulawesi Barat',

  // Maluku & Papua
  'ambon': 'Maluku',
  'tual': 'Maluku',
  'ternate': 'Maluku Utara',
  'tidore': 'Maluku Utara',
  'jayapura': 'Papua',
  'sorong': 'Papua Barat Daya',
  'manokwari': 'Papua Barat',
  'merauke': 'Papua Selatan',
  'nabire': 'Papua Tengah',
  'wamena': 'Papua Pegunungan',
};

export interface InstansiClassificationResult {
  kategori: InstansiKategori;
  provinsi?: string;
  confidence: number;
}

/**
 * Classifies the category (Kementerian, Lembaga, Pemprov, Pemkab/Pemkot)
 * and detects the province based on instansi name and BKN code.
 */
export function classifyInstansi(nama: string, kode?: string): InstansiClassificationResult {
  const normNama = (nama || '').toLowerCase().trim();
  const normKode = (kode || '').trim();

  // 1. Detect Province from direct name
  let detectedProvinsi: string | undefined = undefined;
  for (const prov of DAFTAR_PROVINSI_INDONESIA) {
    const provLower = prov.toLowerCase();
    // Use regex to avoid false positives (e.g. "Papua" vs "Papua Barat")
    const regex = new RegExp(`\\b${provLower}\\b`, 'i');
    if (regex.test(normNama)) {
      detectedProvinsi = prov;
      break;
    }
  }

  // If province not directly found, check district/city keywords
  if (!detectedProvinsi) {
    for (const [key, provName] of Object.entries(KOTA_KABUPATEN_PROVINSI_MAP)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(normNama)) {
        detectedProvinsi = provName;
        break;
      }
    }
  }

  // 2. Classify: Pemerintah Provinsi (Pemprov)
  const isPemprov =
    /\b(?:pemerintah\s+provinsi|pemprov|provinsi\b)/i.test(normNama) ||
    (normKode.startsWith('50') && normKode.length === 4);

  if (isPemprov) {
    return {
      kategori: 'pemprov',
      provinsi: detectedProvinsi,
      confidence: 0.95,
    };
  }

  // 3. Classify: Pemerintah Kabupaten atau Kota (Pemkab/Pemkot)
  const isPemda =
    /\b(?:pemerintah\s+kabupaten|pemkab|kabupaten|kab\.|pemerintah\s+kota|pemkot|kotamadya|pemerintah\s+daerah)\b/i.test(
      normNama
    ) ||
    /^[567]\d{3}$/.test(normKode);

  if (isPemda) {
    return {
      kategori: 'pemkab_pemkot',
      provinsi: detectedProvinsi,
      confidence: 0.95,
    };
  }

  // 4. Classify: Kementerian
  const isKementerian =
    /\b(?:kementerian|kemenkes|kemendikbud|kemenkeu|kemenag|kemenhub|kemlu|kemendagri|kemhan|kemenkumham|kemensos|kemenaker|kemenperin|kemendag|kemenesdm|kemenpupr|kemenkominfo|kemenpanrb|kemenpora|kemenparekraf|kemenkop|kemenpppa|kemenatr|kemenko|kemenko\s+pmk|kemenko\s+marves)\b/i.test(
      normNama
    ) ||
    (/^[12]\d{3}$/.test(normKode) && !/\b(?:badan|lembaga)\b/i.test(normNama));

  if (isKementerian) {
    return {
      kategori: 'kementerian',
      provinsi: detectedProvinsi,
      confidence: 0.9,
    };
  }

  // 5. Classify: Lembaga / Badan Non-Kementerian / LPNK
  const isLembaga =
    /\b(?:badan|lembaga|sekretariat|kejaksaan|mahkamah|komisi|dewan|otoritas|arsip|bkn|bpkp|bpk|bappenas|bmkg|bnpb|bnn|bnpt|basarnas|brin|bps|bpom|big|bin|lan|anri|kpu|bawaslu|kpk|komnas|lpsk|ppatk|ojk|bi\b|bank\s+indonesia)\b/i.test(
      normNama
    ) ||
    /^[34]\d{3}$/.test(normKode);

  if (isLembaga) {
    return {
      kategori: 'lembaga',
      provinsi: detectedProvinsi,
      confidence: 0.9,
    };
  }

  // Fallback heuristic based on BKN code
  if (normKode) {
    const num = parseInt(normKode, 10);
    if (num >= 5000 && num <= 7999) {
      return {
        kategori: 'pemkab_pemkot',
        provinsi: detectedProvinsi,
        confidence: 0.8,
      };
    }
  }

  // Default fallback
  return {
    kategori: 'kementerian',
    provinsi: detectedProvinsi,
    confidence: 0.7,
  };
}

export interface ExtractedInstansiHeader {
  nama: string;
  kode: string;
  kategori: InstansiKategori;
  provinsi?: string;
  tahun: string;
}

/**
 * Extracts instansi name, code, category, province, and year from raw text of SSCASN PDF header.
 */
export function extractInstansiHeaderFromRawText(rawText: string): ExtractedInstansiHeader | null {
  if (!rawText) return null;

  let rawNama = '';
  let rawKode = '';
  let rawTahun = '2024';

  // 1. Detect Year
  const yearMatch = rawText.match(/\b(202[0-9])\b/);
  if (yearMatch) {
    rawTahun = yearMatch[1];
  }

  // 2. Pattern A: "Instansi : (5471) Pemerintah Kota Surabaya" or "Instansi Formasi : (4001) BKN"
  const instansiParenMatch = rawText.match(
    /\bInstansi(?:\s+Formasi)?\s*:\s*\(([A-Za-z0-9]+)\)\s*([^\r\n,;]+?)(?=\s+(?:Jabatan|Lokasi|Jenis|Pendidikan|Halaman|$))/i
  );

  if (instansiParenMatch) {
    rawKode = instansiParenMatch[1].trim();
    rawNama = instansiParenMatch[2].trim();
  } else {
    // Pattern B: "Instansi : 5471 - Pemerintah Kota Surabaya"
    const instansiDashMatch = rawText.match(
      /\bInstansi(?:\s+Formasi)?\s*:\s*([A-Za-z0-9]+)\s*[-–—]\s*([^\r\n,;]+?)(?=\s+(?:Jabatan|Lokasi|Jenis|Pendidikan|Halaman|$))/i
    );
    if (instansiDashMatch) {
      rawKode = instansiDashMatch[1].trim();
      rawNama = instansiDashMatch[2].trim();
    } else {
      // Pattern C: "Instansi : Pemerintah Kota Surabaya"
      const instansiColonMatch = rawText.match(
        /\bInstansi(?:\s+Formasi)?\s*:\s*([^\r\n,;]+?)(?=\s+(?:Jabatan|Lokasi|Jenis|Pendidikan|Halaman|$))/i
      );
      if (instansiColonMatch) {
        const fullVal = instansiColonMatch[1].trim();
        const codePrefix = fullVal.match(/^(\d{4})\s*[-–]\s*(.+)$/);
        if (codePrefix) {
          rawKode = codePrefix[1].trim();
          rawNama = codePrefix[2].trim();
        } else {
          rawNama = fullVal;
        }
      }
    }
  }

  // Clean rawNama from trailing keywords if present
  if (rawNama) {
    rawNama = rawNama
      .replace(/\s+(?:Jabatan|Lokasi|Jenis|Pendidikan|Jumlah|Kode).*$/i, '')
      .replace(/\s*-\s*$/, '')
      .trim();
  }

  // If code is still empty, look for separate code pattern
  if (!rawKode && rawText) {
    const standaloneCodeMatch = rawText.match(/\b(?:Kode\s+Instansi|Kode)\s*:\s*(\d{4})\b/i);
    if (standaloneCodeMatch) {
      rawKode = standaloneCodeMatch[1];
    }
  }

  if (!rawNama && !rawKode) {
    return null;
  }

  // Normalize name capitalization
  let formattedNama = rawNama;
  if (rawNama && rawNama === rawNama.toUpperCase() && rawNama.length > 4) {
    // Convert ALL-CAPS to Title Case for cleaner display
    formattedNama = rawNama
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (['ri', 'bkn', 'dki', 'di', 'dan', 'yang', 'di', 'ke', 'dari'].includes(word)) {
          return word === 'ri' || word === 'bkn' || word === 'dki' || word === 'di'
            ? word.toUpperCase()
            : word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  const { kategori, provinsi } = classifyInstansi(formattedNama || rawNama, rawKode);

  return {
    nama: formattedNama || rawNama,
    kode: rawKode,
    kategori,
    provinsi,
    tahun: rawTahun,
  };
}
