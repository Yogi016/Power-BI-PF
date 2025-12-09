// Filter utilities for Dashboard and Weekly Progress

export interface FilterState {
  pics: string[];
  statuses: string[];
  categories: string[];
  dateRange: { start: string; end: string } | null;
  searchText: string;
}

/**
 * Apply filters to projects array
 */
export function applyFilters<T extends { pic?: string; status?: string; category?: string; name?: string }>(
  data: T[],
  filters: FilterState
): T[] {
  return data.filter(item => {
    // Filter by PIC
    if (filters.pics.length > 0 && item.pic && !filters.pics.includes(item.pic)) {
      return false;
    }

    // Filter by Status
    if (filters.statuses.length > 0 && item.status && !filters.statuses.includes(item.status)) {
      return false;
    }

    // Filter by Category
    if (filters.categories.length > 0 && item.category && !filters.categories.includes(item.category)) {
      return false;
    }

    // Filter by Search Text
    if (filters.searchText && item.name) {
      const searchLower = filters.searchText.toLowerCase();
      if (!item.name.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get unique PICs from projects
 */
export function getUniquePICs<T extends { pic?: string }>(data: T[]): string[] {
  const pics = new Set<string>();
  data.forEach(item => {
    if (item.pic) pics.add(item.pic);
  });
  return Array.from(pics).sort();
}

/**
 * Get unique categories from projects
 */
export function getUniqueCategories<T extends { category?: string }>(data: T[]): string[] {
  const categories = new Set<string>();
  data.forEach(item => {
    if (item.category) categories.add(item.category);
  });
  return Array.from(categories).sort();
}

/**
 * Get unique statuses from projects
 */
export function getUniqueStatuses<T extends { status?: string }>(data: T[]): string[] {
  const statuses = new Set<string>();
  data.forEach(item => {
    if (item.status) statuses.add(item.status);
  });
  return Array.from(statuses).sort();
}

/**
 * Save filters to localStorage
 */
export function saveFilters(key: string, filters: FilterState): void {
  try {
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving filters:', error);
  }
}

/**
 * Load filters from localStorage
 */
export function loadFilters(key: string): FilterState | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading filters:', error);
  }
  return null;
}

/**
 * Get default filter state
 */
export function getDefaultFilters(): FilterState {
  return {
    pics: [],
    statuses: [],
    categories: [],
    dateRange: null,
    searchText: '',
  };
}
