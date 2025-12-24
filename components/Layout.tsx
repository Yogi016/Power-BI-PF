import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  TrendingUp,
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  Menu,
  X,
  Calendar,
  Briefcase
} from 'lucide-react';
import { PageView } from '../types';

interface LayoutProps {
  activePage: PageView;
  onPageChange: (page: PageView) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activePage, onPageChange, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${collapsed ? 'w-20' : 'w-64'} 
        bg-slate-900 text-slate-300 flex flex-col shadow-xl z-50 transition-all duration-200
        fixed lg:relative h-full
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800 justify-between">
          <img
            src="/logo_putih.png"
            alt="Logo"
            className={`${collapsed ? 'h-6 w-6 sm:h-8 sm:w-8 mx-auto' : 'h-6 sm:h-8 w-auto'} object-contain`}
            loading="lazy"
          />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hidden lg:block"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            onClick={closeMobileMenu}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => {
              onPageChange(PageView.DASHBOARD);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activePage === PageView.DASHBOARD
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <LayoutDashboard size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Dashboard</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.MANAGE_DATA);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activePage === PageView.MANAGE_DATA
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Database size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Manage Data</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.WEEKLY_PROGRESS);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activePage === PageView.WEEKLY_PROGRESS
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <TrendingUp size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Weekly Progress</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.GANTT);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activePage === PageView.GANTT
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <BarChart3 size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Gantt Chart</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.CALENDAR);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activePage === PageView.CALENDAR
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Calendar size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Calendar</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.WORK);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activePage === PageView.WORK
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Briefcase size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Work</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Settings size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Settings</span>}
          </button>
          <button
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:ml-0">
        {/* Desktop Header */}
        <header className="hidden lg:flex bg-white border-b border-slate-200 px-6 py-4 items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <img
              src="/pf-logo.png"
              alt="Pertamina"
              className="h-10 w-auto object-contain"
              loading="lazy"
            />
            <div>
              <h1 className="text-lg font-bold text-slate-800">Project Fungsi Lingkungan</h1>
              <p className="text-xs text-slate-500">Project Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">Admin User</p>
              <p className="text-xs text-slate-500">Project Manager</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-700 font-bold">
              AU
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 active:bg-slate-200"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <img
            src="/logo_putih.png"
            alt="Logo"
            className="h-8 w-auto object-contain"
            loading="lazy"
          />
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
