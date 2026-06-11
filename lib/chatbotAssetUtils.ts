export type AssetSourceType = 'asset';

export interface ChatbotAssetRow {
  id: string;
  file_name: string;
  file_url: string;
  storage_key: string;
  mime_type?: string | null;
  file_size?: number | null;
  category?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChatbotAssetLink {
  id: string;
  fileName: string;
  fileUrl: string;
  storageKey: string;
  mimeType?: string | null;
  fileSize: number;
  category?: string | null;
  description?: string | null;
  uploadedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  location: string;
  folder: string;
  fileType: 'image' | 'pdf' | 'archive' | 'document' | 'spreadsheet' | 'file';
}

export interface ChatbotAssetSource {
  id: string;
  type: AssetSourceType;
  title: string;
  subtitle: string;
  url: string;
  meta?: string;
}

export interface ChatbotAssetSummary {
  totalAssets: number;
  totalSize: number;
  byLocation: Array<{ location: string; count: number; totalSize: number }>;
  byFolder: Array<{ location: string; folder: string; count: number; totalSize: number }>;
  recent: ChatbotAssetLink[];
  items: ChatbotAssetLink[];
}

const DEFAULT_LOCATION = 'Tanpa Lokasi';
const DEFAULT_FOLDER = 'Tanpa Folder';
const MAX_RECENT_ASSETS = 18;

function normalizePathPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function getDisplayPathPart(value: string): string {
  return normalizePathPart(value.replace(/_/g, ' '));
}

function getStorageFolderSegments(storageKey: string): string[] {
  const keyParts = storageKey.split('/').filter(Boolean);
  if (keyParts[0] !== 'assets') return [];

  const folderParts = keyParts.slice(1, -1);
  const isDatedFallback = /^\d{4}$/.test(folderParts[0] || '') && /^\d{2}$/.test(folderParts[1] || '');
  return isDatedFallback ? [] : folderParts.map(getDisplayPathPart).filter(Boolean);
}

function getAssetPathParts(asset: Pick<ChatbotAssetLink, 'category' | 'storageKey'>): {
  location: string;
  folder: string;
} {
  const categoryParts = (asset.category || '')
    .split(/[\\/]/)
    .map(normalizePathPart)
    .filter(Boolean);

  if (categoryParts.length >= 2) {
    return {
      location: categoryParts[0],
      folder: categoryParts.slice(1).join(' / '),
    };
  }

  if (categoryParts.length === 1) {
    return {
      location: DEFAULT_LOCATION,
      folder: categoryParts[0],
    };
  }

  const storageParts = getStorageFolderSegments(asset.storageKey);
  if (storageParts.length >= 2) {
    return {
      location: storageParts[0],
      folder: storageParts.slice(1).join(' / '),
    };
  }

  if (storageParts.length === 1) {
    return {
      location: DEFAULT_LOCATION,
      folder: storageParts[0],
    };
  }

  return {
    location: DEFAULT_LOCATION,
    folder: DEFAULT_FOLDER,
  };
}

function getAssetFileType(fileName: string, mimeType?: string | null): ChatbotAssetLink['fileType'] {
  const name = fileName.toLowerCase();
  const mime = mimeType || '';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) return 'image';
  if (mime.includes('pdf') || /\.pdf$/.test(name)) return 'pdf';
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return 'archive';
  if (/\.(doc|docx|txt|ppt|pptx)$/.test(name)) return 'document';
  if (/\.(csv|xls|xlsx)$/.test(name)) return 'spreadsheet';
  return 'file';
}

function toAssetLink(row: ChatbotAssetRow): ChatbotAssetLink {
  const base = {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    category: row.category,
    description: row.description,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fileType: getAssetFileType(row.file_name, row.mime_type),
  };
  const path = getAssetPathParts(base);
  return { ...base, ...path };
}

function newerFirst(a?: string | null, b?: string | null): number {
  return (b || '').localeCompare(a || '');
}

function formatAssetSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const value = unitIndex === 0 ? String(Math.round(size)) : size.toFixed(size >= 10 ? 1 : 2);
  return `${value} ${units[unitIndex]}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, ' ');
}

export function buildAssetSummary(rows: ChatbotAssetRow[]): ChatbotAssetSummary {
  const items = rows
    .map(toAssetLink)
    .sort((a, b) => newerFirst(a.createdAt, b.createdAt));
  const locationMap = new Map<string, { location: string; count: number; totalSize: number; latestCreatedAt?: string | null }>();
  const folderMap = new Map<string, { location: string; folder: string; count: number; totalSize: number; latestCreatedAt?: string | null }>();

  items.forEach((item) => {
    const locationKey = item.location.toLowerCase();
    const folderKey = `${locationKey}::${item.folder.toLowerCase()}`;
    const existingLocation = locationMap.get(locationKey) || {
      location: item.location,
      count: 0,
      totalSize: 0,
      latestCreatedAt: item.createdAt,
    };
    existingLocation.count += 1;
    existingLocation.totalSize += item.fileSize;
    if (newerFirst(existingLocation.latestCreatedAt, item.createdAt) > 0) {
      existingLocation.latestCreatedAt = item.createdAt;
    }
    locationMap.set(locationKey, existingLocation);

    const existingFolder = folderMap.get(folderKey) || {
      location: item.location,
      folder: item.folder,
      count: 0,
      totalSize: 0,
      latestCreatedAt: item.createdAt,
    };
    existingFolder.count += 1;
    existingFolder.totalSize += item.fileSize;
    if (newerFirst(existingFolder.latestCreatedAt, item.createdAt) > 0) {
      existingFolder.latestCreatedAt = item.createdAt;
    }
    folderMap.set(folderKey, existingFolder);
  });

  return {
    totalAssets: items.length,
    totalSize: items.reduce((sum, item) => sum + item.fileSize, 0),
    byLocation: Array.from(locationMap.values())
      .sort((a, b) => newerFirst(a.latestCreatedAt, b.latestCreatedAt))
      .map(({ location, count, totalSize }) => ({ location, count, totalSize })),
    byFolder: Array.from(folderMap.values())
      .sort((a, b) => newerFirst(a.latestCreatedAt, b.latestCreatedAt))
      .map(({ location, folder, count, totalSize }) => ({ location, folder, count, totalSize })),
    recent: items.slice(0, MAX_RECENT_ASSETS),
    items,
  };
}

export function assetToSource(asset: ChatbotAssetLink): ChatbotAssetSource {
  const date = asset.createdAt ? new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(asset.createdAt)) : null;

  return {
    id: `asset-${asset.id}`,
    type: 'asset',
    title: asset.fileName,
    subtitle: [asset.location, asset.folder, asset.description].filter(Boolean).join(' - '),
    url: asset.fileUrl,
    meta: [asset.fileType.toUpperCase(), formatAssetSize(asset.fileSize), date].filter(Boolean).join(' - '),
  };
}

export function scoreAssetSource(source: ChatbotAssetSource, tokens: string[], question: string): number {
  const searchable = normalizeText([
    source.title,
    source.subtitle,
    source.meta,
    source.url,
  ].filter(Boolean).join(' '));
  let score = 0;

  tokens.forEach((token) => {
    if (searchable.includes(token)) score += 2;
  });

  if (/asset|aset|r2|folder|shapefile|file|lampiran|data spasial|peta/i.test(question)) score += 3;
  return score;
}
