import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    PenTool, Plus, Trash2, Edit3, Upload, FileText, CheckCircle2,
    XCircle, Search, Download, Eye, ChevronRight, Shield, User, Briefcase,
    Calendar, QrCode, X, AlertCircle, Loader2, GripVertical, Maximize2, Minimize2, Lock, Key
} from 'lucide-react';
import {
    fetchLingSignatures,
    createLingSignature,
    updateLingSignature,
    deleteLingSignature,
    saveSignedDocument,
    fetchSignedDocuments,
    verifySignature,
    verifySandi,
} from '../lib/supabase';
import { LingSignature, SignedDocument } from '../types';
import { generateSignatureQR, generateVerificationCode } from '../utils/generateSignatureQR';
import { applySignaturesToPDF, SignatureStamp } from '../utils/applySignatureToPDF';

// =====================================================
// TAB TYPES
// =====================================================
type TabId = 'manage' | 'sign' | 'history' | 'verify';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'manage', label: 'Kelola TTD', icon: <PenTool size={18} /> },
    { id: 'sign', label: 'Tanda Tangani', icon: <FileText size={18} /> },
    { id: 'history', label: 'Riwayat', icon: <Calendar size={18} /> },
    { id: 'verify', label: 'Verifikasi', icon: <Shield size={18} /> },
];

// =====================================================
// MAIN PAGE
// =====================================================
export const LingSignPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('manage');

    // Check URL for verify param
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const verifyCode = params.get('verify');
        if (verifyCode) {
            setActiveTab('verify');
        }
    }, []);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <PenTool size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Ling-Sign</h1>
                    <p className="text-sm text-slate-500">Tanda Tangan Digital</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center min-w-0 ${activeTab === tab.id
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'manage' && <SignatureManagerTab />}
            {activeTab === 'sign' && <SignDocumentTab />}
            {activeTab === 'history' && <HistoryTab />}
            {activeTab === 'verify' && <VerifyTab />}
        </div>
    );
};

// =====================================================
// TAB 1: SIGNATURE MANAGER
// =====================================================
const SignatureManagerTab: React.FC = () => {
    const [signatures, setSignatures] = useState<LingSignature[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState('');
    const [formSandi, setFormSandi] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
    const [deleteSandi, setDeleteSandi] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const loadSignatures = useCallback(async () => {
        setLoading(true);
        const data = await fetchLingSignatures();
        setSignatures(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSignatures();
    }, [loadSignatures]);

    // Generate preview when form changes
    useEffect(() => {
        if (!formName || !formRole) {
            setPreviewUrl(null);
            return;
        }
        const timer = setTimeout(async () => {
            const url = await generateSignatureQR({
                signerName: formName,
                signerRole: formRole,
                signDate: new Date().toISOString(),
                verificationCode: 'PREVIEW',
            });
            setPreviewUrl(url);
        }, 300);
        return () => clearTimeout(timer);
    }, [formName, formRole]);

    const handleSave = async () => {
        if (!formName.trim() || !formRole.trim() || (!editingId && !formSandi.trim())) return;
        setSaving(true);

        if (editingId) {
            await updateLingSignature(editingId, formName.trim(), formRole.trim());
        } else {
            const code = generateVerificationCode();
            await createLingSignature(formName.trim(), formRole.trim(), code, formSandi.trim());
        }

        setShowForm(false);
        setEditingId(null);
        setFormName('');
        setFormRole('');
        setFormSandi('');
        setPreviewUrl(null);
        setSaving(false);
        await loadSignatures();
    };

    const handleEdit = (sig: LingSignature) => {
        setEditingId(sig.id);
        setFormName(sig.signerName);
        setFormRole(sig.signerRole);
        setShowForm(true);
    };

    const handleDeleteRequest = (sig: LingSignature) => {
        setDeleteModal({ id: sig.id, name: sig.signerName });
        setDeleteSandi('');
        setDeleteError('');
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal) return;
        const valid = await verifySandi(deleteModal.id, deleteSandi);
        if (!valid) {
            setDeleteError('Sandi salah. Silakan coba lagi.');
            return;
        }
        await deleteLingSignature(deleteModal.id);
        setDeleteModal(null);
        setDeleteSandi('');
        setDeleteError('');
        await loadSignatures();
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormName('');
        setFormRole('');
        setPreviewUrl(null);
    };

    return (
        <div className="space-y-6">
            {/* Create/Edit Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in slide-in-from-top-2 duration-300">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                        {editingId ? 'Edit TTD' : 'Buat TTD Baru'}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <User size={14} className="inline mr-1" />
                                    Nama Penandatangan
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Contoh: Dr. Ahmad Fauzi"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Briefcase size={14} className="inline mr-1" />
                                    Jabatan
                                </label>
                                <input
                                    type="text"
                                    value={formRole}
                                    onChange={e => setFormRole(e.target.value)}
                                    placeholder="Contoh: VP Lingkungan"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm"
                                />
                            </div>
                            {!editingId && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        <Lock size={14} className="inline mr-1" />
                                        Sandi (PIN)
                                    </label>
                                    <input
                                        type="password"
                                        value={formSandi}
                                        onChange={e => setFormSandi(e.target.value)}
                                        placeholder="Masukkan PIN untuk keamanan TTD"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Digunakan saat menghapus TTD dan menandatangani dokumen</p>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formName.trim() || !formRole.trim() || (!editingId && !formSandi.trim())}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {editingId ? 'Simpan Perubahan' : 'Buat TTD'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4 min-h-[200px]">
                            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Preview TTD</p>
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview TTD" className="max-h-[280px] rounded-lg shadow-sm" />
                            ) : (
                                <div className="text-center text-slate-400 text-sm">
                                    <QrCode size={40} className="mx-auto mb-2 opacity-30" />
                                    <p>Isi nama & jabatan untuk melihat preview</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header + Add Button */}
            {!showForm && (
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Daftar TTD Digital</h3>
                        <p className="text-sm text-slate-500">{signatures.length} tanda tangan</p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={16} />
                        Buat TTD Baru
                    </button>
                </div>
            )}

            {/* Signature Cards Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-emerald-500" />
                </div>
            ) : signatures.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                    <PenTool size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-lg font-medium">Belum ada TTD digital</p>
                    <p className="text-slate-400 text-sm mt-1">Buat tanda tangan pertama Anda</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {signatures.map(sig => (
                        <SignatureCard
                            key={sig.id}
                            signature={sig}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRequest}
                        />
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal with Sandi */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <Key size={20} className="text-red-500" />
                            Konfirmasi Hapus TTD
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Masukkan sandi untuk menghapus TTD <strong>{deleteModal.name}</strong>:
                        </p>
                        <input
                            type="password"
                            value={deleteSandi}
                            onChange={e => { setDeleteSandi(e.target.value); setDeleteError(''); }}
                            placeholder="Masukkan sandi"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm mb-2"
                            onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
                            autoFocus
                        />
                        {deleteError && (
                            <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                                <AlertCircle size={12} /> {deleteError}
                            </p>
                        )}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={!deleteSandi.trim()}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                Hapus TTD
                            </button>
                            <button
                                onClick={() => setDeleteModal(null)}
                                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SignatureCard: React.FC<{
    signature: LingSignature;
    onEdit: (sig: LingSignature) => void;
    onDelete: (sig: LingSignature) => void;
}> = ({ signature, onEdit, onDelete }) => {
    const [qrPreview, setQrPreview] = useState<string | null>(null);

    useEffect(() => {
        generateSignatureQR({
            signerName: signature.signerName,
            signerRole: signature.signerRole,
            signDate: signature.createdAt || new Date().toISOString(),
            verificationCode: signature.verificationCode,
        }).then(setQrPreview);
    }, [signature]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
            <div className="p-4 flex items-start gap-4">
                {qrPreview && (
                    <img src={qrPreview} alt="QR" className="w-20 h-auto rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{signature.signerName}</h4>
                    <p className="text-sm text-slate-500 truncate">{signature.signerRole}</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{signature.verificationCode}</p>
                </div>
            </div>
            <div className="px-4 pb-3 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(signature)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                >
                    <Edit3 size={12} /> Edit
                </button>
                <button
                    onClick={() => onDelete(signature)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                >
                    <Trash2 size={12} /> Hapus
                </button>
            </div>
        </div>
    );
};

// =====================================================
// TAB 2: SIGN DOCUMENT (Drag-and-drop on PDF)
// =====================================================
const SignDocumentTab: React.FC = () => {
    const [signatures, setSignatures] = useState<LingSignature[]>([]);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfPages, setPdfPages] = useState<string[]>([]); // data URLs per page
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedSigs, setSelectedSigs] = useState<Map<string, { x: number; y: number; page: number; scale: number }>>(new Map());
    const [sigPreviews, setSigPreviews] = useState<Map<string, string>>(new Map());
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    // Sandi modal for signing
    const [showSandiModal, setShowSandiModal] = useState(false);
    const [sandiInputs, setSandiInputs] = useState<Map<string, string>>(new Map());
    const [sandiErrors, setSandiErrors] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        fetchLingSignatures().then(setSignatures);
    }, []);

    // Measure container width for responsive rendering
    useEffect(() => {
        const measure = () => {
            if (previewContainerRef.current) {
                setContainerWidth(previewContainerRef.current.clientWidth);
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [pdfFile]);

    // Generate QR previews for selected signatures
    useEffect(() => {
        const genPreviews = async () => {
            const newPreviews = new Map<string, string>();
            for (const [sigId] of selectedSigs) {
                if (sigPreviews.has(sigId)) {
                    newPreviews.set(sigId, sigPreviews.get(sigId)!);
                    continue;
                }
                const sig = signatures.find(s => s.id === sigId);
                if (!sig) continue;
                const url = await generateSignatureQR({
                    signerName: sig.signerName,
                    signerRole: sig.signerRole,
                    signDate: new Date().toISOString(),
                    verificationCode: sig.verificationCode,
                });
                newPreviews.set(sigId, url);
            }
            setSigPreviews(newPreviews);
        };
        if (selectedSigs.size > 0) genPreviews();
    }, [selectedSigs, signatures]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') return;

        setPdfFile(file);
        setSelectedSigs(new Map());
        setSigned(false);
        setLoadingPdf(true);
        setCurrentPage(1);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            setTotalPages(pdf.numPages);

            const pages: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d')!;
                await (page as any).render({ canvasContext: ctx, viewport }).promise;
                pages.push(canvas.toDataURL('image/png'));
            }
            setPdfPages(pages);
        } catch (err) {
            console.error('Error loading PDF:', err);
            alert('Gagal memuat PDF.');
        } finally {
            setLoadingPdf(false);
        }
    };

    const toggleSignature = (sig: LingSignature) => {
        const newMap = new Map(selectedSigs);
        if (newMap.has(sig.id)) {
            newMap.delete(sig.id);
        } else {
            const idx = newMap.size;
            newMap.set(sig.id, {
                x: 0.55 + (idx % 2) * 0.2,
                y: 0.75,
                page: currentPage,
                scale: 1.0,
            });
        }
        setSelectedSigs(newMap);
    };

    const handleSignRequest = () => {
        if (!pdfFile || selectedSigs.size === 0) return;
        // Initialize sandi inputs for each selected signature
        const inputs = new Map<string, string>();
        for (const [sigId] of selectedSigs) {
            inputs.set(sigId, '');
        }
        setSandiInputs(inputs);
        setSandiErrors(new Map());
        setShowSandiModal(true);
    };

    const handleSignWithSandi = async () => {
        // Verify all sandi first
        const errors = new Map<string, string>();
        for (const [sigId, sandi] of sandiInputs) {
            const valid = await verifySandi(sigId, sandi);
            if (!valid) {
                const sig = signatures.find(s => s.id === sigId);
                errors.set(sigId, `Sandi salah untuk ${sig?.signerName || 'TTD'}`);
            }
        }
        if (errors.size > 0) {
            setSandiErrors(errors);
            return;
        }
        setShowSandiModal(false);
        await performSign();
    };

    const performSign = async () => {
        if (!pdfFile || selectedSigs.size === 0) return;
        setSigning(true);

        try {
            const pdfBytes = await pdfFile.arrayBuffer();
            const stamps: SignatureStamp[] = [];
            const saveRecords: {
                signatureId: string;
                signerName: string;
                signerRole: string;
                verificationCode: string;
                positionX: number;
                positionY: number;
                pageNumber: number;
            }[] = [];

            for (const [sigId, pos] of selectedSigs) {
                const sig = signatures.find(s => s.id === sigId);
                if (!sig) continue;

                stamps.push({
                    signerName: sig.signerName,
                    signerRole: sig.signerRole,
                    verificationCode: sig.verificationCode,
                    positionX: pos.x,
                    positionY: pos.y,
                    pageNumber: pos.page,
                    signDate: new Date().toISOString(),
                    scale: pos.scale,
                });

                saveRecords.push({
                    signatureId: sig.id,
                    signerName: sig.signerName,
                    signerRole: sig.signerRole,
                    verificationCode: sig.verificationCode,
                    positionX: pos.x,
                    positionY: pos.y,
                    pageNumber: pos.page,
                });
            }

            const signedBlob = await applySignaturesToPDF(pdfBytes, stamps);
            await saveSignedDocument(pdfFile.name, saveRecords);

            const url = URL.createObjectURL(signedBlob);
            window.open(url, '_blank');
            setSigned(true);
        } catch (err) {
            console.error('Error signing document:', err);
            alert('Gagal menandatangani dokumen. Silakan coba lagi.');
        } finally {
            setSigning(false);
        }
    };

    // Get signatures on current page
    const sigsOnCurrentPage = Array.from(selectedSigs.entries()).filter(
        ([, pos]) => pos.page === currentPage
    );

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Upload size={20} className="text-emerald-600" />
                    Upload Dokumen
                </h3>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {!pdfFile ? (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-12 border-2 border-dashed border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/30 transition-all flex flex-col items-center gap-3 group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload size={24} className="text-emerald-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-700">Klik untuk upload dokumen PDF</p>
                            <p className="text-xs text-slate-400 mt-1">Hanya file .pdf yang didukung</p>
                        </div>
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                                <FileText size={20} className="text-emerald-600" />
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{pdfFile.name}</p>
                                    <p className="text-xs text-slate-400">{(pdfFile.size / 1024).toFixed(1)} KB · {totalPages} halaman</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setPdfFile(null);
                                    setPdfPages([]);
                                    setSelectedSigs(new Map());
                                    setSigned(false);
                                    setTotalPages(0);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* PDF Preview with draggable signatures */}
                        {loadingPdf ? (
                            <div className="flex justify-center py-20">
                                <Loader2 size={32} className="animate-spin text-emerald-500" />
                            </div>
                        ) : pdfPages.length > 0 && (
                            <div className="space-y-3">
                                {/* Page Navigation */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage <= 1}
                                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 disabled:opacity-40 transition-colors"
                                        >
                                            ← Prev
                                        </button>
                                        <span className="text-sm font-medium text-slate-600">
                                            Halaman {currentPage} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage >= totalPages}
                                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 disabled:opacity-40 transition-colors"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}

                                {/* Document Canvas with Drag Overlays */}
                                <div
                                    ref={previewContainerRef}
                                    className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100 mx-auto"
                                    style={{ maxWidth: '700px' }}
                                >
                                    {/* PDF page image */}
                                    <img
                                        src={pdfPages[currentPage - 1]}
                                        alt={`Page ${currentPage}`}
                                        className="w-full h-auto block"
                                        draggable={false}
                                    />

                                    {/* Draggable signature overlays */}
                                    {sigsOnCurrentPage.map(([sigId, pos]) => (
                                        <DraggableStamp
                                            key={sigId}
                                            sigId={sigId}
                                            position={pos}
                                            previewUrl={sigPreviews.get(sigId) || null}
                                            signerName={signatures.find(s => s.id === sigId)?.signerName || ''}
                                            containerRef={previewContainerRef}
                                            onMove={(x, y) => {
                                                const newMap = new Map(selectedSigs);
                                                newMap.set(sigId, { ...pos, x, y });
                                                setSelectedSigs(newMap);
                                            }}
                                            onScale={(newScale) => {
                                                const newMap = new Map(selectedSigs);
                                                newMap.set(sigId, { ...pos, scale: newScale });
                                                setSelectedSigs(newMap);
                                            }}
                                            onRemove={() => {
                                                const newMap = new Map(selectedSigs);
                                                newMap.delete(sigId);
                                                setSelectedSigs(newMap);
                                            }}
                                        />
                                    ))}

                                    {/* Hint text */}
                                    {sigsOnCurrentPage.length > 0 && (
                                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                                            Drag TTD ke posisi yang diinginkan
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Signature Selection */}
            {pdfFile && pdfPages.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <PenTool size={20} className="text-emerald-600" />
                        Pilih TTD untuk Dibubuhkan
                    </h3>

                    {signatures.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <AlertCircle size={32} className="mx-auto mb-2" />
                            <p className="text-sm">Belum ada TTD. Buat TTD di tab "Kelola TTD" terlebih dahulu.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {signatures.map(sig => {
                                const isSelected = selectedSigs.has(sig.id);
                                const pos = selectedSigs.get(sig.id);

                                return (
                                    <div key={sig.id} className={`rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:border-slate-200'
                                        }`}>
                                        <button
                                            onClick={() => toggleSignature(sig)}
                                            className="w-full flex items-center gap-4 p-3 text-left"
                                        >
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                                                }`}>
                                                {isSelected && <CheckCircle2 size={14} className="text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800 text-sm">{sig.signerName}</p>
                                                <p className="text-xs text-slate-500">{sig.signerRole}</p>
                                            </div>
                                            {isSelected && pos && (
                                                <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md font-medium">
                                                    Hal. {pos.page}
                                                </span>
                                            )}
                                            <span className="text-xs font-mono text-slate-400">{sig.verificationCode}</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Sign Button */}
                    {selectedSigs.size > 0 && (
                        <div className="mt-6 flex items-center gap-4">
                            <button
                                onClick={handleSignRequest}
                                disabled={signing}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                {signing ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <PenTool size={18} />
                                )}
                                {signing ? 'Menandatangani...' : `Bubuhkan ${selectedSigs.size} TTD`}
                            </button>

                            {signed && (
                                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium animate-in fade-in duration-300">
                                    <CheckCircle2 size={18} />
                                    Dokumen berhasil ditandatangani!
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Sandi Verification Modal for Signing */}
            {showSandiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <Key size={20} className="text-emerald-600" />
                            Masukkan Sandi untuk Menandatangani
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Masukkan sandi masing-masing TTD untuk mengotorisasi pembubuhan:
                        </p>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {Array.from(selectedSigs.entries()).map(([sigId]) => {
                                const sig = signatures.find(s => s.id === sigId);
                                if (!sig) return null;
                                const error = sandiErrors.get(sigId);
                                return (
                                    <div key={sigId}>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            <Lock size={12} className="inline mr-1" />
                                            {sig.signerName}
                                        </label>
                                        <input
                                            type="password"
                                            value={sandiInputs.get(sigId) || ''}
                                            onChange={e => {
                                                const newInputs = new Map(sandiInputs);
                                                newInputs.set(sigId, e.target.value);
                                                setSandiInputs(newInputs);
                                                const newErrors = new Map(sandiErrors);
                                                newErrors.delete(sigId);
                                                setSandiErrors(newErrors);
                                            }}
                                            placeholder="Masukkan sandi"
                                            className={`w-full px-4 py-2 rounded-xl border text-sm outline-none transition-all ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                                }`}
                                        />
                                        {error && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <AlertCircle size={11} /> {error}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleSignWithSandi}
                                disabled={Array.from(sandiInputs.values()).some(v => !v.trim())}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                <PenTool size={16} /> Konfirmasi & Tandatangani
                            </button>
                            <button
                                onClick={() => setShowSandiModal(false)}
                                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Draggable + Resizable signature stamp overlay
const DraggableStamp: React.FC<{
    sigId: string;
    position: { x: number; y: number; page: number; scale: number };
    previewUrl: string | null;
    signerName: string;
    containerRef: React.RefObject<HTMLDivElement>;
    onMove: (x: number, y: number) => void;
    onScale: (scale: number) => void;
    onRemove: () => void;
}> = ({ position, previewUrl, signerName, containerRef, onMove, onScale, onRemove }) => {
    const stampRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const resizeStartInfo = useRef({ startY: 0, startScale: 1 });

    const baseWidth = 120;
    const stampWidth = baseWidth * (position.scale || 1);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isResizing.current) return;
        e.preventDefault();
        e.stopPropagation();
        isDragging.current = true;
        const stamp = stampRef.current;
        if (!stamp) return;

        const rect = stamp.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        stamp.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isResizing.current) return;
        if (!isDragging.current || !containerRef.current) return;
        e.preventDefault();

        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();

        const relX = (e.clientX - containerRect.left - dragOffset.current.x) / containerRect.width;
        const relY = (e.clientY - containerRect.top - dragOffset.current.y) / containerRect.height;

        onMove(
            Math.max(0, Math.min(relX, 0.85)),
            Math.max(0, Math.min(relY, 0.85))
        );
    };

    const handlePointerUp = () => {
        isDragging.current = false;
    };

    // Resize via corner handle
    const handleResizePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing.current = true;
        resizeStartInfo.current = {
            startY: e.clientY,
            startScale: position.scale || 1,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handleResizePointerMove = (e: React.PointerEvent) => {
        if (!isResizing.current) return;
        e.preventDefault();
        e.stopPropagation();

        const dy = e.clientY - resizeStartInfo.current.startY;
        const sensitivity = 0.005;
        const newScale = Math.max(0.4, Math.min(2.5, resizeStartInfo.current.startScale + dy * sensitivity));
        onScale(Math.round(newScale * 100) / 100);
    };

    const handleResizePointerUp = (e: React.PointerEvent) => {
        e.stopPropagation();
        isResizing.current = false;
    };

    return (
        <div
            ref={stampRef}
            className="absolute cursor-grab active:cursor-grabbing group"
            style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                width: `${stampWidth}px`,
                touchAction: 'none',
                zIndex: 10,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            {/* Remove button */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
                onPointerDown={e => e.stopPropagation()}
            >
                <X size={12} />
            </button>

            {/* Stamp visual */}
            <div className="bg-white/90 backdrop-blur-sm border-2 border-emerald-400 rounded-lg shadow-lg p-1 pointer-events-none">
                {previewUrl ? (
                    <img src={previewUrl} alt="TTD" className="w-full h-auto rounded" draggable={false} />
                ) : (
                    <div className="text-center py-4 text-xs text-slate-400">
                        <PenTool size={16} className="mx-auto mb-1" />
                        {signerName}
                    </div>
                )}
            </div>

            {/* Resize handle (bottom-right corner) */}
            <div
                className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full cursor-nwse-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
            >
                <Maximize2 size={10} className="text-white" />
            </div>

            {/* Scale indicator */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
                {Math.round((position.scale || 1) * 100)}%
            </div>
        </div>
    );
};

// =====================================================
// TAB 3: HISTORY
// =====================================================
const HistoryTab: React.FC = () => {
    const [documents, setDocuments] = useState<SignedDocument[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSignedDocuments().then(data => {
            setDocuments(data);
            setLoading(false);
        });
    }, []);

    const formatDate = (iso?: string) => {
        if (!iso) return '-';
        try {
            return new Date(iso).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch { return iso; }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Riwayat Dokumen Ditandatangani</h3>
                <span className="text-sm text-slate-400">{documents.length} dokumen</span>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-emerald-500" />
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                    <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-lg font-medium">Belum ada dokumen yang ditandatangani</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {documents.map(doc => (
                        <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                    <FileText size={20} className="text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-slate-900 text-sm sm:text-base break-all leading-snug">{doc.originalFilename}</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(doc.signedAt)}</p>
                                </div>
                            </div>

                            {/* Signatures on this document */}
                            {doc.signatures && doc.signatures.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                                    {doc.signatures.map(s => (
                                        <span key={s.id} className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] sm:text-xs font-medium">
                                            <PenTool size={11} className="flex-shrink-0" />
                                            <span className="break-all">{s.signerName} — {s.signerRole}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// =====================================================
// TAB 4: VERIFY
// =====================================================
const VerifyTab: React.FC = () => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        valid: boolean;
        signerName?: string;
        signerRole?: string;
        documentName?: string;
        signedAt?: string;
    } | null>(null);
    const [searched, setSearched] = useState(false);

    // Auto-fill from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const verifyCode = params.get('verify');
        if (verifyCode) {
            setCode(verifyCode);
            handleVerify(verifyCode);
        }
    }, []);

    const handleVerify = async (codeToVerify?: string) => {
        const c = codeToVerify || code.trim();
        if (!c) return;
        setLoading(true);
        setSearched(true);

        const res = await verifySignature(c);
        setResult(res);
        setLoading(false);
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '-';
        try {
            return new Date(iso).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch { return iso; }
    };

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                    <Shield size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Verifikasi Tanda Tangan</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Scan QR code atau masukkan kode verifikasi untuk memvalidasi tanda tangan digital
                </p>
            </div>

            {/* Input */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Kode Verifikasi</label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="Contoh: A3F2-B8K1-C4M7"
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono tracking-wider text-center text-sm sm:text-lg"
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    />
                    <button
                        onClick={() => handleVerify()}
                        disabled={loading || !code.trim()}
                        className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Verifikasi
                    </button>
                </div>
            </div>

            {/* Result */}
            {searched && !loading && result && (
                <div className={`rounded-2xl border-2 p-6 animate-in slide-in-from-bottom-2 duration-300 ${result.valid
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'
                    }`}>
                    <div className="flex items-center gap-3 mb-4">
                        {result.valid ? (
                            <>
                                <CheckCircle2 size={28} className="text-emerald-600" />
                                <div>
                                    <p className="font-bold text-emerald-800 text-lg">Tanda Tangan Valid ✅</p>
                                    <p className="text-sm text-emerald-600">Tanda tangan digital ini terverifikasi</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <XCircle size={28} className="text-red-600" />
                                <div>
                                    <p className="font-bold text-red-800 text-lg">Tidak Ditemukan ❌</p>
                                    <p className="text-sm text-red-600">Kode verifikasi tidak terdaftar dalam sistem</p>
                                </div>
                            </>
                        )}
                    </div>

                    {result.valid && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-emerald-200">
                            <div className="flex items-center gap-3">
                                <User size={16} className="text-emerald-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-emerald-600 font-medium">Penandatangan</p>
                                    <p className="text-sm font-bold text-emerald-900">{result.signerName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Briefcase size={16} className="text-emerald-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-emerald-600 font-medium">Jabatan</p>
                                    <p className="text-sm font-bold text-emerald-900">{result.signerRole}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-emerald-600 font-medium">Dokumen</p>
                                    <p className="text-sm font-bold text-emerald-900">{result.documentName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar size={16} className="text-emerald-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-emerald-600 font-medium">Tanggal Tanda Tangan</p>
                                    <p className="text-sm font-bold text-emerald-900">{formatDate(result.signedAt)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
