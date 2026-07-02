import type { DocumentCategory, DocumentItem } from '../types';
import { fetchAllDocuments, fetchDocumentCategories, fetchDocuments } from './supabase';

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let categoriesCache: CacheEntry<DocumentCategory[]> | null = null;
const documentsByCategoryCache = new Map<string, CacheEntry<DocumentItem[]>>();
let allDocumentsCache: CacheEntry<DocumentItem[]> | null = null;
let cacheGeneration = 0;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function withTtl<T>(value: T): CacheEntry<T> {
  return {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

export async function getCachedDocumentCategories(force = false): Promise<DocumentCategory[]> {
  if (!force && isFresh(categoriesCache)) {
    return categoriesCache.value;
  }

  const generation = cacheGeneration;
  const categories = await fetchDocumentCategories();
  if (generation === cacheGeneration) {
    categoriesCache = withTtl(categories);
  }
  return categories;
}

export async function getCachedDocuments(categoryId: string, force = false): Promise<DocumentItem[]> {
  const cached = documentsByCategoryCache.get(categoryId) ?? null;
  if (!force && isFresh(cached)) {
    return cached.value;
  }

  const generation = cacheGeneration;
  const documents = await fetchDocuments(categoryId);
  if (generation === cacheGeneration) {
    documentsByCategoryCache.set(categoryId, withTtl(documents));
  }
  return documents;
}

export async function getCachedAllDocuments(force = false): Promise<DocumentItem[]> {
  if (!force && isFresh(allDocumentsCache)) {
    return allDocumentsCache.value;
  }

  const generation = cacheGeneration;
  const documents = await fetchAllDocuments();
  if (generation === cacheGeneration) {
    allDocumentsCache = withTtl(documents);
  }
  return documents;
}

export function clearDocumentCaches(categoryId?: string): void {
  cacheGeneration += 1;
  categoriesCache = null;
  allDocumentsCache = null;

  if (categoryId) {
    documentsByCategoryCache.delete(categoryId);
    return;
  }

  documentsByCategoryCache.clear();
}
