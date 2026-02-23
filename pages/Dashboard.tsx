import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { SCurveChart } from '../components/SCurveChart';
import { PICDonutChart } from '../components/PICDonutChart';
import { StatCard } from '../components/StatCard';
import { WeeklySummaryTable } from '../components/WeeklySummaryTable';
import { WeeklyTimeline } from '../components/WeeklyTimeline';
import { Activity, BarChart3, TrendingUp, AlertCircle, CheckCircle2, Filter } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    sCurveData,
    tasks,
    projects,
    weeklySummary,
    selectedPIC,
    selectedProject,
    selectedYear,
    selectedProjectFilter,
    projectFilters,
    useManualSCurve,
    setSelectedPIC,
    setSelectedProject,
    setSelectedYear,
    setSelectedProjectFilter,
  } = useData();
  const [weeklyMode, setWeeklyMode] = useState<'weekly' | 'monthly'>('monthly');

  // Get unique PICs from projects
  const availablePICs = useMemo(() => {
    const pics = new Set<string>();
    projects.forEach(p => pics.add(p.pic));
    return Array.from(pics).sort();
  }, [projects]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    weeklySummary.forEach(w => years.add(w.year));
    return Array.from(years).sort();
  }, [weeklySummary]);

  const allProjectsList = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);
  const projectSelectOptions = useMemo(() => {
    if (allProjectsList.length > 0) {
      return allProjectsList.map(p => ({ value: p.id, label: p.name }));
    }
    // fallback to user-added filters when no project data
    return projectFilters.map(name => ({ value: name, label: name }));
  }, [allProjectsList, projectFilters]);
  const hasProjectOptions = projectSelectOptions.length > 0;

  const projectMatchesFilter = (name: string) => {
    if (!selectedProjectFilter || selectedProjectFilter === 'Semua Proyek') return true;
    if (selectedProjectFilter === 'Lain - Lain') {
      return !['mahakam', 'bontang', 'blora'].some(keyword =>
        name.toLowerCase().includes(keyword)
      );
    }
    return name.toLowerCase().includes(selectedProjectFilter.toLowerCase());
  };

  // Filter projects based on selection
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedPIC && p.pic !== selectedPIC) return false;
      if (selectedProject && p.id !== selectedProject) return false;
      if (!projectMatchesFilter(p.name)) return false;
      return true;
    });
  }, [projects, selectedPIC, selectedProject, selectedProjectFilter]);

  const activeProjectLabel = useMemo(() => {
    if (selectedProject) {
      const proj = projects.find(p => p.id === selectedProject);
      return proj ? proj.name : 'Proyek dipilih';
    }
    if (selectedProjectFilter && selectedProjectFilter !== 'Semua Proyek') {
      return `Filter: ${selectedProjectFilter}`;
    }
    return 'Semua Proyek';
  }, [selectedProject, selectedProjectFilter, projects]);

  // Get projects for selected PIC
  const projectsForPIC = useMemo(() => {
    if (!selectedPIC) return [];
    return projects.filter(p => p.pic === selectedPIC);
  }, [projects, selectedPIC]);

  // Filter weekly data by year (if selected)
  const filteredWeeks = useMemo(() => {
    if (!selectedYear) return weeklySummary;
    return weeklySummary.filter(w => w.year === selectedYear);
  }, [weeklySummary, selectedYear]);

  // Apply project filter to weekly data for charts (actuals aggregated from filtered projects)
  const filteredWeeksWithProjects = useMemo(() => {
    if (filteredProjects.length === 0 || filteredWeeks.length === 0) return filteredWeeks;

    const actualMap = new Map<string, number>();
    filteredProjects.forEach(project => {
      project.activities.forEach(activity => {
        Object.entries(activity.weeklyProgress).forEach(([weekLabel, value]) => {
          actualMap.set(weekLabel, (actualMap.get(weekLabel) || 0) + value);
        });
      });
    });

    return filteredWeeks.map(week => ({
      ...week,
      actual: actualMap.get(week.week) ?? 0,
    }));
  }, [filteredWeeks, filteredProjects]);

  // Calculate metrics from CSV data or fallback to legacy data
  const weeklyDataAvailable = filteredWeeksWithProjects.length > 0 && !useManualSCurve;
  const displayWeeklyData = weeklyMode === 'weekly' && weeklyDataAvailable;
  const currentData = displayWeeklyData
    ? filteredWeeksWithProjects[filteredWeeksWithProjects.length - 1]
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
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-6">

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Project Overview</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Real-time insights into project performance and progress.</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="col-span-2 flex items-center gap-2 text-sm text-slate-500 font-medium">
            <Filter size={16} /> Filters:
          </div>

          <select
            value={selectedProject || ''}
            onChange={(e) => setSelectedProject(e.target.value || null)}
            className="flex h-9 w-full sm:w-[180px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.5rem_center] bg-no-repeat cursor-pointer col-span-2"
            disabled={!hasProjectOptions}
          >
            <option value="">{hasProjectOptions ? 'All Projects' : 'No project data'}</option>
            {allProjectsList.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.pic})
              </option>
            ))}
          </select>

          {projectFilters.length > 0 && (
            <select
              value={selectedProjectFilter || 'Semua Proyek'}
              onChange={(e) => setSelectedProjectFilter(e.target.value || null)}
              className="flex h-9 w-full sm:w-[140px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.5rem_center] bg-no-repeat cursor-pointer"
            >
              <option value="Semua Proyek">Semua Area</option>
              {projectFilters.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          <select
            value={selectedPIC || ''}
            onChange={(e) => {
              setSelectedPIC(e.target.value || null);
              setSelectedProject(null); // Reset project when PIC changes
            }}
            className="flex h-9 w-full sm:w-[120px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.5rem_center] bg-no-repeat cursor-pointer"
          >
            <option value="">All PIC</option>
            {availablePICs.map(pic => (
              <option key={pic} value={pic}>{pic}</option>
            ))}
          </select>

          {availableYears.length > 0 && (
            <select
              value={selectedYear ?? ''}
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
              className="flex h-9 w-full sm:w-[110px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em] bg-[right_0.5rem_center] bg-no-repeat cursor-pointer"
            >
              <option value="">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 animate-in slide-in-from-bottom-4 duration-500">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in slide-in-from-bottom-4 duration-700">
        {/* S-Curve - Takes up 2/3 width */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm flex flex-col">
          <div className="flex flex-col space-y-1.5 p-6 pb-0">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
              <div className="space-y-1.5">
                <h3 className="font-semibold leading-none tracking-tight">Progress S-Curve</h3>
                <p className="text-sm text-slate-500">Menampilkan {activeProjectLabel} ({filteredProjects.length || projects.length} proyek) • Tahun: {selectedYear ?? 'Semua'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-md border border-slate-200 p-1 text-slate-500 bg-slate-100/50">
                  <button
                    onClick={() => setWeeklyMode('monthly')}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${weeklyMode === 'monthly' ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => weeklyDataAvailable ? setWeeklyMode('weekly') : null}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${weeklyMode === 'weekly' ? 'bg-white text-slate-950 shadow-sm' : weeklyDataAvailable ? 'hover:bg-slate-100 hover:text-slate-900' : 'opacity-50 cursor-not-allowed'}`}
                    disabled={!weeklyDataAvailable}
                  >
                    Mingguan
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 px-2.5 py-0.5 text-xs font-semibold bg-orange-50 text-orange-700">Baseline</span>
              <span className="inline-flex items-center rounded-full border border-sky-200 px-2.5 py-0.5 text-xs font-semibold bg-sky-50 text-sky-700">Actual</span>
            </div>
          </div>
          <div className="p-6 pt-0 flex-1">
            <SCurveChart
              data={displayWeeklyData ? undefined : sCurveData}
              weeklyData={displayWeeklyData ? filteredWeeksWithProjects : undefined}
              showWeekly={displayWeeklyData}
              yearLabel={selectedYear ? selectedYear.toString() : 'Semua Tahun'}
            />
          </div>
        </div>

        {/* PIC Distribution - Takes up 1/3 width */}
        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm flex flex-col">
          <div className="flex flex-col space-y-1.5 p-6 pb-2">
            <h3 className="font-semibold leading-none tracking-tight">Resource Allocation</h3>
            <p className="text-sm text-slate-500">Task distribution by PIC untuk {activeProjectLabel.toLowerCase()}</p>
          </div>
          <div className="p-6 pt-0 flex-1 flex items-center justify-center">
            <PICDonutChart tasks={tasks} />
          </div>
        </div>
      </div>

      {/* Power BI style weekly snapshot & timeline */}
      {displayWeeklyData && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Proyek Aktif</p>
              <p className="text-sm font-medium text-slate-900">{activeProjectLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end max-w-[70%]">
              {filteredProjects.map(p => (
                <span key={p.id} className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold transition-colors bg-slate-50 text-slate-900">
                  {p.name}
                </span>
              ))}
              {filteredProjects.length === 0 && (
                <span className="text-xs text-slate-400 italic">Tidak ada proyek sesuai filter</span>
              )}
            </div>
          </div>
          <div id="weekly-timeline">
            <WeeklySummaryTable weeklySummary={filteredWeeksWithProjects} />
            {filteredProjects.length > 0 && (
              <WeeklyTimeline weeks={filteredWeeksWithProjects} projects={filteredProjects} />
            )}
          </div>
        </div>
      )}

      {/* Detailed Task Table */}
      <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 p-6 border-b border-slate-100 sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <h3 className="font-semibold leading-none tracking-tight">Activity Breakdown</h3>
            <p className="text-sm text-slate-500">Detailed list of project activities and status.</p>
          </div>
          <a
            href="#weekly-timeline"
            className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 h-9 px-4 py-2 border border-slate-200 bg-white text-slate-700 shadow-sm"
          >
            View Full Schedule <BarChart3 size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
          </a>
        </div>
        <div className="relative w-full overflow-auto custom-scrollbar">
          <table className="w-full caption-bottom text-sm min-w-[800px]">
            <thead className="[&_tr]:border-b border-slate-200 bg-slate-50/50">
              <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Code</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Activity</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">PIC</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Timeline</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Status</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-slate-500">Progress</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {displayWeeklyData && filteredProjects.length > 0 ? (
                // Show activities from CSV projects
                filteredProjects.flatMap(project =>
                  project.activities.map((activity, idx) => {
                    const weekKeys = Object.keys(activity.weeklyProgress);
                    const totalProgress = weekKeys.reduce((sum, key) => sum + activity.weeklyProgress[key], 0);
                    const progressPercent = weekKeys.length > 0 ? Math.min(100, (totalProgress / weekKeys.length) * 100) : 0;

                    return (
                      <tr key={`${project.id}-${idx}`} className="group border-b border-slate-200 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100">
                        <td className="p-4 align-middle font-medium text-slate-900">
                          {activity.category || activity.subCategory || '-'}
                        </td>
                        <td className="p-4 align-middle text-slate-700">{activity.activity}</td>
                        <td className="p-4 align-middle">
                          <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold bg-white text-slate-900 shadow-sm">
                            {activity.pic}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-slate-500 whitespace-nowrap text-sm">
                          {activity.startWeek !== undefined && activity.endWeek !== undefined
                            ? `Week ${activity.startWeek + 1} - ${activity.endWeek + 1}`
                            : '-'}
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${progressPercent === 100 ? 'bg-green-50 text-green-700 border-green-200' :
                            progressPercent > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                            {progressPercent === 100 ? 'Completed' : progressPercent > 0 ? 'In Progress' : 'Not Started'}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center justify-end gap-3 w-full">
                            <span className="text-sm font-medium text-slate-700 tabular-nums w-10 text-right">{progressPercent.toFixed(0)}%</span>
                            <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ease-in-out ${progressPercent === 100 ? 'bg-green-500' :
                                  progressPercent < 30 ? 'bg-rose-500' : 'bg-slate-900'
                                  }`}
                                style={{ width: `${progressPercent}%` }}
                              />
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
                  <tr key={task.id} className="group border-b border-slate-200 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100">
                    <td className="p-4 align-middle font-medium text-slate-900">{task.code}</td>
                    <td className="p-4 align-middle text-slate-700">{task.activity}</td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold bg-white text-slate-900 shadow-sm">
                        {task.pic}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-slate-500 whitespace-nowrap text-sm">
                      {new Date(task.startDate).toLocaleDateString('id-ID', { month: 'short' })} - {new Date(task.endDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${task.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                        task.status === 'Delayed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-end gap-3 w-full">
                        <span className="text-sm font-medium text-slate-700 tabular-nums w-10 text-right">{task.progress}%</span>
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-in-out ${task.progress === 100 ? 'bg-green-500' :
                              task.progress < 30 ? 'bg-rose-500' : 'bg-slate-900'
                              }`}
                            style={{ width: `${task.progress}%` }}
                          />
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
