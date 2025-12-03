import React from 'react';
import { useData } from '../context/DataContext';
import { SCurveChart } from '../components/SCurveChart';
import { PICDonutChart } from '../components/PICDonutChart';
import { StatCard } from '../components/StatCard';
import { Activity, BarChart3, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { sCurveData, tasks } = useData();

  // Calculate Metrics
  const currentMonthData = sCurveData[sCurveData.length - 1]; // Simply taking last for demo, ideally match Date
  const planVsActual = currentMonthData ? (currentMonthData.actual - currentMonthData.plan).toFixed(1) : 0;
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const delayedTasks = tasks.filter(t => t.status === 'Delayed').length;
  const overallProgress = (tasks.reduce((acc, curr) => acc + (curr.progress * (curr.weight / 100)), 0)).toFixed(1);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Project Overview</h1>
        <p className="text-slate-500">Real-time insights into project performance and progress.</p>
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
          value={`${currentMonthData?.plan}%`}
          subtext={`Target for ${currentMonthData?.month}`}
          icon={<TrendingUp size={24} />}
        />
        <StatCard 
          title="Completed Activities" 
          value={`${completedTasks}/${totalTasks}`}
          subtext="Milestones achieved"
          icon={<CheckCircle2 size={24} />}
        />
        <StatCard 
          title="Critical Issues" 
          value={delayedTasks}
          trend={-delayedTasks} // Negative trend logic for bad things
          trendLabel="Delayed Tasks"
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
          <SCurveChart data={sCurveData} />
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
              {tasks.map((task) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};