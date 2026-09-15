import { SSCASNPeserta } from '../types';

/**
 * Ensures participant name contains strictly the person's name,
 * preventing education degree/major strings (e.g. "ADMINISTRASI PUBLIK", "S-1 HUKUM", "ILMU PEMERINTAHAN")
 * from being merged into participant names due to PDF column alignment shifts.
 */
export function sanitizePesertaNamaAndPendidikan(
  rawNama: string,
  rawPendidikan: string,
  headerPendidikan?: string
): { nama: string; pendidikan: string } {
  if (!rawNama) return { nama: 'PESERTA SSCASN', pendidikan: rawPendidikan || '-' };

  let nama = rawNama.replace(/\s+/g, ' ').trim();
  let pendidikan = (rawPendidikan || '-').replace(/\s+/g, ' ').trim();
  let extractedEducationText = '';

  // Degree regex matching standard degree markers
  const degreeRegex = /\b(S-[123]|S[123]|D-IV|D-III|D-II|D-I|DIV|DIII|DII|DI|D-4|D-3|D-2|D-1|PROFESI|SPESIALIS|PPDS|PPDS-1|SMA|SMK|SLTA|SEKOLAH\s+MENENGAH)\b/i;

  // 1. Extract major options & majors from headerPendidikan if available
  const headerOptions: string[] = [];
  const headerMajors: string[] = [];

  if (headerPendidikan && headerPendidikan !== '-') {
    const splitParts = headerPendidikan.split(/[\/\,\;\n]|(?:\b(?:ATAU|OR)\b)/i);
    for (const part of splitParts) {
      const pClean = part.replace(/\s+/g, ' ').trim();
      if (!pClean) continue;
      headerOptions.push(pClean);
      const majorOnly = pClean
        .replace(/^(?:S-[123]|S[123]|D-IV|D-III|D-II|D-I|DIV|DIII|DII|DI|D-[1234]|PROFESI|SPESIALIS|PPDS|PPDS-1|SMA|SMK|SLTA|SEKOLAH\s+MENENGAH)\s+/i, '')
        .trim();
      if (majorOnly && majorOnly.length >= 3) {
        headerMajors.push(majorOnly);
      }
    }
  }

  // Sort headerMajors by length descending (longest major matches first)
  headerMajors.sort((a, b) => b.length - a.length);

  // 2. Check if a degree marker exists in nama (e.g. "DIANA RETNO WULAN S-1 HUKUM")
  const degreeMatch = nama.match(degreeRegex);

  if (degreeMatch && degreeMatch.index !== undefined) {
    const idx = degreeMatch.index;
    if (idx > 0) {
      extractedEducationText = nama.substring(idx).trim();
      nama = nama.substring(0, idx).trim();
    } else {
      extractedEducationText = nama.substring(0, degreeMatch[0].length).trim();
      nama = nama.substring(degreeMatch[0].length).trim();
    }
  } else {
    // 3. No degree marker in nama. Check if nama ends with or contains any major from headerMajors
    let matchedHeaderMajor = false;
    for (const major of headerMajors) {
      const escapeMajor = major.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapeMajor}\\b`, 'i');
      if (regex.test(nama)) {
        matchedHeaderMajor = true;
        const matchIndex = nama.search(regex);
        if (matchIndex > 0) {
          extractedEducationText = nama.substring(matchIndex).trim();
          nama = nama.substring(0, matchIndex).trim();
        } else {
          nama = nama.replace(regex, '').trim();
          extractedEducationText = major;
        }
        break;
      }
    }

    // 4. Fallback: Check built-in common major keywords if no header match found
    if (!matchedHeaderMajor) {
      const commonMajorsRegex = /\b(ADMINISTRASI\s+PUBLIK|ADMINISTRASI\s+NEGARA|ADMINISTRASI\s+BISNIS|ADMINISTRASI\s+PERKANTORAN|ILMU\s+PEMERINTAHAN|PEMERINTAHAN|SATUAN\s+POLISI\s+PAMONG\s+PRAJA|POLISI\s+PAMONG\s+PRAJA|ILMU\s+HUKUM|HUKUM|TEKNIK\s+INFORMATIKA|INFORMATIKA|SISTEM\s+INFORMASI|ILMU\s+KOMPUTER|KOMPUTER|TEKNIK\s+SIPIL|SIPIL|TEKNIK\s+INDUSTRI|INDUSTRI|TEKNIK\s+KIMIA|KIMIA|TEKNIK\s+PERMINYAKAN|PERMINYAKAN|TEKNIK\s+PERTAMBANGAN|PERTAMBANGAN|TEKNIK\s+GEOLOGI|GEOLOGI|TEKNIK\s+ELEKTRO|TEKNIK\s+MESIN|AKUNTANSI|MANAJEMEN|EKONOMI\s+PEMBANGUNAN|PEMBANGUNAN|EKONOMI|KEDOKTERAN|KEPERAWATAN|KEBIDANAN|FARMASI|PSIKOLOGI|HUBUNGAN\s+INTERNASIONAL|ILMU\s+KOMUNIKASI|HUBUNGAN\s+MASYARAKAT|MASYARAKAT|KESEHATAN\s+MASYARAKAT|AGRIBISNIS|PERENCANAAN\s+WILAYAH\s+DAN\s+KOTA|ILMU\s+POLITIK|POLITIK|ILMU\s+GEOGRAFI|GEOGRAFI|PRAKTIK\s+PERPOLISIAN\s+TATA\s+PAMONG)\b/i;
      const commonMatch = nama.match(commonMajorsRegex);
      if (commonMatch && commonMatch.index !== undefined && commonMatch.index > 0) {
        extractedEducationText = nama.substring(commonMatch.index).trim();
        nama = nama.substring(0, commonMatch.index).trim();
      }
    }
  }

  // Clean trailing date/month patterns that might have leaked into nama (e.g. "MEI LINA ESTRIANA SUCI 10 Mei" or "MESTIKA NAFIS HUSNA 29 November")
  const monthNamesList = 'Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|Jun|Jul|Agt|Sep|Okt|Nov|Des';
  const trailingDateRegex = new RegExp(`\\s+(?:\\d{1,2}\\s+)?(?:${monthNamesList})(?:\\s+(?:19|20)\\d{2})?$`, 'i');
  nama = nama.replace(trailingDateRegex, '').trim();

  // Clean trailing digits, punctuation or leftover whitespace from nama
  nama = nama.replace(/[\s\d\-,\/]+$/, '').replace(/\s+/g, ' ').trim();

  // 5. Merge extractedEducationText into pendidikan
  if (extractedEducationText) {
    if (pendidikan === '-' || !pendidikan) {
      pendidikan = extractedEducationText;
    } else {
      // If pendidikan is just a degree marker or prefix like "S-1", "S-1 ILMU", "D-IV", etc.
      if (/^(?:S-[123]|S[123]|D-IV|D-III|D-II|D-I|DIV|DIII|DII|DI|D-[1234]|\w+\s+ILMU|\w+\s+TEKNIK|\w+\s+ADMINISTRASI)$/i.test(pendidikan)) {
        if (extractedEducationText.toUpperCase().startsWith(pendidikan.toUpperCase())) {
          pendidikan = extractedEducationText;
        } else {
          pendidikan = `${pendidikan} ${extractedEducationText}`;
        }
      } else if (!pendidikan.toUpperCase().includes(extractedEducationText.toUpperCase())) {
        pendidikan = `${pendidikan} ${extractedEducationText}`;
      }
    }
  }

  // 6. Complete incomplete pendidikan using headerOptions
  if (headerOptions.length > 0) {
    const normPen = pendidikan.toUpperCase().replace(/\s+/g, ' ').trim();

    // Case A: Exact match with one of headerOptions when stripped of degree
    for (const opt of headerOptions) {
      const normOpt = opt.toUpperCase().replace(/\s+/g, ' ').trim();

      // If pendidikan is a prefix of headerOption (e.g. "S-1 ILMU" -> "S-1 ILMU PEMERINTAHAN")
      if (normOpt.startsWith(normPen) && normOpt.length > normPen.length) {
        // If headerOptions has only 1 matching option for this prefix, complete it
        const prefixMatches = headerOptions.filter((o) => o.toUpperCase().startsWith(normPen));
        if (prefixMatches.length === 1) {
          pendidikan = prefixMatches[0];
          break;
        }
      }
    }

    // Case B: If pendidikan is still just a bare degree marker (e.g. "S-1", "D-IV") and headerOptions has exactly 1 option
    if (/^(?:S-[123]|S[123]|D-IV|D-III|D-II|D-I|DIV|DIII|DII|DI|D-[1234])$/i.test(pendidikan) && headerOptions.length === 1) {
      pendidikan = headerOptions[0];
    }
  }

  return {
    nama: nama || 'PESERTA SSCASN',
    pendidikan: pendidikan || '-',
  };
}

/**
 * Sanitize an entire list of participants
 */
export function sanitizePesertaList(
  pesertaList: SSCASNPeserta[],
  headerPendidikan?: string
): SSCASNPeserta[] {
  return pesertaList.map((p) => {
    const { nama, pendidikan } = sanitizePesertaNamaAndPendidikan(p.nama, p.pendidikan, headerPendidikan);
    return {
      ...p,
      nama,
      pendidikan,
    };
  });
}
