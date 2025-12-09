import React from 'react';
import { Project } from '../types';
import { Calendar, User, MapPin, FileText } from 'lucide-react';

interface ProjectHeaderProps {
  project: Project;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ project }) => {
  // Format dates
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric',
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Calculate duration
  const calculateDuration = () => {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const months = Math.floor(diffDays / 30);
    
    if (months > 0) {
      return `${months} bulan`;
    } else if (weeks > 0) {
      return `${weeks} minggu`;
    } else {
      return `${diffDays} hari`;
    }
  };

  // Status badge color
  const getStatusColor = () => {
    switch (project.status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'on-hold':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = () => {
    switch (project.status) {
      case 'active': return 'Aktif';
      case 'completed': return 'Selesai';
      case 'on-hold': return 'Ditunda';
      case 'cancelled': return 'Dibatalkan';
      default: return project.status;
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-2xl shadow-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-32 -translate-y-32"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-48 translate-y-48"></div>
      </div>

      <div className="relative p-8">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                {project.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor()}`}>
                {getStatusLabel()}
              </span>
            </div>
            {project.category && (
              <p className="text-blue-100 text-sm font-medium">
                {project.category}
              </p>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* PIC */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">
                  Person In Charge
                </p>
                <p className="text-white text-lg font-bold">
                  {project.pic}
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Calendar size={20} className="text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">
                  Timeline
                </p>
                <p className="text-white text-sm font-semibold">
                  {formatDate(project.startDate)} - {formatDate(project.endDate)}
                </p>
                <p className="text-blue-200 text-xs mt-1">
                  Durasi: {calculateDuration()}
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          {project.location && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MapPin size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">
                    Lokasi
                  </p>
                  <p className="text-white text-sm font-semibold">
                    {project.location}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Budget (if available) */}
          {project.budget && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <FileText size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">
                    Budget
                  </p>
                  <p className="text-white text-sm font-semibold">
                    Rp {(project.budget / 1000000).toFixed(0)}M
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {project.description && (
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wide mb-2">
              Uraian Kegiatan/Program
            </p>
            <p className="text-white text-sm leading-relaxed">
              {project.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
