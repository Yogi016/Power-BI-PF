import { supabase } from './supabaseClient';
import {
  Project,
  SCurveDataPoint,
  ActivityData,
  ProjectMetrics,
  WorkProject,
  WorkDailyData,
  DocumentCategory,
  DocumentItem,
  AssetItem,
  CooperationDocument,
  CooperationDocumentApproval,
  CooperationDocumentStatus,
  CooperationDocumentType,
  CooperationDocumentVersion,
  CooperationProjectLink,
  CooperationRevisionSource,
  CreateCooperationDocumentInput,
  PortfolioSeriesPoint,
  UserRole,
  HelpRequestStatus,
  HelpRequestSummary,
  HelpRequestMessage,
  RecipientOption,
} from '../types';
import { hasUnread } from './helpRequests';
// Using Cloudflare Worker via VITE_R2_WORKER_URL for secure uploads

// =====================================================
// STORAGE VALIDATION HELPERS
// =====================================================

const MAX_EVIDENCE_SIZE_MB = 100;
const MAX_DOCUMENT_SIZE_MB = 300;
const MAX_ASSET_SIZE_MB = 100;

const ALLOWED_EVIDENCE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png',
];

function validateFile(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number
): void {
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi batas ${maxSizeMB}MB. Ukuran saat ini: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
  }
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Format file tidak didukung: ${file.type || 'unknown'}. Format yang diizinkan: ${allowedTypes.join(', ')}`);
  }
}

function validateFileSize(file: File, maxSizeMB: number): void {
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi batas ${maxSizeMB}MB. Ukuran saat ini: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
  }
}

// =====================================================
// PROJECT OPERATIONS
// =====================================================

/**
 * Fetch active projects from Supabase.
 */
export async function fetchProjects(): Promise<Project[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .neq('status', 'completed')
      .order('start_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapProjectRow);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

/**
 * Fetch closed projects from Supabase.
 */
export async function fetchClosedProjects(): Promise<Project[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapProjectRow);
  } catch (error) {
    console.error('Error fetching closed projects:', error);
    return [];
  }
}

function mapProjectRow(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    pic: row.pic,
    description: row.description,
    category: row.category,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    budget: row.budget,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch single project by ID
 */
export async function fetchProjectById(projectId: string): Promise<Project | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      pic: data.pic,
      description: data.description,
      category: data.category,
      location: data.location,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      budget: data.budget,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

// =====================================================
// S-CURVE DATA OPERATIONS
// =====================================================

/**
 * Fetch S-Curve data for a project
 */
export async function fetchSCurveData(
  projectId: string,
  periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly'
): Promise<SCurveDataPoint[]> {
  if (!supabase) return [];

  try {
    // For yearly, we'll aggregate monthly data
    const actualPeriodType = periodType === 'yearly' ? 'monthly' : periodType;

    // Fetch baseline data
    const { data: baselineData, error: baselineError } = await supabase
      .from('s_curve_baseline')
      .select('*')
      .eq('project_id', projectId)
      .eq('period_type', actualPeriodType)
      .order('year', { ascending: true })
      .order('period_index', { ascending: true });

    if (baselineError) throw baselineError;

    // Fetch actual data
    const { data: actualData, error: actualError } = await supabase
      .from('s_curve_actual')
      .select('*')
      .eq('project_id', projectId)
      .eq('period_type', actualPeriodType)
      .order('year', { ascending: true })
      .order('period_index', { ascending: true });

    if (actualError) throw actualError;

    // Merge baseline and actual data
    const dataMap = new Map<string, SCurveDataPoint>();

    (baselineData || []).forEach(row => {
      const key = `${row.year}-${row.period_index}`;
      dataMap.set(key, {
        periodLabel: row.period_label,
        periodIndex: row.period_index,
        year: row.year,
        baseline: row.cumulative_baseline || 0,
        actual: 0,
        periodBaseline: row.period_baseline || 0,
        periodActual: 0,
        variance: 0,
      });
    });

    (actualData || []).forEach(row => {
      const key = `${row.year}-${row.period_index}`;
      const existing = dataMap.get(key);
      if (existing) {
        existing.actual = row.cumulative_actual || 0;
        existing.periodActual = row.period_actual || 0;
        existing.variance = existing.actual - existing.baseline;
      } else {
        dataMap.set(key, {
          periodLabel: row.period_label,
          periodIndex: row.period_index,
          year: row.year,
          baseline: 0,
          actual: row.cumulative_actual || 0,
          periodBaseline: 0,
          periodActual: row.period_actual || 0,
          variance: row.cumulative_actual || 0,
        });
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.periodIndex - b.periodIndex;
    });
  } catch (error) {
    console.error('Error fetching S-Curve data:', error);
    return [];
  }
}

/**
 * Aggregate a budget-weighted portfolio S-Curve across projects.
 *
 * Reads the same tables Manage Data writes to (`s_curve_baseline` /
 * `s_curve_actual`) so the dashboard reflects real entered data. Each project's
 * cumulative % at a given period is weighted by its budget; periods where no
 * contributing project has a budget fall back to a simple average so the curve
 * still renders. Returns `null` for a series at a period with no data (so the
 * chart can span the plan while stopping actual at the last realised period).
 */
export async function fetchPortfolioSCurve(
  periodType: 'weekly' | 'monthly' = 'monthly',
  projectIds?: string[]
): Promise<PortfolioSeriesPoint[]> {
  if (!supabase) return [];

  try {
    // 1. Active projects + their weight (budget). Optionally scoped.
    let projectQuery = supabase
      .from('projects')
      .select('id, budget')
      .neq('status', 'completed');
    if (projectIds && projectIds.length > 0) {
      projectQuery = projectQuery.in('id', projectIds);
    }
    const { data: projectRows, error: projectError } = await projectQuery;
    if (projectError) throw projectError;

    const rows = projectRows || [];
    if (rows.length === 0) return [];

    const ids = rows.map((p: any) => p.id);
    const weightById = new Map<string, number>();
    rows.forEach((p: any) => {
      const b = Number(p.budget);
      weightById.set(p.id, Number.isFinite(b) && b > 0 ? b : 0);
    });

    // 2. Bulk-fetch baseline + actual for those projects (one round-trip each).
    const [baselineRes, actualRes] = await Promise.all([
      supabase
        .from('s_curve_baseline')
        .select('project_id, period_label, period_index, year, cumulative_baseline')
        .eq('period_type', periodType)
        .in('project_id', ids),
      supabase
        .from('s_curve_actual')
        .select('project_id, period_label, period_index, year, cumulative_actual')
        .eq('period_type', periodType)
        .in('project_id', ids),
    ]);
    if (baselineRes.error) throw baselineRes.error;
    if (actualRes.error) throw actualRes.error;

    // 3. Weighted aggregation per (year, period_index).
    interface Bucket {
      label: string;
      year: number;
      index: number;
      planWeighted: number; planWeight: number; planSum: number; planCount: number;
      actualWeighted: number; actualWeight: number; actualSum: number; actualCount: number;
    }
    const buckets = new Map<string, Bucket>();
    const ensure = (year: number, index: number, label: string): Bucket => {
      const key = `${year}-${index}`;
      let b = buckets.get(key);
      if (!b) {
        b = {
          label, year, index,
          planWeighted: 0, planWeight: 0, planSum: 0, planCount: 0,
          actualWeighted: 0, actualWeight: 0, actualSum: 0, actualCount: 0,
        };
        buckets.set(key, b);
      }
      return b;
    };

    (baselineRes.data || []).forEach((row: any) => {
      const b = ensure(row.year, row.period_index, row.period_label);
      const value = Number(row.cumulative_baseline) || 0;
      const w = weightById.get(row.project_id) ?? 0;
      b.planWeighted += value * w;
      b.planWeight += w;
      b.planSum += value;
      b.planCount += 1;
    });
    (actualRes.data || []).forEach((row: any) => {
      const b = ensure(row.year, row.period_index, row.period_label);
      const value = Number(row.cumulative_actual) || 0;
      const w = weightById.get(row.project_id) ?? 0;
      b.actualWeighted += value * w;
      b.actualWeight += w;
      b.actualSum += value;
      b.actualCount += 1;
    });

    // Weighted mean when budgets exist; equal-weight mean otherwise; null if empty.
    const resolve = (weighted: number, weight: number, sum: number, count: number): number | null => {
      if (weight > 0) return Math.round((weighted / weight) * 100) / 100;
      if (count > 0) return Math.round((sum / count) * 100) / 100;
      return null;
    };

    return [...buckets.values()]
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.index - b.index))
      .map((b) => ({
        month: b.label,
        plan: resolve(b.planWeighted, b.planWeight, b.planSum, b.planCount),
        actual: resolve(b.actualWeighted, b.actualWeight, b.actualSum, b.actualCount),
      }));
  } catch (error) {
    console.error('Error fetching portfolio S-Curve:', error);
    return [];
  }
}

// =====================================================
// ACTIVITY OPERATIONS
// =====================================================

/**
 * Fetch activities for a project
 */
export async function fetchActivities(projectId: string): Promise<ActivityData[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('project_id', projectId)
      .order('code', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      code: row.code,
      activityName: row.activity_name,
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      status: row.status || 'not-started',
      pic: row.pic,
      weight: row.weight,
      // Legacy fields for backward compatibility
      project: '',
      category: row.category,
      subCategory: row.sub_category,
      activity: row.activity_name,
      weeklyProgress: {},
      startWeek: row.start_week,
      endWeek: row.end_week,
      evidence: row.evidence || '[]',
    }));
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

/**
 * Fetch weekly progress for an activity
 */
export async function fetchWeeklyProgress(activityId: string): Promise<Record<string, number>> {
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from('weekly_progress')
      .select('week_label, progress_value')
      .eq('activity_id', activityId)
      .order('week_index', { ascending: true });

    if (error) throw error;

    const weeklyProgress: Record<string, number> = {};
    (data || []).forEach(row => {
      weeklyProgress[row.week_label] = row.progress_value || 0;
    });

    return weeklyProgress;
  } catch (error) {
    console.error('Error fetching weekly progress:', error);
    return {};
  }
}

// =====================================================
// PROJECT METRICS
// =====================================================

/**
 * Calculate project metrics
 */
export async function fetchProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
  if (!supabase) return null;

  try {
    // Fetch project
    const project = await fetchProjectById(projectId);
    if (!project) return null;

    // Fetch activities
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('project_id', projectId);

    if (activitiesError) throw activitiesError;

    const totalActivities = activities?.length || 0;
    const completedActivities = activities?.filter(a => a.status === 'completed').length || 0;
    const inProgressActivities = activities?.filter(a => a.status === 'in-progress').length || 0;
    const delayedActivities = activities?.filter(a => a.status === 'delayed').length || 0;

    // Fetch latest S-Curve data
    const sCurveData = await fetchSCurveData(projectId, 'monthly');
    const latestData = sCurveData[sCurveData.length - 1];

    const overallProgress = latestData?.actual || 0;
    const plannedProgress = latestData?.baseline || 0;
    const variance = overallProgress - plannedProgress;

    // Calculate days remaining
    const endDate = new Date(project.endDate);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate completion rate
    const completionRate = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

    return {
      totalActivities,
      completedActivities,
      inProgressActivities,
      delayedActivities,
      overallProgress,
      plannedProgress,
      variance,
      daysRemaining,
      completionRate,
    };
  } catch (error) {
    console.error('Error calculating project metrics:', error);
    return null;
  }
}

// =====================================================
// UPDATE OPERATIONS
// =====================================================

/**
 * Update project progress
 */
export async function updateProjectProgress(
  projectId: string,
  periodType: 'weekly' | 'monthly',
  periodIndex: number,
  year: number,
  actualValue: number
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('s_curve_actual')
      .upsert({
        project_id: projectId,
        period_type: periodType,
        period_index: periodIndex,
        year: year,
        cumulative_actual: actualValue,
      }, {
        onConflict: 'project_id,period_type,period_index,year'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating progress:', error);
    return false;
  }
}

/**
 * Update activity status
 */
export async function updateActivityStatus(
  activityId: string,
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed'
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activities')
      .update({ status })
      .eq('id', activityId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating activity status:', error);
    return false;
  }
}

/**
 * Update activity dates (for Gantt chart drag-to-reschedule)
 */
export async function updateActivityDates(
  activityId: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activities')
      .update({
        start_date: startDate,
        end_date: endDate,
      })
      .eq('id', activityId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating activity dates:', error);
    return false;
  }
}


// =====================================================
// CREATE OPERATIONS
// =====================================================

/**
 * Create new project
 */
export async function createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: projectData.name,
        pic: projectData.pic,
        description: projectData.description,
        category: projectData.category,
        location: projectData.location,
        start_date: projectData.startDate,
        end_date: projectData.endDate,
        status: projectData.status,
        budget: projectData.budget,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      pic: data.pic,
      description: data.description,
      category: data.category,
      location: data.location,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      budget: data.budget,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

/**
 * Update existing project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.pic !== undefined) updateData.pic = updates.pic;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.budget !== undefined) updateData.budget = updates.budget;

    const { error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    return false;
  }
}

/**
 * Delete project (will cascade delete activities and S-Curve data)
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

// =====================================================
// ACTIVITY CRUD OPERATIONS
// =====================================================

/**
 * Create new activity
 */
export async function createActivity(
  projectId: string,
  activityData: {
    code: string;
    activityName: string;
    category?: string;
    subCategory?: string;
    pic: string;
    weight?: number;
    evidence?: string;
    startWeek?: number;
    endWeek?: number;
    startDate?: string | null;
    endDate?: string | null;
    status?: 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'on-hold';
  }
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activities')
      .insert({
        project_id: projectId,
        code: activityData.code,
        activity_name: activityData.activityName,
        category: activityData.category,
        sub_category: activityData.subCategory,
        pic: activityData.pic,
        weight: activityData.weight || 0,
        evidence: activityData.evidence || null,
        start_week: activityData.startWeek,
        end_week: activityData.endWeek,
        start_date: activityData.startDate,
        end_date: activityData.endDate,
        status: activityData.status || 'not-started',
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating activity:', error);
    return false;
  }
}

/**
 * Update activity
 */
export async function updateActivity(
  activityId: string,
  updates: Partial<{
    code: string;
    activityName: string;
    category: string;
    subCategory: string;
    pic: string;
    weight: number;
    evidence: string;
    startWeek: number;
    endWeek: number;
    startDate: string;
    endDate: string;
    status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  }>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const updateData: any = {};
    if (updates.code !== undefined) updateData.code = updates.code;
    if (updates.activityName !== undefined) updateData.activity_name = updates.activityName;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.subCategory !== undefined) updateData.sub_category = updates.subCategory;
    if (updates.pic !== undefined) updateData.pic = updates.pic;
    if (updates.weight !== undefined) updateData.weight = updates.weight;
    if (updates.evidence !== undefined) updateData.evidence = updates.evidence;
    if (updates.startWeek !== undefined) updateData.start_week = updates.startWeek;
    if (updates.endWeek !== undefined) updateData.end_week = updates.endWeek;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.status !== undefined) updateData.status = updates.status;

    const { error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', activityId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating activity:', error);
    return false;
  }
}

/**
 * Delete activity
 */
export async function deleteActivity(activityId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting activity:', error);
    return false;
  }
}

// =====================================================
// S-CURVE DATA OPERATIONS
// =====================================================

/**
 * Upsert S-Curve baseline data
 */
export async function upsertSCurveBaseline(
  projectId: string,
  periodType: 'weekly' | 'monthly',
  data: Array<{
    periodLabel: string;
    periodIndex: number;
    year: number;
    cumulativeBaseline: number;
    periodBaseline: number;
  }>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const records = data.map(d => ({
      project_id: projectId,
      period_type: periodType,
      period_label: d.periodLabel,
      period_index: d.periodIndex,
      year: d.year,
      cumulative_baseline: d.cumulativeBaseline,
      period_baseline: d.periodBaseline,
    }));

    const { error } = await supabase
      .from('s_curve_baseline')
      .upsert(records, {
        onConflict: 'project_id,period_type,period_index,year'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting S-Curve baseline:', error);
    return false;
  }
}

/**
 * Upsert S-Curve actual data
 */
export async function upsertSCurveActual(
  projectId: string,
  periodType: 'weekly' | 'monthly',
  data: Array<{
    periodLabel: string;
    periodIndex: number;
    year: number;
    cumulativeActual: number;
    periodActual: number;
  }>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const records = data.map(d => ({
      project_id: projectId,
      period_type: periodType,
      period_label: d.periodLabel,
      period_index: d.periodIndex,
      year: d.year,
      cumulative_actual: d.cumulativeActual,
      period_actual: d.periodActual,
    }));

    const { error } = await supabase
      .from('s_curve_actual')
      .upsert(records, {
        onConflict: 'project_id,period_type,period_index,year'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting S-Curve actual:', error);
    return false;
  }
}

// =====================================================
// WEEKLY PROGRESS OPERATIONS
// =====================================================

/**
 * Fetch weekly progress for an activity
 */
export async function fetchWeeklyProgressForActivity(
  activityId: string
): Promise<Array<{
  weekLabel: string;
  weekIndex: number;
  year: number;
  progressValue: number;
}>> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('weekly_progress')
      .select('*')
      .eq('activity_id', activityId)
      .order('year', { ascending: true })
      .order('week_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      weekLabel: row.week_label,
      weekIndex: row.week_index,
      year: row.year,
      progressValue: row.progress_value || 0,
    }));
  } catch (error) {
    console.error('Error fetching weekly progress:', error);
    return [];
  }
}

/**
 * Update single weekly progress entry
 */
export async function updateWeeklyProgress(
  activityId: string,
  weekLabel: string,
  weekIndex: number,
  year: number,
  progressValue: number
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('weekly_progress')
      .upsert({
        activity_id: activityId,
        week_label: weekLabel,
        week_index: weekIndex,
        year: year,
        progress_value: progressValue,
      }, {
        onConflict: 'activity_id,week_index,year'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating weekly progress:', error);
    return false;
  }
}

/**
 * Batch update weekly progress
 */
export async function batchUpdateWeeklyProgress(
  updates: Array<{
    activityId: string;
    weekLabel: string;
    weekIndex: number;
    year: number;
    progressValue: number;
  }>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const records = updates.map(u => ({
      activity_id: u.activityId,
      week_label: u.weekLabel,
      week_index: u.weekIndex,
      year: u.year,
      progress_value: u.progressValue,
    }));

    const { error } = await supabase
      .from('weekly_progress')
      .upsert(records, {
        onConflict: 'activity_id,week_index,year'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error batch updating weekly progress:', error);
    return false;
  }
}

// =====================================================
// MULTI-PROJECT AGGREGATION
// =====================================================

/**
 * Fetch and aggregate S-Curve data from all projects
 */
export async function fetchAllProjectsSCurveData(
  periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly',
  projectIds?: string[]
): Promise<SCurveDataPoint[]> {
  if (!supabase) return [];
  if (projectIds && projectIds.length === 0) return [];

  try {
    const actualPeriodType = periodType === 'yearly' ? 'monthly' : periodType;

    // Fetch all baseline data
    let baselineQuery = supabase
      .from('s_curve_baseline')
      .select('*')
      .eq('period_type', actualPeriodType);

    if (projectIds) {
      baselineQuery = baselineQuery.in('project_id', projectIds);
    }

    const { data: baselineData, error: baselineError } = await baselineQuery
      .order('year', { ascending: true })
      .order('period_index', { ascending: true });

    if (baselineError) throw baselineError;

    // Fetch all actual data
    let actualQuery = supabase
      .from('s_curve_actual')
      .select('*')
      .eq('period_type', actualPeriodType);

    if (projectIds) {
      actualQuery = actualQuery.in('project_id', projectIds);
    }

    const { data: actualData, error: actualError } = await actualQuery
      .order('year', { ascending: true })
      .order('period_index', { ascending: true });

    if (actualError) throw actualError;

    // Group by period and calculate average
    const periodMap = new Map<string, {
      periodLabel: string;
      periodIndex: number;
      year: number;
      baselineValues: number[];
      actualValues: number[];
    }>();

    // Process baseline data
    (baselineData || []).forEach(row => {
      const key = `${row.year}-${row.period_index}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          periodLabel: row.period_label,
          periodIndex: row.period_index,
          year: row.year,
          baselineValues: [],
          actualValues: [],
        });
      }
      periodMap.get(key)!.baselineValues.push(row.cumulative_baseline || 0);
    });

    // Process actual data
    (actualData || []).forEach(row => {
      const key = `${row.year}-${row.period_index}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          periodLabel: row.period_label,
          periodIndex: row.period_index,
          year: row.year,
          baselineValues: [],
          actualValues: [],
        });
      }
      periodMap.get(key)!.actualValues.push(row.cumulative_actual || 0);
    });

    // Calculate averages
    const result: SCurveDataPoint[] = Array.from(periodMap.values()).map(period => {
      const avgBaseline = period.baselineValues.length > 0
        ? period.baselineValues.reduce((a, b) => a + b, 0) / period.baselineValues.length
        : 0;

      const avgActual = period.actualValues.length > 0
        ? period.actualValues.reduce((a, b) => a + b, 0) / period.actualValues.length
        : 0;

      return {
        periodLabel: period.periodLabel,
        periodIndex: period.periodIndex,
        year: period.year,
        baseline: avgBaseline,
        actual: avgActual,
        periodBaseline: 0, // Could calculate delta if needed
        periodActual: 0,
        variance: avgActual - avgBaseline,
      };
    });

    // Sort by year and period
    return result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.periodIndex - b.periodIndex;
    });
  } catch (error) {
    console.error('Error fetching all projects S-Curve data:', error);
    return [];
  }
}

// =====================================================
// WORK PAGE OPERATIONS
// =====================================================

/**
 * Fetch all work projects
 */
export async function fetchWorkProjects(): Promise<WorkProject[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('work_projects')
      .select('*')
      .order('project_name', { ascending: true })
      .order('fase_name', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      projectName: row.project_name || row.name || '',
      faseName: row.fase_name || row.phase || '',
      target: row.target || row.target_pohon || 0,
      startDate: row.start_date,
      endDate: row.end_date,
      manpowerEksisting: row.manpower_eksisting,
      productivityTarget: row.productivity_target,
      obstacle: row.obstacle,
      actionPlan: row.action_plan,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching work projects:', error);
    return [];
  }
}

/**
 * Fetch single work project by ID
 */
export async function fetchWorkProjectById(projectId: string): Promise<WorkProject | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('work_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      projectName: data.project_name,
      faseName: data.fase_name,
      target: data.target,
      startDate: data.start_date,
      endDate: data.end_date,
      manpowerEksisting: data.manpower_eksisting,
      productivityTarget: data.productivity_target,
      obstacle: data.obstacle,
      actionPlan: data.action_plan,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error fetching work project:', error);
    return null;
  }
}

/**
 * Create new work project
 */
export async function createWorkProject(projectData: Omit<WorkProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkProject | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('work_projects')
      .insert({
        project_name: projectData.projectName,
        fase_name: projectData.faseName,
        target: projectData.target,
        start_date: projectData.startDate,
        end_date: projectData.endDate,
        manpower_eksisting: projectData.manpowerEksisting,
        productivity_target: projectData.productivityTarget,
        obstacle: projectData.obstacle,
        action_plan: projectData.actionPlan,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      projectName: data.project_name,
      faseName: data.fase_name,
      target: data.target,
      startDate: data.start_date,
      endDate: data.end_date,
      manpowerEksisting: data.manpower_eksisting,
      productivityTarget: data.productivity_target,
      obstacle: data.obstacle,
      actionPlan: data.action_plan,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating work project:', error);
    return null;
  }
}

/**
 * Update work project
 */
export async function updateWorkProject(
  projectId: string,
  updates: Partial<Omit<WorkProject, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const updateData: any = {};
    if (updates.projectName !== undefined) updateData.project_name = updates.projectName;
    if (updates.faseName !== undefined) updateData.fase_name = updates.faseName;
    if (updates.target !== undefined) updateData.target = updates.target;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.manpowerEksisting !== undefined) updateData.manpower_eksisting = updates.manpowerEksisting;
    if (updates.productivityTarget !== undefined) updateData.productivity_target = updates.productivityTarget;
    if (updates.obstacle !== undefined) updateData.obstacle = updates.obstacle;
    if (updates.actionPlan !== undefined) updateData.action_plan = updates.actionPlan;
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('work_projects')
      .update(updateData)
      .eq('id', projectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating work project:', error);
    return false;
  }
}

/**
 * Delete work project (cascades to daily data)
 */
export async function deleteWorkProject(projectId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('work_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting work project:', error);
    return false;
  }
}

/**
 * Fetch daily data for a work project
 */
export async function fetchWorkDailyData(workProjectId: string): Promise<WorkDailyData[]> {
  if (!supabase) return [];

  try {
    // Try primary table first (work_daily_data)
    const { data: primaryData, error: primaryError } = await supabase
      .from('work_daily_data')
      .select('*')
      .eq('work_project_id', workProjectId)
      .order('date', { ascending: true });

    if (!primaryError && primaryData && primaryData.length > 0) {
      // Get project start_date to compute proper sequential dayIndex
      const { data: projData } = await supabase
        .from('work_projects')
        .select('start_date')
        .eq('id', workProjectId)
        .single();

      const projectStart = projData ? new Date(projData.start_date) : null;

      // Check if we have actual_daily values (new data format)
      const hasActualDaily = primaryData.some(row => row.actual_daily != null && row.actual_daily > 0);

      if (hasActualDaily) {
        // NEW DATA PATH: recompute cumulative from actual_daily values (most reliable)
        let runningCumulative = 0;
        return primaryData.map(row => {
          let dayIndex = row.day_index;
          if (projectStart && row.date) {
            const rowDate = new Date(row.date);
            dayIndex = Math.ceil((rowDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }

          const dailyValue = row.actual_daily || 0;
          runningCumulative += dailyValue;

          return {
            id: row.id,
            workProjectId: row.work_project_id,
            date: row.date,
            dayIndex,
            planCumulative: row.plan_cumulative,
            actualCumulative: runningCumulative,
            planDaily: row.plan_daily,
            actualDaily: dailyValue,
          };
        });
      }

      // LEGACY DATA PATH: detect cumulative segments (month-boundary resets)
      // Within each month, stored cumulative is correct (increases monotonically).
      // At month boundaries, cumulative resets to near-zero.
      // True cumulative = sum of all completed segments' final values + current segment's value
      let segmentBaseOffset = 0;
      let prevStoredCum = 0;

      return primaryData.map((row, index) => {
        let dayIndex = row.day_index;
        if (projectStart && row.date) {
          const rowDate = new Date(row.date);
          dayIndex = Math.ceil((rowDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }

        const storedCum = row.actual_cumulative || 0;

        // Detect cumulative reset (new segment)
        if (index > 0 && storedCum < prevStoredCum) {
          segmentBaseOffset += prevStoredCum;
        }

        prevStoredCum = storedCum;
        const trueCumulative = segmentBaseOffset + storedCum;

        // Extract daily value for reference
        let dailyValue: number;
        if (index === 0) {
          dailyValue = storedCum;
        } else {
          const prevStored = primaryData[index - 1].actual_cumulative || 0;
          dailyValue = storedCum > prevStored ? storedCum - prevStored : storedCum;
        }

        return {
          id: row.id,
          workProjectId: row.work_project_id,
          date: row.date,
          dayIndex,
          planCumulative: row.plan_cumulative,
          actualCumulative: trueCumulative,
          planDaily: row.plan_daily,
          actualDaily: dailyValue,
        };
      });
    }

    // Fallback: try daily_work_data table with raw realisasi values
    const { data: rawData, error: rawError } = await supabase
      .from('daily_work_data')
      .select('*')
      .eq('project_id', workProjectId)
      .order('date', { ascending: true });

    if (rawError || !rawData || rawData.length === 0) return [];

    // Get the project to compute dayIndex from start_date
    const { data: projectData, error: projectError } = await supabase
      .from('work_projects')
      .select('start_date, generated_plan')
      .eq('id', workProjectId)
      .single();

    if (projectError || !projectData) return [];

    const projectStartDate = new Date(projectData.start_date);

    // Parse generated_plan to get plan cumulative values
    const planByDate = new Map<string, number>();
    if (projectData.generated_plan) {
      try {
        const planArray = JSON.parse(projectData.generated_plan);
        for (const p of planArray) {
          planByDate.set(p.date, p.cumulative || 0);
        }
      } catch (e) {
        console.warn('Could not parse generated_plan:', e);
      }
    }

    // Compute dayIndex and cumulative values from raw daily realisasi
    let cumulative = 0;
    return rawData.map(row => {
      const rowDate = new Date(row.date);
      const dayIndex = Math.ceil((rowDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dailyValue = row.realisasi || 0;
      cumulative += dailyValue;

      return {
        id: row.id,
        workProjectId: workProjectId,
        date: row.date,
        dayIndex,
        planCumulative: planByDate.get(row.date) || 0,
        actualCumulative: cumulative,
        planDaily: undefined,
        actualDaily: dailyValue,
      };
    });
  } catch (error) {
    console.error('Error fetching work daily data:', error);
    return [];
  }
}

/**
 * Upsert (create or update) daily data
 */
export async function upsertWorkDailyData(
  dailyData: Omit<WorkDailyData, 'id'>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('work_daily_data')
      .upsert({
        work_project_id: dailyData.workProjectId,
        date: dailyData.date,
        day_index: dailyData.dayIndex,
        plan_cumulative: dailyData.planCumulative,
        actual_cumulative: dailyData.actualCumulative,
        plan_daily: dailyData.planDaily,
        actual_daily: dailyData.actualDaily,
      }, {
        onConflict: 'work_project_id,date'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting work daily data:', error);
    return false;
  }
}

/**
 * Batch upsert daily data
 */
export async function batchUpsertWorkDailyData(
  dailyDataArray: Omit<WorkDailyData, 'id'>[]
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const records = dailyDataArray.map(d => ({
      work_project_id: d.workProjectId,
      date: d.date,
      day_index: d.dayIndex,
      plan_cumulative: d.planCumulative,
      actual_cumulative: d.actualCumulative,
      plan_daily: d.planDaily,
      actual_daily: d.actualDaily,
    }));

    const { error } = await supabase
      .from('work_daily_data')
      .upsert(records, {
        onConflict: 'work_project_id,date'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error batch upserting work daily data:', error);
    return false;
  }
}

/**
 * Delete daily data for a specific date
 */
export async function deleteWorkDailyData(workProjectId: string, date: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('work_daily_data')
      .delete()
      .eq('work_project_id', workProjectId)
      .eq('date', date);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting work daily data:', error);
    return false;
  }
}

// =====================================================
// WORK PLAN SCHEDULE OPERATIONS
// =====================================================

import { WorkPlanSchedule } from '../types';

/**
 * Fetch work plan schedule for a project
 */
export async function fetchWorkPlanSchedule(workProjectId: string): Promise<WorkPlanSchedule[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  try {
    // Try primary table first (work_plan_schedule)
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('work_plan_schedule')
      .select('*')
      .eq('work_project_id', workProjectId)
      .order('day_index', { ascending: true });

    if (!scheduleError && scheduleData && scheduleData.length > 0) {
      return scheduleData.map(row => ({
        id: row.id,
        workProjectId: row.work_project_id,
        dayIndex: row.day_index,
        date: row.date,
        dailyTarget: row.daily_target,
        weight: parseFloat(row.weight),
        planCumulative: row.plan_cumulative,
      }));
    }

    // Fallback: parse generated_plan JSON from work_projects
    const { data: projectData, error } = await supabase
      .from('work_projects')
      .select('start_date, generated_plan, target, target_pohon')
      .eq('id', workProjectId)
      .single();

    if (error || !projectData?.generated_plan) return [];

    const projectStartDate = new Date(projectData.start_date);
    const target = projectData.target || projectData.target_pohon || 0;

    try {
      const planArray = JSON.parse(projectData.generated_plan);
      return planArray.map((p: any) => {
        const planDate = new Date(p.date);
        const dayIndex = Math.ceil((planDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return {
          workProjectId,
          dayIndex,
          date: p.date,
          dailyTarget: p.dailyTarget || 0,
          weight: p.bobot || (target > 0 ? parseFloat(((p.dailyTarget / target) * 100).toFixed(2)) : 0),
          planCumulative: p.cumulative || 0,
        };
      });
    } catch (parseError) {
      console.warn('Could not parse generated_plan JSON:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error fetching work plan schedule:', error);
    return [];
  }
}

/**
 * Batch upsert work plan schedule
 */
export async function batchUpsertWorkPlanSchedule(
  scheduleData: Omit<WorkPlanSchedule, 'id'>[]
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const records = scheduleData.map(s => ({
      work_project_id: s.workProjectId,
      day_index: s.dayIndex,
      date: s.date,
      daily_target: s.dailyTarget,
      weight: s.weight,
      plan_cumulative: s.planCumulative,
    }));

    const { error } = await supabase
      .from('work_plan_schedule')
      .upsert(records, {
        onConflict: 'work_project_id,day_index'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error batch upserting work plan schedule:', error);
    return false;
  }
}

/**
 * Delete all plan schedule for a project
 */
export async function deleteWorkPlanSchedule(workProjectId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('work_plan_schedule')
      .delete()
      .eq('work_project_id', workProjectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting work plan schedule:', error);
    return false;
  }
}

/**
 * Delete daily data outside a date range for a work project
 */
export async function deleteWorkDailyDataOutsideRange(
  workProjectId: string,
  startDate: string,
  endDate: string
): Promise<{ deleted: number }> {
  if (!supabase) return { deleted: 0 };

  try {
    // Delete rows where date < startDate OR date > endDate
    const { data: beforeData, error: beforeError } = await supabase
      .from('work_daily_data')
      .delete()
      .eq('work_project_id', workProjectId)
      .lt('date', startDate)
      .select('id');

    const { data: afterData, error: afterError } = await supabase
      .from('work_daily_data')
      .delete()
      .eq('work_project_id', workProjectId)
      .gt('date', endDate)
      .select('id');

    if (beforeError) console.error('Error deleting before-range data:', beforeError);
    if (afterError) console.error('Error deleting after-range data:', afterError);

    const deleted = (beforeData?.length || 0) + (afterData?.length || 0);
    return { deleted };
  } catch (error) {
    console.error('Error cleaning up daily data outside range:', error);
    return { deleted: 0 };
  }
}

// =====================================================
// EVIDENCE STORAGE OPERATIONS
// =====================================================

const EVIDENCE_BUCKET = 'evidence';

/**
 * Upload a file to the evidence storage bucket.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadEvidence(
  file: File,
  projectId: string,
  activityCode: string
): Promise<string | null> {
  try {
    // Validasi file sebelum upload
    validateFile(file, ALLOWED_EVIDENCE_TYPES, MAX_EVIDENCE_SIZE_MB);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const timestamp = Date.now();
    const safeName = (activityCode || 'file').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `${projectId}/${safeName}_${timestamp}.${ext}`;

    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    if (workerUrl) {
      const response = await fetch(`${workerUrl}/${filePath}`, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!response.ok) {
         console.error('Worker returned error:', await response.text());
         throw new Error(`Upload via worker failed: ${response.status}`);
      }
      const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;
      return `${publicUrlBase}/${filePath}`;
    }

    if (!supabase) return null;
    const { error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (error) {
    console.error('Error uploading evidence:', error);
    throw error; // Re-throw agar UI bisa menampilkan pesan error ke pengguna
  }
}


/**
 * Delete an evidence file from storage using its public URL.
 */
export async function deleteStorageFileByUrl(publicUrl: string, bucketType: 'evidence' | 'dokumen' | 'assets' = 'evidence'): Promise<boolean> {
  try {
    if (!publicUrl) return false;

    const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    
    if (r2PublicUrl && workerUrl && publicUrl.startsWith(r2PublicUrl)) {
      const key = decodeURIComponent(publicUrl.replace(`${r2PublicUrl}/`, ''));
      
      const response = await fetch(`${workerUrl}/${key}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
         console.error('Worker delete returned error:', await response.text());
         throw new Error(`Delete via worker failed: ${response.status}`);
      }
      return true;
    }

    if (!supabase) return false;
    const marker = `/storage/v1/object/public/${bucketType}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) {
      const filePath = decodeURIComponent(publicUrl.substring(idx + marker.length));
      const { error } = await supabase.storage.from(bucketType).remove([filePath]);
      if (error) throw error;
      return true;
    }
    return true;
  } catch (e) {
    console.error('Error deleting file from storage via url:', e);
    return false;
  }
}

export async function deleteEvidence(publicUrl: string): Promise<boolean> {
  return deleteStorageFileByUrl(publicUrl, 'evidence');
}

// =====================================================
// LING-SIGN OPERATIONS
// =====================================================

import { LingSignature, SignedDocument, SignedDocumentSignature } from '../types';

/**
 * Fetch all digital signatures
 */
export async function fetchLingSignatures(): Promise<LingSignature[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('ling_signatures')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      signerName: row.signer_name,
      signerRole: row.signer_role,
      verificationCode: row.verification_code,
      sandi: row.sandi || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching ling signatures:', error);
    return [];
  }
}

/**
 * Create a new digital signature
 */
export async function createLingSignature(
  signerName: string,
  signerRole: string,
  verificationCode: string,
  sandi: string
): Promise<LingSignature | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('ling_signatures')
      .insert({
        signer_name: signerName,
        signer_role: signerRole,
        verification_code: verificationCode,
        sandi: sandi,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      signerName: data.signer_name,
      signerRole: data.signer_role,
      verificationCode: data.verification_code,
      sandi: data.sandi || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating ling signature:', error);
    return null;
  }
}

/**
 * Verify sandi (PIN) for a signature
 */
export async function verifySandi(signatureId: string, sandi: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('ling_signatures')
      .select('sandi')
      .eq('id', signatureId)
      .single();

    if (error) throw error;
    return data?.sandi === sandi;
  } catch (error) {
    console.error('Error verifying sandi:', error);
    return false;
  }
}

/**
 * Update a digital signature
 */
export async function updateLingSignature(
  id: string,
  signerName: string,
  signerRole: string
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('ling_signatures')
      .update({
        signer_name: signerName,
        signer_role: signerRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating ling signature:', error);
    return false;
  }
}

/**
 * Delete a digital signature
 */
export async function deleteLingSignature(id: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('ling_signatures')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting ling signature:', error);
    return false;
  }
}

/**
 * Save a signed document record
 */
export async function saveSignedDocument(
  originalFilename: string,
  signatures: {
    signatureId: string;
    signerName: string;
    signerRole: string;
    verificationCode: string;
    positionX: number;
    positionY: number;
    pageNumber: number;
  }[]
): Promise<SignedDocument | null> {
  if (!supabase) return null;

  try {
    // Create document record
    const { data: docData, error: docError } = await supabase
      .from('signed_documents')
      .insert({
        original_filename: originalFilename,
        signed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (docError) throw docError;

    // Create signature junction records
    const sigRecords = signatures.map(s => ({
      document_id: docData.id,
      signature_id: s.signatureId,
      signer_name: s.signerName,
      signer_role: s.signerRole,
      verification_code: s.verificationCode,
      position_x: s.positionX,
      position_y: s.positionY,
      page_number: s.pageNumber,
      signed_at: new Date().toISOString(),
    }));

    const { error: sigError } = await supabase
      .from('signed_document_signatures')
      .insert(sigRecords);

    if (sigError) throw sigError;

    return {
      id: docData.id,
      originalFilename: docData.original_filename,
      storageUrl: docData.storage_url,
      signedAt: docData.signed_at,
      createdAt: docData.created_at,
    };
  } catch (error) {
    console.error('Error saving signed document:', error);
    return null;
  }
}

/**
 * Fetch signed documents with their signatures
 */
export async function fetchSignedDocuments(): Promise<SignedDocument[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('signed_documents')
      .select(`
        *,
        signed_document_signatures (*)
      `)
      .order('signed_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      originalFilename: row.original_filename,
      storageUrl: row.storage_url,
      signedAt: row.signed_at,
      createdAt: row.created_at,
      signatures: (row.signed_document_signatures || []).map((s: any) => ({
        id: s.id,
        documentId: s.document_id,
        signatureId: s.signature_id,
        signerName: s.signer_name,
        signerRole: s.signer_role,
        verificationCode: s.verification_code,
        positionX: s.position_x,
        positionY: s.position_y,
        pageNumber: s.page_number,
        signedAt: s.signed_at,
      })),
    }));
  } catch (error) {
    console.error('Error fetching signed documents:', error);
    return [];
  }
}

/**
 * Verify a signature by verification code
 */
export async function verifySignature(code: string): Promise<{
  valid: boolean;
  signerName?: string;
  signerRole?: string;
  documentName?: string;
  signedAt?: string;
} | null> {
  if (!supabase) return null;

  try {
    // Search in signed_document_signatures
    const { data, error } = await supabase
      .from('signed_document_signatures')
      .select(`
        *,
        signed_documents (original_filename)
      `)
      .eq('verification_code', code)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { valid: false };
    }

    const record = data[0];
    return {
      valid: true,
      signerName: record.signer_name,
      signerRole: record.signer_role,
      documentName: record.signed_documents?.original_filename,
      signedAt: record.signed_at,
    };
  } catch (error) {
    console.error('Error verifying signature:', error);
    return null;
  }
}

// =====================================================
// COOPERATION DOCUMENT OPERATIONS
// =====================================================

function mapCooperationVersionRow(row: any): CooperationDocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    versionLabel: row.version_label,
    fileName: row.file_name,
    fileUrl: row.file_url,
    storageKey: row.storage_key,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    statusAtUpload: row.status_at_upload as CooperationDocumentStatus,
    revisionNotes: row.revision_notes,
    revisionSource: row.revision_source as CooperationRevisionSource | null,
  };
}

function mapCooperationApprovalRow(row: any): CooperationDocumentApproval {
  return {
    id: row.id,
    documentId: row.document_id,
    approverRole: row.approver_role as UserRole,
    approverUserId: row.approver_user_id,
    action: row.action,
    comment: row.comment,
    fromStatus: row.from_status as CooperationDocumentStatus,
    toStatus: row.to_status as CooperationDocumentStatus,
    createdAt: row.created_at,
  };
}

function mapCooperationProjectLinkRow(row: any): CooperationProjectLink {
  return {
    id: row.id,
    documentId: row.document_id,
    projectId: row.project_id,
    projectName: row.project_name,
    documentWeight: Number(row.document_weight) || 0,
    linkedAt: row.linked_at,
  };
}

function mapCooperationDocumentRow(row: any): CooperationDocument {
  return {
    id: row.id,
    title: row.title,
    documentType: row.document_type as CooperationDocumentType,
    partnerName: row.partner_name,
    documentNumber: row.document_number,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as CooperationDocumentStatus,
    internalPic: row.internal_pic,
    projectHead: row.project_head,
    projectManager: row.project_manager,
    scopeSummary: row.scope_summary,
    legalInternalNotes: row.legal_internal_notes,
    partnerNotes: row.partner_notes,
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: (row.cooperation_document_versions || []).map(mapCooperationVersionRow),
    approvals: (row.cooperation_document_approvals || []).map(mapCooperationApprovalRow),
    projectLinks: (row.cooperation_document_project_links || []).map(mapCooperationProjectLinkRow),
  };
}

export async function fetchCooperationDocuments(): Promise<CooperationDocument[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('cooperation_documents')
      .select(`
        *,
        cooperation_document_versions (*),
        cooperation_document_approvals (*),
        cooperation_document_project_links (*)
      `)
      .order('updated_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(5_000));

    if (error) throw error;
    return (data || []).map(mapCooperationDocumentRow);
  } catch (error) {
    console.warn('Cooperation documents unavailable, using UI fallback data:', error);
    return [];
  }
}

export type AdvanceCooperationResult =
  | { ok: true; status: CooperationDocumentStatus }
  | { ok: false; error: string };

export async function advanceCooperationStatus(
  documentId: string,
  toStatus: CooperationDocumentStatus,
  notes?: string
): Promise<AdvanceCooperationResult> {
  if (!supabase) return { ok: false, error: 'Supabase tidak dikonfigurasi.' };

  try {
    const { data, error } = await supabase.rpc('advance_cooperation_status', {
      p_document_id: documentId,
      p_to_status: toStatus,
      p_notes: notes ?? null,
    });

    if (error) throw error;
    return { ok: true, status: (data as CooperationDocumentStatus) ?? toStatus };
  } catch (error) {
    const message = (error as { message?: string })?.message ?? String(error);
    console.error('Error advancing cooperation status:', error);
    return { ok: false, error: message };
  }
}

export async function createCooperationDocumentDraft(input: CreateCooperationDocumentInput): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data: documentRow, error: documentError } = await supabase
      .from('cooperation_documents')
      .insert({
        title: input.title,
        document_type: input.documentType,
        partner_name: input.partnerName,
        document_number: input.documentNumber || null,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        status: 'draft-internal',
        internal_pic: input.internalPic,
        project_head: input.projectHead || null,
        project_manager: input.projectManager || null,
        scope_summary: input.scopeSummary || null,
        created_by: input.createdBy || null,
      })
      .select('id')
      .single();

    if (documentError) throw documentError;
    if (!documentRow?.id) throw new Error('Dokumen kerja sama gagal dibuat.');

    const { data: versionRow, error: versionError } = await supabase
      .from('cooperation_document_versions')
      .insert({
        document_id: documentRow.id,
        version_label: input.version.versionLabel,
        file_name: input.version.fileName,
        file_url: input.version.fileUrl,
        storage_key: input.version.storageKey || null,
        uploaded_by: input.version.uploadedBy || null,
        status_at_upload: input.version.statusAtUpload,
        revision_notes: input.version.revisionNotes || null,
        revision_source: input.version.revisionSource || null,
      })
      .select('id')
      .single();

    if (versionError) throw versionError;

    if (versionRow?.id) {
      const { error: updateError } = await supabase
        .from('cooperation_documents')
        .update({ current_version_id: versionRow.id })
        .eq('id', documentRow.id);

      if (updateError) throw updateError;
    }

    if (input.projectLink?.projectId && input.projectLink.projectName) {
      const { error: linkError } = await supabase
        .from('cooperation_document_project_links')
        .insert({
          document_id: documentRow.id,
          project_id: input.projectLink.projectId,
          project_name: input.projectLink.projectName,
          document_weight: input.projectLink.documentWeight ?? 20,
        });

      if (linkError) throw linkError;
    }

    await supabase
      .from('audit_events')
      .insert({
        entity_type: 'cooperation_document',
        entity_id: documentRow.id,
        actor_user_id: input.createdBy || null,
        actor_role: 'staff_officer',
        action: 'create_draft',
        from_value: null,
        to_value: {
          status: 'draft-internal',
          document_type: input.documentType,
          version_label: input.version.versionLabel,
        },
        notes: input.version.revisionNotes || null,
      });

    return documentRow.id;
  } catch (error) {
    console.error('Error creating cooperation document draft:', error);
    return null;
  }
}

// =====================================================
// DOCUMENT CATEGORY OPERATIONS
// =====================================================

export async function fetchDocumentCategories(): Promise<DocumentCategory[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('document_categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      displayOrder: row.display_order,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching document categories:', error);
    return [];
  }
}

export async function createDocumentCategory(name: string, displayOrder?: number): Promise<DocumentCategory | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('document_categories')
      .insert({ name, display_order: displayOrder ?? 0 })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, displayOrder: data.display_order, createdAt: data.created_at };
  } catch (error) {
    console.error('Error creating document category:', error);
    return null;
  }
}

export async function updateDocumentCategory(id: string, name: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('document_categories')
      .update({ name })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating document category:', error);
    return false;
  }
}

export async function deleteDocumentCategory(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: docs } = await supabase.from('documents').select('link').eq('category_id', id);
    if (docs) {
      for (const doc of docs) {
         if (doc.link) await deleteStorageFileByUrl(doc.link, 'dokumen');
      }
    }

    const { error } = await supabase
      .from('document_categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting document category:', error);
    return false;
  }
}

// =====================================================
// DOCUMENT OPERATIONS
// =====================================================

export async function fetchDocuments(categoryId: string): Promise<DocumentItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category_id', categoryId)
      .order('tanggal', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      categoryId: row.category_id,
      noSurat: row.no_surat,
      tanggal: row.tanggal,
      deskripsi: row.deskripsi,
      jenisDokumen: row.jenis_dokumen,
      link: row.link,
      pengisi: row.pengisi,
      penerbi: row.penerbi,
      hasSoftfile: row.has_softfile,
      hasHardfile: row.has_hardfile,
      keterangan: row.keterangan,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
}

export async function fetchAllDocuments(): Promise<DocumentItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('tanggal', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      categoryId: row.category_id,
      noSurat: row.no_surat,
      tanggal: row.tanggal,
      deskripsi: row.deskripsi,
      jenisDokumen: row.jenis_dokumen,
      link: row.link,
      pengisi: row.pengisi,
      penerbi: row.penerbi,
      hasSoftfile: row.has_softfile,
      hasHardfile: row.has_hardfile,
      keterangan: row.keterangan,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching all documents:', error);
    return [];
  }
}

export async function createDocument(doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentItem | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        category_id: doc.categoryId,
        no_surat: doc.noSurat || null,
        tanggal: doc.tanggal || null,
        deskripsi: doc.deskripsi || null,
        jenis_dokumen: doc.jenisDokumen || null,
        link: doc.link || null,
        pengisi: doc.pengisi || null,
        penerbi: doc.penerbi || null,
        has_softfile: doc.hasSoftfile,
        has_hardfile: doc.hasHardfile,
        keterangan: doc.keterangan || null,
        display_order: doc.displayOrder,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      categoryId: data.category_id,
      noSurat: data.no_surat,
      tanggal: data.tanggal,
      deskripsi: data.deskripsi,
      jenisDokumen: data.jenis_dokumen,
      link: data.link,
      pengisi: data.pengisi,
      penerbi: data.penerbi,
      hasSoftfile: data.has_softfile,
      hasHardfile: data.has_hardfile,
      keterangan: data.keterangan,
      displayOrder: data.display_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating document:', error);
    return null;
  }
}

export async function updateDocument(
  id: string,
  updates: Partial<Omit<DocumentItem, 'id' | 'categoryId' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const updateData: any = {};
    if (updates.noSurat !== undefined) updateData.no_surat = updates.noSurat || null;
    if (updates.tanggal !== undefined) updateData.tanggal = updates.tanggal || null;
    if (updates.deskripsi !== undefined) updateData.deskripsi = updates.deskripsi || null;
    if (updates.jenisDokumen !== undefined) updateData.jenis_dokumen = updates.jenisDokumen || null;
    if (updates.link !== undefined) updateData.link = updates.link || null;
    if (updates.pengisi !== undefined) updateData.pengisi = updates.pengisi || null;
    if (updates.penerbi !== undefined) updateData.penerbi = updates.penerbi || null;
    if (updates.hasSoftfile !== undefined) updateData.has_softfile = updates.hasSoftfile;
    if (updates.hasHardfile !== undefined) updateData.has_hardfile = updates.hasHardfile;
    if (updates.keterangan !== undefined) updateData.keterangan = updates.keterangan || null;
    if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating document:', error);
    return false;
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: doc } = await supabase.from('documents').select('link').eq('id', id).single();
    if (doc?.link) {
      await deleteStorageFileByUrl(doc.link, 'dokumen');
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

// =====================================================
// DOCUMENT FILE UPLOAD
// =====================================================

function sanitizeDocumentPathSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || 'general';
}

function sanitizeDocumentFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned || 'document.bin';
}

function buildCooperationDocumentStorageKey(fileName: string, documentType: CooperationDocumentType): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return [
    'documents',
    'pks-mou',
    sanitizeDocumentPathSegment(documentType.toLowerCase()),
    year,
    month,
    `${now.getTime()}_${sanitizeDocumentFileName(fileName)}`,
  ].join('/');
}

export async function uploadCooperationDocumentFile(
  file: File,
  documentType: CooperationDocumentType
): Promise<{ url: string; storageKey: string } | null> {
  try {
    validateFile(file, ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_MB);

    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;

    if (!workerUrl || !publicUrlBase) {
      throw new Error('Konfigurasi R2 belum lengkap. Periksa VITE_R2_WORKER_URL dan VITE_R2_PUBLIC_URL.');
    }

    const storageKey = buildCooperationDocumentStorageKey(file.name, documentType);
    const response = await fetch(`${workerUrl}/${storageKey}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload via worker failed: ${response.status}`);
    }

    return {
      url: `${publicUrlBase}/${storageKey}`,
      storageKey,
    };
  } catch (error) {
    console.error('Error uploading cooperation document file:', error);
    throw error;
  }
}

export async function uploadDocumentFile(file: File, categoryName: string): Promise<string | null> {
  try {
    // Validasi file sebelum upload
    validateFile(file, ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_MB);

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${categoryName}/${timestamp}_${safeName}`;

    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    if (workerUrl) {
      const response = await fetch(`${workerUrl}/${filePath}`, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!response.ok) {
         console.error('Worker returned error:', await response.text());
         throw new Error(`Upload via worker failed: ${response.status}`);
      }
      const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;
      return `${publicUrlBase}/${filePath}`;
    }

    if (!supabase) return null;
    const { error } = await supabase.storage
      .from('dokumen')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('dokumen')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading document file:', error);
    return null;
  }
}

// =====================================================
// ASSET OPERATIONS
// =====================================================

function mapAssetRow(row: any): AssetItem {
  return {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    category: row.category,
    description: row.description,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeAssetFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned || 'asset.bin';
}

function sanitizeAssetFolderName(folderName: string): string {
  const cleaned = folderName
    .trim()
    .split(/[\\/]/)
    .map(segment => segment
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
    )
    .filter(Boolean)
    .join('/');

  return cleaned || 'general';
}

function sanitizeAssetFolderSegment(folderName: string): string {
  const cleaned = folderName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'general';
}

function buildAssetStorageKey(fileName: string, folderName?: string): string {
  const now = new Date();
  const timestamp = now.getTime();
  if (folderName?.trim()) {
    return `assets/${sanitizeAssetFolderName(folderName)}/${timestamp}_${sanitizeAssetFileName(fileName)}`;
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `assets/${sanitizeAssetFolderSegment(String(year))}/${sanitizeAssetFolderSegment(month)}/${timestamp}_${sanitizeAssetFileName(fileName)}`;
}

export async function uploadAssetFile(file: File, folderName?: string): Promise<{ url: string; storageKey: string } | null> {
  try {
    validateFileSize(file, MAX_ASSET_SIZE_MB);

    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;

    if (!workerUrl || !publicUrlBase) {
      throw new Error('Konfigurasi R2 belum lengkap. Periksa VITE_R2_WORKER_URL dan VITE_R2_PUBLIC_URL.');
    }

    const storageKey = buildAssetStorageKey(file.name, folderName);
    const response = await fetch(`${workerUrl}/${storageKey}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload via worker failed: ${response.status}`);
    }

    return {
      url: `${publicUrlBase}/${storageKey}`,
      storageKey,
    };
  } catch (error) {
    console.error('Error uploading asset file:', error);
    throw error;
  }
}

export async function fetchAssets(): Promise<AssetItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapAssetRow);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return [];
  }
}

export async function createAsset(asset: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetItem | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        file_name: asset.fileName,
        file_url: asset.fileUrl,
        storage_key: asset.storageKey,
        mime_type: asset.mimeType || null,
        file_size: asset.fileSize,
        category: asset.category || null,
        description: asset.description || null,
        uploaded_by: asset.uploadedBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapAssetRow(data);
  } catch (error) {
    console.error('Error creating asset:', error);
    return null;
  }
}

export async function updateAsset(
  id: string,
  updates: Pick<Partial<AssetItem>, 'fileName' | 'category' | 'description'>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const updateData: any = {};
    if (updates.fileName !== undefined) updateData.file_name = updates.fileName;
    if (updates.category !== undefined) updateData.category = updates.category || null;
    if (updates.description !== undefined) updateData.description = updates.description || null;

    const { error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating asset:', error);
    return false;
  }
}

export async function deleteAsset(asset: AssetItem): Promise<boolean> {
  if (!supabase) return false;
  try {
    const storageDeleted = await deleteStorageFileByUrl(asset.fileUrl, 'assets');
    if (!storageDeleted) return false;

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', asset.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting asset:', error);
    return false;
  }
}

// =====================================================
// COORDINATION HUB (help requests)
// =====================================================

/** Requests where the current user is a participant, with unread + counterpart name. */
export async function fetchMyHelpRequests(): Promise<HelpRequestSummary[]> {
  if (!supabase) return [];
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return [];

    const { data: reqData, error: reqError } = await supabase
      .from('help_requests')
      .select('id, from_user, to_user, subject, status, created_at, updated_at')
      .or(`from_user.eq.${uid},to_user.eq.${uid}`)
      .order('updated_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(5_000));
    if (reqError) throw reqError;

    const requests = reqData || [];
    if (requests.length === 0) return [];

    const ids = requests.map((r: any) => r.id);
    const counterpartIds = Array.from(
      new Set(requests.map((r: any) => (r.from_user === uid ? r.to_user : r.from_user))),
    );

    const [msgRes, readRes, profileRes] = await Promise.all([
      supabase.from('help_request_messages').select('request_id, sender_user, created_at').in('request_id', ids),
      supabase.from('help_request_reads').select('request_id, last_read_at').eq('user_id', uid).in('request_id', ids),
      supabase.from('user_profiles').select('user_id, full_name').in('user_id', counterpartIds),
    ]);
    if (msgRes.error) throw msgRes.error;
    if (readRes.error) throw readRes.error;
    if (profileRes.error) throw profileRes.error;

    const messagesByReq = new Map<string, { senderUser: string; createdAt: string }[]>();
    (msgRes.data || []).forEach((m: any) => {
      const arr = messagesByReq.get(m.request_id) ?? [];
      arr.push({ senderUser: m.sender_user, createdAt: m.created_at });
      messagesByReq.set(m.request_id, arr);
    });
    const readByReq = new Map<string, string>();
    (readRes.data || []).forEach((r: any) => readByReq.set(r.request_id, r.last_read_at));
    const nameById = new Map<string, string>();
    (profileRes.data || []).forEach((p: any) => nameById.set(p.user_id, p.full_name));

    return requests.map((r: any): HelpRequestSummary => {
      const counterpartId = r.from_user === uid ? r.to_user : r.from_user;
      return {
        id: r.id,
        fromUser: r.from_user,
        toUser: r.to_user,
        subject: r.subject,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        direction: r.to_user === uid ? 'incoming' : 'outgoing',
        counterpartName: nameById.get(counterpartId) || 'Pengguna',
        unread: hasUnread(r.created_at, r.from_user, messagesByReq.get(r.id) ?? [], readByReq.get(r.id) ?? null, uid),
      };
    });
  } catch (error) {
    console.error('Error fetching help requests:', error);
    return [];
  }
}

export async function createHelpRequest(toUser: string, subject: string, body: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return false;
    const { error } = await supabase
      .from('help_requests')
      .insert({ from_user: uid, to_user: toUser, subject, body });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating help request:', error);
    return false;
  }
}

export async function fetchHelpRequestThread(requestId: string): Promise<HelpRequestMessage[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('help_request_messages')
      .select('id, request_id, sender_user, body, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return (data || []).map((m: any) => ({
      id: m.id,
      requestId: m.request_id,
      senderUser: m.sender_user,
      body: m.body,
      createdAt: m.created_at,
    }));
  } catch (error) {
    console.error('Error fetching help request thread:', error);
    throw error;
  }
}

export async function postHelpRequestMessage(requestId: string, body: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return false;
    const { error } = await supabase
      .from('help_request_messages')
      .insert({ request_id: requestId, sender_user: uid, body });
    if (error) throw error;
    // Bump parent so it re-sorts to the top of both participants' lists.
    await supabase.from('help_requests').update({ updated_at: new Date().toISOString() }).eq('id', requestId);
    return true;
  } catch (error) {
    console.error('Error posting help request message:', error);
    return false;
  }
}

export async function updateHelpRequestStatus(requestId: string, status: HelpRequestStatus): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('help_requests').update({ status }).eq('id', requestId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating help request status:', error);
    return false;
  }
}

export async function markHelpRequestRead(requestId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    await supabase
      .from('help_request_reads')
      .upsert({ request_id: requestId, user_id: uid, last_read_at: new Date().toISOString() });
  } catch (error) {
    console.error('Error marking help request read:', error);
  }
}

/** All other users, for the recipient picker. */
export async function fetchRecipients(): Promise<RecipientOption[]> {
  if (!supabase) return [];
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, role_code')
      .order('full_name', { ascending: true })
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return (data || [])
      .filter((p: any) => p.user_id !== uid)
      .map((p: any) => ({ userId: p.user_id, fullName: p.full_name || 'Pengguna', roleCode: p.role_code }));
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return [];
  }
}
