import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { TaskItem, MonthlyData } from '../types';
import { Save, Plus, Trash2, Edit2, X } from 'lucide-react';

export const ManageData: React.FC = () => {
  const { tasks, sCurveData, updateTasks, updateSCurveData } = useData();
  const [editingTask, setEditingTask] = useState<string | null>(null);
  
  // Local state for S-Curve inputs to handle changes before save if needed, 
  // but for this demo, we'll edit directly.
  
  const handleTaskChange = (id: string, field: keyof TaskItem, value: any) => {
    const updated = tasks.map(t => t.id === id ? { ...t, [field]: value } : t);
    updateTasks(updated);
  };

  const handleSCurveChange = (month: string, field: 'plan' | 'actual', value: string) => {
    const numValue = parseFloat(value) || 0;
    const updated = sCurveData.map(d => d.month === month ? { ...d, [field]: numValue } : d);
    updateSCurveData(updated);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Data</h1>
          <p className="text-slate-500">Update project schedules, progress, and S-Curve metrics.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
          <Save size={18} />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* S-Curve Data Editor */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">S-Curve Metrics</h3>
            <p className="text-sm text-slate-500">Update Plan vs Actual percentages per month.</p>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Month</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Plan (%)</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Actual (%)</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-600">Deviation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sCurveData.map((row) => (
                  <tr key={row.month} className="group hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{row.month}</td>
                    <td className="px-6 py-3">
                      <input 
                        type="number" 
                        value={row.plan} 
                        onChange={(e) => handleSCurveChange(row.month, 'plan', e.target.value)}
                        className="w-24 px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input 
                        type="number" 
                        value={row.actual}
                        onChange={(e) => handleSCurveChange(row.month, 'actual', e.target.value)} 
                        className="w-24 px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      <span className={(row.actual - row.plan) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(row.actual - row.plan).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Data Editor */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
             <div>
              <h3 className="text-lg font-bold text-slate-800">Activity Data</h3>
              <p className="text-sm text-slate-500">Modify task details, owners, and progress.</p>
             </div>
             <button className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors">
               <Plus size={20} />
             </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 w-16">Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Activity</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 w-24">PIC</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 w-32">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 w-24">Weight</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 w-24">Progress</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const isEditing = editingTask === task.id;
                  return (
                    <tr key={task.id} className={isEditing ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <input 
                          disabled={!isEditing}
                          value={task.code}
                          onChange={(e) => handleTaskChange(task.id, 'code', e.target.value)}
                          className={`w-full bg-transparent ${isEditing ? 'border-b border-indigo-500' : ''} outline-none`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          disabled={!isEditing}
                          value={task.activity}
                          onChange={(e) => handleTaskChange(task.id, 'activity', e.target.value)}
                          className={`w-full bg-transparent ${isEditing ? 'border-b border-indigo-500' : ''} outline-none`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          disabled={!isEditing}
                          value={task.pic}
                          onChange={(e) => handleTaskChange(task.id, 'pic', e.target.value)}
                          className={`w-full bg-transparent ${isEditing ? 'border-b border-indigo-500' : ''} outline-none appearance-none`}
                        >
                           <option value="DANTA">DANTA</option>
                           <option value="ARIEF">ARIEF</option>
                           <option value="BILA">BILA</option>
                           <option value="INDRI">INDRI</option>
                           <option value="TIM LAPANGAN">TIM LAPANGAN</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          disabled={!isEditing}
                          value={task.status}
                          onChange={(e) => handleTaskChange(task.id, 'status', e.target.value)}
                           className={`w-full bg-transparent ${isEditing ? 'border-b border-indigo-500' : ''} outline-none appearance-none`}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number"
                          disabled={!isEditing}
                          value={task.weight}
                          onChange={(e) => handleTaskChange(task.id, 'weight', parseFloat(e.target.value))}
                          className={`w-full bg-transparent ${isEditing ? 'border-b border-indigo-500' : ''} outline-none`}
                        />
                      </td>
                      <td className="px-4 py-3">
                         <div className="flex items-center gap-2">
                            <input 
                              type="range"
                              disabled={!isEditing}
                              min="0" max="100"
                              value={task.progress}
                              onChange={(e) => handleTaskChange(task.id, 'progress', parseInt(e.target.value))}
                              className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs w-8 text-right">{task.progress}%</span>
                         </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <button onClick={() => setEditingTask(null)} className="text-green-600 hover:text-green-700 p-1">
                            <Save size={16} />
                          </button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingTask(task.id)} className="text-slate-400 hover:text-indigo-600 p-1">
                              <Edit2 size={16} />
                            </button>
                            <button className="text-slate-400 hover:text-red-600 p-1">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};