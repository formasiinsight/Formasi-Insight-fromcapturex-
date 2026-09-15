import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  User,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  Lock,
  Mail,
  Building2,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  KeyRound,
  LogIn,
} from 'lucide-react';
import { AuthUser } from '../types';
import {
  getStoredUsers,
  saveStoredUsers,
  addUser,
  updateUser,
  deleteUser,
  ADMIN_EMAIL,
  INITIAL_AUTH_USERS,
  setCurrentSession,
} from '../utils/authStorage';

interface UserManagementProps {
  currentUser: AuthUser;
  onSwitchUser?: (user: AuthUser) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  onSwitchUser,
}) => {
  const [users, setUsers] = useState<AuthUser[]>(() => getStoredUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'user'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
    instansi: string;
    status: 'active' | 'inactive';
  }>({
    name: '',
    email: '',
    password: '',
    role: 'user',
    instansi: '',
    status: 'active',
  });

  // UI state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isConfirmDeleteId, setIsConfirmDeleteId] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleOpenAddModal = () => {
    setEditingUserId(null);
    setFormData({
      name: '',
      email: '',
      password: 'user123',
      role: 'user',
      instansi: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AuthUser) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      password: user.password || 'user123',
      role: user.role,
      instansi: user.instansi || '',
      status: user.status,
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      showNotification('error', 'Semua field wajib diisi.');
      return;
    }

    if (editingUserId) {
      const res = updateUser(editingUserId, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        role: formData.role,
        instansi: formData.instansi.trim() || undefined,
        status: formData.status,
      });

      if (res.success && res.user) {
        setUsers(getStoredUsers());
        showNotification('success', `Data pengguna "${res.user.name}" berhasil diperbarui.`);
        setIsModalOpen(false);
      } else {
        showNotification('error', res.error || 'Gagal memperbarui pengguna.');
      }
    } else {
      const res = addUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        role: formData.role,
        instansi: formData.instansi.trim() || 'Unit SSCASN',
        status: formData.status,
      });

      if (res.success && res.user) {
        setUsers(getStoredUsers());
        showNotification('success', `Pengguna baru "${res.user.name}" berhasil ditambahkan.`);
        setIsModalOpen(false);
      } else {
        showNotification('error', res.error || 'Gagal menambahkan pengguna.');
      }
    }
  };

  const handleDeleteUser = (id: string) => {
    const res = deleteUser(id);
    if (res.success) {
      setUsers(getStoredUsers());
      showNotification('success', 'Pengguna berhasil dihapus.');
      setIsConfirmDeleteId(null);
    } else {
      showNotification('error', res.error || 'Gagal menghapus pengguna.');
    }
  };

  const handleToggleStatus = (user: AuthUser) => {
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      showNotification('error', 'Akun Administrator Utama tidak boleh dinonaktifkan.');
      return;
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const res = updateUser(user.id, { status: newStatus });
    if (res.success) {
      setUsers(getStoredUsers());
      showNotification('success', `Status pengguna "${user.name}" diubah menjadi ${newStatus === 'active' ? 'Aktif' : 'Nonaktif'}.`);
    }
  };

  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyPassword = (id: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetDefaults = () => {
    if (confirm('Kembalikan daftar akun ke daftar default sistem?')) {
      saveStoredUsers(INITIAL_AUTH_USERS);
      setUsers(INITIAL_AUTH_USERS);
      showNotification('success', 'Daftar pengguna telah direset ke data default.');
    }
  };

  const handleSwitchSession = (user: AuthUser) => {
    if (user.status !== 'active') {
      showNotification('error', 'Akun nonaktif tidak dapat digunakan untuk login.');
      return;
    }
    setCurrentSession(user);
    if (onSwitchUser) {
      onSwitchUser(user);
    }
    showNotification('success', `Beralih ke akun ${user.name} (${user.role === 'admin' ? 'Admin' : 'User Biasa'})`);
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.instansi && u.instansi.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalAdmin = users.filter((u) => u.role === 'admin').length;
  const totalUserBiasa = users.filter((u) => u.role === 'user').length;
  const totalActive = users.filter((u) => u.status === 'active').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">User Management</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.7
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Daftar akun terdaftar yang memiliki otorisasi login ke aplikasi Formasi Insight
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Reset ke akun default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Default</span>
          </button>

          <button
            id="btn-add-user-main"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Pengguna</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{users.length}</div>
          <p className="text-[11px] text-slate-500">Akun terdaftar di database</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-purple-500/20 space-y-1">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold">
            <span>Administrator</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-200">{totalAdmin}</div>
          <p className="text-[11px] text-purple-400/80 font-mono truncate">{ADMIN_EMAIL}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-blue-500/20 space-y-1">
          <div className="flex items-center justify-between text-blue-300 text-xs font-semibold">
            <span>User Biasa</span>
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-200">{totalUserBiasa}</div>
          <p className="text-[11px] text-slate-500">Akses pengguna umum</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
            <span>Akun Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-200">{totalActive}</div>
          <p className="text-[11px] text-slate-500">Dapat melakukan login</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, email, atau instansi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 flex-1 md:flex-initial"
            >
              <option value="ALL">Semua Peran (Role)</option>
              <option value="admin">Administrator</option>
              <option value="user">User Biasa</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 flex-1 md:flex-initial"
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {/* USERS LIST TABLE */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3.5 sm:p-4">Pengguna</th>
                <th className="p-3.5 sm:p-4">Role / Peran</th>
                <th className="p-3.5 sm:p-4">Instansi / Unit Kerja</th>
                <th className="p-3.5 sm:p-4">Kredensial Login</th>
                <th className="p-3.5 sm:p-4">Status</th>
                <th className="p-3.5 sm:p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-300">Tidak ada data pengguna ditemukan</p>
                    <p className="text-[11px] text-slate-500">Ubah kata kunci pencarian atau filter di atas.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isMainAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                  const isCurrent = currentUser.id === user.id || currentUser.email.toLowerCase() === user.email.toLowerCase();
                  const initials = user.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const isPasswordRevealed = !!revealedPasswords[user.id];

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isCurrent ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* User Info */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${
                              user.avatarColor || 'from-indigo-500 to-purple-600'
                            } flex items-center justify-center text-white font-black text-xs shadow-md shrink-0`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="font-mono text-slate-300">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-3.5 sm:p-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            <User className="w-3.5 h-3.5 text-blue-400" />
                            <span>User Biasa</span>
                          </span>
                        )}
                      </td>

                      {/* Instansi */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-xs">{user.instansi || '-'}</span>
                        </div>
                      </td>

                      {/* Credentials (Password Display) */}
                      <td className="p-3.5 sm:p-4">
                        <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl font-mono text-xs text-slate-300">
                          <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold">
                            {isPasswordRevealed ? user.password || '●●●●●●●●' : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(user.id)}
                            className="p-1 hover:text-white text-slate-500 transition-colors ml-1"
                            title={isPasswordRevealed ? 'Sembunyikan password' : 'Lihat password'}
                          >
                            {isPasswordRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyPassword(user.id, user.password || '')}
                            className="p-1 hover:text-white text-slate-500 transition-colors"
                            title="Salin password"
                          >
                            {copiedId === user.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 sm:p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={isMainAdmin}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            user.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                          } ${isMainAdmin ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                          title={isMainAdmin ? 'Status Admin Utama selalu aktif' : 'Klik untuk ubah status'}
                        >
                          {user.status === 'active' ? '● Aktif' : '○ Nonaktif'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Login As / Switch button */}
                          <button
                            onClick={() => handleSwitchSession(user)}
                            className="p-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                            title={`Login sebagai ${user.name}`}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Edit Data Pengguna"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button (except main admin) */}
                          {!isMainAdmin ? (
                            <button
                              onClick={() => {
                                if (confirm(`Hapus pengguna "${user.name}"?`)) {
                                  handleDeleteUser(user.id);
                                }
                              }}
                              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Hapus Pengguna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="p-1.5 text-slate-600" title="Akun utama tidak dapat dihapus">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info in section */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Akun Admin: <strong>{ADMIN_EMAIL}</strong> &bull; Password: <strong>@Dmin1357</strong></span>
          </div>
          <span>Total {users.length} akun terdaftar di Formasi Insight</span>
        </div>
      </div>

      {/* ADD / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl shadow-black/80 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingUserId ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingUserId ? 'Perbarui informasi dan hak akses pengguna' : 'Buat akun baru yang dapat melakukan login'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budi Santoso, S.Kom"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Alamat Email (Digunakan untuk Login)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. budi@sscasn.go.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300">
                    Password Akun
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: 'user' + Math.floor(1000 + Math.random() * 9000) })}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Generate Acak
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Masukkan password..."
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Role */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Peran (Role)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="user">User Biasa (Akses Standar)</option>
                    <option value="admin">Administrator (Akses Penuh)</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Status Akun
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Aktif (Bisa Login)</option>
                    <option value="inactive">Nonaktif (Suspended)</option>
                  </select>
                </div>
              </div>

              {/* Instansi */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Instansi / Unit Kerja
                </label>
                <input
                  type="text"
                  placeholder="e.g. BKPSDM Pemkab Jember / BKN Pusat"
                  value={formData.instansi}
                  onChange={(e) => setFormData({ ...formData, instansi: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  {editingUserId ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
