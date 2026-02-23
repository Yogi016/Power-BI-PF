import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { TaskItem, MonthlyData } from '../types';
import { Save, Plus, Trash2, Edit2, X, Upload, FileText, CheckCircle2, AlertCircle, PlusCircle, Calendar } from 'lucide-react';
import { parseSCurveCSV, weeklyToMonthly } from '../utils/csvParser';

export const ManageData: React.FC = () => {
  const {
    tasks,
    sCurveData,
    projects,
    weeklySummary,
    projectFilters,
    addProjectFilter,
    selectedYear,
    setSelectedYear,
    setUseManualSCurve,
    updateTasks,
    updateSCurveData,
    setProjects,
    setWeeklySummary,
  } = useData();
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newProjectFilter, setNewProjectFilter] = useState('');
  const availableYears = Array.from(new Set(weeklySummary.map(w => w.year))).sort();
  const monthOptions = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // Local state for S-Curve inputs to handle changes before save if needed, 
  // but for this demo, we'll edit directly.

  const handleTaskChange = (id: string, field: keyof TaskItem, value: any) => {
    const updated = tasks.map(t => t.id === id ? { ...t, [field]: value } : t);
    updateTasks(updated);
  };

  const handleAddTask = () => {
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      code: 'NEW',
      activity: 'New Activity',
      pic: 'DANTA',
      status: 'Not Started',
      weight: 0,
      progress: 0,
      startDate: new Date().toISOString().substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
      startYear: new Date().getFullYear(),
      startMonth: monthOptions[new Date().getMonth()],
      startWeek: 1,
    };
    const updated = [...tasks, newTask];
    updateTasks(updated);
    setEditingTask(newTask.id);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    updateTasks(updated);
    if (editingTask === id) setEditingTask(null);
  };

  const handleSCurveChange = (month: string, field: 'plan' | 'actual', value: string) => {
    const numValue = parseFloat(value) || 0;
    const updated = sCurveData.map(d => d.month === month ? { ...d, [field]: numValue } : d);
    updateSCurveData(updated);
    // Gunakan manual S-curve ketika ada perubahan
    setUseManualSCurve(true);
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
      setUseManualSCurve(false); // kembali ke data CSV

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
    if (newProjectFilter.trim() !== '') {
      addProjectFilter(newProjectFilter);
      setNewProjectFilter('');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Manage Data</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Update project schedules, progress, and S-Curve metrics.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm h-10 group transition-colors focus-within:ring-1 focus-within:ring-slate-950">
              <Calendar size={16} className="text-slate-500 group-hover:text-slate-900 transition-colors" />
              <select
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                className="outline-none text-sm bg-transparent appearance-none cursor-pointer pr-4"
              >
                <option value="">Semua Tahun</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
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
            className="group flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 px-4 h-10 rounded-md text-sm font-medium transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Upload size={16} className="group-hover:-translate-y-1 transition-transform duration-300" />
            Import CSV
          </label>
          <button className="group flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-900/90 text-slate-50 px-4 h-10 rounded-md text-sm font-medium transition-colors shadow-sm whitespace-nowrap">
            <Save size={16} className="group-hover:scale-110 transition-transform duration-300" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Import Status */}
      {importStatus.type && (
        <div className={`p-4 rounded-md flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300 ${importStatus.type === 'success'
          ? 'bg-green-50 border border-green-200 text-green-900'
          : 'bg-red-50 border border-red-200 text-red-900'
          }`}>
          {importStatus.type === 'success' ? (
            <CheckCircle2 size={18} className="text-green-600 animate-pulse" />
          ) : (
            <AlertCircle size={18} className="text-red-600 animate-pulse" />
          )}
          <span className="text-sm font-medium">{importStatus.message}</span>
        </div>
      )}

      {/* Info Projects */}
      {projects.length > 0 && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl shadow-sm text-slate-950 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={18} className="text-slate-700" />
            <h3 className="font-semibold leading-none tracking-tight">Data dari CSV</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {projects.length} proyek terdeteksi • {weeklySummary.length} data mingguan tersedia
          </p>
          <div className="flex flex-wrap gap-2">
            {projects.map(project => (
              <span key={project.id} className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-0.5 text-xs font-semibold bg-white text-slate-950 shadow-sm transition-colors hover:bg-slate-100">
                {project.pic}: {project.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">

        {/* Project filter manager */}
        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm animate-in slide-in-from-left-4 duration-500">
          <div className="flex flex-col space-y-1.5 p-6 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <h3 className="font-semibold leading-none tracking-tight">Pilihan Proyek</h3>
                <p className="text-sm text-slate-500">Atur opsi filter proyek (Mahakam, Bontang, Blora, dll).</p>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <input
                value={newProjectFilter}
                onChange={(e) => setNewProjectFilter(e.target.value)}
                placeholder="Nama proyek baru"
                className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={handleAddProjectFilter}
                className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 shadow hover:bg-slate-900/90 h-9 px-4 py-2"
              >
                <PlusCircle size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                Tambah
              </button>
            </div>
          </div>
          <div className="p-6 flex flex-wrap gap-2">
            {projectFilters.map((name) => (
              <span key={name} className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 bg-slate-100 text-slate-900 hover:bg-slate-100/80">
                {name}
              </span>
            ))}
            {projectFilters.length === 0 && (
              <span className="text-sm text-slate-500 italic">Belum ada filter proyek.</span>
            )}
          </div>
        </div>

        {/* S-Curve Data Editor */}
        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm animate-in slide-in-from-right-4 duration-500">
          <div className="flex flex-col space-y-1.5 p-6 border-b border-slate-100">
            <h3 className="font-semibold leading-none tracking-tight">S-Curve Metrics</h3>
            <p className="text-sm text-slate-500">Update Plan vs Actual percentages per month. Tahun: <span className="font-medium text-slate-900">{selectedYear ?? 'Semua'}</span></p>
          </div>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b border-slate-200 bg-slate-50/50 hidden md:table-header-group">
                <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Month</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Plan (%)</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Actual (%)</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-slate-500">Deviation</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {sCurveData.map((row) => (
                  <tr key={row.month} className="group border-b border-slate-200 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100 flex flex-col md:table-row py-2 md:py-0">
                    <td className="p-4 align-middle font-medium text-slate-900 md:w-auto w-full flex justify-between md:table-cell">
                      <span className="md:hidden text-slate-500">Month</span>
                      {row.month}
                    </td>
                    <td className="p-4 align-middle md:w-auto w-full flex justify-between md:table-cell items-center">
                      <span className="md:hidden text-slate-500">Plan (%)</span>
                      <input
                        type="number"
                        value={row.plan}
                        onChange={(e) => handleSCurveChange(row.month, 'plan', e.target.value)}
                        className="flex h-9 w-24 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                    <td className="p-4 align-middle md:w-auto w-full flex justify-between md:table-cell items-center">
                      <span className="md:hidden text-slate-500">Actual (%)</span>
                      <input
                        type="number"
                        value={row.actual}
                        onChange={(e) => handleSCurveChange(row.month, 'actual', e.target.value)}
                        className="flex h-9 w-24 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                    <td className="p-4 align-middle text-right md:w-auto w-full flex justify-between md:table-cell font-medium">
                      <span className="md:hidden text-slate-500">Deviation</span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className={(row.actual - row.plan) >= 0 ? 'text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs' : 'text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs'}>
                          {(row.actual - row.plan).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Data Editor */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 p-6 border-b border-slate-100 sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <h3 className="font-semibold leading-none tracking-tight">Activity Data</h3>
              <p className="text-sm text-slate-500">Modify task details, owners, and progress.</p>
            </div>
            <button
              onClick={handleAddTask}
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 shadow-sm h-9 px-4 py-2"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
              New Activity
            </button>
          </div>

          <div className="relative w-full overflow-auto custom-scrollbar">
            <table className="w-full caption-bottom text-sm min-w-[1000px]">
              <thead className="[&_tr]:border-b border-slate-200 bg-slate-50/50">
                <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-24">Code</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Activity</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-32">PIC</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-36">Status</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-24">Year</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-28">Month</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-20">Week</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-28">Weight</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-slate-500 w-36">Progress</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-slate-500 w-24">Action</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      No activities found. Click "New Activity" to add one.
                    </td>
                  </tr>
                )}
                {tasks.map((task) => {
                  const isEditing = editingTask === task.id;
                  const inputClass = `flex w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${isEditing ? 'border-indigo-300 ring-1 ring-indigo-100 bg-indigo-50/30' : 'border-transparent hover:border-slate-200'}`;

                  return (
                    <tr key={task.id} className={`group border-b border-slate-200 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100 ${isEditing ? 'bg-indigo-50/10' : ''}`}>
                      <td className="p-3 align-middle">
                        <input
                          disabled={!isEditing}
                          value={task.code}
                          onChange={(e) => handleTaskChange(task.id, 'code', e.target.value)}
                          className={inputClass}
                        />
                      </td>
                      <td className="p-3 align-middle">
                        <input
                          disabled={!isEditing}
                          value={task.activity}
                          onChange={(e) => handleTaskChange(task.id, 'activity', e.target.value)}
                          className={inputClass}
                        />
                      </td>
                      <td className="p-3 align-middle">
                        <select
                          disabled={!isEditing}
                          value={task.pic}
                          onChange={(e) => handleTaskChange(task.id, 'pic', e.target.value)}
                          className={inputClass}
                        >
                          <option value="DANTA">DANTA</option>
                          <option value="ARIEF">ARIEF</option>
                          <option value="BILA">BILA</option>
                          <option value="INDRI">INDRI</option>
                          <option value="TIM LAPANGAN">TIM LAPANGAN</option>
                        </select>
                      </td>
                      <td className="p-3 align-middle">
                        <select
                          disabled={!isEditing}
                          value={task.status}
                          onChange={(e) => handleTaskChange(task.id, 'status', e.target.value)}
                          className={inputClass}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                      </td>
                      <td className="p-3 align-middle">
                        <input
                          type="number"
                          min="2020"
                          max="2100"
                          disabled={!isEditing}
                          value={task.startYear ?? ''}
                          onChange={(e) => handleTaskChange(task.id, 'startYear', Number(e.target.value))}
                          className={inputClass}
                        />
                      </td>
                      <td className="p-3 align-middle">
                        <select
                          disabled={!isEditing}
                          value={task.startMonth ?? ''}
                          onChange={(e) => handleTaskChange(task.id, 'startMonth', e.target.value)}
                          className={inputClass}
                        >
                          <option value="">-</option>
                          {monthOptions.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 align-middle">
                        <select
                          disabled={!isEditing}
                          value={task.startWeek ?? 1}
                          onChange={(e) => handleTaskChange(task.id, 'startWeek', Number(e.target.value))}
                          className={inputClass}
                        >
                          {[1, 2, 3, 4].map(week => (
                            <option key={week} value={week}>{week}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 align-middle">
                        <input
                          type="number"
                          disabled={!isEditing}
                          value={task.weight}
                          onChange={(e) => handleTaskChange(task.id, 'weight', parseFloat(e.target.value))}
                          className={inputClass}
                        />
                      </td>
                      <td className="p-3 align-middle">
                        <div className="flex items-center gap-3 w-full">
                          <input
                            type="range"
                            disabled={!isEditing}
                            min="0" max="100"
                            value={task.progress}
                            onChange={(e) => handleTaskChange(task.id, 'progress', parseInt(e.target.value))}
                            className={`flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer ${isEditing ? 'accent-slate-900' : 'accent-slate-400 opacity-60'}`}
                          />
                          <span className="text-xs font-medium w-9 text-right tabular-nums">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="p-3 align-middle text-right">
                        {isEditing ? (
                          <div className="flex justify-end pr-2">
                            <button
                              onClick={() => setEditingTask(null)}
                              className="group inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 h-9 w-9 text-green-600 border border-green-200 bg-green-50 shadow-sm hover:bg-green-100"
                              title="Save Task"
                            >
                              <Save size={16} className="group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1 flex-nowrap">
                            <button
                              onClick={() => setEditingTask(task.id)}
                              className="group inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 h-9 w-9 text-slate-500 hover:text-indigo-600"
                              title="Edit Task"
                            >
                              <Edit2 size={16} className="group-hover:rotate-12 transition-transform" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="group inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-900 h-9 w-9 text-slate-500 hover:text-red-600"
                              title="Delete Task"
                            >
                              <Trash2 size={16} className="group-hover:scale-110 group-hover:text-red-600 transition-all" />
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
