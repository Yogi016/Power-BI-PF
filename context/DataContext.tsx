import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MonthlyData, TaskItem, ProjectData, WeeklyData } from '../types';
import { INITIAL_SCURVE_DATA, INITIAL_TASKS } from '../constants';
import { parseSCurveCSV, weeklyToMonthly } from '../utils/csvParser';
import { supabase } from '../lib/supabaseClient';

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

  // Load CSV data automatically on mount
  useEffect(() => {
    const loadCSVData = async () => {
      // Skip if already loaded
      if (csvLoaded || projects.length > 0) return;

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

    const loadSupabase = async () => {
      try {
        // fetch projects with activities and weekly progress
        const { data: projectData, error: projError } = await supabase
          .from('protrack.projects')
          .select(`
            id, name, pic,
            activities:activities (
              id,
              category,
              sub_category,
              activity,
              start_week,
              end_week,
              weeklyProgress:activity_weekly_progress (week_index, week_label, year, value)
            )
          `);
        if (projError) throw projError;

        const mappedProjects: ProjectData[] = (projectData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          pic: p.pic,
          activities: (p.activities || []).map((a: any) => {
            const weeklyProgress: Record<string, number> = {};
            (a.weeklyProgress || []).forEach((wp: any) => {
              weeklyProgress[wp.week_label] = Number(wp.value) || 0;
            });
            return {
              pic: p.pic,
              project: p.name,
              category: a.category || undefined,
              subCategory: a.sub_category || undefined,
              activity: a.activity,
              weeklyProgress,
              startWeek: a.start_week ?? undefined,
              endWeek: a.end_week ?? undefined,
            };
          }),
          weeklyBaseline: [],
          weeklyActual: [],
        }));

        const { data: summaryData, error: summaryError } = await supabase
          .from('protrack.weekly_summary')
          .select('week_index, week_label, year, baseline, actual')
          .order('week_index', { ascending: true });
        if (summaryError) throw summaryError;

        const mappedSummary: WeeklyData[] = (summaryData || []).map((row: any) => ({
          week: row.week_label,
          weekIndex: row.week_index,
          year: row.year,
          baseline: Number(row.baseline) || 0,
          actual: Number(row.actual) || 0,
        }));

        const { data: tasksData, error: tasksError } = await supabase
          .from('protrack.tasks')
          .select('*');
        if (tasksError) throw tasksError;

        const mappedTasks: TaskItem[] = (tasksData || []).map((t: any) => ({
          id: t.id,
          code: t.code,
          activity: t.activity,
          pic: t.pic,
          weight: Number(t.weight) || 0,
          progress: Number(t.progress) || 0,
          status: t.status,
          startDate: t.start_date || new Date().toISOString(),
          endDate: t.end_date || new Date().toISOString(),
          projectId: t.project_id || undefined,
          startYear: t.start_year || undefined,
          startMonth: t.start_month || undefined,
          startWeek: t.start_week || undefined,
        }));

        setProjects(mappedProjects);
        if (mappedSummary.length > 0) {
          setWeeklySummary(mappedSummary);
          const monthlyData = weeklyToMonthly(mappedSummary);
          if (monthlyData.length > 0) {
            setSCurveData(monthlyData);
          }
        }
        if (mappedTasks.length > 0) {
          setTasks(mappedTasks);
        }
        setSupabaseLoaded(true);
      } catch (err) {
        console.warn('Supabase load failed, fallback to CSV/default:', err);
      }
    };

    loadSupabase();
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

  return (
    <DataContext.Provider value={{ 
      sCurveData, 
      tasks, 
      projects,
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
