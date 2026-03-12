import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Search, FileText, Trash2, Edit3, X, ExternalLink,
    Check, ChevronDown, FolderPlus, Settings2, AlertCircle, Loader2,
    Upload, Link as LinkIcon, File, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { DocumentCategory, DocumentItem } from '../types';
import {
    fetchDocumentCategories,
    createDocumentCategory,
    updateDocumentCategory,
    deleteDocumentCategory,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    uploadDocumentFile,
} from '../lib/supabase';

// =====================================================
// DOKUMEN PAGE
// =====================================================

export const DokumenPage: React.FC = () => {
    // State
    const [categories, setCategories] = useState<DocumentCategory[]>([]);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [showAddDocModal, setShowAddDocModal] = useState(false);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [showManageCategories, setShowManageCategories] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'doc' | 'category'; id: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [linkMode, setLinkMode] = useState<'link' | 'upload'>('link');

    // Form state
    const [formData, setFormData] = useState({
        noSurat: '',
        tanggal: '',
        deskripsi: '',
        jenisDokumen: '',
        link: '',
        pengisi: '',
        penerbi: '',
        hasSoftfile: false,
        hasHardfile: false,
        keterangan: '',
    });

    // Load categories
    const loadCategories = useCallback(async () => {
        setLoading(true);
        const cats = await fetchDocumentCategories();
        setCategories(cats);
        if (cats.length > 0 && !activeCategory) {
            setActiveCategory(cats[0].id);
        }
        setLoading(false);
    }, []);

    // Load documents for active category
    const loadDocuments = useCallback(async () => {
        if (!activeCategory) {
            setDocuments([]);
            return;
        }
        setLoadingDocs(true);
        const docs = await fetchDocuments(activeCategory);
        setDocuments(docs);
        setLoadingDocs(false);
    }, [activeCategory]);

    useEffect(() => { loadCategories(); }, [loadCategories]);
    useEffect(() => { loadDocuments(); }, [loadDocuments]);

    // Filtered & sorted documents
    const filteredDocs = documents
        .filter(doc => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                doc.noSurat?.toLowerCase().includes(q) ||
                doc.deskripsi?.toLowerCase().includes(q) ||
                doc.jenisDokumen?.toLowerCase().includes(q) ||
                doc.pengisi?.toLowerCase().includes(q) ||
                doc.penerbi?.toLowerCase().includes(q) ||
                doc.keterangan?.toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            const dateA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
            const dateB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

    // Handlers
    const resetForm = () => {
        setFormData({
            noSurat: '', tanggal: '', deskripsi: '', jenisDokumen: '', link: '',
            pengisi: '', penerbi: '', hasSoftfile: false, hasHardfile: false, keterangan: '',
        });
        setEditingDoc(null);
        setSelectedFile(null);
        setLinkMode('link');
    };

    const handleSaveDoc = async () => {
        if (!activeCategory) return;

        let finalLink = formData.link;

        // If file is selected, upload it first
        if (selectedFile && linkMode === 'upload') {
            setUploading(true);
            const activeCat = categories.find(c => c.id === activeCategory);
            const catName = activeCat?.name || 'general';
            const uploadedUrl = await uploadDocumentFile(selectedFile, catName);
            setUploading(false);
            if (!uploadedUrl) return; // upload failed
            finalLink = uploadedUrl;
        }

        const saveData = { ...formData, link: finalLink };

        if (editingDoc) {
            const ok = await updateDocument(editingDoc.id, saveData);
            if (ok) { await loadDocuments(); setShowAddDocModal(false); resetForm(); }
        } else {
            const doc = await createDocument({
                categoryId: activeCategory,
                ...saveData,
                displayOrder: documents.length,
            });
            if (doc) { await loadDocuments(); setShowAddDocModal(false); resetForm(); }
        }
    };

    const handleEditDoc = (doc: DocumentItem) => {
        setEditingDoc(doc);
        setFormData({
            noSurat: doc.noSurat || '',
            tanggal: doc.tanggal || '',
            deskripsi: doc.deskripsi || '',
            jenisDokumen: doc.jenisDokumen || '',
            link: doc.link || '',
            pengisi: doc.pengisi || '',
            penerbi: doc.penerbi || '',
            hasSoftfile: doc.hasSoftfile,
            hasHardfile: doc.hasHardfile,
            keterangan: doc.keterangan || '',
        });
        setShowAddDocModal(true);
    };

    const handleDeleteDoc = async (id: string) => {
        const ok = await deleteDocument(id);
        if (ok) { await loadDocuments(); setDeleteConfirm(null); }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const cat = await createDocumentCategory(newCategoryName.trim(), categories.length);
        if (cat) {
            setCategories(prev => [...prev, cat]);
            setActiveCategory(cat.id);
            setNewCategoryName('');
            setShowAddCategoryModal(false);
        }
    };

    const handleUpdateCategory = async (id: string) => {
        if (!editingCategoryName.trim()) return;
        const ok = await updateDocumentCategory(id, editingCategoryName.trim());
        if (ok) {
            setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editingCategoryName.trim() } : c));
            setEditingCategoryId(null);
            setEditingCategoryName('');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        const ok = await deleteDocumentCategory(id);
        if (ok) {
            const newCats = categories.filter(c => c.id !== id);
            setCategories(newCats);
            if (activeCategory === id) {
                setActiveCategory(newCats.length > 0 ? newCats[0].id : null);
            }
            setDeleteConfirm(null);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('id-ID', {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
        } catch { return dateStr; }
    };

    // =====================================================
    // RENDER
    // =====================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="text-emerald-600" size={24} />
                        Daftar Dokumen
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Kelola dan pantau seluruh dokumen proyek
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowManageCategories(!showManageCategories)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <Settings2 size={16} />
                        <span className="hidden sm:inline">Kelola Kategori</span>
                    </button>
                    <button
                        onClick={() => { setShowAddCategoryModal(true); setNewCategoryName(''); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                        <FolderPlus size={16} />
                        <span className="hidden sm:inline">Kategori Baru</span>
                    </button>
                </div>
            </div>

            {/* Category Tabs */}
            {categories.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="relative">
                        <div className="flex overflow-x-auto scrollbar-thin border-b border-slate-200">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeCategory === cat.id
                                        ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    {cat.name}
                                    {activeCategory === cat.id && (
                                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                            {documents.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search & Actions Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Cari dokumen..."
                                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                />
                            </div>
                            <button
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
                                title={sortOrder === 'desc' ? 'Tanggal: Terbaru di atas' : 'Tanggal: Terlama di atas'}
                            >
                                {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                            </button>
                        </div>
                        <button
                            onClick={() => { resetForm(); setShowAddDocModal(true); }}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow transition-all"
                        >
                            <Plus size={16} />
                            Tambah Dokumen
                        </button>
                    </div>

                    {/* Manage Categories Panel */}
                    {showManageCategories && (
                        <div className="p-4 bg-amber-50/50 border-b border-amber-100">
                            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
                                <Settings2 size={14} />
                                Kelola Kategori
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <div
                                        key={cat.id}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-sm"
                                    >
                                        {editingCategoryId === cat.id ? (
                                            <>
                                                <input
                                                    type="text"
                                                    value={editingCategoryName}
                                                    onChange={e => setEditingCategoryName(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleUpdateCategory(cat.id)}
                                                    className="w-24 sm:w-32 px-1 py-0.5 text-sm rounded border border-amber-300 focus:outline-none focus:border-emerald-400"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleUpdateCategory(cat.id)}
                                                    className="p-0.5 text-emerald-600 hover:text-emerald-700"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }}
                                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-slate-700">{cat.name}</span>
                                                <button
                                                    onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}
                                                    className="p-0.5 text-slate-400 hover:text-emerald-600"
                                                >
                                                    <Edit3 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ type: 'category', id: cat.id })}
                                                    className="p-0.5 text-slate-400 hover:text-red-600"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    {loadingDocs ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <FileText size={40} className="mb-3 opacity-50" />
                            <p className="text-sm font-medium">
                                {searchQuery ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}
                            </p>
                            <p className="text-xs mt-1">
                                {searchQuery ? 'Coba kata kunci lain' : 'Klik "Tambah Dokumen" untuk memulai'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600">
                                        <th className="text-left px-4 py-3 font-semibold w-10">No</th>
                                        <th className="text-left px-4 py-3 font-semibold w-28">Tanggal</th>
                                        <th className="text-left px-4 py-3 font-semibold w-36">No Surat</th>
                                        <th className="text-left px-4 py-3 font-semibold min-w-[200px]">Deskripsi</th>
                                        <th className="text-left px-4 py-3 font-semibold w-36">Jenis Dokumen</th>
                                        <th className="text-center px-4 py-3 font-semibold w-16">Link</th>
                                        <th className="text-left px-4 py-3 font-semibold w-28">Pengirim</th>
                                        <th className="text-left px-4 py-3 font-semibold w-28">Penerima</th>
                                        <th className="text-center px-4 py-3 font-semibold w-20">Softfile</th>
                                        <th className="text-center px-4 py-3 font-semibold w-20">Hardfile</th>
                                        <th className="text-left px-4 py-3 font-semibold min-w-[120px]">Keterangan</th>
                                        <th className="text-center px-4 py-3 font-semibold w-20">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDocs.map((doc, idx) => (
                                        <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-4 py-3 text-slate-500 font-medium">{idx + 1}</td>
                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(doc.tanggal)}</td>
                                            <td className="px-4 py-3 text-slate-700 text-xs">{doc.noSurat || '-'}</td>
                                            <td className="px-4 py-3 text-slate-800">{doc.deskripsi || '-'}</td>
                                            <td className="px-4 py-3">
                                                {doc.jenisDokumen ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                                                        {doc.jenisDokumen}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {doc.link ? (
                                                    <a
                                                        href={doc.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                                        title="Buka Link"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{doc.pengisi || '-'}</td>
                                            <td className="px-4 py-3 text-slate-600">{doc.penerbi || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${doc.hasSoftfile
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                    {doc.hasSoftfile ? '✓' : '✗'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${doc.hasHardfile
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                    {doc.hasHardfile ? '✓' : '✗'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{doc.keterangan || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditDoc(doc)}
                                                        className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm({ type: 'doc', id: doc.id })}
                                                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer Stats */}
                    {filteredDocs.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500">
                            <span>Total: <strong className="text-slate-700">{filteredDocs.length}</strong> dokumen</span>
                            <div className="flex items-center gap-4">
                                <span>Softfile: <strong className="text-emerald-600">{filteredDocs.filter(d => d.hasSoftfile).length}</strong></span>
                                <span>Hardfile: <strong className="text-emerald-600">{filteredDocs.filter(d => d.hasHardfile).length}</strong></span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
                    <FolderPlus size={48} className="text-slate-300 mb-4" />
                    <h2 className="text-lg font-semibold text-slate-700 mb-2">Belum ada Kategori</h2>
                    <p className="text-sm text-slate-500 mb-4">Mulai dengan membuat kategori dokumen pertama</p>
                    <button
                        onClick={() => { setShowAddCategoryModal(true); setNewCategoryName(''); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-sm transition-all"
                    >
                        <Plus size={16} />
                        Buat Kategori
                    </button>
                </div>
            )}

            {/* =====================================================
          MODALS
          ===================================================== */}

            {/* Add/Edit Document Modal */}
            {showAddDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setShowAddDocModal(false); resetForm(); }} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingDoc ? 'Edit Dokumen' : 'Tambah Dokumen Baru'}
                            </h2>
                            <button
                                onClick={() => { setShowAddDocModal(false); resetForm(); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                                    <input
                                        type="date"
                                        value={formData.tanggal}
                                        onChange={e => setFormData(f => ({ ...f, tanggal: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Dokumen</label>
                                    <input
                                        type="text"
                                        value={formData.jenisDokumen}
                                        onChange={e => setFormData(f => ({ ...f, jenisDokumen: e.target.value }))}
                                        placeholder="Contoh: Surat, Notulen, MoU"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">No Surat</label>
                                <input
                                    type="text"
                                    value={formData.noSurat}
                                    onChange={e => setFormData(f => ({ ...f, noSurat: e.target.value }))}
                                    placeholder="Contoh: 001/PF/2024"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
                                <textarea
                                    value={formData.deskripsi}
                                    onChange={e => setFormData(f => ({ ...f, deskripsi: e.target.value }))}
                                    placeholder="Deskripsi dokumen..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Dokumen</label>
                                {/* Toggle: Link or Upload */}
                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-3 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setLinkMode('link')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${linkMode === 'link'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <LinkIcon size={13} />
                                        Paste Link
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLinkMode('upload')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${linkMode === 'upload'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <Upload size={13} />
                                        Upload File
                                    </button>
                                </div>

                                {linkMode === 'link' ? (
                                    <input
                                        type="url"
                                        value={formData.link}
                                        onChange={e => setFormData(f => ({ ...f, link: e.target.value }))}
                                        placeholder="https://..."
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <label
                                            className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${selectedFile
                                                ? 'border-emerald-300 bg-emerald-50/50'
                                                : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                                                }`}
                                        >
                                            {selectedFile ? (
                                                <div className="flex items-center gap-2 text-emerald-700">
                                                    <File size={20} />
                                                    <div className="text-sm">
                                                        <p className="font-medium">{selectedFile.name}</p>
                                                        <p className="text-xs text-emerald-600">
                                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.preventDefault(); setSelectedFile(null); }}
                                                        className="ml-2 p-1 rounded-md hover:bg-emerald-100 text-emerald-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-400">
                                                    <Upload size={24} className="mb-1" />
                                                    <p className="text-xs font-medium">Klik untuk pilih file</p>
                                                    <p className="text-[10px] mt-0.5">PDF, DOC, XLS, PPT, dll.</p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setSelectedFile(file);
                                                }}
                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.zip,.rar"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Pengirim</label>
                                    <input
                                        type="text"
                                        value={formData.pengisi}
                                        onChange={e => setFormData(f => ({ ...f, pengisi: e.target.value }))}
                                        placeholder="Nama pengirim"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Penerima</label>
                                    <input
                                        type="text"
                                        value={formData.penerbi}
                                        onChange={e => setFormData(f => ({ ...f, penerbi: e.target.value }))}
                                        placeholder="Nama penerima"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div
                                        onClick={() => setFormData(f => ({ ...f, hasSoftfile: !f.hasSoftfile }))}
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${formData.hasSoftfile
                                            ? 'bg-emerald-600 border-emerald-600'
                                            : 'border-slate-300 hover:border-emerald-400'
                                            }`}
                                    >
                                        {formData.hasSoftfile && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className="text-sm text-slate-700">Softfile</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div
                                        onClick={() => setFormData(f => ({ ...f, hasHardfile: !f.hasHardfile }))}
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${formData.hasHardfile
                                            ? 'bg-emerald-600 border-emerald-600'
                                            : 'border-slate-300 hover:border-emerald-400'
                                            }`}
                                    >
                                        {formData.hasHardfile && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className="text-sm text-slate-700">Hardfile</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
                                <textarea
                                    value={formData.keterangan}
                                    onChange={e => setFormData(f => ({ ...f, keterangan: e.target.value }))}
                                    placeholder="Catatan tambahan (opsional)..."
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setShowAddDocModal(false); resetForm(); }}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveDoc}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading && <Loader2 size={14} className="animate-spin" />}
                                {uploading ? 'Mengupload...' : editingDoc ? 'Simpan Perubahan' : 'Tambah Dokumen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Category Modal */}
            {showAddCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddCategoryModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">Kategori Baru</h2>
                            <button
                                onClick={() => setShowAddCategoryModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Nama Kategori</label>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                                placeholder="Contoh: KET, INTERNAL, BLORA..."
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                                autoFocus
                            />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddCategoryModal(false)}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAddCategory}
                                disabled={!newCategoryName.trim()}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Buat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="text-red-600" size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Konfirmasi Hapus</h3>
                            <p className="text-sm text-slate-500">
                                {deleteConfirm.type === 'category'
                                    ? 'Menghapus kategori akan menghapus semua dokumen di dalamnya. Lanjutkan?'
                                    : 'Apakah Anda yakin ingin menghapus dokumen ini?'
                                }
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    if (deleteConfirm.type === 'doc') handleDeleteDoc(deleteConfirm.id);
                                    else handleDeleteCategory(deleteConfirm.id);
                                }}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
