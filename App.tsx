import React, { useState } from 'react';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { DashboardNew } from './pages/DashboardNew';
import { ManageData } from './pages/ManageData';
import { ManageDataNew } from './pages/ManageDataNew';
import { WeeklyProgressPage } from './pages/WeeklyProgressPage';
import { GanttPage } from './pages/GanttPage';
import { PageView } from './types';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageView>(PageView.DASHBOARD);
  const [useNewDashboard, setUseNewDashboard] = useState(true); // Toggle untuk testing
  const [useNewManageData, setUseNewManageData] = useState(true); // Toggle untuk Manage Data

  return (
    <DataProvider>
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {activePage === PageView.DASHBOARD ? (
          useNewDashboard ? <DashboardNew /> : <Dashboard />
        ) : activePage === PageView.WEEKLY_PROGRESS ? (
          <WeeklyProgressPage />
        ) : activePage === PageView.GANTT ? (
          <GanttPage />
        ) : (
          useNewManageData ? <ManageDataNew /> : <ManageData />
        )}
      </Layout>
    </DataProvider>
  );
};

export default App;