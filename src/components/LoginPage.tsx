import React, { useState } from 'react';
import {
  Compass,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  User,
  CheckCircle2,
} from 'lucide-react';
import { AuthUser } from '../types';
import { loginUser, ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD } from '../utils/authStorage';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = loginUser(email, password);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || 'Gagal masuk. Periksa email dan password Anda.');
      }
    }, 250);
  };

  const handleQuickFill = (targetEmail: string, targetPass: string) => {
    setEmail(targetEmail);
    setPassword(targetPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* App Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white shadow-xl shadow-indigo-600/25 ring-2 ring-white/10 mb-2">
            <Compass className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Formasi Insight</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              v2.7
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Portal Analisis & Manajemen Formasi CPNS SSCASN BKN Indonesia
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Masuk ke Akun Anda</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gunakan kredensial terdaftar untuk mengakses sistem
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="faizcapturex@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-500 hover:text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Memverifikasi...</span>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1 text-indigo-300">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Pilihan Akun Cepat:</span>
              </span>
              <span className="text-[10px] text-slate-500">Klik untuk isi otomatis</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Admin Quick Fill */}
              <button
                type="button"
                id="btn-quick-admin"
                onClick={() => handleQuickFill(ADMIN_EMAIL, ADMIN_DEFAULT_PASSWORD)}
                className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 hover:border-purple-500/60 text-left group transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                    Admin
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="mt-1.5 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-purple-300 truncate">
                    Faiz CaptureX
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {ADMIN_EMAIL}
                  </div>
                </div>
              </button>

              {/* User Biasa Quick Fill */}
              <button
                type="button"
                id="btn-quick-user"
                onClick={() => handleQuickFill('budi.santoso@sscasn.go.id', 'user123')}
                className="p-2.5 rounded-xl bg-slate-950 border border-blue-500/30 hover:border-blue-500/60 text-left group transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                    User Biasa
                  </span>
                  <User className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="mt-1.5 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-blue-300 truncate">
                    Budi Santoso, S.Kom
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    budi.santoso@sscasn.go.id
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer Note */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sistem Otorisasi Formasi SSCASN v2.7 BKN</span>
        </div>
      </div>
    </div>
  );
};
