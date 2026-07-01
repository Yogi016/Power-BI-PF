import assert from 'node:assert/strict';
import { scopeProjectsForRole } from '../utils/projectScope';
import type { ProjectData } from '../types';

const p = (id: string): ProjectData => ({
  id,
  name: id,
  pic: 'x',
  activities: [],
  weeklyBaseline: [],
  weeklyActual: [],
});

const projects = [p('a'), p('b'), p('c')];

assert.deepEqual(
  scopeProjectsForRole(projects, 'staff_officer', ['a'], true).map((x) => x.id),
  ['a'],
  'staff officer hanya melihat proyek yang ditugaskan saat data Supabase'
);

assert.deepEqual(
  scopeProjectsForRole(projects, 'project_manager', ['a'], true).map((x) => x.id),
  ['a', 'b', 'c'],
  'project manager melihat semua proyek (tidak di-scope)'
);

assert.deepEqual(
  scopeProjectsForRole(projects, 'staff_officer', [], true).map((x) => x.id),
  ['a', 'b', 'c'],
  'assignment kosong = fail-open (lihat semua)'
);

assert.deepEqual(
  scopeProjectsForRole(projects, 'staff_officer', ['a'], false).map((x) => x.id),
  ['a', 'b', 'c'],
  'mode CSV (supabaseLoaded false) tidak di-scope'
);

console.log('project scope checks passed');
