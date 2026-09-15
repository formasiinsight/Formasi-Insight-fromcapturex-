import { SSCASNHeader, SSCASNParsedResult } from '../types';

export const OFFICIAL_JENIS_FORMASI_MAP: Record<string, string> = {
  '1': 'UMUM',
  '2': 'PENYANDANG DISABILITAS',
  '3': 'PUTRA/PUTRI LULUSAN TERBAIK (CUMLAUDE)',
  '4': 'DIASPORA',
  '5': 'PUTRA/PUTRI PAPUA',
  '6': 'PUTRA/PUTRI KALIMANTAN',
};

export const OFFICIAL_JENIS_FORMASI_LIST = Object.values(OFFICIAL_JENIS_FORMASI_MAP);

/**
 * Strips any jenisFormasi prefix or leftover table quota artifacts (e.g. "1 - UMUM 1", "1 - UMUM", "UMUM 1")
 * from the kualifikasi pendidikan text.
 */
export function cleanPendidikanString(pendidikan: string): string {
  if (!pendidikan) return '';
  let str = pendidikan.trim();

  // Strip "Nilai Seleksi Kompetensi Dasar" and BKN report headers from education string
  str = str.replace(/Nilai\s+Seleksi\s+Kompetensi\s+Dasar.*/gi, '');
  str = str.replace(/(?:REKAPITULASI\s+)?HASIL\s+SELEKSI\s+KOMPETENSI\s+DASAR.*/gi, '');
  str = str.replace(/PANITIA\s+SELEKSI\s+NASIONAL.*/gi, '');

  // Strip "SKB" word/suffix from kualifikasi pendidikan
  str = str.replace(/\bSKB\b/gi, '').replace(/\s+/g, ' ').trim();

  // Strip leading "Pendidikan" label prefix if present
  str = str.replace(/^Pendidikan\s*:?\s*/i, '').trim();

  // Pattern matching official jenis formasi or generic prefixes at start of string
  const leadingJenisRegex = /^(?:[1-6]\s*[-/. ]\s*)?(?:1\s*-\s*)?(?:UMUM|PENYANDANG\s+DISABILITAS|DISABILITAS|PUTRA\/PUTRI\s+LULUSAN\s+TERBAIK(?:\s*\(CUMLAUDE\))?|CUMLAUDE|DIASPORA|PUTRA\/PUTRI\s+PAPUA|PUTRA\/PUTRI\s+KALIMANTAN)\s*(?:\d+)?\s*/i;

  let prev = '';
  while (str !== prev) {
    prev = str;
    str = str.replace(leadingJenisRegex, '').trim();
  }

  // Strip inline standalone quota numbers that leaked into education string between words (e.g. "S-1 ILMU 2 GIZI/" -> "S-1 ILMU GIZI/")
  str = str.replace(/(\b[A-Z0-9/-]+)\s+\d+\s+(?=[A-Z0-9/-])/gi, '$1 ');

  // Strip standalone leftover quota number if immediately followed by standard degree level
  str = str.replace(/^[0-9]+\s+(?=(?:D-[I|V|X]+|D[1-4]|S-[1-3]|S[1-3]|SMA|SMK|SLTA|DIPLOMA|SARJANA|MAGISTER|DOKTOR|PROFESI|SPESIALIS))/i, '').trim();

  // Remove leading separators
  str = str.replace(/^[/:.-]\s*/, '').trim();

  // Strip "SKB" again in case stripping prefix/suffix exposed it
  str = str.replace(/\bSKB\b/gi, '').replace(/\s+/g, ' ').trim();

  // Clean trailing trailing quota digits or slashes
  str = str.replace(/\s*\/\s*$/, '').replace(/\s+\d+$/, '').trim();

  // Normalize slashes and spacing cleanly (e.g. "D-IV BIOLOGI/ D-IV ILMU GIZI")
  str = str.replace(/\s*\/\s*/g, '/ ').replace(/\s+/g, ' ').trim();

  return str;
}

/**
 * Detects if lokasiFormasi/namaLokasi was truncated due to legacy parser issues
 * (e.g., ending with a lone prefix like "| DINAS" while pendidikan contains "| BIDANG...")
 * and recombines the location parts back into lokasiFormasi while cleaning pendidikan.
 */
export function healHeaderLokasiAndPendidikan<T extends Partial<SSCASNHeader>>(header: T): T {
  if (!header) return header;

  let rawLok = (header.lokasiFormasi || header.namaLokasi || '').trim();
  let rawPen = (header.pendidikan || '').trim();

  if (!rawLok || !rawPen) return header;

  // Check if lokasi ends with a lone unit prefix (e.g. "| DINAS", "| BAGIAN", "| BIDANG", "| BADAN")
  const lonePrefixMatch = rawLok.match(/(.*?\b(?:DINAS|BAGIAN|BIDANG|SUBBAGIAN|SUBBIDANG|BADAN|DEPUTI|DIREKTORAT|INSPEKTORAT|SEKRETARIAT))$/i);

  if (lonePrefixMatch) {
    // Check if pendidikan contains location spillover starting with '|' (e.g., "| BIDANG...", "| PENDIDIKAN | ...")
    const spillMatch = rawPen.match(/\s*\|\s*(?:PENDIDIKAN\s*\|\s*)?((?:BIDANG|SUBBAGIAN|SUBBIDANG|BAGIAN|SEKRETARIAT|UPT|UPTD|SATUAN|PUSKESMAS|RSD|RSUD|SEKOLAH|TATA\s+USAHA|DINAS|BADAN|INSPEKTORAT|DIREKTORAT|DEPUTI).*)$/i);

    if (spillMatch && spillMatch.index !== undefined) {
      const spillText = spillMatch[1].trim();

      // Clean pendidikan by stripping the spillover
      let cleanPen = rawPen.substring(0, spillMatch.index).trim();
      cleanPen = cleanPendidikanString(cleanPen);

      // Determine missing department word if needed (e.g. "DINAS" + "SEKOLAH" => "DINAS PENDIDIKAN")
      let missingWord = '';
      const upperLok = rawLok.toUpperCase();
      const upperSpill = spillText.toUpperCase();
      if (upperLok.endsWith('DINAS') && !upperSpill.startsWith('PENDIDIKAN')) {
        if (
          upperSpill.includes('SEKOLAH') ||
          upperSpill.includes('GURU') ||
          upperSpill.includes('PEMBINAAN') ||
          upperSpill.includes('SISWA') ||
          upperSpill.includes('TK') ||
          upperSpill.includes('SD') ||
          upperSpill.includes('SMP') ||
          upperSpill.includes('SMA')
        ) {
          missingWord = 'PENDIDIKAN ';
        }
      }

      const cleanSpill = spillText.replace(/^(?:PENDIDIKAN\s*)?\|\s*/i, '').trim();
      let restoredLokasi = `${rawLok} ${missingWord}| ${cleanSpill}`.replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ');

      // Clean duplicate "| DINAS | PENDIDIKAN" into "| DINAS PENDIDIKAN"
      restoredLokasi = restoredLokasi.replace(/\|\s*DINAS\s*\|\s*PENDIDIKAN/gi, '| DINAS PENDIDIKAN');

      let kodeLokasi = header.kodeLokasi || '';
      let namaLokasi = restoredLokasi;
      const codeMatch = restoredLokasi.match(/^(\d+)\s*-\s*(.+)$/);
      if (codeMatch) {
        kodeLokasi = codeMatch[1].trim();
        namaLokasi = codeMatch[2].trim();
      }

      return {
        ...header,
        lokasiFormasi: restoredLokasi,
        namaLokasi: namaLokasi,
        kodeLokasi: kodeLokasi,
        pendidikan: cleanPen,
      };
    }
  }

  return header;
}

/**
 * Sanitizes header fields to prevent cross-field bleeding (e.g. Lokasi Formasi / Instansi text leaking into Jabatan Formasi).
 */
export function sanitizeMetadataHeader<T extends Partial<SSCASNHeader>>(header: T): T {
  if (!header || !header.jabatanFormasi) return header;

  let rawJab = header.jabatanFormasi.trim();
  let rawLok = header.lokasiFormasi ? header.lokasiFormasi.trim() : (header.namaLokasi || '').trim();
  let rawInst = header.namaInstansi || (header.instansi ? header.instansi.replace(/^\d+\s*-\s*/, '') : '');

  // 1. Identify misplaced lokasi / instansi text bleeding into jabatanFormasi
  // Position titles (namaJabatan) in SSCASN never contain pipe '|' or agency hierarchy like 'PEMERINTAH ... |'
  let misplacedIndex = -1;

  // Signal 1: Pipe character in jabatanFormasi
  const pipeIdx = rawJab.indexOf('|');

  // Signal 2: Match to instansi name or common agency prefixes
  let instIdx = -1;
  if (rawInst && rawInst.length > 3) {
    const instWords = rawInst.split(/\s+/).slice(0, 3).join(' ');
    if (instWords.length > 3) {
      const regexInst = new RegExp(`\\s+${instWords.replace(/[^a-z0-9]/gi, '\\s*')}`, 'i');
      const matchInst = rawJab.match(regexInst);
      if (matchInst && matchInst.index !== undefined) {
        instIdx = matchInst.index;
      }
    }
  }

  // Signal 3: Organizational hierarchy keyword match (PEMERINTAH, KEMENTERIAN, SEKRETARIAT, DINAS, RSUD, RSUP, BADAN, DIREKTORAT, INSPEKTORAT, PUSKESMAS, BALAI, KANTOR, DEWAN)
  const orgRegex = /\s+(?=(?:PEMERINTAH|KEMENTERIAN|SEKRETARIAT|DINAS|RSUD|RSUP|BADAN|DIREKTORAT|INSPEKTORAT|PUSKESMAS|BALAI|KANTOR|DEWAN)\b)/i;
  const matchOrg = rawJab.match(orgRegex);
  let orgIdx = -1;
  if (matchOrg && matchOrg.index !== undefined) {
    orgIdx = matchOrg.index;
  }

  // Choose the earliest valid split index (> 0)
  const candidateIndices = [pipeIdx, instIdx, orgIdx].filter((idx) => idx > 0);
  if (candidateIndices.length > 0) {
    misplacedIndex = Math.min(...candidateIndices);
  }

  if (misplacedIndex > 0) {
    const cleanJabText = rawJab.substring(0, misplacedIndex).trim();
    const misplacedLokText = rawJab.substring(misplacedIndex).trim();

    let newKodeJab = header.kodeJabatan || '';
    let newNamaJab = cleanJabText;

    const jabParts = cleanJabText.split('-');
    if (jabParts.length > 1 && /^(?:JF|JP|[A-Z0-9]{3,15})$/i.test(jabParts[0].trim())) {
      newKodeJab = jabParts[0].trim();
      newNamaJab = jabParts.slice(1).join('-').trim();
    } else {
      const dashIdx = cleanJabText.indexOf(' - ');
      if (dashIdx !== -1) {
        newKodeJab = cleanJabText.substring(0, dashIdx).trim();
        newNamaJab = cleanJabText.substring(dashIdx + 3).trim();
      }
    }

    let updatedLokasi = rawLok;
    let newKodeLok = header.kodeLokasi || '';
    let newNamaLok = header.namaLokasi || rawLok;

    if (misplacedLokText) {
      if (rawLok) {
        const lokParts = rawLok.split('-');
        if (lokParts.length > 1 && /^\d+$/.test(lokParts[0].trim())) {
          newKodeLok = lokParts[0].trim();
          const existingNamaLok = lokParts.slice(1).join('-').trim();

          const misplacedPrefix = misplacedLokText.substring(0, Math.min(20, misplacedLokText.length)).toLowerCase();
          if (!existingNamaLok.toLowerCase().includes(misplacedPrefix)) {
            newNamaLok = `${misplacedLokText} ${existingNamaLok}`.replace(/\s+/g, ' ').trim();
            updatedLokasi = `${newKodeLok} - ${newNamaLok}`;
          } else {
            newNamaLok = existingNamaLok;
            updatedLokasi = `${newKodeLok} - ${existingNamaLok}`;
          }
        } else {
          const misplacedPrefix = misplacedLokText.substring(0, Math.min(20, misplacedLokText.length)).toLowerCase();
          if (!rawLok.toLowerCase().includes(misplacedPrefix)) {
            updatedLokasi = `${misplacedLokText} ${rawLok}`.replace(/\s+/g, ' ').trim();
            newNamaLok = updatedLokasi;
          }
        }
      } else {
        updatedLokasi = misplacedLokText;
        newNamaLok = misplacedLokText;
      }
    }

    return {
      ...header,
      jabatanFormasi: newKodeJab ? `${newKodeJab} - ${newNamaJab}` : newNamaJab,
      kodeJabatan: newKodeJab,
      namaJabatan: newNamaJab,
      lokasiFormasi: updatedLokasi,
      kodeLokasi: newKodeLok,
      namaLokasi: newNamaLok,
    };
  }

  return header;
}

/**
 * Normalizes header's jenisFormasi and pendidikan according to SSCASN Rules:
 * 1. If jenisFormasi is NOT one of the 6 official kinds, it is moved/prepended into kualifikasi pendidikan.
 * 2. Display format for jenisFormasi is strictly without number code (e.g. "UMUM", "PENYANDANG DISABILITAS").
 * 3. Kualifikasi pendidikan is stripped of extraneous jenisFormasi prefix headers (e.g. "1 - UMUM 1").
 */
export function normalizeJenisFormasiHeader<T extends Partial<SSCASNHeader>>(header: T): T {
  if (!header) return header;
  const sanitizedHeader = sanitizeMetadataHeader(header);
  const healedHeader = healHeaderLokasiAndPendidikan(sanitizedHeader);
  let rawJenis = (healedHeader.jenisFormasi || healedHeader.namaJenisFormasi || '').trim();
  let currentPendidikan = cleanPendidikanString((healedHeader.pendidikan || '').trim());

  // Check if rawJenis contains embedded Pendidikan label or degree markers (e.g. "1 - UMUM 1 Pendidikan D-IV ...")
  if (rawJenis) {
    const embeddedPenMatch = rawJenis.match(/\b(Pendidikan|D-[I|V|X]+|D[1-4]|S-[1-3]|S[1-3]|SMA|SMK|SLTA|DIPLOMA|SARJANA|MAGISTER|DOKTOR|PROFESI|SPESIALIS)\b/i);
    if (embeddedPenMatch && embeddedPenMatch.index !== undefined && embeddedPenMatch.index > 0) {
      const extractedPenPart = rawJenis.substring(embeddedPenMatch.index).replace(/^Pendidikan\s*:?\s*/i, '').trim();
      const cleanJenisPart = rawJenis.substring(0, embeddedPenMatch.index).trim();
      rawJenis = cleanJenisPart;

      const cleanedExtractedPen = cleanPendidikanString(extractedPenPart);
      if (cleanedExtractedPen && cleanedExtractedPen.length > 3) {
        // Replace currentPendidikan if it was missing/default or if rawJenis contained the true education string for this formasi
        if (!currentPendidikan || currentPendidikan === '-' || !currentPendidikan.toUpperCase().includes(cleanedExtractedPen.toUpperCase())) {
          currentPendidikan = cleanedExtractedPen;
        }
      }
    }
  }

  let matchedName: string | null = null;
  let matchedCode: string = '1';

  if (rawJenis) {
    const upperRaw = rawJenis.toUpperCase();
    // Clean leading numbers or prefixes like "1 - ", "1 / ", "1. ", "1 " and trailing count numbers
    const cleanedRaw = rawJenis
      .replace(/^[1-6]\s*[-/. ]\s*/, '')
      .replace(/\s+\d+$/, '')
      .trim()
      .toUpperCase();

    // Exact or keyword match against official 6 kinds
    if (
      cleanedRaw === 'UMUM' ||
      cleanedRaw.startsWith('UMUM') ||
      upperRaw.includes('1 - UMUM') ||
      upperRaw.includes('1/UMUM') ||
      upperRaw.includes('UMUM') ||
      cleanedRaw === '1'
    ) {
      matchedName = 'UMUM';
      matchedCode = '1';
    } else if (
      cleanedRaw === 'PENYANDANG DISABILITAS' ||
      cleanedRaw.includes('DISABILITAS') ||
      upperRaw.includes('PENYANDANG DISABILITAS') ||
      upperRaw.includes('DISABILITAS')
    ) {
      matchedName = 'PENYANDANG DISABILITAS';
      matchedCode = '2';
    } else if (
      cleanedRaw === 'PUTRA/PUTRI LULUSAN TERBAIK (CUMLAUDE)' ||
      cleanedRaw.includes('CUMLAUDE') ||
      cleanedRaw.includes('LULUSAN TERBAIK') ||
      upperRaw.includes('CUMLAUDE') ||
      upperRaw.includes('LULUSAN TERBAIK')
    ) {
      matchedName = 'PUTRA/PUTRI LULUSAN TERBAIK (CUMLAUDE)';
      matchedCode = '3';
    } else if (cleanedRaw === 'DIASPORA' || upperRaw.includes('DIASPORA')) {
      matchedName = 'DIASPORA';
      matchedCode = '4';
    } else if (cleanedRaw === 'PUTRA/PUTRI PAPUA' || upperRaw.includes('PAPUA')) {
      matchedName = 'PUTRA/PUTRI PAPUA';
      matchedCode = '5';
    } else if (cleanedRaw === 'PUTRA/PUTRI KALIMANTAN' || upperRaw.includes('KALIMANTAN')) {
      matchedName = 'PUTRA/PUTRI KALIMANTAN';
      matchedCode = '6';
    }
  }

  if (matchedName) {
    // Valid jenis formasi (without number code)
    return {
      ...header,
      jenisFormasi: matchedName,
      namaJenisFormasi: matchedName,
      kodeJenisFormasi: matchedCode,
      pendidikan: currentPendidikan || '-',
    };
  } else {
    // Rule 1: Move invalid jenisFormasi text into kualifikasi pendidikan ONLY IF it is not a jenis formasi prefix
    const isJenisPrefix = /^(?:[1-6]\s*[-/. ]\s*)?(?:UMUM|PENYANDANG\s+DISABILITAS|DISABILITAS|CUMLAUDE|DIASPORA|PAPUA|KALIMANTAN)\b/i.test(rawJenis);
    if (rawJenis && !isJenisPrefix && rawJenis.toUpperCase() !== 'UMUM') {
      if (!currentPendidikan || currentPendidikan === '-') {
        currentPendidikan = rawJenis;
      } else if (!currentPendidikan.toUpperCase().includes(rawJenis.toUpperCase())) {
        currentPendidikan = `${rawJenis} / ${currentPendidikan}`;
      }
    }

    // Default to 1 - UMUM (displayed without number code)
    return {
      ...header,
      jenisFormasi: 'UMUM',
      namaJenisFormasi: 'UMUM',
      kodeJenisFormasi: '1',
      pendidikan: cleanPendidikanString(currentPendidikan) || '-',
    };
  }
}

/**
 * Helper to test if a single qualification clause (e.g. "S-1 PERIKANAN") matches requested Jenjang filter.
 */
export function isSingleClauseMatchingJenjang(clause: string, jenjangFilter: string): boolean {
  const normalizedJenjang = (jenjangFilter || 'ALL').trim().toUpperCase();
  if (!normalizedJenjang || normalizedJenjang === 'ALL') return true;
  const lowerClause = clause.toLowerCase();

  if (normalizedJenjang === 'S-1' || normalizedJenjang === 'S1') {
    return /\b(s-?1|sarjana)\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'D-IV' || normalizedJenjang === 'D4') {
    return /\b(d-?iv|d-?4|diploma\s*(iv|4))\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'D-III' || normalizedJenjang === 'D3') {
    return /\b(d-?iii|d-?3|diploma\s*(iii|3))\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'D-II' || normalizedJenjang === 'D2') {
    return /\b(d-?ii|d-?2|diploma\s*(ii|2))\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'D-I' || normalizedJenjang === 'D1') {
    return /\b(d-?i|d-?1|diploma\s*(i|1))\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'S-2' || normalizedJenjang === 'S2') {
    return /\b(s-?2|magister)\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'S-3' || normalizedJenjang === 'S3') {
    return /\b(s-?3|doktor)\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'SMK') {
    return /\b(smk|stm|sekolah\s+menengah\s+kejuruan)\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'SMA') {
    return /\b(sma|slta|ma\b|sekolah\s+menengah\s+atas)\b/i.test(lowerClause);
  }
  if (normalizedJenjang === 'SLTA') {
    return /\b(slta|sma|smk|stm|ma\b|sekolah\s+menengah|sederajat)\b/i.test(lowerClause);
  }

  return lowerClause.includes(normalizedJenjang.toLowerCase());
}

/**
 * Checks if a kualifikasi pendidikan string (which may contain multiple qualifications separated by /, ;, \n, ATAU, etc.)
 * matches the specified Jenjang Pendidikan filter AND Jurusan / Program Studi filter.
 *
 * CRITICAL RULE:
 * For a formasi to match both Jenjang and Jurusan:
 * At least ONE qualification option/clause in the pendidikan string MUST satisfy
 * BOTH the Jenjang filter AND the Jurusan filter simultaneously.
 */
export function matchPendidikanWithFilters(
  pendidikanStr: string,
  jenjangFilter: string = 'ALL',
  jurusanFilter: string = ''
): boolean {
  if (!pendidikanStr) return false;

  const trimmedJurusan = jurusanFilter.trim().toLowerCase();
  const normalizedJenjang = (jenjangFilter || 'ALL').trim().toUpperCase();

  // If both filters are ALL / empty, match everything
  if ((!normalizedJenjang || normalizedJenjang === 'ALL') && !trimmedJurusan) {
    return true;
  }

  // Split string into separate qualification clauses/options
  // Common delimiters: ' / ', '\n', ' ; ', ' ATAU ', ' Atau ', '|'
  const rawClauses = pendidikanStr.split(/\s*(?:\/|\n+|;|\||\bATAU\b)\s*/i);

  // Also clean each clause
  const clauses = rawClauses.map((c) => c.trim()).filter((c) => c.length > 0);

  if (clauses.length === 0) {
    return false;
  }

  // Helper to test if a single qualification clause matches requested Jurusan
  const isClauseMatchingJurusan = (clause: string): boolean => {
    if (!trimmedJurusan) return true;
    return clause.toLowerCase().includes(trimmedJurusan);
  };

  // Check if any SINGLE clause matches BOTH Jenjang AND Jurusan
  return clauses.some((clause) => {
    return isSingleClauseMatchingJenjang(clause, normalizedJenjang) && isClauseMatchingJurusan(clause);
  });
}

/**
 * Normalizes all headers inside an SSCASNParsedResult object.
 */
export function normalizeParsedDataHeaders(data: SSCASNParsedResult): SSCASNParsedResult {
  if (!data) return data;

  const normalizedHeader = data.header ? normalizeJenisFormasiHeader(data.header) : data.header;

  const normalizedFormasiList = (data.formasiList || []).map((block) => ({
    ...block,
    header: normalizeJenisFormasiHeader(block.header),
  }));

  return {
    ...data,
    header: normalizedHeader,
    formasiList: normalizedFormasiList,
  };
}

