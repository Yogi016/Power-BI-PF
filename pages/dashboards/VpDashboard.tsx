import React from 'react';
import { Briefcase, Stamp, AlertTriangle, Clock } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { SCurvePanel } from '../../components/dashboard/SCurvePanel';
import { StatusDonut } from '../../components/dashboard/StatusDonut';
import { atRiskProjects } from '../../utils/dashboardMetrics';
import { useCooperationDocuments } from '../../hooks/useCooperationDocuments';
import { buildRoleDocumentInbox } from '../../lib/cooperationWorkflow';

export const VpDashboard: React.FC = () => {
  const { projects } = useData();
  const { documents } = useCooperationDocuments();
  const awaitingApproval = buildRoleDocumentInbox(documents, 'vp_lingkungan').length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard VP Lingkungan</h1>
        <p className="text-sm text-slate-500">Executive approval dan pemantauan risiko lintas portfolio.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total proyek" value={projects.length} icon={<Briefcase size={20} />} />
        <StatTile label="Menunggu approval" value={awaitingApproval} icon={<Stamp size={20} />} />
        <StatTile label="Portfolio berisiko" value={atRiskProjects(projects).length} icon={<AlertTriangle size={20} />} />
        <StatTile label="Terlambat" value="—" icon={<Clock size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="vp_lingkungan" />
        <StatusDonut projects={projects} />
      </div>
      <SCurvePanel title="Kurva-S portfolio" />
    </div>
  );
};
