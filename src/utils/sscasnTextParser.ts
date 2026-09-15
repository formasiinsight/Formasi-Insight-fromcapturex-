import { SSCASNParsedResult, SSCASNHeader, SSCASNPeserta } from '../types';
import { calculateVerification } from './sampleData';
import { normalizeJenisFormasiHeader, sanitizeMetadataHeader } from './jenisFormasiUtils';
import { sanitizePesertaList, sanitizePesertaNamaAndPendidikan } from './pesertaSanitizer';

export function parseSSCASNFromText(rawText: string, fileName?: string): SSCASNParsedResult {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const header: SSCASNHeader = {
    instansi: '',
    jabatanFormasi: '',
    lokasiFormasi: '',
    jenisFormasi: '',
    pendidikan: '',
    jumlahKuota: 0,
  };

  // Header field extractors
  lines.forEach((line) => {
    if (/instansi\s*:/i.test(line)) {
      const match = line.match(/instansi\s*:\s*(.+)$/i);
      if (match) header.instansi = match[1].trim();
    } else if (/jabatan\s+formasi\s*:/i.test(line)) {
      const match = line.match(/jabatan\s+formasi\s*:\s*(.+)$/i);
      if (match) header.jabatanFormasi = match[1].trim();
    } else if (/lokasi\s+formasi\s*:/i.test(line)) {
      const match = line.match(/lokasi\s+formasi\s*:\s*(.+)$/i);
      if (match) header.lokasiFormasi = match[1].trim();
    } else if (/jenis\s+formasi\s*:/i.test(line)) {
      const match = line.match(/jenis\s+formasi\s*:\s*(.+)$/i);
      if (match) header.jenisFormasi = match[1].trim();
    } else if (/pendidikan\s*:/i.test(line)) {
      const match = line.match(/pendidikan\s*:\s*(.+)$/i);
      if (match) header.pendidikan = match[1].trim();
    }
  });

  const cleanHeaderNoise = (str: string) => {
    if (!str) return '';
    return str
      .replace(/\s+(?:Nilai|Skor)\s+SKD.*$/gi, '')
      .replace(/\s+(?:Nilai|Skor)\s+SKB.*$/gi, '')
      .replace(/\s+Nilai\s+Akhir.*$/gi, '')
      .replace(/\s+Keterangan.*$/gi, '')
      .replace(/\s+No\s+Peserta.*$/gi, '')
      .replace(/\s+IPK.*$/gi, '')
      .replace(/\s+Tanggal\s+Lahir.*$/gi, '')
      .replace(/\s+Kode\s+Jumlah.*$/gi, '')
      .replace(/\bSKB\b/gi, '')
      .replace(/\s+(?!(?:19|20)\d{2}\b)\d+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  header.instansi = cleanHeaderNoise(header.instansi);
  header.jabatanFormasi = cleanHeaderNoise(header.jabatanFormasi);
  header.lokasiFormasi = cleanHeaderNoise(header.lokasiFormasi);
  header.jenisFormasi = cleanHeaderNoise(header.jenisFormasi);
  header.pendidikan = cleanHeaderNoise(header.pendidikan);

  const cleanHead = sanitizeMetadataHeader(header);
  Object.assign(header, cleanHead);

  // Split code and name for header fields
  if (header.instansi) {
    const parts = header.instansi.split('-');
    if (parts.length > 1) {
      header.kodeInstansi = parts[0].trim();
      header.namaInstansi = cleanHeaderNoise(parts.slice(1).join('-').trim());
      header.instansi = `${header.kodeInstansi} - ${header.namaInstansi}`;
    }
  }

  if (header.jabatanFormasi) {
    const parts = header.jabatanFormasi.split('-');
    if (parts.length > 1) {
      header.kodeJabatan = parts[0].trim();
      header.namaJabatan = cleanHeaderNoise(parts.slice(1).join('-').trim());
      header.jabatanFormasi = `${header.kodeJabatan} - ${header.namaJabatan}`;
    }
  }

  if (header.lokasiFormasi) {
    const parts = header.lokasiFormasi.split('-');
    if (parts.length > 1) {
      header.kodeLokasi = parts[0].trim();
      header.namaLokasi = cleanHeaderNoise(parts.slice(1).join('-').trim());
      header.lokasiFormasi = `${header.kodeLokasi} - ${header.namaLokasi}`;
    }
  }

  if (header.jenisFormasi) {
    const parts = header.jenisFormasi.split('-');
    if (parts.length > 1) {
      header.kodeJenisFormasi = parts[0].trim();
      header.namaJenisFormasi = cleanHeaderNoise(parts.slice(1).join('-').trim());
      header.jenisFormasi = `${header.kodeJenisFormasi} - ${header.namaJenisFormasi}`;
    }
  }

  // Parse candidate records
  // SSCASN Candidate No pattern: 18-digit number starting with 2 (e.g., 24651220120001209 or 213000...)
  const pesertaList: SSCASNPeserta[] = [];

  // Group line blocks or parse single composite lines
  // Example candidate line:
  // 1 24651220120001209 UMI FATIKHATUL JANNAH 19 Agustus 1998 S-1 HUKUM 3.76 115 145 191 451 32.8 68.0 40.8 73.6 P/L
  const participantRegex = /^(\d{1,4})\s+(2\d{14,18})\s+(.+?)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\d+\.\d+|\d+)\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+([A-Za-z0-9\/\-]+)$/;

  let autoNo = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(participantRegex);

    if (match) {
      const [, noStr, noPeserta, nama, tanggalLahir, pendidikan, ipkStr, twkStr, tiuStr, tkpStr, totalSkdStr, skorSkdStr, skbStr, skorSkbStr, nilaiAkhirStr, keterangan] = match;

      const ipkVal = parseFloat(ipkStr) || 0;
      const ipk = ipkVal >= 0 && ipkVal <= 4.0 ? ipkVal : 0;

      pesertaList.push({
        no: parseInt(noStr, 10) || autoNo++,
        noPeserta: noPeserta.trim(),
        nama: nama.trim(),
        tanggalLahir: tanggalLahir.trim(),
        pendidikan: pendidikan.trim() || '-',
        ipk,
        twk: parseInt(twkStr, 10) || 0,
        tiu: parseInt(tiuStr, 10) || 0,
        tkp: parseInt(tkpStr, 10) || 0,
        totalSkd: parseInt(totalSkdStr, 10) || 0,
        skorSkd: parseFloat(skorSkdStr) || 0,
        skb: parseFloat(skbStr) || 0,
        skorSkb: parseFloat(skorSkbStr) || 0,
        nilaiAkhir: parseFloat(nilaiAkhirStr) || 0,
        keterangan: keterangan.trim(),
      });
    } else if (/^2\d{14,18}/.test(line)) {
      // Fallback line parser if spaced across tokens
      const tokens = line.split(/\s+/);
      if (tokens.length >= 12) {
        const noPeserta = tokens[0];
        const keterangan = tokens[tokens.length - 1];
        const nilaiAkhir = parseFloat(tokens[tokens.length - 2]) || 0;
        const skorSkb = parseFloat(tokens[tokens.length - 3]) || 0;
        const skb = parseFloat(tokens[tokens.length - 4]) || 0;
        const skorSkd = parseFloat(tokens[tokens.length - 5]) || 0;
        const totalSkd = parseInt(tokens[tokens.length - 6], 10) || 0;
        const tkp = parseInt(tokens[tokens.length - 7], 10) || 0;
        const tiu = parseInt(tokens[tokens.length - 8], 10) || 0;
        const twk = parseInt(tokens[tokens.length - 9], 10) || 0;
        const ipkRaw = parseFloat(tokens[tokens.length - 10]) || 0;
        const ipk = ipkRaw >= 0 && ipkRaw <= 4.0 ? ipkRaw : 0;

        // Name and details are tokens between 1 and length-10
        const middle = tokens.slice(1, tokens.length - 10).join(' ');

        pesertaList.push({
          no: autoNo++,
          noPeserta,
          nama: middle || 'PESERTA SSCASN',
          tanggalLahir: '-',
          pendidikan: '-',
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
        });
      }
    }
  }

  const sanitizedPesertaList = sanitizePesertaList(pesertaList, header.pendidikan);

  // Determine kuota count from P/L occurrences if not set
  const totalPL = sanitizedPesertaList.filter((p) => p.keterangan.startsWith('P/L')).length;
  const finalKuota = typeof header.jumlahKuota === 'number' && header.jumlahKuota >= 0 ? header.jumlahKuota : (totalPL > 0 ? totalPL : 0);
  header.jumlahKuota = finalKuota;
  header.kuotaPendidikan = finalKuota;
  header.kuotaJenisFormasi = finalKuota;
  header.kuotaLokasi = finalKuota;
  header.kuotaJabatan = finalKuota;
  header.kuotaInstansi = finalKuota;
  header.kuotaPerTingkat = {
    pendidikanCount: finalKuota,
    jenisCount: finalKuota,
    lokasiCount: finalKuota,
    jabatanCount: finalKuota,
    instansiCount: finalKuota,
  };

  const finalHeader = normalizeJenisFormasiHeader(header);
  const verification = calculateVerification(sanitizedPesertaList);

  const formasiBlock = {
    id: 'formasi-1',
    header: finalHeader,
    pesertaList: sanitizedPesertaList,
    verification,
  };

  return {
    meta: {
      docTitle: 'PANITIA SELEKSI NASIONAL PENGADAAN CASN - HASIL INTEGRASI SKD DAN SKB',
      tahun: '2024',
      parsedAt: new Date().toISOString(),
      sourceType: 'text',
      fileName: fileName || 'SSCASN_Doc.txt',
      totalFormasiCount: 1,
      totalPesertaCount: sanitizedPesertaList.length,
    },
    formasiList: [formasiBlock],
    header,
    pesertaList: sanitizedPesertaList,
    verification,
  };
}
