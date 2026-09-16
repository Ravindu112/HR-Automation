-- ============================================================
-- HR System - Supabase schema (custom auth by employee ID)
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
--
-- This replaces the previous email-auth schema. It sets up:
--   • employee_ids  – IDs pre-registered by the HR manager
--   • app_users     – employee/HR accounts (employee ID + password,
--                     status: pending / verified / rejected)
--   • sessions      – custom login sessions
--   • documents     – uploaded documents per user
--   • leave_requests, qualifications, profile_change_requests
-- Storage buckets: hr-documents (private) and hr-avatars (public).
-- Default HR manager: Employee ID  HR-0001  Password  HR@12345
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Drop remnants of the previous schema (if any) ----------
drop table if exists public.notes;
drop table if exists public.employment_history;
drop table if exists public.leave_requests;
drop table if exists public.documents;
drop table if exists public.employees;
drop table if exists public.profile_change_requests;
drop table if exists public.qualifications;
drop table if exists public.sessions;
drop table if exists public.app_users;
drop table if exists public.employee_ids;

-- ---------- PRE-REGISTERED EMPLOYEE IDS ----------
-- Created by the HR manager and handed to employees manually.
create table public.employee_ids (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  first_name text not null,
  last_name text not null,
  email text,
  department text,
  position text,
  status text not null default 'unused'
    check (status in ('unused', 'claimed')),
  created_by text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

-- ---------- APP USERS (custom auth: employee ID + password) ----------
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique references public.employee_ids(employee_id),
  password_hash text not null,
  role text not null default 'employee'
    check (role in ('hr_manager', 'employee')),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  date_of_birth date,
  address text,
  department text,
  position text,
  profile_picture_path text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

create index if not exists app_users_status_idx on public.app_users(status);
create index if not exists app_users_role_idx on public.app_users(role);

-- ---------- SESSIONS ----------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_token_idx on public.sessions(token);
create index if not exists sessions_user_idx on public.sessions(user_id);

-- ---------- DOCUMENTS ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  category text not null default 'other'
    check (category in ('id', 'certificate', 'educational', 'contract', 'other')),
  file_name text not null,
  file_path text not null,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_idx on public.documents(user_id);

-- ---------- LEAVE REQUESTS ----------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  leave_type text not null default 'annual'
    check (leave_type in ('annual', 'sick', 'casual', 'maternity', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists leave_requests_status_idx on public.leave_requests(status);
create index if not exists leave_requests_user_idx on public.leave_requests(user_id);

-- ---------- QUALIFICATIONS ----------
-- Employees add their own qualifications; they are applied to the profile
-- instantly with no HR review, so new rows default to 'approved'.
create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null,
  institution text,
  year text,
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists qualifications_user_idx on public.qualifications(user_id);

-- ---------- PROFILE CHANGE REQUESTS ----------
-- Employees cannot edit important fields directly; changes go through
-- the HR manager for approval.
create table public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  field text not null,
  field_label text not null,
  current_value text,
  new_value text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profile_change_requests_status_idx on public.profile_change_requests(status);
create index if not exists profile_change_requests_user_idx on public.profile_change_requests(user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('hr-documents', 'hr-documents', false),
  ('hr-avatars', 'hr-avatars', true)
on conflict (id) do nothing;

-- Allow the browser client (anon key) to read and create signed URLs
-- for documents, and to upload/manage files in both buckets.
create policy "hr-documents storage select" on storage.objects
  for select to anon using (bucket_id = 'hr-documents');
create policy "hr-documents storage insert" on storage.objects
  for insert to anon with check (bucket_id = 'hr-documents');
create policy "hr-documents storage update" on storage.objects
  for update to anon using (bucket_id = 'hr-documents');
create policy "hr-documents storage delete" on storage.objects
  for delete to anon using (bucket_id = 'hr-documents');

create policy "hr-avatars storage select" on storage.objects
  for select to anon using (bucket_id = 'hr-avatars');
create policy "hr-avatars storage insert" on storage.objects
  for insert to anon with check (bucket_id = 'hr-avatars');
create policy "hr-avatars storage update" on storage.objects
  for update to anon using (bucket_id = 'hr-avatars');
create policy "hr-avatars storage delete" on storage.objects
  for delete to anon using (bucket_id = 'hr-avatars');

-- ============================================================
-- SEED DEFAULT HR MANAGER
-- Employee ID:  HR-0001   Password:  HR@12345   (change after login)
-- ============================================================
insert into public.employee_ids
  (employee_id, first_name, last_name, email, department, position, status)
values
  ('HR-0001', 'System', 'Administrator', 'admin@company.com', 'Human Resources', 'HR Manager', 'claimed');

insert into public.app_users
  (employee_id, password_hash, role, status, first_name, last_name,
   email, department, position, decided_at)
values
  ('HR-0001', crypt('HR@12345', gen_salt('bf')), 'hr_manager', 'verified',
   'System', 'Administrator', 'admin@company.com',
   'Human Resources', 'HR Manager', now());