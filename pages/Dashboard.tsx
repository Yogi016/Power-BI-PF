import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { SCurveChart } from '../components/SCurveChart';
import { PICDonutChart } from '../components/PICDonutChart';
import { StatCard } from '../components/StatCard';
import { Activity, BarChart3, TrendingUp, AlertCircle, CheckCircle2, Filter } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { 
    sCurveData, 
    tasks, 
    projects, 
    weeklySummary,
    selectedPIC,
    selectedProject,
    setSelectedPIC,
    setSelectedProject,
  } = useData();

  // Get unique PICs from projects
  const availablePICs = useMemo(() => {
    const pics = new Set<string>();
    projects.forEach(p => pics.add(p.pic));
    return Array.from(pics).sort();
  }, [projects]);

  // Filter projects based on selection
  const filteredProjects = useMemo(() => {
    if (!selectedPIC && !selectedProject) return projects;
    return projects.filter(p => {
      if (selectedPIC && p.pic !== selectedPIC) return false;
      if (selectedProject && p.id !== selectedProject) return false;
      return true;
    });
  }, [projects, selectedPIC, selectedProject]);

  // Get projects for selected PIC
  const projectsForPIC = useMemo(() => {
    if (!selectedPIC) return [];
    return projects.filter(p => p.pic === selectedPIC);
  }, [projects, selectedPIC]);

  // Calculate metrics from CSV data or fallback to legacy data
  const displayWeeklyData = weeklySummary.length > 0;
  const currentData = displayWeeklyData 
    ? weeklySummary[weeklySummary.length - 1]
    : null;
  
  const planVsActual = currentData 
    ? (currentData.actual - currentData.baseline).toFixed(1)
    : sCurveData.length > 0 
      ? (sCurveData[sCurveData.length - 1].actual - sCurveData[sCurveData.length - 1].plan).toFixed(1)
      : '0';
  
  const totalActivities = projects.reduce((sum, p) => sum + p.activities.length, 0) || tasks.length;
  const totalProjects = projects.length || 1;
  
  // Calculate overall progress from weekly data or tasks
  const overallProgress = currentData 
    ? currentData.actual.toFixed(1)
    : tasks.length > 0
      ? (tasks.reduce((acc, curr) => acc + (curr.progress * (curr.weight / 100)), 0)).toFixed(1)
      : '0';

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Project Overview</h1>
            <p className="text-slate-500">Real-time insights into project performance and progress.</p>
          </div>
          
          {/* Filters */}
          {(projects.length > 0 || availablePICs.length > 0) && (
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-slate-500" />
              <select
                value={selectedPIC || ''}
                onChange={(e) => {
                  setSelectedPIC(e.target.value || null);
                  setSelectedProject(null); // Reset project when PIC changes
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="">All PIC</option>
                {availablePICs.map(pic => (
                  <option key={pic} value={pic}>{pic}</option>
                ))}
              </select>
              
              {selectedPIC && projectsForPIC.length > 0 && (
                <select
                  value={selectedProject || ''}
                  onChange={(e) => setSelectedProject(e.target.value || null)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">All Projects</option>
                  {projectsForPIC.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Overall Progress" 
          value={`${overallProgress}%`} 
          trend={Number(planVsActual)}
          trendLabel="vs Plan"
          icon={<Activity size={24} />}
        />
        <StatCard 
          title="Planned Progress (YTD)" 
          value={`${currentData?.baseline.toFixed(1) || sCurveData[sCurveData.length - 1]?.plan || 0}%`}
          subtext={displayWeeklyData ? `Baseline Week ${currentData?.week || ''}` : `Target for ${sCurveData[sCurveData.length - 1]?.month || ''}`}
          icon={<TrendingUp size={24} />}
        />
        <StatCard 
          title={displayWeeklyData ? "Total Projects" : "Completed Activities"} 
          value={displayWeeklyData ? totalProjects : `${tasks.filter(t => t.status === 'Completed').length}/${tasks.length}`}
          subtext={displayWeeklyData ? `${filteredProjects.length} filtered` : "Milestones achieved"}
          icon={<CheckCircle2 size={24} />}
        />
        <StatCard 
          title={displayWeeklyData ? "Total Activities" : "Critical Issues"} 
          value={displayWeeklyData ? totalActivities : tasks.filter(t => t.status === 'Delayed').length}
          trend={displayWeeklyData ? undefined : -tasks.filter(t => t.status === 'Delayed').length}
          trendLabel={displayWeeklyData ? undefined : "Delayed Tasks"}
          icon={<AlertCircle size={24} />}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* S-Curve - Takes up 2/3 width */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Progress S-Curve</h3>
            <div className="flex gap-2">
               <span className="px-3 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full border border-orange-100">Baseline</span>
               <span className="px-3 py-1 bg-sky-50 text-sky-600 text-xs font-medium rounded-full border border-sky-100">Actual</span>
            </div>
          </div>
          <SCurveChart 
            data={displayWeeklyData ? undefined : sCurveData} 
            weeklyData={displayWeeklyData ? weeklySummary : undefined}
            showWeekly={displayWeeklyData}
          />
        </div>

        {/* PIC Distribution - Takes up 1/3 width */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Resource Allocation</h3>
          <p className="text-sm text-slate-500 mb-4">Task distribution by Person In Charge (PIC)</p>
          <div className="flex-grow flex items-center justify-center">
            <PICDonutChart tasks={tasks} />
          </div>
        </div>
      </div>

      {/* Detailed Task Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Activity Breakdown</h3>
          <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1">
             View Full Schedule <BarChart3 size={16}/>
          </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 font-semibold">Code</th>
                <th className="px-6 py-3 font-semibold">Activity</th>
                <th className="px-6 py-3 font-semibold">PIC</th>
                <th className="px-6 py-3 font-semibold">Timeline</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayWeeklyData && filteredProjects.length > 0 ? (
                // Show activities from CSV projects
                filteredProjects.flatMap(project => 
                  project.activities.map((activity, idx) => {
                    const weekKeys = Object.keys(activity.weeklyProgress);
                    const totalProgress = weekKeys.reduce((sum, key) => sum + activity.weeklyProgress[key], 0);
                    const progressPercent = weekKeys.length > 0 ? Math.min(100, (totalProgress / weekKeys.length) * 100) : 0;
                    
                    return (
                      <tr key={`${project.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {activity.category || activity.subCategory || '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{activity.activity}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            {activity.pic}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                          {activity.startWeek !== undefined && activity.endWeek !== undefined
                            ? `Week ${activity.startWeek + 1} - ${activity.endWeek + 1}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            progressPercent === 100 ? 'bg-green-50 text-green-700 border-green-200' :
                            progressPercent > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {progressPercent === 100 ? 'Completed' : progressPercent > 0 ? 'In Progress' : 'Not Started'}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-[200px]">
                          <div className="flex items-center justify-end gap-3">
                            <span className="font-medium text-slate-700">{progressPercent.toFixed(0)}%</span>
                            <div className="w-24 bg-slate-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  progressPercent === 100 ? 'bg-green-500' : 
                                  progressPercent < 30 ? 'bg-red-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                // Fallback to legacy tasks
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{task.code}</td>
                    <td className="px-6 py-4 text-slate-700">{task.activity}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {task.pic}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(task.startDate).toLocaleDateString('id-ID', { month: 'short' })} - {new Date(task.endDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        task.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                        task.status === 'Delayed' ? 'bg-red-50 text-red-700 border-red-200' :
                        task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      <div className="flex items-center justify-end gap-3">
                        <span className="font-medium text-slate-700">{task.progress}%</span>
                        <div className="w-24 bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              task.progress === 100 ? 'bg-green-500' : 
                              task.progress < 30 ? 'bg-red-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};