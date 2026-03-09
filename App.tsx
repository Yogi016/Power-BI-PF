import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { DashboardNew } from './pages/DashboardNew';
import { ManageData } from './pages/ManageData';
import { ManageDataNew } from './pages/ManageDataNew';
import { GanttPage } from './pages/GanttPage';
import { CalendarPage } from './pages/CalendarPage';
import { WorkPage } from './pages/WorkPage';
import { LingSignPage } from './pages/LingSignPage';
import { DokumenPage } from './pages/DokumenPage';
import { LoginPage } from './pages/LoginPage';
import { PageView } from './types';
import { Loader2 } from 'lucide-react';

const AuthenticatedApp: React.FC = () => {
  const [activePage, setActivePage] = useState<PageView>(PageView.DASHBOARD);
  const [useNewDashboard, setUseNewDashboard] = useState(true);
  const [useNewManageData, setUseNewManageData] = useState(true);
  const [manageDataFocusProjectId, setManageDataFocusProjectId] = useState<string | null>(null);

  const handleOpenManageDataForSCurve = (projectId: string | null) => {
    setManageDataFocusProjectId(projectId);
    setActivePage(PageView.MANAGE_DATA);
  };

  const handleFocusHandled = () => {
    setManageDataFocusProjectId(null);
  };

  return (
    <DataProvider>
      <Layout activePage={activePage} onPageChange={setActivePage}>
        {activePage === PageView.DASHBOARD ? (
          useNewDashboard ? (
            <DashboardNew onOpenManageDataForSCurve={handleOpenManageDataForSCurve} />
          ) : (
            <Dashboard />
          )
        ) : activePage === PageView.GANTT ? (
          <GanttPage />
        ) : activePage === PageView.CALENDAR ? (
          <CalendarPage />
        ) : activePage === PageView.WORK ? (
          <WorkPage />
        ) : activePage === PageView.LING_SIGN ? (
          <LingSignPage />
        ) : activePage === PageView.DOKUMEN ? (
          <DokumenPage />
        ) : (
          useNewManageData ? (
            <ManageDataNew
              focusProjectId={manageDataFocusProjectId}
              onFocusHandled={handleFocusHandled}
            />
          ) : (
            <ManageData />
          )
        )}
      </Layout>
    </DataProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/pf-logo.png" alt="Pertamina Foundation" className="h-10 w-auto object-contain" />
          <Loader2 size={28} className="animate-spin text-blue-600" />
          <p className="text-sm text-slate-400">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
