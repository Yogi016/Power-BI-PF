-- =====================================================
-- SEED DATA: Sample data untuk testing
-- =====================================================

-- Insert sample projects
INSERT INTO projects (id, name, pic, description, category, location, start_date, end_date, status, budget) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'Penanaman Mangrove Mahakam Fase-3',
    'ARIEF',
    'Program penanaman dan konservasi mangrove di kawasan pesisir Mahakam untuk mendukung biodiversity dan mitigasi perubahan iklim',
    'Environmental',
    'Mahakam, Kalimantan Timur',
    '2024-10-01',
    '2025-04-30',
    'active',
    500000000.00
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'Community Development Bontang',
    'BILA',
    'Program pemberdayaan masyarakat lokal melalui pelatihan keterampilan dan pengembangan UMKM',
    'Social',
    'Bontang, Kalimantan Timur',
    '2024-12-01',
    '2025-03-31',
    'active',
    300000000.00
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'Monitoring Biodiversity Blora',
    'ARIEF',
    'Program monitoring keanekaragaman hayati dan ekosistem hutan di kawasan Blora',
    'Environmental',
    'Blora, Jawa Tengah',
    '2025-01-15',
    '2025-04-15',
    'active',
    200000000.00
);

-- Insert activities untuk Project 1 (Mahakam)
INSERT INTO activities (id, project_id, code, activity_name, category, sub_category, pic, weight, start_week, end_week, start_date, end_date, status) VALUES
(
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'A',
    'Administrasi Awal',
    'Administration',
    NULL,
    'DANTA',
    15.00,
    0,
    6,
    '2024-10-01',
    '2024-11-15',
    'completed'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'B.1',
    'Survey Lokasi & Pengadaan Bibit',
    'Preparation',
    'Survey',
    'ARIEF',
    10.00,
    4,
    10,
    '2024-11-01',
    '2024-12-15',
    'completed'
),
(
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    'B.2',
    'Penanaman Bibit',
    'Implementation',
    'Planting',
    'TIM LAPANGAN',
    30.00,
    13,
    25,
    '2025-01-01',
    '2025-03-30',
    'in-progress'
),
(
    '660e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440001',
    'C',
    'Administrasi Penutupan',
    'Administration',
    'Closing',
    'INDRI',
    10.00,
    21,
    28,
    '2025-03-01',
    '2025-04-15',
    'not-started'
);

-- Insert activities untuk Project 2 (Bontang)
INSERT INTO activities (id, project_id, code, activity_name, category, sub_category, pic, weight, start_week, end_week, start_date, end_date, status) VALUES
(
    '660e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440002',
    'D.1',
    'Pelatihan Keterampilan',
    'Training',
    NULL,
    'BILA',
    40.00,
    0,
    8,
    '2024-12-01',
    '2025-01-31',
    'in-progress'
),
(
    '660e8400-e29b-41d4-a716-446655440006',
    '550e8400-e29b-41d4-a716-446655440002',
    'D.2',
    'Pendampingan UMKM',
    'Mentoring',
    NULL,
    'BILA',
    35.00,
    8,
    16,
    '2025-02-01',
    '2025-03-31',
    'not-started'
);

-- Insert activities untuk Project 3 (Blora)
INSERT INTO activities (id, project_id, code, activity_name, category, sub_category, pic, weight, start_week, end_week, start_date, end_date, status) VALUES
(
    '660e8400-e29b-41d4-a716-446655440007',
    '550e8400-e29b-41d4-a716-446655440003',
    'E.1',
    'Survey Baseline',
    'Research',
    'Baseline',
    'ARIEF',
    30.00,
    0,
    4,
    '2025-01-15',
    '2025-02-15',
    'in-progress'
),
(
    '660e8400-e29b-41d4-a716-446655440008',
    '550e8400-e29b-41d4-a716-446655440003',
    'E.2',
    'Monitoring Rutin',
    'Research',
    'Monitoring',
    'ARIEF',
    50.00,
    4,
    12,
    '2025-02-15',
    '2025-04-15',
    'not-started'
);

-- Insert S-Curve Baseline untuk Project 1 (Monthly)
INSERT INTO s_curve_baseline (project_id, period_type, period_label, period_index, year, cumulative_baseline, period_baseline) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Okt', 10, 2024, 18.00, 18.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Nov', 11, 2024, 35.00, 17.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Des', 12, 2024, 47.00, 12.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Jan', 1, 2025, 53.00, 6.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Feb', 2, 2025, 71.00, 18.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Mar', 3, 2025, 88.00, 17.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Apr', 4, 2025, 100.00, 12.00);

-- Insert S-Curve Actual untuk Project 1 (Monthly)
INSERT INTO s_curve_actual (project_id, period_type, period_label, period_index, year, cumulative_actual, period_actual) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Okt', 10, 2024, 18.00, 18.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Nov', 11, 2024, 47.00, 29.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Des', 12, 2024, 47.00, 0.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Jan', 1, 2025, 52.00, 5.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Feb', 2, 2025, 52.00, 0.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Mar', 3, 2025, 52.00, 0.00),
('550e8400-e29b-41d4-a716-446655440001', 'monthly', 'Apr', 4, 2025, 52.00, 0.00);

-- Insert S-Curve Baseline untuk Project 2 (Monthly)
INSERT INTO s_curve_baseline (project_id, period_type, period_label, period_index, year, cumulative_baseline, period_baseline) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Des', 12, 2024, 20.00, 20.00),
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Jan', 1, 2025, 45.00, 25.00),
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Feb', 2, 2025, 70.00, 25.00),
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Mar', 3, 2025, 100.00, 30.00);

-- Insert S-Curve Actual untuk Project 2 (Monthly)
INSERT INTO s_curve_actual (project_id, period_type, period_label, period_index, year, cumulative_actual, period_actual) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Des', 12, 2024, 25.00, 25.00),
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Jan', 1, 2025, 60.00, 35.00),
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Feb', 2, 2025, 60.00, 0.00),
('550e8400-e29b-41d4-a716-446655440002', 'monthly', 'Mar', 3, 2025, 60.00, 0.00);

-- Insert S-Curve Baseline untuk Project 3 (Monthly)
INSERT INTO s_curve_baseline (project_id, period_type, period_label, period_index, year, cumulative_baseline, period_baseline) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Jan', 1, 2025, 15.00, 15.00),
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Feb', 2, 2025, 40.00, 25.00),
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Mar', 3, 2025, 70.00, 30.00),
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Apr', 4, 2025, 100.00, 30.00);

-- Insert S-Curve Actual untuk Project 3 (Monthly)
INSERT INTO s_curve_actual (project_id, period_type, period_label, period_index, year, cumulative_actual, period_actual) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Jan', 1, 2025, 10.00, 10.00),
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Feb', 2, 2025, 10.00, 0.00),
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Mar', 3, 2025, 10.00, 0.00),
('550e8400-e29b-41d4-a716-446655440003', 'monthly', 'Apr', 4, 2025, 10.00, 0.00);

-- Insert Monthly Progress untuk Project 1
INSERT INTO monthly_progress (project_id, month, year, month_index, baseline, actual) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Okt', 2024, 10, 18.00, 18.00),
('550e8400-e29b-41d4-a716-446655440001', 'Nov', 2024, 11, 35.00, 47.00),
('550e8400-e29b-41d4-a716-446655440001', 'Des', 2024, 12, 47.00, 47.00),
('550e8400-e29b-41d4-a716-446655440001', 'Jan', 2025, 1, 53.00, 52.00),
('550e8400-e29b-41d4-a716-446655440001', 'Feb', 2025, 2, 71.00, 52.00),
('550e8400-e29b-41d4-a716-446655440001', 'Mar', 2025, 3, 88.00, 52.00),
('550e8400-e29b-41d4-a716-446655440001', 'Apr', 2025, 4, 100.00, 52.00);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Query 1: Check all projects
-- SELECT * FROM projects ORDER BY start_date;

-- Query 2: Check project summary
-- SELECT * FROM project_summary;

-- Query 3: Check S-Curve data for a project
-- SELECT * FROM latest_scurve_data WHERE project_id = '550e8400-e29b-41d4-a716-446655440001' ORDER BY year, period_index;

-- Query 4: Check activities per project
-- SELECT p.name, a.code, a.activity_name, a.pic, a.status 
-- FROM projects p 
-- JOIN activities a ON p.id = a.project_id 
-- ORDER BY p.name, a.code;
