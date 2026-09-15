import { useRef, useEffect, useState } from 'react';
import { LayoutDashboard, TableProperties, Building2, ShieldCheck, Cloud, RefreshCw, CloudCheck, WifiOff } from 'lucide-react';
import { InstansiItem } from '../types';

interface HeaderNavigationProps {
  activeTab: 'dashboard' | 'formasi' | 'instansi' | 'users';
  onTabChange: (tab: 'dashboard' | 'formasi' | 'instansi' | 'users') => void;
  selectedJurusan?: string;
  instansiList: InstansiItem[];
  onManualSync?: () => void;
}

export const HeaderNavigation = ({
  activeTab,
  onTabChange,
  selectedJurusan,
  instansiList,
  onManualSync,
}: HeaderNavigationProps) => {
  const headerRef = useRef<HTMLElement>(null);
  const [syncState, setSyncState] = useState<{
    status: 'synced' | 'syncing' | 'offline' | 'error';
    message: string;
    lastTime: string;
  }>({
    status: 'synced',
    message: 'Cloud Synced',
    lastTime: new Date().toLocaleTimeString(),
  });

  useEffect(() => {
    const handleSyncEvent = (e: any) => {
      if (e.detail) {
        setSyncState({
          status: e.detail.status || 'synced',
          message: e.detail.message || (e.detail.status === 'synced' ? 'Cloud Synced' : 'Syncing...'),
          lastTime: new Date().toLocaleTimeString(),
        });
      }
    };

    window.addEventListener('sscasn_cloud_sync', handleSyncEvent);
    return () => window.removeEventListener('sscasn_cloud_sync', handleSyncEvent);
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeight);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <header ref={headerRef} className="bg-slate-900 border-b border-slate-800 text-white shadow-lg transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 rounded-xl shadow-md shadow-indigo-500/20 text-white shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Portal Formasi CPNS & Analytics
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                  SSCASN
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Supabase DB
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-tight">
                Analisis Peluang, Keketatan Formasi & Supabase Cloud PostgreSQL (Formasi Insight)
              </p>
            </div>
          </div>

          {/* Cloud Database Status Pill & Quick Action */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                syncState.status === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : syncState.status === 'syncing'
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
              title={`Status: ${syncState.message} (${syncState.lastTime}) - Supabase Proyek: Formasi Insight`}
            >
              {syncState.status === 'synced' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] hidden sm:inline font-medium">Supabase Connected</span>
                  <span className="text-[11px] sm:hidden font-medium">Supabase</span>
                </>
              ) : syncState.status === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span className="text-[11px] font-medium">Sinkronisasi Supabase...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-medium">Offline Cache</span>
                </>
              )}
            </div>

            {onManualSync && (
              <button
                onClick={onManualSync}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs transition-all cursor-pointer flex items-center gap-1"
                title="Sinkronisasi Ulang ke Supabase Cloud"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                <span className="text-[10px] hidden md:inline">Sync Supabase</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Main Tabs Navigation Bar */}
        <div className="flex items-center justify-between mt-2.5 border-t border-slate-800/80 pt-2 gap-2 overflow-x-auto">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-300" />
              <span>Instansi</span>
            </button>

            <button
              onClick={() => onTabChange('formasi')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'formasi'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5 text-purple-300" />
              <span>Formasi</span>
            </button>

            <button
              onClick={() => onTabChange('instansi')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'instansi'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Katalog Instansi</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};


