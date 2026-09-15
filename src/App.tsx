import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X, Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import { SidebarNavigation } from './components/SidebarNavigation';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { FormasiTableDetailed } from './components/FormasiTableDetailed';
import { InstansiManager } from './components/InstansiManager';
import { UserManagement } from './components/UserManagement';
import { LoginPage } from './components/LoginPage';
import { PesertaDetailModal } from './components/PesertaDetailModal';
import { InstansiFormModal } from './components/InstansiFormModal';
import { FileUploadModal } from './components/FileUploadModal';
import { JsonViewerModal } from './components/JsonViewerModal';
import { FormasiWizardModal } from './components/FormasiWizardModal';

import { InstansiItem, SSCASNFormasiBlock, SSCASNParsedResult, AuthUser } from './types';
import {
  loadInstansiListAsync,
  updateInstansiParsedDataAsync,
  addInstansiManualAsync,
  updateInstansiMetadataAsync,
  deleteInstansiAsync,
  onCloudSyncEvent,
} from './utils/instansiStorage';
import { getCurrentSession, logoutUser, INITIAL_AUTH_USERS } from './utils/authStorage';
import { SAMPLE_SSCASN_DATA } from './utils/sampleData';

export default function App() {
  // Auth state - default to current session or main admin for instant preview, with full logout capability
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const session = getCurrentSession();
    return session || INITIAL_AUTH_USERS[0];
  });

  const [instansiList, setInstansiList] = useState<InstansiItem[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'formasi' | 'instansi' | 'users'>('dashboard');
  const [selectedInstansiId, setSelectedInstansiId] = useState<string>('ALL');
  const [selectedJenjang, setSelectedJenjang] = useState<string>('ALL');
  const [selectedJurusan, setSelectedJurusan] = useState<string>('');
  const [globalNotification, setGlobalNotification] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);

  // Listen to auth changes
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      const newUser = e.detail || null;
      setCurrentUser(newUser);
      if (newUser && newUser.role !== 'admin' && (activeTab === 'instansi' || activeTab === 'users')) {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('sscasn_auth_change', handleAuthChange);
    return () => window.removeEventListener('sscasn_auth_change', handleAuthChange);
  }, [activeTab]);

  // Protect admin tabs if role changes
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && (activeTab === 'instansi' || activeTab === 'users')) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  const handleTabChange = (newTab: 'dashboard' | 'formasi' | 'instansi' | 'users') => {
    if (currentUser?.role !== 'admin' && (newTab === 'instansi' || newTab === 'users')) {
      setActiveTab('dashboard');
      return;
    }
    setActiveTab(newTab);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  // Modal States
  const [pesertaModalFormasi, setPesertaModalFormasi] = useState<{
    block: SSCASNFormasiBlock;
    instansiNama: string;
    instansiId?: string;
  } | null>(null);

  const [uploadModalTargetId, setUploadModalTargetId] = useState<string | null>(null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingInstansi, setEditingInstansi] = useState<InstansiItem | null>(null);
  const [jsonModalData, setJsonModalData] = useState<SSCASNParsedResult | null>(null);

  // 3-Step Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardTargetInstansi, setWizardTargetInstansi] = useState<InstansiItem | null>(null);

  // Load initial list asynchronously from IndexedDB on mount
  useEffect(() => {
    async function initStorage() {
      const list = await loadInstansiListAsync();
      setInstansiList(list);

      // Default select Pemkab Jember if available
      const jember = list.find((i) => i.id === 'instansi-pemkab-jember');
      if (jember) {
        setSelectedInstansiId(jember.id);
      } else if (list.length > 0) {
        setSelectedInstansiId(list[0].id);
      }
    }
    initStorage();

    // Listen for cloud sync errors
    const cleanupSync = onCloudSyncEvent((event) => {
      if (event.status === 'error') {
        setGlobalNotification({
          type: 'error',
          message: event.message,
        });
      }
    });

    return () => {
      cleanupSync();
    };
  }, []);

  const selectedInstansi = instansiList.find((i) => i.id === selectedInstansiId) || instansiList[0] || null;

  // Handlers for storage operations
  const handleSaveParsedData = async (data: SSCASNParsedResult) => {
    if (!uploadModalTargetId) return;

    const updated = await updateInstansiParsedDataAsync(uploadModalTargetId, data, data.meta.fileName);
    setInstansiList(updated);
    setSelectedInstansiId(uploadModalTargetId);
    setActiveTab('dashboard');
    setUploadModalTargetId(null);
  };

  // Handler for 3-Step Wizard Completion
  const handleWizardComplete = async (data: {
    nama: string;
    kode: string;
    kategori: any;
    provinsi?: string;
    tahun: string;
    notes?: string;
    parsedData?: SSCASNParsedResult;
    pdfFileName?: string;
  }) => {
    try {
      if (wizardTargetInstansi) {
        const hasParsedData = !!data.parsedData && (data.parsedData.formasiList?.length ?? 0) > 0;
        const updated = await updateInstansiMetadataAsync(wizardTargetInstansi.id, {
          nama: data.nama,
          kode: data.kode,
          kategori: data.kategori,
          provinsi: data.provinsi,
          tahun: data.tahun,
          notes: data.notes,
          ...(hasParsedData && data.parsedData
            ? {
                status: 'terdaftar' as const,
                parsedData: data.parsedData,
                pdfFileName: data.pdfFileName || `${data.nama.replace(/\s+/g, '_')}_2024.pdf`,
              }
            : {}),
        });

        setInstansiList(updated);
        setSelectedInstansiId(wizardTargetInstansi.id);
      } else {
        // Add new instansi with 3-step parsed result
        const hasParsedData = !!data.parsedData && (data.parsedData.formasiList?.length ?? 0) > 0;
        const updated = await addInstansiManualAsync({
          nama: data.nama,
          kode: data.kode,
          kategori: data.kategori,
          provinsi: data.provinsi,
          tahun: data.tahun,
          notes: data.notes,
          status: hasParsedData ? 'terdaftar' : 'perlu_upload',
          parsedData: data.parsedData,
          pdfFileName: data.pdfFileName || (hasParsedData ? `${data.nama.replace(/\s+/g, '_')}_2024.pdf` : undefined),
        });

        setInstansiList(updated);
        const newest = updated[0];
        if (newest) {
          setSelectedInstansiId(newest.id);
        }
      }

      setIsWizardOpen(false);
      setWizardTargetInstansi(null);
    } catch (err: any) {
      const errMsg = err?.message || 'Gagal menyimpan instansi ke Cloud / Supabase.';
      setGlobalNotification({
        type: 'error',
        message: errMsg,
      });
      // Re-throw so wizard modal can keep modal open and display its own banner
      throw new Error(errMsg);
    }
  };

  const handleAddInstansiSubmit = async (data: {
    nama: string;
    kode: string;
    kategori: any;
    provinsi?: string;
    tahun: string;
    notes?: string;
  }) => {
    try {
      if (editingInstansi) {
        const updated = await updateInstansiMetadataAsync(editingInstansi.id, data);
        setInstansiList(updated);
      } else {
        const updated = await addInstansiManualAsync({
          ...data,
          status: 'perlu_upload',
        });
        setInstansiList(updated);
      }
      setIsAddEditModalOpen(false);
      setEditingInstansi(null);
    } catch (err: any) {
      setGlobalNotification({
        type: 'error',
        message: err?.message || 'Gagal menyimpan data instansi ke server / Supabase.',
      });
    }
  };

  const handleDeleteInstansi = async (id: string) => {
    try {
      const updated = await deleteInstansiAsync(id);
      setInstansiList(updated);
      if (selectedInstansiId === id && updated.length > 0) {
        setSelectedInstansiId(updated[0].id);
      }
    } catch (err: any) {
      setGlobalNotification({
        type: 'error',
        message: err?.message || 'Gagal menghapus instansi dari database.',
      });
    }
  };

  const handleManualCloudSync = async () => {
    try {
      const refreshed = await loadInstansiListAsync(true);
      setInstansiList(refreshed);
    } catch (err: any) {
      setGlobalNotification({
        type: 'error',
        message: err?.message || 'Gagal memuat ulang data dari database server.',
      });
    }
  };

  // Handler for Peserta List updates from detail modal
  const handleUpdatePesertaFromModal = async (updatedBlock: SSCASNFormasiBlock) => {
    const targetInstansiId = pesertaModalFormasi?.instansiId || selectedInstansi?.id;
    const targetInstansi = instansiList.find((i) => i.id === targetInstansiId) || selectedInstansi;
    if (!targetInstansi || !targetInstansi.parsedData) return;

    const currentParsed = targetInstansi.parsedData;
    const currentBlocks = currentParsed.formasiList || [];

    const newBlocks = currentBlocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b));
    const allPeserta = newBlocks.flatMap((b) => b.pesertaList);

    const updatedParsed: SSCASNParsedResult = {
      ...currentParsed,
      formasiList: newBlocks,
      pesertaList: allPeserta,
    };

    const updatedList = await updateInstansiParsedDataAsync(
      targetInstansi.id,
      updatedParsed,
      targetInstansi.pdfFileName
    );
    setInstansiList(updatedList);
    setPesertaModalFormasi({
      block: updatedBlock,
      instansiNama: pesertaModalFormasi?.instansiNama || targetInstansi.nama,
      instansiId: targetInstansi.id,
    });
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-indigo-500 selection:text-white">
      {/* SIDEBAR NAVIGATION */}
      <SidebarNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedJurusan={selectedJurusan}
        instansiList={instansiList}
        currentUser={currentUser}
        onLogout={handleLogout}
        onManualSync={handleManualCloudSync}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* TAB 1: DASHBOARD ANALYTICS */}
          {activeTab === 'dashboard' && (
            <DashboardAnalytics
              instansi={selectedInstansi}
              instansiList={instansiList}
              selectedJenjang={selectedJenjang}
              onSelectJenjang={setSelectedJenjang}
              selectedJurusan={selectedJurusan}
              onSelectJurusan={setSelectedJurusan}
              onSelectInstansi={(inst) => setSelectedInstansiId(inst.id)}
              onGoToUpload={(instansiId) => {
                if (currentUser.role === 'admin') {
                  setUploadModalTargetId(instansiId);
                } else {
                  alert('Akses Dibatasi: Upload PDF & Kelola Formasi hanya dapat dilakukan oleh Administrator.');
                }
              }}
              onGoToFormasiTab={() => setActiveTab('formasi')}
              onViewPeserta={(block, instansiNama) => {
                setPesertaModalFormasi({ block, instansiNama, instansiId: selectedInstansi?.id });
              }}
            />
          )}

          {/* TAB 2: FORMASI INSTANSI & FILTER JURUSAN */}
          {activeTab === 'formasi' && (
            <FormasiTableDetailed
              instansiList={instansiList}
              selectedInstansiId={selectedInstansiId}
              onSelectInstansiId={setSelectedInstansiId}
              selectedJenjang={selectedJenjang}
              onSelectJenjang={setSelectedJenjang}
              selectedJurusan={selectedJurusan}
              onSelectJurusan={setSelectedJurusan}
              onViewPeserta={(block, instansiNama, instansiId) => {
                setPesertaModalFormasi({
                  block,
                  instansiNama,
                  instansiId: instansiId || (selectedInstansiId !== 'ALL' ? selectedInstansiId : undefined),
                });
              }}
            />
          )}

          {/* TAB 3: INSTANSI TERDAFTAR MANAGEMENT (ADMIN ONLY) */}
          {activeTab === 'instansi' && (
            currentUser.role === 'admin' ? (
              <InstansiManager
                instansiList={instansiList}
                onSelectForDashboard={(inst) => {
                  setSelectedInstansiId(inst.id);
                  setActiveTab('dashboard');
                }}
                onSelectForFormasi={(inst) => {
                  setSelectedInstansiId(inst.id);
                  setActiveTab('formasi');
                }}
                onOpenUploadModal={(id) => {
                  const target = instansiList.find((i) => i.id === id) || null;
                  setWizardTargetInstansi(target);
                  setIsWizardOpen(true);
                }}
                onOpenAddModal={() => {
                  setWizardTargetInstansi(null);
                  setIsWizardOpen(true);
                }}
                onOpenEditModal={(inst) => {
                  setWizardTargetInstansi(inst);
                  setIsWizardOpen(true);
                }}
                onOpenJsonModal={(parsedData) => setJsonModalData(parsedData)}
                onDeleteInstansi={handleDeleteInstansi}
                onListUpdated={(newList) => setInstansiList(newList)}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Akses Dibatasi: Database Instansi</h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Menu Database Instansi dan Parsing PDF hanya dapat dikelola oleh akun dengan hak akses <strong className="text-amber-300">Administrator</strong>.
                </p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke Dashboard
                </button>
              </div>
            )
          )}

          {/* TAB 4: USER MANAGEMENT SECTION (ADMIN ONLY) */}
          {activeTab === 'users' && (
            currentUser.role === 'admin' ? (
              <UserManagement
                currentUser={currentUser}
                onSwitchUser={(user) => setCurrentUser(user)}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Akses Dibatasi: User Management</h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Pengelolaan akun pengguna login dan hak akses sistem hanya diperuntukkan bagi <strong className="text-amber-300">Administrator Utama</strong>.
                </p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke Dashboard
                </button>
              </div>
            )
          )}
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-900/80 py-6 text-center text-xs text-slate-500 px-4">
          <p>
            Formasi Insight &bull; Strategi cerdas memilih formasi CPNS &bull; SSCASN BKN Indonesia &bull; Supabase Cloud PostgreSQL
          </p>
        </footer>
      </div>

      {/* MODAL 1: PESERTA DETAIL MODAL */}
      <PesertaDetailModal
        key={`${pesertaModalFormasi?.instansiId || ''}-${pesertaModalFormasi?.block?.id || ''}`}
        formasi={pesertaModalFormasi?.block || null}
        instansiNama={pesertaModalFormasi?.instansiNama || ''}
        instansiId={pesertaModalFormasi?.instansiId}
        onClose={() => setPesertaModalFormasi(null)}
        onUpdatePesertaList={handleUpdatePesertaFromModal}
      />

      {/* MODAL 2: 3-STEP FORMASI / INSTANSI WIZARD MODAL (1: Detail, 2: Upload & Split PDF, 3: Preview) */}
      <FormasiWizardModal
        isOpen={isWizardOpen}
        initialItem={wizardTargetInstansi}
        existingInstansiList={instansiList}
        onClose={() => {
          setIsWizardOpen(false);
          setWizardTargetInstansi(null);
        }}
        onComplete={handleWizardComplete}
      />

      {/* MODAL 3: FALLBACK FILE UPLOAD MODAL */}
      <FileUploadModal
        isOpen={uploadModalTargetId !== null}
        targetInstansi={instansiList.find((i) => i.id === uploadModalTargetId) || null}
        onClose={() => setUploadModalTargetId(null)}
        onParsed={handleSaveParsedData}
        onLoadSample={() => {
          if (uploadModalTargetId) {
            handleSaveParsedData(SAMPLE_SSCASN_DATA);
          }
        }}
      />

      {/* MODAL 4: JSON VIEWER MODAL */}
      <JsonViewerModal
        isOpen={jsonModalData !== null}
        data={jsonModalData}
        onClose={() => setJsonModalData(null)}
      />

      {/* GLOBAL FLOATING TOAST NOTIFICATION (HIGHEST Z-INDEX OVER ALL MODALS) */}
      {globalNotification && (
        <div className="fixed top-5 right-5 z-[999999] max-w-lg w-full animate-in slide-in-from-top-4 duration-200">
          <div
            className={`p-4 sm:p-5 rounded-2xl shadow-2xl border-2 flex items-start gap-3.5 backdrop-blur-2xl ${
              globalNotification.type === 'error'
                ? 'bg-rose-950/98 border-rose-500/80 text-rose-100 shadow-rose-950/80'
                : 'bg-emerald-950/98 border-emerald-500/80 text-emerald-100 shadow-emerald-950/80'
            }`}
          >
            {globalNotification.type === 'error' ? (
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-sm text-white">
                  {globalNotification.type === 'error' ? 'Pemberitahuan Error Server / Supabase' : 'Sukses'}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${
                    globalNotification.type === 'error'
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {globalNotification.type === 'error' ? 'Database Sync Error' : 'Database Synced'}
                </span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed break-words bg-black/50 p-2.5 rounded-xl border border-white/10 text-rose-200 select-text">
                {globalNotification.message}
              </p>
            </div>
            <button
              onClick={() => setGlobalNotification(null)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
              title="Tutup Notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
