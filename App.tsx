import React, { useState } from 'react';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ManageData } from './pages/ManageData';
import { PageView } from './types';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageView>(PageView.DASHBOARD);

  return (
    <DataProvider>
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {activePage === PageView.DASHBOARD ? <Dashboard /> : <ManageData />}
      </Layout>
    </DataProvider>
  );
};

export default App;