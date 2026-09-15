import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TableProperties,
  Building2,
  Users,
  Sparkles,
  Cloud,
  RefreshCw,
  WifiOff,
  Menu,
  X,
  Compass,
  ChevronRight,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Lock,
} from 'lucide-react';
import { InstansiItem, AuthUser } from '../types';
import { getStoredUsers, ADMIN_EMAIL } from '../utils/authStorage';

interface SidebarNavigationProps {
  activeTab: 'dashboard' | 'formasi' | 'instansi' | 'users';
  onTabChange: (tab: 'dashboard' | 'formasi' | 'instansi' | 'users') => void;
  selectedJurusan?: string;
  instansiList: InstansiItem[];
  currentUser: AuthUser;
  onLogout: () => void;
  onManualSync?: () => void;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  activeTab,
  onTabChange,
  selectedJurusan,
  instansiList,
  currentUser,
  onLogout,
  onManualSync,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [usersCount, setUsersCount] = useState<number>(() => getStoredUsers().length);
  const [syncState, setSyncState] = useState<{
    status: 'synced' | 'syncing' | 'offline' | 'error';
    message: string;
    lastTime: string;
  }>({
    status: 'synced',
    message: 'Cloud Synced',
    lastTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  useEffect(() => {
    const handleSyncEvent = (e: any) => {
      if (e.detail) {
        setSyncState({
          status: e.detail.status || 'synced',
          message: e.detail.message || (e.detail.status === 'synced' ? 'Cloud Synced' : 'Syncing...'),
          lastTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    };

    const handleStorageChange = () => {
      setUsersCount(getStoredUsers().length);
    };

    window.addEventListener('sscasn_cloud_sync', handleSyncEvent);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('sscasn_cloud_sync', handleSyncEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const totalInstansi = instansiList.length;
  const withData = instansiList.filter(
    (i) => i.parsedData && (i.parsedData.formasiList?.length ?? 0) > 0
  ).length;

  const isAdmin = currentUser.role === 'admin';

  const generalNavItems = [
    {
      id: 'dashboard' as const,
      label: 'Analisis Instansi',
      sublabel: 'Peluang & Perbandingan',
      icon: LayoutDashboard,
      badgeText: selectedJurusan && selectedJurusan !== 'ALL' ? selectedJurusan : undefined,
      adminOnly: false,
    },
    {
      id: 'formasi' as const,
      label: 'Katalog Formasi',
      sublabel: 'Tabel Detail & Keketatan',
      icon: TableProperties,
      badgeText: `${withData} Instansi`,
      adminOnly: false,
    },
  ];

  const adminNavItems = [
    {
      id: 'instansi' as const,
      label: 'Database Instansi',
      sublabel: 'Kelola & Parsing PDF',
      icon: Building2,
      badgeText: `${totalInstansi}`,
      adminOnly: true,
    },
    {
      id: 'users' as const,
      label: 'User Management',
      sublabel: 'Daftar Pengguna Login',
      icon: Users,
      badgeText: `${usersCount} Akun`,
      adminOnly: true,
    },
  ];

  const handleSelectTab = (tab: 'dashboard' | 'formasi' | 'instansi' | 'users', adminOnly?: boolean) => {
    if (adminOnly && !isAdmin) {
      alert('Akses Dibatasi: Menu ini hanya dapat diakses oleh Administrator (faizcapturex@gmail.com).');
      return;
    }
    onTabChange(tab);
    setIsMobileOpen(false);
  };

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight leading-tight">Formasi Insight</h1>
            <p className="text-[10px] text-slate-400 font-medium">Strategi cerdas memilih formasi CPNS</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Logout button on mobile */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-rose-400 hover:text-rose-300"
            title="Keluar / Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            aria-label="Toggle Navigation"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE OVERLAY BACKDROP */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* DESKTOP & MOBILE SIDEBAR DRAWER */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* TOP SECTION: BRANDING & APP IDENTITY */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0 ring-1 ring-white/20">
                <Compass className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-black text-white tracking-tight">Formasi Insight</h1>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    v2.7
                  </span>
                </div>
                <p className="text-[11px] text-indigo-300/80 font-medium leading-snug">
                  Strategi cerdas memilih formasi CPNS
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Tagline Box */}
          <div className="mt-4 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[11px] text-slate-300 leading-tight">
              Peluang lolos, keketatan rasio, & cut-off SSCASN BKN.
            </p>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {/* SECTION 1: MENU UTAMA */}
          <div className="space-y-1.5">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Menu Utama
            </div>

            {generalNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => handleSelectTab(item.id, false)}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl flex items-center justify-between group transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'bg-slate-950/80 text-slate-400 group-hover:text-indigo-300 border border-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">{item.label}</div>
                      <div
                        className={`text-[10px] truncate leading-tight ${
                          isActive ? 'text-indigo-200' : 'text-slate-500 group-hover:text-slate-400'
                        }`}
                      >
                        {item.sublabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badgeText && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-white/20 text-white border-white/20'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800'
                        }`}
                      >
                        {item.badgeText}
                      </span>
                    )}
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isActive ? 'text-white translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* SECTION 2: ADMINISTRASI & DATABASE (HANYA DITAMPILKAN & DIAKSES OLEH ADMIN) */}
          {isAdmin && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60 animate-in fade-in">
              <div className="px-3 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/90 flex items-center gap-1">
                  <span>Manajemen Admin</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Admin Khusus
                </span>
              </div>

              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    onClick={() => handleSelectTab(item.id, true)}
                    className={`w-full text-left px-3.5 py-3 rounded-2xl flex items-center justify-between group transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-xl shrink-0 transition-colors ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'bg-slate-950/80 text-purple-400 group-hover:text-purple-300 border border-purple-500/20'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate leading-tight flex items-center gap-1.5">
                          <span>{item.label}</span>
                        </div>
                        <div
                          className={`text-[10px] truncate leading-tight ${
                            isActive ? 'text-purple-200' : 'text-slate-500 group-hover:text-slate-400'
                          }`}
                        >
                          {item.sublabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badgeText && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-white/20 text-white border-white/20'
                              : 'bg-slate-950/80 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          {item.badgeText}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isActive ? 'text-white translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: USER PROFILE PILL, DATABASE SYNC & LOGOUT */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
          {/* Active User Card & Logout Trigger */}
          <div
            id="sidebar-active-user-card"
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2.5 group"
          >
            <div
              className={`flex items-center gap-2.5 min-w-0 flex-1 ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => {
                if (isAdmin) {
                  handleSelectTab('users', true);
                }
              }}
              title={isAdmin ? 'Buka User Management' : 'Profil Pengguna Aktif'}
            >
              <div className="relative shrink-0">
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${
                    currentUser.avatarColor || (isAdmin ? 'from-indigo-500 via-purple-500 to-pink-500' : 'from-blue-500 to-cyan-500')
                  } flex items-center justify-center text-white font-black text-xs shadow-sm`}
                >
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold text-white truncate leading-tight ${isAdmin ? 'group-hover:text-indigo-300' : ''}`}>
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-3 h-3 text-purple-400 inline shrink-0" />
                      <span className="text-purple-300 font-bold">Administrator</span>
                    </>
                  ) : (
                    <>
                      <UserIcon className="w-3 h-3 text-blue-400 inline shrink-0" />
                      <span className="text-blue-300 font-medium">User Biasa</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Logout Action Button */}
            <button
              id="btn-logout-sidebar"
              onClick={onLogout}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/40 transition-all cursor-pointer shrink-0"
              title="Keluar dari akun (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Supabase Status Pill */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {syncState.status === 'synced' ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-bold text-emerald-300">Supabase Connected</span>
                  </>
                ) : syncState.status === 'syncing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span className="text-[11px] font-bold text-indigo-300">Sinkronisasi DB...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-300">Offline Cache</span>
                  </>
                )}
              </div>

              {onManualSync && (
                <button
                  onClick={onManualSync}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Sinkronkan data ke Cloud Supabase"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`}
                  />
                </button>
              )}
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Status Data:</span>
              <span className="font-mono text-slate-300">
                {withData}/{totalInstansi} Terisi
              </span>
            </div>
          </div>

          {/* Quick Copyright */}
          <div className="text-[10px] text-slate-500 text-center font-medium leading-relaxed">
            Formasi Insight &bull; v2.7
          </div>
        </div>
      </aside>
    </>
  );
};
