import { ProjectData, ActivityData, WeeklyData } from '../types';

// Parse percentage string dengan format "0,082%" atau "18%"
function parsePercentage(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Hapus % dan ganti koma dengan titik
  const cleaned = value.replace('%', '').replace(',', '.').trim();
  return parseFloat(cleaned) || 0;
}

// Generate week labels: Juni-1, Juni-2, ..., Maret-4
const MONTHS = ['Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember', 'Januari', 'Februari', 'Maret'];
function getWeekLabel(weekIndex: number): string {
  const monthIndex = Math.floor(weekIndex / 4);
  const weekInMonth = (weekIndex % 4) + 1;
  return `${MONTHS[monthIndex]}-${weekInMonth}`;
}

// Parse CSV dengan format SCURVE FINAL
export function parseSCurveCSV(csvContent: string): {
  projects: ProjectData[];
  summaryBaseline: WeeklyData[];
  summaryActual: WeeklyData[];
} {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('CSV file tidak valid');
  }

  // Parse header untuk mendapatkan kolom mingguan
  const headerLine = lines[0];
  const headers = headerLine.split(';').map(h => h.trim());
  
  // Cari kolom-kolom mingguan (Juni 1-4, Juli 1-4, dst)
  const weekColumns: { index: number; label: string }[] = [];
  let weekIndex = 0;
  
  // Header dimulai dari kolom ke-5 (index 4) untuk mingguan
  // Format: ;;;;1;2;3;4;1;2;3;4;... (Juni 1-4, Juli 1-4, dst)
  for (let i = 4; i < headers.length && weekIndex < 40; i++) {
    const header = headers[i];
    if (header && /^\d+$/.test(header)) {
      weekColumns.push({ index: i, label: getWeekLabel(weekIndex) });
      weekIndex++;
    }
  }

  const projects: ProjectData[] = [];
  const activities: ActivityData[] = [];
  
  let currentPIC = '';
  let currentProject = '';
  let currentCategory = '';
  let currentSubCategory = '';
  
  // Parse data rows (mulai dari baris ke-3, skip header dan sub-header)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(';').map(col => col.trim());
    
    // Skip baris kosong atau baris summary di akhir
    if (columns.length < 5) continue;
    
    const pic = columns[0] || currentPIC;
    const project = columns[1] || currentProject;
    const category = columns[2] || currentCategory;
    const subCategory = columns[3] || currentSubCategory;
    const activity = columns[4];
    
    // Update current context
    if (pic) currentPIC = pic;
    if (project) currentProject = project;
    if (category) currentCategory = category;
    if (subCategory) currentSubCategory = subCategory;
    
    // Skip baris summary (Baseline Scurve, Kumulatif Realisasi, dll)
    if (!activity || 
        activity.includes('Baseline') || 
        activity.includes('Kumulatif') ||
        activity.includes('Beban Tiap Minggu') ||
        activity.includes('Realisasi Tiap Minggu') ||
        activity.includes('Progres') ||
        activity === '') {
      continue;
    }
    
    // Parse weekly progress
    const weeklyProgress: Record<string, number> = {};
    let hasProgress = false;
    
    weekColumns.forEach(({ index, label }) => {
      if (columns[index]) {
        const value = parsePercentage(columns[index]);
        if (value > 0) {
          weeklyProgress[label] = value;
          hasProgress = true;
        }
      }
    });
    
    // Hanya tambahkan aktivitas yang punya progress
    if (hasProgress && activity) {
      // Cari minggu pertama dan terakhir dengan progress
      let startWeek = -1;
      let endWeek = -1;
      
      weekColumns.forEach(({ label }, idx) => {
        if (weeklyProgress[label] > 0) {
          if (startWeek === -1) startWeek = idx;
          endWeek = idx;
        }
      });
      
      activities.push({
        pic: currentPIC || pic,
        project: currentProject || project,
        category: currentCategory || category,
        subCategory: currentSubCategory || subCategory,
        activity: activity.trim(),
        weeklyProgress,
        startWeek: startWeek >= 0 ? startWeek : undefined,
        endWeek: endWeek >= 0 ? endWeek : undefined,
      });
    }
  }
  
  // Group activities by project
  const projectMap = new Map<string, ProjectData>();
  
  activities.forEach(activity => {
    const projectKey = `${activity.pic}-${activity.project}`;
    
    if (!projectMap.has(projectKey)) {
      projectMap.set(projectKey, {
        id: projectKey,
        name: activity.project,
        pic: activity.pic,
        activities: [],
        weeklyBaseline: [],
        weeklyActual: [],
      });
    }
    
    projectMap.get(projectKey)!.activities.push(activity);
  });
  
  // Parse summary data (Baseline Scurve dan Kumulatif Realisasi)
  // Cari baris summary dari akhir file
  const summaryBaseline: WeeklyData[] = [];
  const summaryActual: WeeklyData[] = [];
  
  // Cari baris yang mengandung "Baseline Scurve" atau "Kumulatif"
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i];
    if (!line) continue;
    
    const columns = line.split(';').map(col => col.trim());
    
    // Cek kolom ke-4 (index 3) untuk label summary
    const rowType = (columns[3] || columns[4] || '').toLowerCase();
    
    if (rowType.includes('baseline scurve') || rowType.includes('baseline')) {
      // Parse data mingguan dari kolom ke-5 (index 4) dan seterusnya
      weekColumns.forEach(({ index, label }, idx) => {
        const colIndex = index;
        const value = parsePercentage(columns[colIndex] || '0');
        if (summaryBaseline.length <= idx) {
          summaryBaseline.push({
            week: label,
            weekIndex: idx,
            baseline: value,
            actual: 0,
          });
        } else {
          summaryBaseline[idx].baseline = value;
        }
      });
    } else if (rowType.includes('kumulatif realisasi') || rowType.includes('kumulatif')) {
      weekColumns.forEach(({ index, label }, idx) => {
        const colIndex = index;
        const value = parsePercentage(columns[colIndex] || '0');
        if (summaryActual.length <= idx) {
          summaryActual.push({
            week: label,
            weekIndex: idx,
            baseline: 0,
            actual: value,
          });
        } else {
          summaryActual[idx].actual = value;
        }
      });
    }
  }
  
  // Convert projectMap to array
  const projectsArray = Array.from(projectMap.values());
  
  // Merge baseline dan actual untuk summary
  // Jika tidak ada summary, buat dari data proyek yang ada
  let mergedSummary: WeeklyData[] = [];
  
  if (summaryBaseline.length > 0 || summaryActual.length > 0) {
    const maxLength = Math.max(summaryBaseline.length, summaryActual.length, weekColumns.length);
    mergedSummary = weekColumns.slice(0, maxLength).map(({ label }, idx) => ({
      week: label,
      weekIndex: idx,
      baseline: summaryBaseline[idx]?.baseline || 0,
      actual: summaryActual[idx]?.actual || 0,
    }));
  } else {
    // Jika tidak ada summary, buat dari aggregasi proyek
    mergedSummary = weekColumns.map(({ label }, idx) => {
      let totalBaseline = 0;
      let totalActual = 0;
      
      projectsArray.forEach(project => {
        // Aggregasi dari activities (simplified)
        project.activities.forEach(activity => {
          const weekKey = label;
          if (activity.weeklyProgress[weekKey]) {
            totalActual += activity.weeklyProgress[weekKey];
          }
        });
      });
      
      return {
        week: label,
        weekIndex: idx,
        baseline: totalBaseline,
        actual: totalActual,
      };
    });
  }
  
  return {
    projects: projectsArray,
    summaryBaseline: mergedSummary,
    summaryActual: mergedSummary,
  };
}

// Helper untuk convert WeeklyData ke MonthlyData (untuk backward compatibility)
export function weeklyToMonthly(weeklyData: WeeklyData[]): MonthlyData[] {
  const monthlyMap = new Map<string, { plan: number; actual: number; count: number }>();
  
  weeklyData.forEach(week => {
    const month = week.week.split('-')[0]; // Ambil nama bulan saja
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { plan: 0, actual: 0, count: 0 });
    }
    
    const monthData = monthlyMap.get(month)!;
    monthData.plan += week.baseline;
    monthData.actual += week.actual;
    monthData.count += 1;
  });
  
  // Ambil nilai terakhir dari setiap bulan (kumulatif)
  const monthOrder = ['Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember', 'Januari', 'Februari', 'Maret'];
  const result: MonthlyData[] = [];
  
  monthOrder.forEach(month => {
    const monthWeeks = weeklyData.filter(w => w.week.startsWith(month));
    if (monthWeeks.length > 0) {
      // Ambil nilai kumulatif terakhir dari bulan tersebut
      const lastWeek = monthWeeks[monthWeeks.length - 1];
      result.push({
        month: month.substring(0, 3), // Jun, Jul, Aug, etc.
        plan: lastWeek.baseline,
        actual: lastWeek.actual,
      });
    }
  });
  
  return result;
}

