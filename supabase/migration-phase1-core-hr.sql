-- ============================================================
-- HR System - Phase 1: Core HR
-- Attendance, notifications, leave balances, holidays, audit logs
-- Run AFTER supabase/schema.sql + migration-cv-skills-qualification-type.sql.
-- Idempotent.
-- ============================================================

-- ---------- ATTENDANCE ----------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  work_minutes int default 0,
  is_late boolean not null default false,
  status text not null default 'present'
    check (status in ('present', 'absent', 'half_day', 'leave', 'holiday')),
  status_reason text,
  corrected_by text,
  correction_reason text,
  source text not null default 'manual'
    check (source in ('manual', 'qr')),
  created_at timestamptz not null default now(),
  constraint attendance_user_date_unique unique (user_id, date)
);

create index if not exists attendance_user_date_idx on public.attendance(user_id, date desc);
create index if not exists attendance_date_idx on public.attendance(date);

-- ---------- NOTIFICATIONS ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  type text not null default 'general'
    check (type in ('general', 'leave', 'profile', 'registration', 'announcement', 'training', 'document', 'performance')),
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read_at);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

-- ---------- LEAVE BALANCES ----------
create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  leave_type text not null
    check (leave_type in ('annual', 'sick', 'casual', 'maternity', 'unpaid', 'other')),
  balance_year int not null,
  allocated numeric(6,1) not null default 0,
  used numeric(6,1) not null default 0,
  carried_forward numeric(6,1) not null default 0,
  updated_at timestamptz not null default now(),
  constraint leave_balances_user_year_type unique (user_id, balance_year, leave_type)
);

create index if not exists leave_balances_user_idx on public.leave_balances(user_id, balance_year);

-- ---------- PUBLIC / COMPANY HOLIDAYS ----------
create table if not exists public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  type text not null default 'public'
    check (type in ('public', 'company')),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists public_holidays_date_idx on public.public_holidays(date);

-- ---------- AUDIT LOGS ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_employee_id text,
  action text not null,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_user_idx on public.audit_logs(user_id);

-- ---------- LEAVE REQUESTS: half day + working days ----------
alter table public.leave_requests
  add column if not exists is_half_day boolean not null default false;
alter table public.leave_requests
  add column if not exists working_days numeric(4,1);
alter table public.leave_requests
  add column if not exists balance_year int;

-- ---------- SEED 2026 HOLIDAYS ----------
insert into public.public_holidays (date, name, type, created_by)
select v.date::date, v.name, v.type, v.created_by
from (values
  ('2026-01-01', 'New Year', 'public', 'HR-0001'),
  ('2026-04-03', 'Good Friday', 'public', 'HR-0001'),
  ('2026-12-25', 'Christmas Day', 'public', 'HR-0001'),
  ('2026-12-26', 'Boxing Day', 'public', 'HR-0001')
) as v(date, name, type, created_by)
where not exists (select 1 from public.public_holidays h where h.date = v.date::date);