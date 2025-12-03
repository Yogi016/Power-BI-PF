import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MonthlyData, TaskItem } from '../types';
import { INITIAL_SCURVE_DATA, INITIAL_TASKS } from '../constants';

interface DataContextType {
  sCurveData: MonthlyData[];
  tasks: TaskItem[];
  updateSCurveData: (data: MonthlyData[]) => void;
  updateTasks: (tasks: TaskItem[]) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sCurveData, setSCurveData] = useState<MonthlyData[]>(INITIAL_SCURVE_DATA);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);

  const updateSCurveData = (data: MonthlyData[]) => {
    setSCurveData(data);
  };

  const updateTasks = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  return (
    <DataContext.Provider value={{ sCurveData, tasks, updateSCurveData, updateTasks, updateTask }}>
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