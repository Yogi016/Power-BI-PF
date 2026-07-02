import React from 'react';
import { FolderKanban, ShieldCheck, GitPullRequestArrow, FileCheck } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { AtRiskList } from '../../components/dashboard/AtRiskList';
import { ProjectTable } from '../../components/dashboard/ProjectTable';
import { atRiskProjects } from '../../utils/dashboardMetrics';

export const PmDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Project Manager</h1>
        <p className="text-sm text-slate-500">Validasi portfolio dan bottleneck dokumen.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total proyek" value={projects.length} icon={<FolderKanban size={20} />} />
        <StatTile label="Perlu validasi" value="—" icon={<ShieldCheck size={20} />} />
        <StatTile label="Bottleneck" value={atRiskProjects(projects).length} icon={<GitPullRequestArrow size={20} />} />
        <StatTile label="Kelengkapan dok." value="—" icon={<FileCheck size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="project_manager" />
        <AtRiskList projects={projects} />
      </div>
      <ProjectTable projects={projects} />
    </div>
  );
};
