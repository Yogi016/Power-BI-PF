import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { TaskItem, MonthlyData } from '../types';
import { Save, Plus, Trash2, Edit2, X, Upload, FileText, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';
import { parseSCurveCSV, weeklyToMonthly } from '../utils/csvParser';

export const ManageData: React.FC = () => {
  const { 
    tasks, 
    sCurveData, 
    projects,
    weeklySummary,
    projectFilters,
    addProjectFilter,
    updateTasks, 
    updateSCurveData,
    setProjects,
    setWeeklySummary,
  } = useData();
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newProjectFilter, setNewProjectFilter] = useState('');
  
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validasi file CSV
    if (!file.name.endsWith('.csv')) {
      setImportStatus({ type: 'error', message: 'File harus berformat CSV' });
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseSCurveCSV(text);
      
      // Update projects dan weekly summary
      setProjects(parsed.projects);
      setWeeklySummary(parsed.summaryBaseline);
      
      // Convert weekly to monthly untuk backward compatibility
      const monthlyData = weeklyToMonthly(parsed.summaryBaseline);
      updateSCurveData(monthlyData);
      
      setImportStatus({ 
        type: 'success', 
        message: `Berhasil mengimpor ${parsed.projects.length} proyek dengan ${parsed.summaryBaseline.length} data mingguan` 
      });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setImportStatus({ 
        type: 'error', 
        message: `Error: ${error instanceof Error ? error.message : 'Gagal memproses file CSV'}` 
      });
    }
  };

  const handleAddProjectFilter = () => {
    addProjectFilter(newProjectFilter);
    setNewProjectFilter('');
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Data</h1>
          <p className="text-slate-500">Update project schedules, progress, and S-Curve metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm cursor-pointer"
          >
            <Upload size={18} />
            Import CSV
          </label>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Import Status */}
      {importStatus.type && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          importStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {importStatus.type === 'success' ? (
            <CheckCircle2 size={20} className="text-green-600" />
          ) : (
            <AlertCircle size={20} className="text-red-600" />
          )}
          <span className="text-sm font-medium">{importStatus.message}</span>
        </div>
      )}

      {/* Info Projects */}
      {projects.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={18} className="text-blue-600" />
            <h3 className="font-semibold text-blue-900">Data dari CSV</h3>
          </div>
          <p className="text-sm text-blue-700">
            {projects.length} proyek terdeteksi • {weeklySummary.length} data mingguan tersedia
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {projects.map(project => (
              <span key={project.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {project.pic}: {project.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Project filter manager */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Pilihan Proyek</h3>
              <p className="text-sm text-slate-500">Atur opsi filter proyek (Mahakam, Bontang, Blora, Lain - Lain, dll).</p>
            </div>
            <div className="flex gap-2">
              <input
                value={newProjectFilter}
                onChange={(e) => setNewProjectFilter(e.target.value)}
                placeholder="Nama proyek baru"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button
                onClick={handleAddProjectFilter}
                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <PlusCircle size={16} />
                Tambah
              </button>
            </div>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {projectFilters.map((name) => (
              <span key={name} className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold border border-slate-200">
                {name}
              </span>
            ))}
          </div>
        </div>
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
