import React, { useState } from 'react';
import {
  LayoutDashboard,
  Database,
  Archive,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Menu,
  X,
  Calendar,
  Briefcase,
  PenTool,
  FileText
} from 'lucide-react';
import { PageView } from '../types';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  activePage: PageView;
  onPageChange: (page: PageView) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activePage, onPageChange, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Derive user display info
  const userEmail = user?.email || '';
  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || userEmail.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

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
            src="/pf-logo.png"
            alt="Pertamina Foundation"
            className={`${collapsed ? 'h-6 w-6 sm:h-8 sm:w-8 mx-auto' : 'h-6 sm:h-8 w-auto'} object-contain transition-all duration-300`}
            loading="lazy"
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

          <button
            onClick={() => {
              onPageChange(PageView.LING_SIGN);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.LING_SIGN
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <PenTool size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.LING_SIGN ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Ling-Sign</span>}
          </button>

          <button
            onClick={() => {
              onPageChange(PageView.DOKUMEN);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.DOKUMEN
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <FileText size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.DOKUMEN ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Dokumen</span>}
          </button>
        </nav>

        <div className="p-3 border-t border-slate-200 shrink-0 space-y-1">
          <button
            onClick={() => {
              onPageChange(PageView.CLOSE_PROJECT);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.CLOSE_PROJECT
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <Archive size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.CLOSE_PROJECT ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span className="font-medium">Close Project</span>}
          </button>
          <button
            onClick={signOut}
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
              <p className="text-sm font-semibold text-slate-900 leading-none mb-1">{userName}</p>
              <p className="text-xs text-slate-500 leading-none">{userEmail}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm ring-2 ring-white shadow-sm">
              {userInitials}
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
            {userInitials}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50/50 pb-24 lg:pb-0">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
          aria-label="Navigasi utama mobile"
        >
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            <div className="grid grid-cols-7 gap-1">
            {[
              { page: PageView.DASHBOARD, icon: <LayoutDashboard className="h-[18px] w-[18px]" />, label: 'Dash', ariaLabel: 'Dashboard' },
              { page: PageView.MANAGE_DATA, icon: <Database className="h-[18px] w-[18px]" />, label: 'Data', ariaLabel: 'Manage Data' },
              { page: PageView.WORK, icon: <Briefcase className="h-[18px] w-[18px]" />, label: 'Work', ariaLabel: 'Work' },
              { page: PageView.GANTT, icon: <BarChart3 className="h-[18px] w-[18px]" />, label: 'Gantt', ariaLabel: 'Gantt Chart' },
              { page: PageView.LING_SIGN, icon: <PenTool className="h-[18px] w-[18px]" />, label: 'Sign', ariaLabel: 'Ling-Sign' },
              { page: PageView.DOKUMEN, icon: <FileText className="h-[18px] w-[18px]" />, label: 'Dok', ariaLabel: 'Dokumen' },
              { page: PageView.CLOSE_PROJECT, icon: <Archive className="h-[18px] w-[18px]" />, label: 'Close', ariaLabel: 'Close Project' },
            ].map(({ page, icon, label, ariaLabel }) => {
              const isActive = activePage === page;

              return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                  aria-label={ariaLabel}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'text-slate-500 active:bg-slate-100'
                  }`}
              >
                  {isActive && (
                    <span className="absolute -top-1 h-1 w-7 rounded-full bg-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.45)]" />
                  )}
                  <span className={`grid h-7 w-7 place-items-center rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm'
                    : 'text-slate-500 group-active:scale-95'
                    }`}>
                    {icon}
                  </span>
                  <span className={`max-w-full truncate text-[9px] font-bold leading-none tracking-normal ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {label}
                  </span>
              </button>
              );
            })}
            </div>
          </div>
        </nav>
      </main>
    </div>
  );
};
