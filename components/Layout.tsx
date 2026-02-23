import React, { useState } from 'react';
import {
  LayoutDashboard,
  Database,
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${collapsed ? 'w-20' : 'w-64'} 
        bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300 ease-in-out
        fixed lg:relative h-full shadow-sm
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center gap-3 border-b border-slate-200 px-4 justify-between shrink-0">
          <img
            src="/logo.png"
            alt="Logo"
            className={`${collapsed ? 'h-6 w-6 sm:h-8 sm:w-8 mx-auto' : 'h-6 sm:h-8 w-auto'} object-contain transition-all duration-300`}
            loading="lazy"
            onError={(e) => {
              // Fallback if logo.png doesn't exist (assuming previous logo_putih was for dark theme)
              e.currentTarget.src = "/logo_putih.png";
              e.currentTarget.classList.add("brightness-0", "invert-0"); // Make it dark if it was white
            }}
          />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hidden lg:block transition-colors"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            onClick={closeMobileMenu}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 lg:hidden transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => {
              onPageChange(PageView.DASHBOARD);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.DASHBOARD
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <LayoutDashboard size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.DASHBOARD ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.MANAGE_DATA);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.MANAGE_DATA
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <Database size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.MANAGE_DATA ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Manage Data</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.WORK);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.WORK
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <Briefcase size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.WORK ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Work</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.GANTT);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.GANTT
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <BarChart3 size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.GANTT ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Gantt Chart</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.CALENDAR);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.CALENDAR
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <Calendar size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.CALENDAR ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Calendar</span>}
          </button>
        </nav>

        <div className="p-3 border-t border-slate-200 shrink-0 space-y-1">
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors group ${collapsed ? 'justify-center' : ''
              }`}
          >
            <Settings size={20} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors" />
            {!collapsed && <span className="font-medium">Settings</span>}
          </button>
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors group ${collapsed ? 'justify-center' : ''
              }`}
          >
            <LogOut size={20} className="flex-shrink-0 text-slate-400 group-hover:text-red-600 transition-colors" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:ml-0">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 px-6 items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <img
              src="/pf-logo.png"
              alt="Pertamina Foundation"
              className="h-8 w-auto object-contain"
              loading="lazy"
            />
            <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">Project Fungsi Lingkungan</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 leading-none mb-1">Admin User</p>
              <p className="text-xs text-slate-500 leading-none">Project Manager</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm ring-2 ring-white shadow-sm">
              AU
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0">
          <img
            src="/pf-logo.png"
            alt="Logo"
            className="h-7 w-auto object-contain"
            loading="lazy"
          />
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs ring-2 ring-white shadow-sm">
            AU
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50/50 pb-16 lg:pb-0">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around h-14">
            {[
              { page: PageView.DASHBOARD, icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
              { page: PageView.MANAGE_DATA, icon: <Database size={20} />, label: 'Data' },
              { page: PageView.WORK, icon: <Briefcase size={20} />, label: 'Work' },
              { page: PageView.GANTT, icon: <BarChart3 size={20} />, label: 'Gantt' },
              { page: PageView.CALENDAR, icon: <Calendar size={20} />, label: 'Calendar' },
            ].map(({ page, icon, label }) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${activePage === page
                  ? 'text-emerald-600'
                  : 'text-slate-400 active:text-slate-600'
                  }`}
              >
                {icon}
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
};
