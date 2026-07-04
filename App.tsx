import React, { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { PageView } from './types';
import { Loader2 } from 'lucide-react';

// Temporarily hide the Danta.AI launcher while the Coordination hub takes its
// slot. Code is kept intact — flip this back to `true` to re-enable Danta.AI.
const SHOW_DANTA_AI = false;

const AIChatbot = lazy(() => import('./components/AIChatbot').then((module) => ({ default: module.AIChatbot })));
const CoordinationBubble = lazy(() => import('./components/coordination/CoordinationBubble').then((module) => ({ default: module.CoordinationBubble })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const DashboardNew = lazy(() => import('./pages/DashboardNew').then((module) => ({ default: module.DashboardNew })));
const ManageData = lazy(() => import('./pages/ManageData').then((module) => ({ default: module.ManageData })));
const ManageDataNew = lazy(() => import('./pages/ManageDataNew').then((module) => ({ default: module.ManageDataNew })));
const GanttPage = lazy(() => import('./pages/GanttPage').then((module) => ({ default: module.GanttPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const WorkPage = lazy(() => import('./pages/WorkPage').then((module) => ({ default: module.WorkPage })));
const LingSignPage = lazy(() => import('./pages/LingSignPage').then((module) => ({ default: module.LingSignPage })));
const DokumenPage = lazy(() => import('./pages/DokumenPage').then((module) => ({ default: module.DokumenPage })));
const CooperationDocumentsPage = lazy(() => import('./pages/CooperationDocumentsPage').then((module) => ({ default: module.CooperationDocumentsPage })));
const AssetPage = lazy(() => import('./pages/AssetPage').then((module) => ({ default: module.AssetPage })));
const CloseProjectPage = lazy(() => import('./pages/CloseProjectPage').then((module) => ({ default: module.CloseProjectPage })));

const PageLoadingFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-[#0066cc]" />
      <p className="text-sm font-medium text-slate-500">Memuat halaman...</p>
    </div>
  </div>
);

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
        <Suspense fallback={<PageLoadingFallback />}>
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
          ) : activePage === PageView.COOPERATION_DOCUMENTS ? (
            <CooperationDocumentsPage />
          ) : activePage === PageView.ASSET ? (
            <AssetPage />
          ) : activePage === PageView.CLOSE_PROJECT ? (
            <CloseProjectPage />
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
        </Suspense>
      </Layout>
      {SHOW_DANTA_AI && (
        <Suspense fallback={null}>
          <AIChatbot />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <CoordinationBubble />
      </Suspense>
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
