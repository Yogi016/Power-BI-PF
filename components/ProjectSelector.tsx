import React from 'react';
import { Project } from '../types';
import { ChevronDown, Building2 } from 'lucide-react';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  className?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
  className = '',
}) => {
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        Pilih Project
      </label>
      <div className="relative">
        <select
          value={selectedProjectId || ''}
          onChange={(e) => onProjectChange(e.target.value || null)}
          className="
            w-full px-4 py-3 pr-10
            bg-white border-2 border-slate-300 rounded-lg
            text-slate-900 font-medium
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            hover:border-slate-400
            transition-all duration-200
            appearance-none cursor-pointer
            shadow-sm
          "
        >
          <option value="">Semua Project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} - {project.pic}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown size={20} className="text-slate-500" />
        </div>
      </div>
      
      {selectedProject && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Building2 size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900 truncate">
                {selectedProject.name}
              </p>
              {selectedProject.description && (
                <p className="text-xs text-blue-700 mt-1 line-clamp-2">
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
