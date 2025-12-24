import { supabase } from './supabaseClient';
import { Project, SCurveDataPoint, ActivityData, ProjectMetrics } from '../types';

// =====================================================
// PROJECT OPERATIONS
// =====================================================

/**
 * Fetch all projects from Supabase
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
      .order('start_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
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
    }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
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
      .eq('period_type', periodType)
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
  periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly'
): Promise<SCurveDataPoint[]> {
  if (!supabase) return [];

  try {
    const actualPeriodType = periodType === 'yearly' ? 'monthly' : periodType;

    // Fetch all baseline data
    const { data: baselineData, error: baselineError } = await supabase
      .from('s_curve_baseline')
      .select('*')
      .eq('period_type', actualPeriodType)
      .order('year', { ascending: true })
      .order('period_index', { ascending: true });

    if (baselineError) throw baselineError;

    // Fetch all actual data
    const { data: actualData, error: actualError } = await supabase
      .from('s_curve_actual')
      .select('*')
      .eq('period_type', actualPeriodType)
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
