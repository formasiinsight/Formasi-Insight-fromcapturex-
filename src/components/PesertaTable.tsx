import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, Edit3, UserCheck, UserX, Award, CheckCircle, HelpCircle } from 'lucide-react';
import { SSCASNPeserta } from '../types';

interface PesertaTableProps {
  pesertaList: SSCASNPeserta[];
  onUpdatePesertaList: (newList: SSCASNPeserta[]) => void;
}

export const PesertaTable: React.FC<PesertaTableProps> = ({ pesertaList: rawPesertaList = [], onUpdatePesertaList }) => {
  const pesertaList = Array.isArray(rawPesertaList) ? rawPesertaList : [];
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof SSCASNPeserta>('no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [editingPeserta, setEditingPeserta] = useState<SSCASNPeserta | null>(null);

  // Statistics
  const stats = useMemo(() => {
    const total = pesertaList.length;
    const passed = pesertaList.filter((p) => p?.keterangan && p.keterangan.startsWith('P/L')).length;
    const failed = total - passed;
    const maxScore = total > 0 ? Math.max(...pesertaList.map((p) => p.nilaiAkhir || 0)) : 0;
    const avgSkd = total > 0 ? Number((pesertaList.reduce((acc, p) => acc + (p.totalSkd || 0), 0) / total).toFixed(1)) : 0;

    return { total, passed, failed, maxScore, avgSkd };
  }, [pesertaList]);

  // Filtered and Sorted list
  const filteredList = useMemo(() => {
    return pesertaList
      .filter((p) => {
        if (!p) return false;
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          (p.nama || '').toLowerCase().includes(query) ||
          (p.noPeserta || '').toLowerCase().includes(query) ||
          (p.pendidikan || '').toLowerCase().includes(query);

        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'PL' && p.keterangan && p.keterangan.startsWith('P/L')) ||
          (statusFilter === 'TL' && p.keterangan === 'TL');

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        return sortOrder === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [pesertaList, searchQuery, statusFilter, sortField, sortOrder]);

  const toggleSort = (field: keyof SSCASNPeserta) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to descending for scores
    }
  };

  const handleSaveEdit = () => {
    if (!editingPeserta) return;
    const updated = pesertaList.map((p) => (p.noPeserta === editingPeserta.noPeserta ? editingPeserta : p));
    onUpdatePesertaList(updated);
    setEditingPeserta(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            2. Daftar Peserta & Integrasi Nilai SKD/SKB ({pesertaList.length} Peserta)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            15 Kolom Lengkap SSCASN BKN (No Peserta, SKD TWK/TIU/TKP, SKB 60%, Skor 40%, Nilai Akhir, Status Keterangan)
          </p>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
            Total: {stats.total}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            Lulus (P/L): {stats.passed}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-semibold flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            TL: {stats.failed}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-semibold flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            Top Nilai: {stats.maxScore}
          </span>
        </div>
      </div>

      {/* Toolbar: Search and Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari Nama / No Peserta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">Semua Keterangan</option>
            <option value="PL">Hanya Lulus (P/L)</option>
            <option value="TL">Tidak Lulus (TL)</option>
          </select>
        </div>
      </div>

      {/* Responsive Data Table */}
      <div className="overflow-auto max-h-[calc(80vh-180px)] min-h-[350px] rounded-xl border border-slate-200 dark:border-slate-800 relative">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
            <tr>
              <th className="py-3 px-3 text-center w-10">No</th>
              <th className="py-3 px-3">No Peserta</th>
              <th className="py-3 px-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-900" onClick={() => toggleSort('nama')}>
                <div className="flex items-center gap-1">
                  Nama {sortField === 'nama' && <ArrowUpDown className="w-3 h-3 text-indigo-500" />}
                </div>
              </th>
              <th className="py-3 px-3">Tgl Lahir</th>
              <th className="py-3 px-3">Pendidikan</th>
              <th className="py-3 px-3 text-center">IPK</th>
              <th className="py-3 px-2 text-center bg-blue-50/50 dark:bg-blue-950/30">TWK</th>
              <th className="py-3 px-2 text-center bg-blue-50/50 dark:bg-blue-950/30">TIU</th>
              <th className="py-3 px-2 text-center bg-blue-50/50 dark:bg-blue-950/30">TKP</th>
              <th className="py-3 px-2 text-center bg-blue-100/50 dark:bg-blue-900/30 font-bold cursor-pointer" onClick={() => toggleSort('totalSkd')}>
                Total SKD
              </th>
              <th className="py-3 px-2 text-center bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                Skor 40%
              </th>
              <th className="py-3 px-2 text-center bg-purple-50/50 dark:bg-purple-950/30">SKB</th>
              <th className="py-3 px-2 text-center bg-purple-100/80 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                Skor 60%
              </th>
              <th className="py-3 px-3 text-center bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold cursor-pointer" onClick={() => toggleSort('nilaiAkhir')}>
                <div className="flex items-center justify-center gap-1">
                  Nilai Akhir {sortField === 'nilaiAkhir' && <ArrowUpDown className="w-3 h-3 text-indigo-500" />}
                </div>
              </th>
              <th className="py-3 px-3 text-center">Ket</th>
              <th className="py-3 px-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-sans">
            {pesertaList.length === 0 ? (
              <tr>
                <td colSpan={16} className="py-12 text-center bg-slate-900/40">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                    <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <UserX className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-200">Formasi Tidak Memiliki Pendaftar (0 Pendaftar)</h4>
                    <p className="text-xs text-slate-400">
                      Header formasi ini berhasil diekstrak dari dokumen PDF SSCASN, namun tidak ada peserta yang mendaftar pada jabatan ini.
                    </p>
                    <span className="mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Status: Formasi Kosong (0 Pendaftar)
                    </span>
                  </div>
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={16} className="py-8 text-center text-slate-400">
                  Tidak ada peserta yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              filteredList.map((p, idx) => {
                const isPassed = p.keterangan.startsWith('P/L');
                return (
                  <tr
                    key={p.noPeserta + idx}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      isPassed ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-500">{p.no}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {p.noPeserta}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[160px] truncate" title={p.nama}>
                      {p.nama}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{p.tanggalLahir}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.pendidikan}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{p.ipk}</td>
                    <td className="py-2.5 px-2 text-center bg-blue-50/30 dark:bg-blue-950/10">{p.twk}</td>
                    <td className="py-2.5 px-2 text-center bg-blue-50/30 dark:bg-blue-950/10">{p.tiu}</td>
                    <td className="py-2.5 px-2 text-center bg-blue-50/30 dark:bg-blue-950/10">{p.tkp}</td>
                    <td className="py-2.5 px-2 text-center font-bold bg-blue-50/60 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                      {p.totalSkd}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-medium text-blue-600 dark:text-blue-400">
                      {p.skorSkd}
                    </td>
                    <td className="py-2.5 px-2 text-center bg-purple-50/30 dark:bg-purple-950/10">{p.skb}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-medium text-purple-600 dark:text-purple-400">
                      {p.skorSkb}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-sm bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300">
                      {p.nilaiAkhir}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPassed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {p.keterangan}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() => setEditingPeserta({ ...p })}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit nilai peserta"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingPeserta && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-white">
            <h3 className="text-lg font-bold border-b border-slate-800 pb-3 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" /> Edit Data Peserta
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama</label>
                <input
                  type="text"
                  value={editingPeserta.nama}
                  onChange={(e) => setEditingPeserta({ ...editingPeserta, nama: e.target.value })}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">No Peserta</label>
                <input
                  type="text"
                  value={editingPeserta.noPeserta}
                  onChange={(e) => setEditingPeserta({ ...editingPeserta, noPeserta: e.target.value })}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">TWK</label>
                <input
                  type="number"
                  value={editingPeserta.twk}
                  onChange={(e) =>
                    setEditingPeserta({ ...editingPeserta, twk: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">TIU</label>
                <input
                  type="number"
                  value={editingPeserta.tiu}
                  onChange={(e) =>
                    setEditingPeserta({ ...editingPeserta, tiu: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">TKP</label>
                <input
                  type="number"
                  value={editingPeserta.tkp}
                  onChange={(e) =>
                    setEditingPeserta({ ...editingPeserta, tkp: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">SKB</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingPeserta.skb}
                  onChange={(e) =>
                    setEditingPeserta({ ...editingPeserta, skb: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={editingPeserta.keterangan}
                  onChange={(e) => setEditingPeserta({ ...editingPeserta, keterangan: e.target.value })}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingPeserta(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
