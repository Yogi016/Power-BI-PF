import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  upsertSCurveBaseline,
  upsertSCurveActual,
  createActivity,
  uploadEvidence,
  deleteEvidence,
} from '../lib/supabase';
import { supabase } from '../lib/supabaseClient';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  Wand2,
  Paperclip,
  Camera,
  FileText,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';

interface ManageDataNewProps {
  focusProjectId?: string | null;
  onFocusHandled?: () => void;
}

interface ActivityFormRow {
  code: string;
  activityName: string;
  weight: number;
  evidence: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface MonthlySCurveEditorRow {
  year: number;
  monthIndex: number;
  monthLabel: string;
  periodLabel: string;
  periodBaseline: number;
  periodActual: number;
  cumulativeBaseline: number;
  cumulativeActual: number;
}

interface SCurveDraftValue {
  periodBaseline: number;
  periodActual: number;
}

interface TimelinePeriod {
  year: number;
  monthIndex: number;
  monthLabel: string;
}

interface ActivitySyncResult {
  success: boolean;
  errorMessage?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const ACTIVITY_STATUS_PROGRESS: Record<string, number> = {
  'not-started': 0,
  'on-hold': 0,
  'in-progress': 50,
  delayed: 25,
  completed: 100,
};
const MAX_PERIOD_ACTUAL = 100;
const MAX_CUMULATIVE_ACTUAL = 100;
const CURRENT_YEAR = new Date().getFullYear();
const DAY_MS = 1000 * 60 * 60 * 24;

const periodKey = (year: number, monthIndex: number) => `${year}-${monthIndex}`;

const parseProjectDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toUtcDay = (date: Date): number => {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
};

const inclusiveDayDiff = (start: Date, end: Date): number => {
  return Math.max(1, toUtcDay(end) - toUtcDay(start) + 1);
};

const overlapDaysInclusive = (
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number => {
  const start = Math.max(toUtcDay(startA), toUtcDay(startB));
  const end = Math.min(toUtcDay(endA), toUtcDay(endB));
  if (end < start) return 0;
  return end - start + 1;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const round2 = (value: number): number => {
  return Number(value.toFixed(2));
};

const normalizeProjectDateRange = (
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } => {
  const parsedStart = parseProjectDate(startDate);
  const parsedEnd = parseProjectDate(endDate);

  const fallbackStart = new Date(CURRENT_YEAR, new Date().getMonth(), 1);
  const start = parsedStart || parsedEnd || fallbackStart;
  const end = parsedEnd || parsedStart || fallbackStart;

  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return { start: end, end: start };
};

const getTimelinePeriods = (startDate?: string, endDate?: string): TimelinePeriod[] => {
  const { start, end } = normalizeProjectDateRange(startDate, endDate);
  const periods: TimelinePeriod[] = [];

  let cursorYear = start.getFullYear();
  let cursorMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  while (cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonth)) {
    periods.push({
      year: cursorYear,
      monthIndex: cursorMonth,
      monthLabel: MONTHS[cursorMonth - 1],
    });

    if (cursorMonth === 12) {
      cursorMonth = 1;
      cursorYear += 1;
    } else {
      cursorMonth += 1;
    }
  }

  return periods;
};

const buildRowsForTimeline = (
  startDate: string | undefined,
  endDate: string | undefined,
  draftMap: Record<string, SCurveDraftValue>
): MonthlySCurveEditorRow[] => {
  const periods = getTimelinePeriods(startDate, endDate);
  let cumulativeBaseline = 0;
  let cumulativeActual = 0;

  return periods.map((period) => {
    const values = draftMap[periodKey(period.year, period.monthIndex)] || {
      periodBaseline: 0,
      periodActual: 0,
    };

    const periodBaseline = Number.isFinite(values.periodBaseline) ? values.periodBaseline : 0;
    const periodActual = Number.isFinite(values.periodActual) ? values.periodActual : 0;

    cumulativeBaseline = round2(cumulativeBaseline + periodBaseline);
    cumulativeActual = round2(cumulativeActual + periodActual);

    return {
      year: period.year,
      monthIndex: period.monthIndex,
      monthLabel: period.monthLabel,
      periodLabel: `${period.monthLabel}-${period.year}`,
      periodBaseline,
      periodActual,
      cumulativeBaseline,
      cumulativeActual,
    };
  });
};

const getPeriodDateRange = (period: TimelinePeriod): { start: Date; end: Date } => {
  return {
    start: new Date(period.year, period.monthIndex - 1, 1),
    end: new Date(period.year, period.monthIndex, 0),
  };
};

const generateSigmoidBaseline = (periodCount: number): number[] => {
  if (periodCount <= 0) return [];
  if (periodCount === 1) return [100];

  const raw: number[] = [];
  for (let idx = 0; idx < periodCount; idx += 1) {
    const progress = (idx + 1) / periodCount;
    raw.push(1 / (1 + Math.exp(-10 * (progress - 0.5))));
  }

  const minRaw = raw[0];
  const maxRaw = raw[raw.length - 1];
  const denom = maxRaw - minRaw || 1;

  let prev = 0;
  const normalized = raw.map((value, idx) => {
    const scaled = ((value - minRaw) / denom) * 100;
    const clamped = clamp(scaled, prev, 100);
    const rounded = round2(clamped);
    prev = rounded;
    return idx === periodCount - 1 ? 100 : rounded;
  });

  return normalized;
};

const getActivityCompletionRatio = (status?: string): number => {
  const key = (status || '').toLowerCase();
  const progress = ACTIVITY_STATUS_PROGRESS[key] ?? 0;
  return progress / 100;
};

const buildAutoSCurvePeriods = (
  periods: TimelinePeriod[],
  activities: ActivityFormRow[],
  startDate?: string,
  endDate?: string
): { periodBaseline: number[]; periodActual: number[] } => {
  if (periods.length === 0) {
    return { periodBaseline: [], periodActual: [] };
  }

  const projectRange = normalizeProjectDateRange(startDate, endDate);
  const projectStart = projectRange.start;
  const projectEnd = projectRange.end;
  const baselineContributions = new Array(periods.length).fill(0);
  const actualContributions = new Array(periods.length).fill(0);

  const activityPool = activities.filter((activity) => activity.weight > 0);
  const totalWeight = activityPool.reduce((sum, activity) => sum + activity.weight, 0);
  let usedActivityModel = false;

  if (activityPool.length > 0 && totalWeight > 0) {
    const weightScale = 100 / totalWeight;

    activityPool.forEach((activity) => {
      const rawStart = parseProjectDate(activity.startDate) || projectStart;
      const rawEnd = parseProjectDate(activity.endDate) || projectEnd;
      const activityStart = rawStart <= rawEnd ? rawStart : rawEnd;
      const activityEnd = rawStart <= rawEnd ? rawEnd : rawStart;
      const activityDurationDays = inclusiveDayDiff(activityStart, activityEnd);
      const normalizedWeight = activity.weight * weightScale;
      const completionRatio = getActivityCompletionRatio(activity.status);

      periods.forEach((period, idx) => {
        const periodRange = getPeriodDateRange(period);
        const overlap = overlapDaysInclusive(activityStart, activityEnd, periodRange.start, periodRange.end);
        if (overlap <= 0) return;

        const weightedPortion = (overlap / activityDurationDays) * normalizedWeight;
        baselineContributions[idx] += weightedPortion;
        actualContributions[idx] += weightedPortion * completionRatio;
        usedActivityModel = true;
      });
    });
  }

  const totalContribution = baselineContributions.reduce((sum, value) => sum + value, 0);
  const cumulativeBaseline: number[] = [];
  const cumulativeActual: number[] = [];

  if (usedActivityModel && totalContribution > 0) {
    const scalingFactor = 100 / totalContribution;
    let running = 0;
    let runningActual = 0;

    baselineContributions.forEach((value, idx) => {
      running += value * scalingFactor;
      runningActual += actualContributions[idx] * scalingFactor;
      const rounded = round2(clamp(running, 0, 100));
      const roundedActual = round2(clamp(runningActual, 0, MAX_CUMULATIVE_ACTUAL));
      cumulativeBaseline.push(idx === baselineContributions.length - 1 ? 100 : rounded);
      cumulativeActual.push(roundedActual);
    });
  } else {
    cumulativeBaseline.push(...generateSigmoidBaseline(periods.length));
    cumulativeActual.push(...periods.map(() => 0));
  }

  const periodBaseline = cumulativeBaseline.map((value, idx) => {
    const previous = idx === 0 ? 0 : cumulativeBaseline[idx - 1];
    return round2(Math.max(0, value - previous));
  });

  const periodActual = cumulativeActual.map((value, idx) => {
    const previous = idx === 0 ? 0 : cumulativeActual[idx - 1];
    return round2(clamp(Math.max(0, value - previous), 0, MAX_PERIOD_ACTUAL));
  });

  return {
    periodBaseline,
    periodActual,
  };
};

const buildDraftMapFromActivities = (
  startDate: string | undefined,
  endDate: string | undefined,
  activities: ActivityFormRow[]
): Record<string, SCurveDraftValue> => {
  const periods = getTimelinePeriods(startDate, endDate);
  const { periodBaseline, periodActual } = buildAutoSCurvePeriods(periods, activities, startDate, endDate);

  const draft: Record<string, SCurveDraftValue> = {};
  periods.forEach((period, idx) => {
    draft[periodKey(period.year, period.monthIndex)] = {
      periodBaseline: periodBaseline[idx] ?? 0,
      periodActual: periodActual[idx] ?? 0,
    };
  });

  return draft;
};

export const ManageDataNew: React.FC<ManageDataNewProps> = ({
  focusProjectId = null,
  onFocusHandled,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSCurve, setLoadingSCurve] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Year filter state
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: string; projectName: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    pic: '',
    description: '',
    category: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'active',
    budget: undefined,
  });

  // Activities state for the project being created/edited
  const [activities, setActivities] = useState<ActivityFormRow[]>([]);
  const [activitiesDirty, setActivitiesDirty] = useState(false);
  const [savingActivities, setSavingActivities] = useState(false);

  // S-Curve editor state
  const [sCurveDraftMap, setSCurveDraftMap] = useState<Record<string, SCurveDraftValue>>({});
  const [sCurveRows, setSCurveRows] = useState<MonthlySCurveEditorRow[]>([]);

  // Evidence upload state
  const [uploadingEvidence, setUploadingEvidence] = useState<number | null>(null);
  const evidenceFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const evidenceCameraRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Load projects
  useEffect(() => {
    loadProjects();
  }, []);

  // Open edit mode automatically when redirected from dashboard no-data CTA
  useEffect(() => {
    if (!focusProjectId || projects.length === 0) return;

    const targetProject = projects.find((p) => p.id === focusProjectId);
    if (!targetProject) {
      onFocusHandled?.();
      return;
    }

    void handleEdit(targetProject).finally(() => {
      onFocusHandled?.();
    });
  }, [focusProjectId, projects]);

  const loadProjects = async () => {
    setLoading(true);
    const data = await fetchProjects();
    setProjects(data);
    setLoading(false);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const resetSCurveEditor = (startDate?: string, endDate?: string, sourceActivities: ActivityFormRow[] = []) => {
    const draft = buildDraftMapFromActivities(startDate, endDate, sourceActivities);

    setSCurveDraftMap(draft);
    setSCurveRows(buildRowsForTimeline(startDate, endDate, draft));
  };

  const loadActivitiesForProject = async (projectId: string): Promise<ActivityFormRow[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('activities')
      .select('code, activity_name, weight, evidence, start_date, end_date, status')
      .eq('project_id', projectId)
      .order('code', { ascending: true });

    if (error) throw error;

    return (data || []).map((a) => ({
      code: a.code,
      activityName: a.activity_name,
      weight: a.weight || 0,
      evidence: a.evidence || '',
      startDate: a.start_date || '',
      endDate: a.end_date || '',
      status: a.status || 'not-started',
    }));
  };

  const handleCreate = () => {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    setIsCreating(true);
    setEditingProject(null);
    setFormData({
      name: '',
      pic: '',
      description: '',
      category: 'Environmental',
      location: '',
      startDate,
      endDate,
      status: 'active',
      budget: undefined,
    });
    setActivities([]);
    setActivitiesDirty(false);
    resetSCurveEditor(startDate, endDate);
    setLoadingSCurve(false);
  };

  const handleEdit = async (project: Project) => {
    setIsCreating(false);
    setEditingProject(project);
    setFormData(project);
    setLoadingSCurve(true);

    try {
      const projectActivities = await loadActivitiesForProject(project.id);

      setActivities(projectActivities);
      setActivitiesDirty(false);
      resetSCurveEditor(project.startDate, project.endDate, projectActivities);
    } catch (error) {
      console.error('Error loading project detail:', error);
      setActivities([]);
      setActivitiesDirty(false);
      resetSCurveEditor(project.startDate, project.endDate, []);
      showNotification('error', 'Gagal memuat activities project');
    } finally {
      setLoadingSCurve(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingProject(null);
    setFormData({});
    setActivities([]);
    setActivitiesDirty(false);
    setSavingActivities(false);
    setSCurveDraftMap({});
    setSCurveRows([]);
    setLoadingSCurve(false);
  };

  useEffect(() => {
    if (!isCreating && !editingProject) return;
    const draft = buildDraftMapFromActivities(formData.startDate, formData.endDate, activities);
    setSCurveDraftMap(draft);
  }, [formData.startDate, formData.endDate, isCreating, editingProject, activities]);

  useEffect(() => {
    if (!isCreating && !editingProject) return;
    setSCurveRows(buildRowsForTimeline(formData.startDate, formData.endDate, sCurveDraftMap));
  }, [formData.startDate, formData.endDate, sCurveDraftMap, isCreating, editingProject]);

  const validateSCurveRows = (draftOverride?: Record<string, SCurveDraftValue>): string | null => {
    const periods = getTimelinePeriods(formData.startDate, formData.endDate);
    if (periods.length === 0) {
      return 'Data S-Curve bulanan tidak tersedia';
    }

    const draftMap = draftOverride || sCurveDraftMap;
    let hasNonZero = false;
    let cumulativeBaseline = 0;
    let cumulativeActual = 0;

    for (const period of periods) {
      const values = draftMap[periodKey(period.year, period.monthIndex)] || {
        periodBaseline: 0,
        periodActual: 0,
      };
      const periodBaseline = values.periodBaseline;
      const periodActual = values.periodActual;

      if (!Number.isFinite(periodBaseline) || periodBaseline < 0 || periodBaseline > 100) {
        return `Baseline periode ${period.monthLabel}-${period.year} harus di antara 0 sampai 100`;
      }

      if (!Number.isFinite(periodActual) || periodActual < 0 || periodActual > MAX_PERIOD_ACTUAL) {
        return `Realisasi periode ${period.monthLabel}-${period.year} harus di antara 0 sampai ${MAX_PERIOD_ACTUAL}`;
      }

      cumulativeBaseline = round2(cumulativeBaseline + periodBaseline);
      cumulativeActual = round2(cumulativeActual + periodActual);

      if (cumulativeBaseline > 100) {
        return `Total baseline kumulatif melewati 100% pada periode ${period.monthLabel}-${period.year}`;
      }

      if (cumulativeActual > MAX_CUMULATIVE_ACTUAL) {
        return `Total realisasi kumulatif melewati ${MAX_CUMULATIVE_ACTUAL}% pada periode ${period.monthLabel}-${period.year}`;
      }

      if (periodBaseline > 0 || periodActual > 0) {
        hasNonZero = true;
      }
    }

    if (!hasNonZero) {
      return 'Minimal satu nilai baseline periode atau realisasi periode harus lebih dari 0';
    }

    return null;
  };

  const saveSCurveForProject = async (
    projectId: string,
    draftOverride?: Record<string, SCurveDraftValue>
  ): Promise<boolean> => {
    const draftMap = draftOverride || sCurveDraftMap;
    const validationError = validateSCurveRows(draftMap);
    if (validationError) {
      showNotification('error', validationError);
      return false;
    }

    const periods = getTimelinePeriods(formData.startDate, formData.endDate);
    if (periods.length === 0) {
      showNotification('error', 'Rentang tanggal project tidak valid untuk S-Curve');
      return false;
    }

    if (supabase) {
      const { error: deleteBaselineError } = await supabase
        .from('s_curve_baseline')
        .delete()
        .eq('project_id', projectId)
        .eq('period_type', 'monthly');

      if (deleteBaselineError) {
        showNotification('error', 'Gagal membersihkan baseline S-Curve lama');
        return false;
      }

      const { error: deleteActualError } = await supabase
        .from('s_curve_actual')
        .delete()
        .eq('project_id', projectId)
        .eq('period_type', 'monthly');

      if (deleteActualError) {
        showNotification('error', 'Gagal membersihkan realisasi S-Curve lama');
        return false;
      }
    }

    let cumulativeBaseline = 0;
    const baselinePayload = periods.map((period) => {
      const values = draftMap[periodKey(period.year, period.monthIndex)] || {
        periodBaseline: 0,
        periodActual: 0,
      };
      const periodBaseline = Number(values.periodBaseline.toFixed(2));
      cumulativeBaseline = Number((cumulativeBaseline + periodBaseline).toFixed(2));

      return {
        periodLabel: period.monthLabel,
        periodIndex: period.monthIndex,
        year: period.year,
        cumulativeBaseline,
        periodBaseline,
      };
    });

    let cumulativeActual = 0;
    const actualPayload = periods.map((period) => {
      const values = draftMap[periodKey(period.year, period.monthIndex)] || {
        periodBaseline: 0,
        periodActual: 0,
      };
      const periodActual = Number(values.periodActual.toFixed(2));
      cumulativeActual = Number((cumulativeActual + periodActual).toFixed(2));

      return {
        periodLabel: period.monthLabel,
        periodIndex: period.monthIndex,
        year: period.year,
        cumulativeActual,
        periodActual,
      };
    });

    const baselineSaved = await upsertSCurveBaseline(projectId, 'monthly', baselinePayload);
    if (!baselineSaved) {
      showNotification('error', 'Gagal menyimpan data baseline S-Curve');
      return false;
    }

    const actualSaved = await upsertSCurveActual(projectId, 'monthly', actualPayload);
    if (!actualSaved) {
      showNotification('error', 'Gagal menyimpan data realisasi S-Curve');
      return false;
    }

    return true;
  };

  const getActivitiesWeightError = (): string | null => {
    for (let index = 0; index < activities.length; index += 1) {
      const activity = activities[index];
      if (!Number.isFinite(activity.weight) || activity.weight < 0 || activity.weight > 100) {
        const label = activity.code || activity.activityName || `Baris ${index + 1}`;
        return `Bobot activity "${label}" harus di antara 0 sampai 100`;
      }
    }
    return null;
  };

  const syncActivitiesForProject = async (projectId: string, picValue: string): Promise<ActivitySyncResult> => {
    if (!supabase) {
      return {
        success: false,
        errorMessage: 'Koneksi Supabase tidak tersedia',
      };
    }

    const { error: deleteError } = await supabase.from('activities').delete().eq('project_id', projectId);
    if (deleteError) {
      console.error('Error deleting old activities:', deleteError);
      return {
        success: false,
        errorMessage: deleteError.message || 'Gagal menghapus data activity lama',
      };
    }

    for (const activity of activities) {
      const created = await createActivity(projectId, {
        code: activity.code,
        activityName: activity.activityName,
        pic: picValue,
        weight: activity.weight,
        evidence: activity.evidence || '',
        status: (activity.status || 'not-started') as
          | 'not-started'
          | 'in-progress'
          | 'completed'
          | 'delayed'
          | 'on-hold',
        startDate: activity.startDate || null,
        endDate: activity.endDate || null,
      });

      if (!created) {
        return {
          success: false,
          errorMessage: `Gagal menyimpan activity "${activity.code || activity.activityName || 'tanpa nama'}"`,
        };
      }
    }

    return {
      success: true,
    };
  };

  const handleSaveActivities = async () => {
    if (!editingProject) {
      showNotification('error', 'Simpan project terlebih dahulu sebelum menyimpan activities');
      return;
    }

    const activitiesWeightError = getActivitiesWeightError();
    if (activitiesWeightError) {
      showNotification('error', activitiesWeightError);
      return;
    }

    if (!activitiesDirty) {
      showNotification('success', 'Tidak ada perubahan activity untuk disimpan');
      return;
    }

    setSavingActivities(true);
    const syncResult = await syncActivitiesForProject(editingProject.id, formData.pic || editingProject.pic);
    setSavingActivities(false);

    if (!syncResult.success) {
      showNotification('error', `Gagal menyimpan activities: ${syncResult.errorMessage || 'Unknown error'}`);
      return;
    }

    const draftFromActivities = buildDraftMapFromActivities(formData.startDate, formData.endDate, activities);
    setSCurveDraftMap(draftFromActivities);
    setSCurveRows(buildRowsForTimeline(formData.startDate, formData.endDate, draftFromActivities));

    const sCurveSaved = await saveSCurveForProject(editingProject.id, draftFromActivities);
    if (!sCurveSaved) {
      return;
    }

    setActivitiesDirty(false);
    showNotification('success', 'Activities dan S-Curve berhasil disimpan');
  };

  const handleSave = async () => {
    if (!formData.name || !formData.pic || !formData.startDate || !formData.endDate) {
      showNotification('error', 'Nama, PIC, dan tanggal wajib diisi');
      return;
    }

    const activitiesWeightError = getActivitiesWeightError();
    if (activitiesWeightError) {
      showNotification('error', activitiesWeightError);
      return;
    }

    if (isCreating) {
      const newProject = await createProject(formData as Omit<Project, 'id' | 'createdAt' | 'updatedAt'>);
      if (!newProject) {
        showNotification('error', 'Gagal membuat project');
        return;
      }

      const syncResult = await syncActivitiesForProject(newProject.id, formData.pic || '');
      if (!syncResult.success) {
        showNotification('error', `Gagal menyimpan activities: ${syncResult.errorMessage || 'Unknown error'}`);
        return;
      }

      const draftFromActivities = buildDraftMapFromActivities(formData.startDate, formData.endDate, activities);
      setSCurveDraftMap(draftFromActivities);
      setSCurveRows(buildRowsForTimeline(formData.startDate, formData.endDate, draftFromActivities));

      const sCurveSaved = await saveSCurveForProject(newProject.id, draftFromActivities);
      if (!sCurveSaved) return;

      setActivitiesDirty(false);
      showNotification('success', 'Project dan S-Curve berhasil dibuat');
      loadProjects();
      handleCancel();
      return;
    }

    if (!editingProject) return;

    const success = await updateProject(editingProject.id, formData);
    if (!success) {
      showNotification('error', 'Gagal mengupdate project');
      return;
    }

    const syncResult = await syncActivitiesForProject(editingProject.id, formData.pic || editingProject.pic);
    if (!syncResult.success) {
      showNotification('error', `Gagal menyimpan activities: ${syncResult.errorMessage || 'Unknown error'}`);
      return;
    }

    const draftFromActivities = buildDraftMapFromActivities(formData.startDate, formData.endDate, activities);
    setSCurveDraftMap(draftFromActivities);
    setSCurveRows(buildRowsForTimeline(formData.startDate, formData.endDate, draftFromActivities));

    const sCurveSaved = await saveSCurveForProject(editingProject.id, draftFromActivities);
    if (!sCurveSaved) return;

    setActivitiesDirty(false);
    showNotification('success', 'Project dan S-Curve berhasil diupdate');
    loadProjects();
    handleCancel();
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    setDeleteConfirm({ projectId, projectName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    const success = await deleteProject(deleteConfirm.projectId);
    if (success) {
      showNotification('success', 'Project berhasil dihapus');
      loadProjects();
    } else {
      showNotification('error', 'Gagal menghapus project');
    }
    setDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Activity management functions
  const addActivity = () => {
    setActivities([
      ...activities,
      {
        code: '',
        activityName: '',
        weight: 0,
        evidence: '',
        startDate: '',
        endDate: '',
        status: 'not-started',
      },
    ]);
    setActivitiesDirty(true);
  };

  const updateActivity = (index: number, field: keyof ActivityFormRow, value: string | number) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value } as ActivityFormRow;
    setActivities(updated);
    setActivitiesDirty(true);
  };

  const removeActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
    setActivitiesDirty(true);
  };

  const generateAutoWeights = () => {
    if (activities.length === 0) {
      showNotification('error', 'Tambahkan minimal 1 activity terlebih dahulu');
      return;
    }

    const totalUnits = 1000; // 100.0% in 0.1% units
    const totalActivities = activities.length;
    const baseUnits = Math.floor(totalUnits / totalActivities);
    let remainder = totalUnits - baseUnits * totalActivities;

    const redistributed = activities.map((activity) => {
      const units = baseUnits + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;

      return {
        ...activity,
        weight: Number((units / 10).toFixed(1)),
      };
    });

    setActivities(redistributed);
    setActivitiesDirty(true);
    showNotification('success', `Bobot otomatis diperbarui ke total 100% (${totalActivities} activity)`);
  };

  // Evidence upload handler
  const handleEvidenceUpload = async (index: number, file: File) => {
    const projectId = editingProject?.id || 'new';
    const code = activities[index]?.code || `act${index}`;

    setUploadingEvidence(index);
    try {
      const url = await uploadEvidence(file, projectId, code);
      if (url) {
        updateActivity(index, 'evidence', url);
        showNotification('success', `File "${file.name}" berhasil diupload`);
      } else {
        showNotification('error', 'Gagal mengupload file');
      }
    } catch {
      showNotification('error', 'Terjadi kesalahan saat upload');
    } finally {
      setUploadingEvidence(null);
    }
  };

  // Evidence delete handler
  const handleEvidenceDelete = async (index: number) => {
    const url = activities[index]?.evidence;
    if (!url) return;

    const confirmed = window.confirm('Yakin ingin menghapus file evidence ini?');
    if (!confirmed) return;

    const deleted = await deleteEvidence(url);
    if (deleted) {
      updateActivity(index, 'evidence', '');
      showNotification('success', 'Evidence berhasil dihapus');
    } else {
      // Still clear the field even if storage delete fails (URL might be manual)
      updateActivity(index, 'evidence', '');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage Data</h1>
              <p className="text-slate-600">Kelola project, activities, dan S-Curve data</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Year Filter */}
              {(() => {
                const availableYears = Array.from(
                  new Set(projects.map((p) => new Date(p.startDate).getFullYear()))
                ).sort((a, b) => b - a);
                return availableYears.length > 1 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm shadow-sm">
                    <Calendar size={16} className="text-slate-500" />
                    <select
                      value={selectedYear ?? ''}
                      onChange={(e) =>
                        setSelectedYear(e.target.value ? Number(e.target.value) : null)
                      }
                      className="outline-none bg-transparent text-slate-700 font-medium cursor-pointer"
                    >
                      <option value="">Semua Tahun</option>
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null;
              })()}
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <Plus size={20} />
                Tambah Project
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Konfirmasi Hapus</h3>
                  <p className="text-sm text-slate-600">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>

              <p className="text-slate-700 mb-6">
                Yakin ingin menghapus project <strong>"{deleteConfirm.projectName}"</strong>?
                Semua data terkait (activities, progress, S-Curve) akan terhapus.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Ya, Hapus
                </button>
                <button
                  onClick={cancelDelete}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-4 ${notification.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
              }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* Form (Create/Edit) */}
        {(isCreating || editingProject) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 animate-in slide-in-from-top-4">
            <h2 className="text-xl font-bold text-slate-900 mb-4">{isCreating ? 'Tambah Project Baru' : 'Edit Project'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nama Project <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Monitoring Biodiversity Blora"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PIC <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pic || ''}
                  onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="ARIEF"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Uraian Kegiatan/Program</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={3}
                  placeholder="Program monitoring keanekaragaman hayati..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Pilih Category</option>
                  <option value="Environmental">Environmental</option>
                  <option value="Social">Social</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Blora, Jawa Tengah"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Budget (Rp)</label>
                <input
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="200000000"
                />
              </div>
            </div>

            {/* Activities Section */}
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Activities</h3>
                  <p className="text-sm text-slate-600">Tambahkan kegiatan untuk project ini (opsional)</p>
                  {editingProject && activitiesDirty && (
                    <p className="text-xs text-amber-600 mt-1">Perubahan activity belum disimpan.</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingProject && (
                    <button
                      type="button"
                      onClick={handleSaveActivities}
                      disabled={!activitiesDirty || savingActivities}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!activitiesDirty || savingActivities
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                      {savingActivities ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Simpan Activities
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={generateAutoWeights}
                    disabled={activities.length === 0}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activities.length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                  >
                    <Wand2 size={16} />
                    Generate Bobot 100%
                  </button>
                  <button
                    type="button"
                    onClick={addActivity}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Tambah Activity
                  </button>
                </div>
              </div>

              {activities.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Kode</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Nama Activity</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Start Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">End Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Bobot (%)</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Evidence</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-700">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activities.map((activity, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={activity.code}
                              onChange={(e) => updateActivity(index, 'code', e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="A"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={activity.activityName}
                              onChange={(e) => updateActivity(index, 'activityName', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="Nama kegiatan"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={activity.startDate}
                              onChange={(e) => updateActivity(index, 'startDate', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={activity.endDate}
                              onChange={(e) => updateActivity(index, 'endDate', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={activity.status || 'not-started'}
                              onChange={(e) => updateActivity(index, 'status', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                              <option value="not-started">Belum Dimulai</option>
                              <option value="in-progress">Sedang Berjalan</option>
                              <option value="completed">Selesai</option>
                              <option value="delayed">Terlambat</option>
                              <option value="on-hold">Ditunda</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={activity.weight}
                              onChange={(e) => updateActivity(index, 'weight', Number.parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 min-w-[160px]">
                              {uploadingEvidence === index ? (
                                <div className="flex items-center gap-2 text-blue-600">
                                  <Loader2 size={14} className="animate-spin" />
                                  <span className="text-xs">Uploading...</span>
                                </div>
                              ) : activity.evidence ? (
                                <div className="flex items-center gap-1">
                                  {activity.evidence.match(/\.(pdf)$/i) ? (
                                    <FileText size={14} className="text-red-500 flex-shrink-0" />
                                  ) : (
                                    <ImageIcon size={14} className="text-green-500 flex-shrink-0" />
                                  )}
                                  <a
                                    href={activity.evidence}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline truncate max-w-[80px]"
                                    title={activity.evidence}
                                  >
                                    Lihat File
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleEvidenceDelete(index)}
                                    className="p-0.5 text-slate-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
                                    title="Hapus file"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {/* File upload button */}
                                  <input
                                    type="file"
                                    accept=".pdf,image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    ref={(el) => { evidenceFileRefs.current[index] = el; }}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleEvidenceUpload(index, f);
                                      e.target.value = '';
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => evidenceFileRefs.current[index]?.click()}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                    title="Upload PDF atau gambar"
                                  >
                                    <Paperclip size={12} />
                                    File
                                  </button>
                                  {/* Camera capture button */}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    ref={(el) => { evidenceCameraRefs.current[index] = el; }}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleEvidenceUpload(index, f);
                                      e.target.value = '';
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => evidenceCameraRefs.current[index]?.click()}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                    title="Ambil foto dari kamera"
                                  >
                                    <Camera size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeActivity(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={5} className="px-3 py-2 text-right">
                          Total Bobot:
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-slate-700">
                            {activities.reduce((sum, a) => sum + a.weight, 0).toFixed(1)}%
                          </span>
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activities.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                  Belum ada activity. Klik "Tambah Activity" untuk menambahkan.
                </div>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Tip: gunakan tombol "Generate Bobot 100%" untuk membagi bobot otomatis agar total selalu tepat 100%.
              </p>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                S-Curve bulanan dihitung otomatis dari bobot, rentang tanggal, dan status di tabel Activities saat data disimpan.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Save size={18} />
                Simpan
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <X size={18} />
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(selectedYear
            ? projects.filter((p) => new Date(p.startDate).getFullYear() === selectedYear)
            : projects
          ).map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-1">{project.name}</h3>
                    <p className="text-sm text-slate-500">PIC: {project.pic}</p>
                  </div>
                </div>
              </div>

              {project.description && <p className="text-sm text-slate-600 mb-4 line-clamp-2">{project.description}</p>}

              <div className="space-y-2 mb-4 text-sm">
                {project.location && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">📍</span>
                    <span>{project.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">📅</span>
                  <span>
                    {new Date(project.startDate).toLocaleDateString('id-ID')} -{' '}
                    {new Date(project.endDate).toLocaleDateString('id-ID')}
                  </span>
                </div>
                {project.budget && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">💰</span>
                    <span>Rp {(project.budget / 1000000).toFixed(0)}M</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${project.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : project.status === 'completed'
                      ? 'bg-blue-100 text-blue-700'
                      : project.status === 'on-hold'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                >
                  {project.status}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(project)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && !isCreating && (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Project</h3>
            <p className="text-slate-600 mb-6">Mulai dengan menambahkan project pertama Anda</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              Tambah Project
            </button>
          </div>
        )}

        {/* Filtered empty state */}
        {selectedYear &&
          projects.length > 0 &&
          projects.filter((p) => new Date(p.startDate).getFullYear() === selectedYear).length === 0 &&
          !isCreating && (
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tidak Ada Proyek Tahun {selectedYear}</h3>
              <p className="text-slate-600 mb-4">
                Tidak ditemukan proyek dengan tahun anggaran {selectedYear}.
              </p>
              <button
                onClick={() => setSelectedYear(null)}
                className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Tampilkan Semua Tahun
              </button>
            </div>
          )}
      </div>
    </div>
  );
};
