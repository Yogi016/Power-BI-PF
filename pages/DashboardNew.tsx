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
  switch (role) {
    case 'vp_lingkungan': return <VpDashboard />;
    case 'project_manager': return <PmDashboard />;
    case 'project_head': return <PhDashboard />;
    case 'staff_officer':
    default: return <StaffDashboard />;
  }
};
