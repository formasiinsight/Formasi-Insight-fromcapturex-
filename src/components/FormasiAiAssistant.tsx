import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Compass,
  Award,
  MapPin,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface FormasiItemSummary {
  jabatan: string;
  lokasi: string;
  jenisFormasi?: string;
  pendidikan?: string;
  kuota: number;
  pelamarSkb?: number;
  totalPesertaSkb?: number;
  rasio?: string;
  minSkd?: number | null;
  maxSkd?: number | null;
  minSkb?: number | null;
  maxSkb?: number | null;
  cutoffNilaiAkhir?: number | null;
}

interface FormasiAiAssistantProps {
  instansiName: string;
  selectedJurusan: string;
  selectedJenjang: string;
  formasiList: FormasiItemSummary[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  contextInfo?: {
    instansi: string;
    jurusan: string;
    totalFormasi: number;
  };
}

export const FormasiAiAssistant: React.FC<FormasiAiAssistantProps> = ({
  instansiName,
  selectedJurusan,
  selectedJenjang,
  formasiList,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{
    remaining: number;
    limit: number;
    used: number;
    percentUsed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch quota status on mount and when query finishes
  const fetchQuotaStatus = async () => {
    try {
      const res = await fetch('/api/ai/quota-status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQuotaInfo({
            remaining: data.remaining,
            limit: data.limit,
            used: data.used,
            percentUsed: data.percentUsed,
          });
        }
      }
    } catch {
      // Non-blocking quota fetch error
    }
  };

  useEffect(() => {
    fetchQuotaStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputValue).trim();
    if (!textToSend || isLoading) return;

    if (formasiList.length === 0) {
      setErrorMessage('Tabel saat ini kosong atau belum ada formasi yang sesuai filter. Terapkan filter instansi/jurusan terlebih dahulu agar AI memiliki data untuk dianalisis.');
      return;
    }

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const response = await fetch('/api/ai/analyze-formasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question: textToSend,
          instansiName: instansiName || 'Semua Instansi',
          jurusan: selectedJurusan || 'Semua Jurusan',
          jenjang: selectedJenjang || 'Semua Jenjang',
          formasiList: formasiList.slice(0, 20),
        }),
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok || !data.success) {
        const errText = data.error || 'Terjadi kesalahan saat memproses pertanyaan ke AI.';
        setErrorMessage(errText);
        const errorAiMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ **Pemberitahuan Analisis:**\n\n${errText}`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorAiMsg]);
      } else {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.answer,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          contextInfo: {
            instansi: instansiName || 'Semua Instansi',
            jurusan: selectedJurusan || 'Semua Jurusan',
            totalFormasi: Math.min(formasiList.length, 20),
          },
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (data.quota) {
          setQuotaInfo({
            remaining: data.quota.remaining,
            limit: data.quota.limit,
            used: data.quota.used,
            percentUsed: Math.round((data.quota.used / data.quota.limit) * 100),
          });
        }
      }
    } catch (err: any) {
      let networkError = 'Gagal tersambung ke server analisis AI.';
      if (err?.name === 'AbortError') {
        networkError = 'Waktu permintaan melebihi batas (20 detik). Silakan klik kirim ulang pertanyaan Anda.';
      } else if (err?.message) {
        networkError = err.message;
      }
      setErrorMessage(networkError);
      const errorAiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ **Gagal Terhubung:**\n\n${networkError}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorAiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    {
      icon: Award,
      label: 'Peluang Masuk Tertinggi',
      prompt: 'Berdasarkan data yang tampil, urutkan formasi dengan peluang masuk paling besar (rasio persaingan terendah dan kuota memadai)?',
    },
    {
      icon: MapPin,
      label: 'Rekomendasi Dekat Rumah',
      prompt: 'Saya ingin mencari formasi yang lokasinya paling strategis dan dekat pemukiman/kota. Bagaimana pemetaan unit kerja formasi di atas?',
    },
    {
      icon: Compass,
      label: 'Rekomendasi 3 Terbaik',
      prompt: 'Berikan 3 rekomendasi formasi terbaik untuk kualifikasi saya beserta alasan strategisnya (pertimbangkan kuota dan jumlah pelamar)!',
    },
    {
      icon: HelpCircle,
      label: 'Analisis Persaingan',
      prompt: 'Bagaimana peta persaingan dari seluruh formasi yang sedang saya lihat ini? Formasi mana yang paling ketat dan mana yang paling longgar?',
    },
  ];

  // Helper function to render simple markdown cleanly
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1" />;
          }

          // Header 3 / Bold heading
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-base font-bold text-indigo-300 mt-3 mb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-lg font-bold text-white mt-4 mb-2 border-b border-slate-700/60 pb-1">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }

          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-indigo-400 mt-1 select-none text-xs">●</span>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(content) }} />
              </div>
            );
          }

          // Numbered list
          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s(.*)/);
            if (match) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                  <span className="text-indigo-400 font-semibold select-none text-xs min-w-[20px]">{match[1]}</span>
                  <span dangerouslySetInnerHTML={{ __html: parseBoldText(match[2]) }} />
                </div>
              );
            }
          }

          // Standard paragraph
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: parseBoldText(trimmed) }} />
          );
        })}
      </div>
    );
  };

  // Safe bold parser
  const parseBoldText = (text: string) => {
    // Escape HTML first to prevent XSS
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Replace **text** with <strong>
    return escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden mt-6 transition-all">
      {/* HEADER: TITLE, CONTEXT BADGE & 50% QUOTA INDICATOR */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Tanya Asisten AI Formasi
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Gemini 3.6 Flash
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Membaca & menganalisis langsung data tabel formasi yang sedang Anda filter di atas.
            </p>
          </div>
        </div>

        {/* RIGHT METRICS: ACTIVE CONTEXT & 50% QUOTA GUARANTEE */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Active Context Chip */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-[200px]" title={instansiName}>
              {instansiName || 'Semua Instansi'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-indigo-300 font-medium">
              {formasiList.length} Formasi Aktif
            </span>
          </div>

          {/* 50% Quota Allocation Safeguard Badge */}
          {quotaInfo && (
            <div
              className="px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-200 flex items-center gap-1.5"
              title={`Alokasi 50% Kuota Admin untuk Publik: Terpakai ${quotaInfo.used} dari ${quotaInfo.limit} per hari.`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Kuota Hari Ini: <strong className="text-white font-mono">{quotaInfo.remaining}</strong> / {quotaInfo.limit}
              </span>
            </div>
          )}

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isCollapsed ? 'Buka Panel AI' : 'Tutup Panel AI'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* EXPANDED CONTENT BODY */}
      {!isCollapsed && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* CONTEXT GROUNDING GUARANTEE BANNER */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong className="text-white font-medium">Context Grounding Aktif:</strong> AI dikunci hanya membaca{' '}
                <span className="text-indigo-300 font-semibold">{formasiList.length} baris formasi</span> yang sedang tampil
                di tabel di atas. AI tidak akan berhalusinasi atau mengambil formasi dari instansi lain.
              </span>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Chat
              </button>
            )}
          </div>

          {/* QUICK PROMPTS CHIPS */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Pilih Pertanyaan Cepat:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {quickPrompts.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isLoading || formasiList.length === 0}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 text-left text-xs font-medium text-slate-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                  >
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="line-clamp-1 group-hover:text-white">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CHAT MESSAGES STREAM */}
          {messages.length > 0 && (
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar pt-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-3xl rounded-2xl p-4 sm:p-5 shadow-lg relative group ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none ml-8'
                        : 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-bl-none mr-8'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-700/40 text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {msg.sender === 'user' ? (
                          <span>Anda (Calon Pelamar)</span>
                        ) : (
                          <span className="text-indigo-400 flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5" />
                            Asisten Analisis Formasi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                        <span>{msg.timestamp}</span>
                        {msg.sender === 'ai' && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Salin Jawaban"
                          >
                            {copiedId === msg.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Body content */}
                    {msg.sender === 'user' ? (
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                    ) : (
                      renderFormattedText(msg.text)
                    )}

                    {/* Footnote context */}
                    {msg.contextInfo && (
                      <div className="mt-3 pt-2 border-t border-slate-700/40 text-[10px] text-slate-400 flex items-center gap-2">
                        <span>
                          Dianalisis dari: <strong>{msg.contextInfo.instansi}</strong> ({msg.contextInfo.totalFormasi} formasi)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl rounded-bl-none p-4 max-w-md">
                    <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold mb-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Membaca data formasi dan merumuskan analisis strategis...
                    </div>
                    <div className="space-y-1.5 animate-pulse">
                      <div className="h-2.5 bg-slate-700 rounded-full w-4/5" />
                      <div className="h-2.5 bg-slate-700 rounded-full w-full" />
                      <div className="h-2.5 bg-slate-700 rounded-full w-3/5" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* ERROR NOTIFICATION */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-semibold block text-red-200">Perhatian:</span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* INPUT BAR */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading || formasiList.length === 0}
                placeholder={
                  formasiList.length === 0
                    ? 'Tabel kosong - pilih instansi/jurusan dulu...'
                    : 'Ketik pertanyaan bebas (misal: "Rumah saya di kec. Tanggul, mana yang terdekat dan peluangnya bagus?")...'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-10"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || formasiList.length === 0}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 flex-shrink-0"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>

          {/* FOOTER GUARANTEE NOTICE */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2 pt-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Alokasi 50% kuota admin aktif. Data Anda diproses aman tanpa menyentuh akun luar.
            </span>
            <span>Didukung Gemini 3.8 Flash • Akurasi Berbasis Data SSCASN BKN</span>
          </div>
        </div>
      )}
    </div>
  );
};
