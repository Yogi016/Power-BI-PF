import React, { useState, useEffect } from 'react';
import { FilterState, getUniquePICs, getUniqueCategories, getUniqueStatuses } from '../lib/filterUtils';
import { X, Search, Filter as FilterIcon } from 'lucide-react';
import { Project } from '../types';

interface FilterPanelProps {
  projects: Project[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  projects,
  filters,
  onFiltersChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const uniquePICs = getUniquePICs(projects);
  const uniqueCategories = getUniqueCategories(projects);
  const uniqueStatuses = getUniqueStatuses(projects);

  const handlePICToggle = (pic: string) => {
    const newPICs = filters.pics.includes(pic)
      ? filters.pics.filter(p => p !== pic)
      : [...filters.pics, pic];
    onFiltersChange({ ...filters, pics: newPICs });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleSearchChange = (text: string) => {
    onFiltersChange({ ...filters, searchText: text });
  };

  const handleClearAll = () => {
    onFiltersChange({
      pics: [],
      statuses: [],
      categories: [],
      dateRange: null,
      searchText: '',
    });
  };

  const activeFilterCount = 
    filters.pics.length + 
    filters.statuses.length + 
    filters.categories.length + 
    (filters.searchText ? 1 : 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FilterIcon size={20} className="text-slate-600" />
          <h3 className="font-bold text-slate-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* PIC Filter */}
          {uniquePICs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                PIC
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {uniquePICs.map(pic => (
                  <label key={pic} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={filters.pics.includes(pic)}
                      onChange={() => handlePICToggle(pic)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{pic}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status Filter */}
          {uniqueStatuses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <div className="space-y-1">
                {uniqueStatuses.map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(status)}
                      onChange={() => handleStatusToggle(status)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter */}
          {uniqueCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <div className="space-y-1">
                {uniqueCategories.map(category => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Active Filters */}
          {activeFilterCount > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Active Filters</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.pics.map(pic => (
                  <span
                    key={pic}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded"
                  >
                    {pic}
                    <button onClick={() => handlePICToggle(pic)} className="hover:text-blue-900">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {filters.statuses.map(status => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded capitalize"
                  >
                    {status}
                    <button onClick={() => handleStatusToggle(status)} className="hover:text-green-900">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {filters.categories.map(category => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded"
                  >
                    {category}
                    <button onClick={() => handleCategoryToggle(category)} className="hover:text-purple-900">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
