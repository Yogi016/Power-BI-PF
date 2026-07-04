import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MonthlyData, TaskItem, ProjectData, WeeklyData } from '../types';
import { INITIAL_SCURVE_DATA, INITIAL_TASKS } from '../constants';
import { parseSCurveCSV, weeklyToMonthly } from '../utils/csvParser';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { scopeProjectsForRole } from '../utils/projectScope';

interface DataContextType {
  // Legacy data (untuk backward compatibility)
  sCurveData: MonthlyData[];
  tasks: TaskItem[];
  
  // Data baru dari CSV
  projects: ProjectData[];
  weeklySummary: WeeklyData[];
  selectedPIC: string | null;
  selectedProject: string | null;
  selectedYear: number | null;
  projectFilters: string[];
  selectedProjectFilter: string | null;
  useManualSCurve: boolean;
  
  // Actions
  updateSCurveData: (data: MonthlyData[]) => void;
  updateTasks: (tasks: TaskItem[]) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  setProjects: (projects: ProjectData[]) => void;
  setWeeklySummary: (summary: WeeklyData[]) => void;
  setSelectedPIC: (pic: string | null) => void;
  setSelectedProject: (projectId: string | null) => void;
  setSelectedYear: (year: number | null) => void;
  setSelectedProjectFilter: (filter: string | null) => void;
  addProjectFilter: (name: string) => void;
  setUseManualSCurve: (val: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sCurveData, setSCurveData] = useState<MonthlyData[]>(INITIAL_SCURVE_DATA);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklyData[]>([]);
  const [selectedPIC, setSelectedPIC] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [projectFilters, setProjectFilters] = useState<string[]>([
    'Semua Proyek',
    'Mahakam',
    'Bontang',
    'Blora',
    'Lain - Lain',
  ]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>('Semua Proyek');
  const [useManualSCurve, setUseManualSCurve] = useState<boolean>(false);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);

  const { role, profile } = useAuth();

  // Load CSV data automatically on mount
  useEffect(() => {
    const loadCSVData = async () => {
      // Skip if already loaded
      if (csvLoaded || projects.length > 0) return;
      if (supabase) {
        setCsvLoaded(true);
        return;
      }

      try {
        // Try to load user-provided CSV first, fallback to default
        const sources = ['/data/scurve-user.csv', '/data/scurve-final.csv'];
        let csvText: string | null = null;

        for (const src of sources) {
          try {
            const response = await fetch(src);
            if (response.ok) {
              csvText = await response.text();
              console.log(`✅ CSV data loaded from ${src}`);
              break;
            }
          } catch (err) {
            // Continue to next source
            console.warn(`Unable to load ${src}:`, err);
          }
        }

        if (!csvText) {
          console.log('CSV file not found, using default data');
          return;
        }

        const parsed = parseSCurveCSV(csvText);
        
        // Update projects and weekly summary
        setProjects(parsed.projects);
        setWeeklySummary(parsed.summaryBaseline);
        
        // Convert weekly to monthly for backward compatibility
        const monthlyData = weeklyToMonthly(parsed.summaryBaseline);
        if (monthlyData.length > 0) {
          setSCurveData(monthlyData);
        }
        
        setCsvLoaded(true);
        console.log(`✅ CSV data loaded: ${parsed.projects.length} projects, ${parsed.summaryBaseline.length} weekly data points`);
      } catch (error) {
        console.error('Error loading CSV data:', error);
        // Continue with default data if CSV load fails
      }
    };

    loadCSVData();
  }, [csvLoaded, projects.length]);

  // Load data from Supabase if credentials available
  useEffect(() => {
    if (!supabase || supabaseLoaded) return;

    let cancelled = false;

    const loadSupabase = async () => {
      const signal = AbortSignal.timeout(5_000);
      try {
        // 1. Active projects — flat query against the real `projects` table
        //    (same source Manage Data uses). Prior code queried non-existent
        //    tables (protrack.*, activity_weekly_progress), so the whole load
        //    failed and the dashboard saw zero projects.
        const projectResult = await supabase
          .from('projects')
          .select('id, name, pic, status')
          .neq('status', 'completed')
          .abortSignal(signal);

        if (cancelled) return;
        if (projectResult.error) throw projectResult.error;

        const projectRows = projectResult.data || [];
        const ids = projectRows.map((p: any) => p.id);

        // 2. Bulk monthly S-curve for those projects from s_curve_baseline /
        //    s_curve_actual (the tables Manage Data writes to). These feed
        //    per-project variance → StatusDonut, AtRiskList, ProjectPortfolio.
        let baselineRows: any[] = [];
        let actualRows: any[] = [];
        if (ids.length > 0) {
          const [baseRes, actRes] = await Promise.all([
            supabase
              .from('s_curve_baseline')
              .select('project_id, period_label, period_index, year, cumulative_baseline')
              .eq('period_type', 'monthly')
              .in('project_id', ids)
              .abortSignal(signal),
            supabase
              .from('s_curve_actual')
              .select('project_id, period_label, period_index, year, cumulative_actual')
              .eq('period_type', 'monthly')
              .in('project_id', ids)
              .abortSignal(signal),
          ]);
          if (baseRes.error) throw baseRes.error;
          if (actRes.error) throw actRes.error;
          baselineRows = baseRes.data || [];
          actualRows = actRes.data || [];
        }

        if (cancelled) return;

        // weekIndex is made monotonic across years so `latestPlanned` /
        // `latestProgress` (which sort by weekIndex) pick the true latest point.
        const baselineByProject = new Map<string, WeeklyData[]>();
        baselineRows.forEach((r: any) => {
          const arr = baselineByProject.get(r.project_id) ?? [];
          arr.push({
            week: r.period_label,
            weekIndex: (Number(r.year) || 0) * 1000 + (Number(r.period_index) || 0),
            year: Number(r.year) || 0,
            baseline: Number(r.cumulative_baseline) || 0,
            actual: 0,
          });
          baselineByProject.set(r.project_id, arr);
        });

        const actualByProject = new Map<string, WeeklyData[]>();
        actualRows.forEach((r: any) => {
          const arr = actualByProject.get(r.project_id) ?? [];
          arr.push({
            week: r.period_label,
            weekIndex: (Number(r.year) || 0) * 1000 + (Number(r.period_index) || 0),
            year: Number(r.year) || 0,
            baseline: 0,
            actual: Number(r.cumulative_actual) || 0,
          });
          actualByProject.set(r.project_id, arr);
        });

        const mappedProjects: ProjectData[] = projectRows.map((p: any) => ({
          id: p.id,
          name: p.name,
          pic: p.pic,
          activities: [],
          weeklyBaseline: baselineByProject.get(p.id) ?? [],
          weeklyActual: actualByProject.get(p.id) ?? [],
        }));

        if (cancelled) return;

        setProjects(mappedProjects);
        setSupabaseLoaded(true);
      } catch (err) {
        console.warn('Supabase load failed, fallback to CSV/default:', err);
      }
    };

    loadSupabase();

    return () => { cancelled = true; };
  }, [supabaseLoaded]);


  const updateSCurveData = (data: MonthlyData[]) => {
    setSCurveData(data);
  };

  const updateTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addProjectFilter = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setProjectFilters(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  };

  const visibleProjects = scopeProjectsForRole(
    projects,
    role,
    profile?.assignedProjectIds ?? [],
    supabaseLoaded
  );

  return (
    <DataContext.Provider value={{
      sCurveData,
      tasks,
      projects: visibleProjects,
      weeklySummary,
      selectedPIC,
      selectedProject,
      selectedYear,
      projectFilters,
      selectedProjectFilter,
      useManualSCurve,
      updateSCurveData, 
      updateTasks, 
      updateTask,
      setProjects,
      setWeeklySummary,
      setSelectedPIC,
      setSelectedProject,
      setSelectedYear,
      setSelectedProjectFilter,
      addProjectFilter,
      setUseManualSCurve,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
