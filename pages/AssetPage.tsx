import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronUp,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AssetItem } from '../types';
import { createAsset, deleteAsset, fetchAssets, updateAsset, uploadAssetFile } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Notice = { type: 'success' | 'error'; message: string } | null;

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getAssetIcon = (asset: AssetItem) => {
  const mime = asset.mimeType || '';
  const name = asset.fileName.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) return FileImage;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  if (mime.includes('pdf') || /\.(pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx)$/.test(name)) return FileText;
  return File;
};

export const AssetPage: React.FC = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [notice, setNotice] = useState<Notice>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [editForm, setEditForm] = useState({ fileName: '', category: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<AssetItem | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    const rows = await fetchAssets();
    setAssets(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(assets.map(asset => asset.category).filter(Boolean) as string[]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return assets.filter(asset => {
      const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
      const matchesQuery = !query || [
        asset.fileName,
        asset.category || '',
        asset.description || '',
        asset.uploadedBy || '',
      ].some(value => value.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [assets, categoryFilter, searchQuery]);

  const resetUploadForm = () => {
    setSelectedFiles([]);
    setCategory('');
    setDescription('');
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setNotice({ type: 'error', message: 'Pilih file terlebih dahulu.' });
      return;
    }

    setUploading(true);
    setNotice(null);
    try {
      let successCount = 0;
      for (const file of selectedFiles) {
        const uploaded = await uploadAssetFile(file);
        if (!uploaded) throw new Error(`Upload gagal untuk ${file.name}.`);

        const created = await createAsset({
          fileName: file.name,
          fileUrl: uploaded.url,
          storageKey: uploaded.storageKey,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          category: category.trim() || null,
          description: description.trim() || null,
          uploadedBy: user?.email || null,
        });

        if (!created) throw new Error(`Metadata asset gagal disimpan untuk ${file.name}.`);
        successCount += 1;
      }

      await loadAssets();
      resetUploadForm();
      setShowUploadPanel(false);
      setNotice({ type: 'success', message: `${successCount} asset berhasil diupload ke R2.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload asset gagal.';
      setNotice({ type: 'error', message });
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (asset: AssetItem) => {
    setEditingAsset(asset);
    setEditForm({
      fileName: asset.fileName,
      category: asset.category || '',
      description: asset.description || '',
    });
  };

  const handleUpdate = async () => {
    if (!editingAsset || !editForm.fileName.trim()) return;
    const ok = await updateAsset(editingAsset.id, {
      fileName: editForm.fileName.trim(),
      category: editForm.category.trim() || null,
      description: editForm.description.trim() || null,
    });
    if (ok) {
      setEditingAsset(null);
      await loadAssets();
      setNotice({ type: 'success', message: 'Metadata asset berhasil diperbarui.' });
    } else {
      setNotice({ type: 'error', message: 'Metadata asset gagal diperbarui.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteAsset(deleteTarget);
    if (ok) {
      setDeleteTarget(null);
      await loadAssets();
      setNotice({ type: 'success', message: 'Asset berhasil dihapus dari R2 dan database.' });
    } else {
      setNotice({ type: 'error', message: 'Asset gagal dihapus.' });
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Team Asset</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Asset</h1>
            <p className="mt-1 text-sm text-slate-500">Upload dan kelola file tim yang disimpan di R2.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowUploadPanel(prev => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
            >
              {showUploadPanel ? <ChevronUp size={16} /> : <Plus size={16} />}
              {showUploadPanel ? 'Tutup Upload' : 'Upload Asset'}
            </button>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Total Asset</p>
              <p className="text-xl font-bold text-slate-900">{assets.length}</p>
            </div>
          </div>
        </div>

        {notice && (
          <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} className="ml-auto rounded p-0.5 hover:bg-white/60" aria-label="Tutup notifikasi">
              <X size={16} />
            </button>
          </div>
        )}

        {showUploadPanel && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Upload Asset</h2>
                <p className="mt-0.5 text-xs text-slate-500">File masuk ke folder R2 `assets/`.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadPanel(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Tutup form upload"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <label className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                selectedFiles.length > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
              }`}>
                {selectedFiles.length > 0 ? (
                  <div className="flex max-w-full flex-col items-center gap-2">
                    <FileText className="h-9 w-9 text-emerald-600" />
                    <p className="max-w-full truncate text-sm font-semibold text-slate-900">{selectedFiles.length} file dipilih</p>
                    <p className="text-xs text-slate-500">{formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))}</p>
                    <div className="mt-2 max-h-28 w-full max-w-xl space-y-1 overflow-y-auto rounded-lg bg-white/80 p-2 text-left">
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700">
                          <File size={13} className="flex-shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <span className="flex-shrink-0 text-slate-400">{formatBytes(file.size)}</span>
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              setSelectedFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));
                            }}
                            className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Hapus ${file.name}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={event => {
                        event.preventDefault();
                        setSelectedFiles([]);
                      }}
                      className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      <X size={13} />
                      Kosongkan pilihan
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Upload className="h-10 w-10 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">Klik untuk pilih beberapa file</p>
                    <p className="text-xs">Semua format file, maksimal 100 MB per file.</p>
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={event => setSelectedFiles(Array.from(event.target.files || []))}
                />
              </label>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
                  <input
                    value={category}
                    onChange={event => setCategory(event.target.value)}
                    placeholder="Contoh: Kontrak, Foto, Template"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Deskripsi</label>
                  <textarea
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Catatan singkat agar file mudah dicari"
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading || selectedFiles.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Mengupload...' : `Upload ${selectedFiles.length || ''} ke R2`}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Daftar Asset</h2>
                <p className="text-xs text-slate-500">{filteredAssets.length} dari {assets.length} asset ditampilkan</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Cari nama file, kategori, deskripsi..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">Semua kategori</option>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Memuat asset...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center px-4 text-center text-slate-500">
              <File className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">Belum ada asset yang cocok.</p>
              <p className="mt-1 text-xs">Upload file pertama atau ubah pencarian.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAssets.map(asset => {
                const Icon = getAssetIcon(asset);
                return (
                  <div key={asset.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{asset.fileName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{formatBytes(asset.fileSize)}</span>
                          <span>{formatDate(asset.createdAt)}</span>
                          {asset.category && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{asset.category}</span>}
                        </div>
                        {asset.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{asset.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <a
                        href={asset.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink size={14} />
                        Buka
                      </a>
                      <a
                        href={asset.fileUrl}
                        download={asset.fileName}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Download size={14} />
                        Unduh
                      </a>
                      <button
                        onClick={() => startEdit(asset)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(asset)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setEditingAsset(null)} />
          <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">Edit Asset</h2>
              <button onClick={() => setEditingAsset(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nama file</label>
                <input
                  value={editForm.fileName}
                  onChange={event => setEditForm(prev => ({ ...prev, fileName: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
                <input
                  value={editForm.category}
                  onChange={event => setEditForm(prev => ({ ...prev, category: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Deskripsi</label>
                <textarea
                  value={editForm.description}
                  onChange={event => setEditForm(prev => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button onClick={() => setEditingAsset(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleUpdate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Hapus asset?</h2>
                <p className="mt-1 text-sm text-slate-500">File akan dihapus dari R2 dan daftar asset.</p>
                <p className="mt-2 break-all text-xs font-medium text-slate-700">{deleteTarget.fileName}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
