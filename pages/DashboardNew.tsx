import React from 'react';
import { useAuth } from '../context/AuthContext';
import { StaffDashboard } from './dashboards/StaffDashboard';
import { PhDashboard } from './dashboards/PhDashboard';
import { PmDashboard } from './dashboards/PmDashboard';
import { VpDashboard } from './dashboards/VpDashboard';

// Keeps the prop that App.tsx passes; role dashboards don't need it yet
// but the signature stays stable to avoid touching App.tsx.
interface DashboardNewProps {
  onOpenManageDataForSCurve?: (projectId: string | null) => void;
}

export const DashboardNew: React.FC<DashboardNewProps> = () => {
  const { role } = useAuth();

  let content: React.ReactNode;
  switch (role) {
    case 'vp_lingkungan': content = <VpDashboard />; break;
    case 'project_manager': content = <PmDashboard />; break;
    case 'project_head': content = <PhDashboard />; break;
    case 'staff_officer':
    default: content = <StaffDashboard />; break;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {content}
    </div>
  );
};
