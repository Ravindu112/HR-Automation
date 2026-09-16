-- ============================================================
-- HR System - Sample data for demonstration
-- Run AFTER supabase/schema.sql in the SQL Editor.
-- ============================================================

-- ---------- EMPLOYEES ----------
insert into public.employees (id, first_name, last_name, email, phone, position, department, employee_code, status, hire_date, date_of_birth, address) values
  ('a0000000-0000-4000-8000-000000000001', 'John',      'Smith',      'john.smith@company.com',      '+1-555-0101', 'Software Engineer',        'Engineering', 'EMP001', 'active',   '2021-03-15', '1993-05-12', '123 Main St, Austin, TX'),
  ('a0000000-0000-4000-8000-000000000002', 'Sarah',     'Johnson',    'sarah.johnson@company.com',   '+1-555-0102', 'Senior Software Engineer', 'Engineering', 'EMP002', 'active',   '2019-08-01', '1990-11-03', '456 Oak Ave, Austin, TX'),
  ('a0000000-0000-4000-8000-000000000003', 'Michael',   'Chen',       'michael.chen@company.com',    '+1-555-0103', 'DevOps Engineer',          'Engineering', 'EMP003', 'active',   '2022-01-10', '1994-02-20', '789 Pine Rd, Dallas, TX'),
  ('a0000000-0000-4000-8000-000000000004', 'Emily',     'Davis',      'emily.davis@company.com',     '+1-555-0104', 'Marketing Manager',        'Marketing',   'EMP004', 'active',   '2020-06-22', '1991-07-30', '321 Cedar Ln, Houston, TX'),
  ('a0000000-0000-4000-8000-000000000005', 'David',     'Wilson',     'david.wilson@company.com',    '+1-555-0105', 'Sales Executive',          'Sales',       'EMP005', 'active',   '2021-11-05', '1988-09-14', '654 Birch Blvd, San Antonio, TX'),
  ('a0000000-0000-4000-8000-000000000006', 'Jessica',   'Brown',      'jessica.brown@company.com',   '+1-555-0106', 'HR Specialist',            'Human Resources', 'EMP006', 'active', '2022-04-18', '1995-03-08', '987 Maple Way, Austin, TX'),
  ('a0000000-0000-4000-8000-000000000007', 'Daniel',    'Martinez',   'daniel.martinez@company.com', '+1-555-0107', 'Accountant',               'Finance',     'EMP007', 'active',   '2018-09-12', '1990-12-25', '135 Spruce Ct, Dallas, TX'),
  ('a0000000-0000-4000-8000-000000000008', 'Laura',     'Taylor',     'laura.taylor@company.com',    '+1-555-0108', 'QA Engineer',              'Engineering', 'EMP008', 'on_leave', '2020-02-14', '1992-06-18', '246 Elm Dr, Austin, TX'),
  ('a0000000-0000-4000-8000-000000000009', 'Robert',    'Anderson',   'robert.anderson@company.com', '+1-555-0109', 'Account Manager',          'Sales',       'EMP009', 'left',     '2017-05-01', '1985-01-09', '579 Ash St, El Paso, TX'),
  ('a0000000-0000-4000-8000-000000000010', 'Amanda',    'Thomas',     'amanda.thomas@company.com',   '+1-555-0110', 'Operations Coordinator',   'Operations',  'EMP010', 'active',   '2023-02-27', '1996-10-02', '864 Willow Ave, Austin, TX');

-- ---------- EMPLOYMENT HISTORY ----------
insert into public.employment_history (employee_id, position, department, change_type, start_date, end_date, notes) values
  ('a0000000-0000-4000-8000-000000000001', 'Software Engineer',    'Engineering',   'hire',      '2021-03-15', null, null),
  ('a0000000-0000-4000-8000-000000000002', 'Software Engineer',    'Engineering',   'hire',      '2019-08-01', '2023-04-10', null),
  ('a0000000-0000-4000-8000-000000000002', 'Senior Software Engineer', 'Engineering', 'promotion', '2023-04-11', null, 'Promoted for leading the payments rewrite'),
  ('a0000000-0000-4000-8000-000000000003', 'DevOps Engineer',      'Engineering',   'hire',      '2022-01-10', null, null),
  ('a0000000-0000-4000-8000-000000000004', 'Marketing Coordinator', 'Marketing',     'hire',      '2020-06-22', '2022-05-15', null),
  ('a0000000-0000-4000-8000-000000000004', 'Marketing Manager',    'Marketing',     'promotion', '2022-05-16', null, null),
  ('a0000000-0000-4000-8000-000000000005', 'Sales Executive',      'Sales',         'hire',      '2021-11-05', null, null),
  ('a0000000-0000-4000-8000-000000000006', 'HR Specialist',        'Human Resources', 'hire',    '2022-04-18', null, null),
  ('a0000000-0000-4000-8000-000000000007', 'Accountant',           'Finance',       'hire',      '2018-09-12', null, null),
  ('a0000000-0000-4000-8000-000000000008', 'QA Engineer',          'Engineering',   'hire',      '2020-02-14', null, null),
  ('a0000000-0000-4000-8000-000000000009', 'Sales Executive',      'Sales',         'hire',      '2017-05-01', '2020-01-15', null),
  ('a0000000-0000-4000-8000-000000000009', 'Account Manager',      'Sales',         'promotion', '2020-01-16', '2023-12-20', 'Left the company Dec 2023'),
  ('a0000000-0000-4000-8000-000000000010', 'Operations Coordinator', 'Operations',   'hire',      '2023-02-27', null, null);

-- ---------- LEAVE REQUESTS ----------
insert into public.leave_requests (employee_id, leave_type, start_date, end_date, reason, status, decided_at) values
  ('a0000000-0000-4000-8000-000000000008', 'sick',    '2026-09-01', '2026-09-05', 'Flu recovery', 'approved', now()),
  ('a0000000-0000-4000-8000-000000000008', 'annual',  '2026-10-12', '2026-10-19', 'Family trip',  'pending',  null),
  ('a0000000-0000-4000-8000-000000000003', 'annual',  '2026-08-03', '2026-08-14', 'Vacation',     'approved', now()),
  ('a0000000-0000-4000-8000-000000000005', 'sick',    '2026-09-20', '2026-09-21', 'Dentist appointment', 'pending', null),
  ('a0000000-0000-4000-8000-000000000002', 'unpaid',  '2026-11-02', '2026-11-06', 'Personal leave', 'pending', null),
  ('a0000000-0000-4000-8000-000000000004', 'annual',  '2026-07-06', '2026-07-10', 'Holiday',      'approved', now()),
  ('a0000000-0000-4000-8000-000000000006', 'other',   '2026-06-15', '2026-06-16', 'Ceremony',     'rejected', now());

-- ---------- NOTES ----------
insert into public.notes (employee_id, content, tag, author_id) values
  ('a0000000-0000-4000-8000-000000000001', 'Strong contributor on the API team. Reliable and communicative.', 'performance', null),
  ('a0000000-0000-4000-8000-000000000001', 'Appreciated for closing the Q3 milestone two weeks early.', 'appreciation', null),
  ('a0000000-0000-4000-8000-000000000002', 'Mentoring two junior engineers on the platform team.', 'general', null),
  ('a0000000-0000-4000-8000-000000000003', 'Handled the cloud migration incident calmly and thoroughly.', 'appreciation', null),
  ('a0000000-0000-4000-8000-000000000005', 'Missed two weekly sync meetings without notice.', 'disciplinary', null),
  ('a0000000-0000-4000-8000-000000000007', 'Prepared the annual audit documentation in record time.', 'performance', null);