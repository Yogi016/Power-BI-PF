import React, { useState } from 'react';
import { LayoutDashboard, Database, Settings, LogOut, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageView } from '../types';

interface Props {
  activePage: PageView;
  onNavigate: (page: PageView) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<Props> = ({ activePage, onNavigate, children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 transition-all duration-200`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800 justify-between">
          <img
            src="/pf-logo.png"
            alt="PF"
            className={`${collapsed ? 'h-8 w-8 mx-auto' : 'h-8 w-auto'} object-contain`}
            loading="lazy"
          />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => onNavigate(PageView.DASHBOARD)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all duration-200 group ${
              activePage === PageView.DASHBOARD 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
              : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} className={activePage === PageView.DASHBOARD ? 'text-indigo-200' : 'text-slate-400 group-hover:text-white'} />
            <span className={`font-medium ${collapsed ? 'hidden' : 'block'}`}>Dashboard</span>
          </button>

          <button
            onClick={() => onNavigate(PageView.MANAGE_DATA)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all duration-200 group ${
              activePage === PageView.MANAGE_DATA
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
              : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Database size={20} className={activePage === PageView.MANAGE_DATA ? 'text-indigo-200' : 'text-slate-400 group-hover:text-white'} />
            <span className={`font-medium ${collapsed ? 'hidden' : 'block'}`}>Manage Data</span>
          </button>

          <button
            onClick={() => onNavigate(PageView.WEEKLY_PROGRESS)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all duration-200 group ${
              activePage === PageView.WEEKLY_PROGRESS
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
              : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Menu size={20} className={activePage === PageView.WEEKLY_PROGRESS ? 'text-indigo-200' : 'text-slate-400 group-hover:text-white'} />
            <span className={`font-medium ${collapsed ? 'hidden' : 'block'}`}>Weekly Progress</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
           <div className={`p-4 bg-slate-800 rounded-xl mb-4 ${collapsed ? 'hidden' : 'block'}`}>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Project Status</p>
              <div className="flex justify-between items-center text-sm text-white">
                <span>Timeline</span>
                <span className="text-green-400">On Track</span>
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2">
                <div className="bg-green-500 h-1.5 rounded-full w-[70%]"></div>
              </div>
           </div>
           <button className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white w-full">
             <Settings size={18} />
             <span className={`${collapsed ? 'hidden' : 'block'}`}>Settings</span>
           </button>
           <button className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white w-full">
             <LogOut size={18} />
             <span className={`${collapsed ? 'hidden' : 'block'}`}>Logout</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
             <button className="md:hidden text-slate-500"><Menu size={24}/></button>
             <div className="flex items-center gap-3">
               <img src="/pf-logo.png" alt="PF" className="h-8 w-auto object-contain hidden sm:block" loading="lazy" />
               <h2 className="text-sm font-medium text-slate-500">
                  <span className="text-slate-900">Project Fungsi Lingkungan</span>
               </h2>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-bold text-slate-800">Admin User</p>
               <p className="text-xs text-slate-500">Project Manager</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
               AU
             </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50">
           {children}
        </div>
      </main>
    </div>
  );
};
