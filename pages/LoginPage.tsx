import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, LogIn, Eye, EyeOff, AlertCircle, Shield, BarChart3, Clock, Users } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Email wajib diisi');
            return;
        }
        if (!password) {
            setError('Password wajib diisi');
            return;
        }

        setLoading(true);
        const result = await signIn(email.trim(), password);
        if (result.error) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-white">
            {/* ─── Left Panel: Information ─── */}
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900">
                {/* Background Pattern (SVG dots grid) */}
                <div className="absolute inset-0 opacity-[0.07]">
                    <svg width="100%" height="100%">
                        <defs>
                            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                                <circle cx="2" cy="2" r="1.5" fill="white" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#dots)" />
                    </svg>
                </div>

                {/* Decorative geometric shapes */}
                <div className="absolute -top-20 -right-20 w-80 h-80 border border-white/10 rounded-full" />
                <div className="absolute -top-10 -right-10 w-60 h-60 border border-white/10 rounded-full" />
                <div className="absolute bottom-20 -left-16 w-56 h-56 border border-white/10 rounded-full" />
                <div className="absolute top-1/2 right-10 w-32 h-32 border border-white/[0.06] rounded-2xl rotate-45" />
                <div className="absolute bottom-40 right-32 w-20 h-20 border border-white/[0.06] rounded-xl rotate-12" />

                {/* Gradient overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-blue-900/80 to-transparent" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
                    {/* Top — Logo */}
                    <div className="flex items-center gap-3">
                        <img src="/logo_putih.png" alt="Pertamina Foundation" className="h-10 xl:h-12 w-auto object-contain" />
                    </div>

                    {/* Center — Hero */}
                    <div className="flex-1 flex flex-col justify-center max-w-lg">
                        <div className="mb-2">
                            <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-sm text-blue-100 text-xs font-medium rounded-full border border-white/10">
                                Sistem Monitoring Proyek
                            </span>
                        </div>
                        <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
                            Project Monitoring
                            <br />
                            <span className="text-blue-200">Fungsi Lingkungan</span>
                        </h1>
                        <p className="text-blue-100/80 text-base leading-relaxed mb-8">
                            Platform pemantauan progress proyek, manajemen data kegiatan, dan pelaporan mingguan Pertamina Foundation.
                        </p>

                        {/* Feature Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: <BarChart3 size={18} />, title: 'S-Curve Analytics', desc: 'Pantau progress baseline vs realisasi' },
                                { icon: <Clock size={18} />, title: 'Weekly Report', desc: 'Generate laporan mingguan otomatis' },
                                { icon: <Users size={18} />, title: 'Team Collaboration', desc: 'Kelola data bersama tim proyek' },
                                { icon: <Shield size={18} />, title: 'Secure Access', desc: 'Autentikasi & kontrol akses aman' },
                            ].map((feature) => (
                                <div
                                    key={feature.title}
                                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] hover:bg-white/[0.1] transition-colors"
                                >
                                    <div className="mt-0.5 p-1.5 rounded-lg bg-blue-500/30 text-blue-200 flex-shrink-0">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-semibold leading-tight">{feature.title}</p>
                                        <p className="text-blue-200/60 text-xs mt-0.5 leading-snug">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom — Footer */}
                    <div className="flex items-center justify-between text-blue-200/40 text-xs">
                        <span>© {new Date().getFullYear()} Pertamina Foundation</span>
                        <span>v2.0 — ProTrack</span>
                    </div>
                </div>
            </div>

            {/* ─── Right Panel: Login Form ─── */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
                {/* Subtle background pattern for right panel */}
                <div className="absolute inset-0 opacity-[0.03]">
                    <svg width="100%" height="100%">
                        <defs>
                            <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e40af" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>

                <div className="relative w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <div className="flex items-center gap-3">
                            <img src="/pf-logo.png" alt="Pertamina Foundation" className="h-10 w-auto object-contain" />
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            Selamat Datang
                        </h2>
                        <p className="text-slate-500 mt-2 text-sm">
                            Masuk ke akun Anda untuk mengakses dashboard monitoring proyek
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Alert */}
                        {error && (
                            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="nama@pertaminafoundation.org"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm"
                                disabled={loading}
                                autoComplete="email"
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm"
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-700/25 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600 active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>Memproses...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    <span>Masuk</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium">INFO</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex gap-3">
                            <div className="mt-0.5 flex-shrink-0">
                                <Shield size={18} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-900">Akun Dikelola Administrator</p>
                                <p className="text-xs text-blue-600/70 mt-1 leading-relaxed">
                                    Akun dibuat oleh administrator sistem. Jika Anda belum memiliki akun atau lupa password, hubungi admin proyek Anda.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Footer */}
                    <p className="lg:hidden text-center text-slate-400 text-xs mt-8">
                        © {new Date().getFullYear()} Pertamina Foundation — ProTrack v2.0
                    </p>
                </div>
            </div>
        </div>
    );
};
