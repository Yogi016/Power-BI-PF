import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MonthlyData, TaskItem, ProjectData, WeeklyData } from '../types';
import { INITIAL_SCURVE_DATA, INITIAL_TASKS } from '../constants';
import { parseSCurveCSV, weeklyToMonthly } from '../utils/csvParser';

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
  const [csvLoaded, setCsvLoaded] = useState(false);

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
