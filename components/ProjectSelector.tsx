import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Project } from '../types';
import { Building2, Calendar, Check, ChevronDown, MapPin, Search, X } from 'lucide-react';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  yearFilter?: number | null;
  onYearFilterChange?: (year: number | null) => void;
  className?: string;
}

const getProjectYear = (project: Project): number | null => {
  if (!project.startDate) return null;
  const year = new Date(project.startDate).getFullYear();
  return Number.isNaN(year) ? null : year;
};

const formatProjectRange = (project: Project) => {
  const startYear = getProjectYear(project);
  if (!startYear) return 'Tahun belum diisi';

  const endYear = project.endDate ? new Date(project.endDate).getFullYear() : startYear;
  if (Number.isNaN(endYear) || endYear === startYear) return `${startYear}`;
  return `${startYear}-${endYear}`;
};

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
  yearFilter = null,
  onYearFilterChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const availableYears = useMemo(() => {
    const counts = new Map<number, number>();
    projects.forEach((project) => {
      const year = getProjectYear(project);
      if (!year) return;
      counts.set(year, (counts.get(year) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (!yearFilter) return projects;
    return projects.filter((project) => getProjectYear(project) === yearFilter);
  }, [projects, yearFilter]);

  const searchedProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleProjects;

    return visibleProjects.filter((project) => {
      const searchable = [
        project.name,
        project.pic,
        project.category,
        project.location,
        project.description,
        formatProjectRange(project),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [searchQuery, visibleProjects]);

  const groupedProjects = useMemo(() => {
    const groups = new Map<string, Project[]>();

    searchedProjects.forEach((project) => {
      const year = getProjectYear(project);
      const key = year ? String(year) : 'Tanpa Tahun';
      groups.set(key, [...(groups.get(key) || []), project]);
    });

    return Array.from(groups.entries())
      .map(([year, grouped]) => ({
        year,
        projects: grouped.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        if (a.year === 'Tanpa Tahun') return 1;
        if (b.year === 'Tanpa Tahun') return -1;
        return Number(b.year) - Number(a.year);
      });
  }, [searchedProjects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setSearchQuery('');
  }, [yearFilter]);

  const handleProjectSelect = (projectId: string | null) => {
    onProjectChange(projectId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const showYearFilter = availableYears.length > 1 && typeof onYearFilterChange === 'function';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Pilih Project
        </label>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {visibleProjects.length}/{projects.length}
        </span>
      </div>

      {showYearFilter && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onYearFilterChange?.(null)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              yearFilter === null
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Calendar size={15} />
            Semua Tahun
          </button>
          {availableYears.map(({ year, count }) => (
            <button
              key={year}
              type="button"
              onClick={() => onYearFilterChange?.(year)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                yearFilter === year
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {year}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                yearFilter === year ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="
          flex w-full items-center gap-3 rounded-lg border-2 border-slate-300
          bg-white px-4 py-3 text-left shadow-sm transition-all duration-200
          hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
        "
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Building2 size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {selectedProject ? selectedProject.name : 'Semua Project'}
          </span>
          <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
            {selectedProject
              ? `${formatProjectRange(selectedProject)} • ${selectedProject.pic}`
              : `${visibleProjects.length} project tersedia`}
          </span>
        </span>
        <ChevronDown size={20} className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-50 p-3">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari nama, PIC, lokasi..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Bersihkan pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto py-2" role="listbox">
            <button
              type="button"
              onClick={() => handleProjectSelect(null)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50"
              role="option"
              aria-selected={!selectedProjectId}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                !selectedProjectId ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-transparent'
              }`}>
                <Check size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">Semua Project</span>
                <span className="block text-xs text-slate-500">
                  {yearFilter ? `Agregasi ${visibleProjects.length} project tahun ${yearFilter}` : 'Agregasi semua project'}
                </span>
              </span>
            </button>

            {groupedProjects.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-600">Project tidak ditemukan</p>
                <p className="mt-1 text-xs text-slate-400">Coba kata kunci atau tahun lain.</p>
              </div>
            ) : (
              groupedProjects.map((group) => (
                <div key={group.year} className="py-1">
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-2 backdrop-blur">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {group.year === 'Tanpa Tahun' ? 'Tanpa Tahun' : `Tahun ${group.year}`}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {group.projects.length}
                    </span>
                  </div>
                  {group.projects.map((project) => {
                    const isSelected = project.id === selectedProjectId;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleProjectSelect(project.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-transparent'
                        }`}>
                          <Check size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-semibold ${
                            isSelected ? 'text-blue-900' : 'text-slate-900'
                          }`}>
                            {project.name}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span>{project.pic}</span>
                            {project.category && <span>{project.category}</span>}
                            {project.location && (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <MapPin size={12} />
                                <span className="truncate">{project.location}</span>
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {selectedProject && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Building2 size={16} className="mt-0.5 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-blue-900">
                  {selectedProject.name}
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {formatProjectRange(selectedProject)}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-blue-700">
                PIC: {selectedProject.pic}
                {selectedProject.location ? ` • ${selectedProject.location}` : ''}
              </p>
              {selectedProject.description && (
                <p className="mt-1 line-clamp-2 text-xs text-blue-700">
                  {selectedProject.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
