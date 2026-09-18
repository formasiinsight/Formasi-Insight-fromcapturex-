import React, { useState, useEffect } from 'react';
import { X, Building2, Save } from 'lucide-react';
import { InstansiItem, InstansiKategori } from '../types';

interface InstansiFormModalProps {
  isOpen: boolean;
  initialItem?: InstansiItem | null;
  existingInstansiList?: InstansiItem[];
  onClose: () => void;
  onSave: (data: {
    nama: string;
    kode: string;
    kategori: InstansiKategori;
    provinsi?: string;
    tahun: string;
    notes?: string;
  }) => void;
}

export const InstansiFormModal: React.FC<InstansiFormModalProps> = ({
  isOpen,
  initialItem,
  existingInstansiList = [],
  onClose,
  onSave,
}) => {
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [kategori, setKategori] = useState<InstansiKategori>('kementerian');
  const [provinsi, setProvinsi] = useState('');
  const [tahun, setTahun] = useState('2024');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setErrorMessage('');
    if (initialItem) {
      setNama(initialItem.nama || '');
      setKode(initialItem.kode || '');
      setKategori(initialItem.kategori || 'kementerian');
      setProvinsi(initialItem.provinsi || '');
      setTahun(initialItem.tahun || '2024');
      setNotes(initialItem.notes || '');
    } else {
      setNama('');
      setKode('');
      setKategori('kementerian');
      setProvinsi('');
      setTahun('2024');
      setNotes('');
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNama = nama.trim();
    const trimmedKode = kode.trim();

    if (!trimmedNama || !trimmedKode) {
      setErrorMessage('Nama instansi dan Kode instansi wajib diisi.');
      return;
    }

    if (trimmedNama.toLowerCase() === trimmedKode.toLowerCase()) {
      setErrorMessage('Nama instansi dan Kode instansi tidak boleh sama. Masukkan nama instansi yang valid dan kode BKN.');
      return;
    }

    const cleanNama = trimmedNama.toLowerCase();
    const cleanKode = trimmedKode.toLowerCase();

    if (existingInstansiList && existingInstansiList.length > 0) {
      const duplicateNama = existingInstansiList.find(
        (item) => item.id !== initialItem?.id && (item.nama || '').trim().toLowerCase() === cleanNama
      );
      if (duplicateNama) {
        setErrorMessage(`Nama instansi "${trimmedNama}" sudah terdaftar di sistem. Nama instansi tidak boleh sama.`);
        return;
      }

      const duplicateKode = existingInstansiList.find(
        (item) => item.id !== initialItem?.id && (item.kode || '').trim().toLowerCase() === cleanKode
      );
      if (duplicateKode) {
        setErrorMessage(`Kode instansi "${trimmedKode}" sudah digunakan oleh "${duplicateKode.nama}". Kode instansi tidak boleh sama.`);
        return;
      }
    }

    setErrorMessage('');
    onSave({
      nama: trimmedNama,
      kode: trimmedKode,
      kategori,
      provinsi: provinsi.trim() || undefined,
      tahun: tahun.trim() || '2024',
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {initialItem ? 'Edit Data Instansi' : 'Tambah Instansi Baru'}
              </h3>
              <p className="text-xs text-slate-400">
                Lengkapi metadata instansi CPNS/CASN di Indonesia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
              {errorMessage}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              Nama Instansi Lengkap <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Kementerian Kesehatan RI / Pemkab Malang"
              className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Kode Instansi SSCASN <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Misal: 4003 / 6512"
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Kategori Instansi <span className="text-red-400">*</span>
              </label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as InstansiKategori)}
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="kementerian">Kementerian</option>
                <option value="lembaga">Lembaga / LPNK</option>
                <option value="pemprov">Pemerintah Provinsi (Pemprov)</option>
                <option value="pemkab_pemkot">Pemerintah Kabupaten/Kota</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Provinsi (Opsional)</label>
              <input
                type="text"
                value={provinsi}
                onChange={(e) => setProvinsi(e.target.value)}
                placeholder="Misal: Jawa Timur / DKI Jakarta"
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Tahun Anggaran</label>
              <input
                type="text"
                value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                placeholder="2024"
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Catatan / Deskripsi</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan mengenai instansi ini..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Instansi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
