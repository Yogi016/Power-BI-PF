import React, { useState, useEffect } from 'react';
import { fetchWeeklyProgressForActivity, updateWeeklyProgress, fetchActivities } from '../lib/supabase';
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface WeeklyProgressEditorProps {
  projectId: string;
  activityId: string;
  activityName: string;
}

interface WeekData {
  weekLabel: string;
  weekIndex: number;
  year: number;
  plan: number;
  actual: number;
}

export const WeeklyProgressEditor: React.FC<WeeklyProgressEditorProps> = ({
  projectId,
  activityId,
  activityName,
}) => {
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Selectors state
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [weeksToShow, setWeeksToShow] = useState<number>(4); // Default 4 weeks per month

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    loadWeeklyProgress();
  }, [activityId, selectedYear, selectedMonth, weeksToShow]);

  const loadWeeklyProgress = async () => {
    setLoading(true);
    const data = await fetchWeeklyProgressForActivity(activityId);
    
    // Generate weeks based on selected month/year
    const weeks: WeekData[] = [];
    const monthName = months[selectedMonth - 1].substring(0, 3); // Jan, Feb, etc.
    
    for (let i = 1; i <= weeksToShow; i++) {
      const weekLabel = `${monthName}-${i}`;
      const existing = data.find(d => 
        d.weekLabel === weekLabel && 
        d.year === selectedYear
      );
      
      // Calculate plan: distribute evenly across weeks
      const planPerWeek = 100 / (12 * 4); // Assuming 12 months * 4 weeks = 48 weeks
      const cumulativePlan = ((selectedMonth - 1) * 4 + i) * planPerWeek;
      
      weeks.push({
        weekLabel,
        weekIndex: (selectedMonth - 1) * 4 + i, // Global week index
        year: selectedYear,
        plan: Math.min(cumulativePlan, 100),
        actual: existing?.progressValue || 0,
      });
    }
    
    setWeeklyData(weeks);
    setLoading(false);
  };

  const handleActualChange = (weekIndex: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWeeklyData(prev => prev.map(w => 
      w.weekIndex === weekIndex ? { ...w, actual: numValue } : w
    ));
  };

  const handleSave = async (weekIndex: number) => {
    const week = weeklyData.find(w => w.weekIndex === weekIndex);
    if (!week) return;

    setSaving(true);
    const success = await updateWeeklyProgress(
      activityId,
      week.weekLabel,
      week.weekIndex,
      week.year,
      week.actual
    );

    if (success) {
      setNotification({ type: 'success', message: `${week.weekLabel} berhasil disimpan` });
    } else {
      setNotification({ type: 'error', message: 'Gagal menyimpan data' });
    }
    
    setSaving(false);
    setTimeout(() => setNotification(null), 2000);
  };

  const getStatusColor = (plan: number, actual: number) => {
    if (actual === 0) return 'bg-slate-100 text-slate-400';
    if (actual >= plan) return 'bg-green-100 text-green-700';
    if (actual >= plan * 0.9) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{activityName}</h3>
        <p className="text-sm text-slate-600">Input progress per minggu</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tahun</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Bulan</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {months.map((month, idx) => (
              <option key={idx + 1} value={idx + 1}>{month}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah Minggu</label>
          <select
            value={weeksToShow}
            onChange={(e) => setWeeksToShow(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value={4}>4 Minggu</option>
            <option value={5}>5 Minggu</option>
            <option value={6}>6 Minggu</option>
          </select>
        </div>
      </div>

      {notification && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {notification.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50">Minggu</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Plan (%)</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Actual (%)</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {weeklyData.map((week) => (
              <tr key={week.weekIndex} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white">
                  {week.weekLabel}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {week.plan.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={week.actual || ''}
                    onChange={(e) => handleActualChange(week.weekIndex, e.target.value)}
                    onBlur={() => handleSave(week.weekIndex)}
                    className="w-20 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="0"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(week.plan, week.actual)}`}>
                    {week.actual === 0 ? 'Belum' : 
                     week.actual >= week.plan ? 'On Track' :
                     week.actual >= week.plan * 0.9 ? 'Slight Delay' : 'Delayed'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSave(week.weekIndex)}
                    disabled={saving}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                  >
                    <Save size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tips:</strong> Input nilai actual progress (0-100%) untuk setiap minggu. 
          Data akan otomatis tersimpan saat Anda klik di luar input atau klik tombol Save.
        </p>
      </div>
    </div>
  );
};
