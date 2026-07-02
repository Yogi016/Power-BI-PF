import React from 'react';
import { FolderKanban, ClipboardCheck, AlertTriangle, ListTodo } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { SCurvePanel } from '../../components/dashboard/SCurvePanel';
import { AtRiskList } from '../../components/dashboard/AtRiskList';
import { atRiskProjects } from '../../utils/dashboardMetrics';

export const PhDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Project Head</h1>
        <p className="text-sm text-slate-500">Review substansi program dan evidence.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Proyek ditugaskan" value={projects.length} icon={<FolderKanban size={20} />} />
        <StatTile label="Perlu review" value="—" icon={<ClipboardCheck size={20} />} />
        <StatTile label="Berisiko" value={atRiskProjects(projects).length} icon={<AlertTriangle size={20} />} />
        <StatTile label="Tindak lanjut" value="—" icon={<ListTodo size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="project_head" />
        <SCurvePanel projects={projects} title="Progres proyek ditugaskan" />
      </div>
      <AtRiskList projects={projects} />
    </div>
  );
};
