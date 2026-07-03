import React from 'react';
import { FolderKanban, FileEdit, CalendarClock, Upload } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { SCurvePanel } from '../../components/dashboard/SCurvePanel';
import { ProjectPortfolio } from '../../components/dashboard/ProjectPortfolio';

export const StaffDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Staff Officer</h1>
        <p className="text-sm text-slate-500">Draft, upload versi, dan kelengkapan metadata.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Proyek saya" value={projects.length} icon={<FolderKanban size={20} />} />
        <StatTile label="Perlu draft/upload" value="—" icon={<FileEdit size={20} />} />
        <StatTile label="Evidence perlu update" value="—" icon={<Upload size={20} />} />
        <StatTile label="Deadline terdekat" value="—" icon={<CalendarClock size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="staff_officer" />
        <SCurvePanel projectIds={projects.map((p) => p.id)} title="Progres proyek saya" />
      </div>
      <ProjectPortfolio projects={projects} />
    </div>
  );
};
