-- ============================================================
-- HR System - Migration: roles, employee portal & approval flow
-- Run AFTER supabase/schema.sql (v1). Idempotent.
-- ============================================================

-- ---------- ROLE HELPER FUNCTIONS ----------
create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from public.employees e where e.user_id = auth.uid() limit 1;
$$;

create or replace function public.is_hr_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'hr_manager');
$$;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.is_hr_manager() to authenticated;

-- ---------- PROFILES (links auth user -> role) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'employee' check (role in ('hr_manager', 'employee')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles: read own or HR" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_hr_manager());

-- ---------- EMPLOYEES: link an employee to a login ----------
alter table public.employees add column if not exists user_id uuid references auth.users(id) on delete set null;

-- ---------- PENDING CHANGES (drafts employees submit) ----------
create table if not exists public.pending_changes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pending_changes_employee_idx on public.pending_changes(employee_id);
create index if not exists pending_changes_status_idx on public.pending_changes(status);

alter table public.pending_changes enable row level security;

-- ---------- QUALIFICATIONS (drafts employees submit) ----------
create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  degree text not null,
  field_of_study text,
  institution text,
  year text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists qualifications_employee_idx on public.qualifications(employee_id);
create index if not exists qualifications_status_idx on public.qualifications(status);

alter table public.qualifications enable row level security;

-- ============================================================
-- REPLACE ALL OLD POLICIES WITH ROLE-AWARE ONES
-- ============================================================

-- employees
drop policy if exists "employees: auth users can read" on public.employees;
drop policy if exists "employees: auth users can insert" on public.employees;
drop policy if exists "employees: auth users can update" on public.employees;
drop policy if exists "employees: auth users can delete" on public.employees;

create policy "employees: read own or HR" on public.employees
  for select to authenticated
  using (public.is_hr_manager() or user_id = auth.uid());
create policy "employees: insert HR only" on public.employees
  for insert to authenticated with check (public.is_hr_manager());
create policy "employees: update HR only" on public.employees
  for update to authenticated using (public.is_hr_manager()) with check (public.is_hr_manager());
create policy "employees: delete HR only" on public.employees
  for delete to authenticated using (public.is_hr_manager());

-- documents
drop policy if exists "documents: auth users can read" on public.documents;
drop policy if exists "documents: auth users can insert" on public.documents;
drop policy if exists "documents: auth users can delete" on public.documents;

create policy "documents: read own or HR" on public.documents
  for select to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "documents: insert own or HR" on public.documents
  for insert to authenticated
  with check (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "documents: delete own or HR" on public.documents
  for delete to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());

-- leave_requests
drop policy if exists "leave: auth users can read" on public.leave_requests;
drop policy if exists "leave: auth users can insert" on public.leave_requests;
drop policy if exists "leave: auth users can update" on public.leave_requests;
drop policy if exists "leave: auth users can delete" on public.leave_requests;

create policy "leave: read own or HR" on public.leave_requests
  for select to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "leave: insert own or HR" on public.leave_requests
  for insert to authenticated
  with check (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "leave: decide HR only" on public.leave_requests
  for update to authenticated
  using (public.is_hr_manager()) with check (public.is_hr_manager());
create policy "leave: delete HR only" on public.leave_requests
  for delete to authenticated using (public.is_hr_manager());

-- employment_history
drop policy if exists "history: auth users can read" on public.employment_history;
drop policy if exists "history: auth users can insert" on public.employment_history;
drop policy if exists "history: auth users can update" on public.employment_history;
drop policy if exists "history: auth users can delete" on public.employment_history;

create policy "history: read own or HR" on public.employment_history
  for select to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "history: manage HR only" on public.employment_history
  for insert to authenticated with check (public.is_hr_manager());
create policy "history: update HR only" on public.employment_history
  for update to authenticated using (public.is_hr_manager()) with check (public.is_hr_manager());
create policy "history: delete HR only" on public.employment_history
  for delete to authenticated using (public.is_hr_manager());

-- notes
drop policy if exists "notes: auth users can read" on public.notes;
drop policy if exists "notes: auth users can insert" on public.notes;
drop policy if exists "notes: auth users can delete" on public.notes;

create policy "notes: read own or HR" on public.notes
  for select to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "notes: write HR only" on public.notes
  for insert to authenticated with check (public.is_hr_manager());
create policy "notes: delete HR only" on public.notes
  for delete to authenticated using (public.is_hr_manager());

-- pending_changes
create policy "changes: read own or HR" on public.pending_changes
  for select to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "changes: insert own or HR" on public.pending_changes
  for insert to authenticated
  with check (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "changes: review HR only" on public.pending_changes
  for update to authenticated using (public.is_hr_manager()) with check (public.is_hr_manager());
create policy "changes: delete HR only" on public.pending_changes
  for delete to authenticated using (public.is_hr_manager());

-- qualifications
create policy "qualifications: read own or HR" on public.qualifications
  for select to authenticated
  using (public.is_hr_manager() or employee_id = public.current_employee_id());
create policy "qualifications: insert own or HR" on public.qualifications
  for insert to authenticated
  with check (
    public.is_hr_manager() or
    (employee_id = public.current_employee_id() and status = 'pending')
  );
create policy "qualifications: review HR only" on public.qualifications
  for update to authenticated using (public.is_hr_manager()) with check (public.is_hr_manager());
create policy "qualifications: delete HR only" on public.qualifications
  for delete to authenticated using (public.is_hr_manager());

-- ============================================================
-- STORAGE: private files, restricted to owner's folder or HR
-- ============================================================
drop policy if exists "documents storage: auth read" on storage.objects;
drop policy if exists "documents storage: auth insert" on storage.objects;
drop policy if exists "documents storage: auth delete" on storage.objects;

create policy "documents storage: read own folder or HR" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employee-documents'
    and (public.is_hr_manager() or (storage.foldername(name))[1] = public.current_employee_id()::text)
  );
create policy "documents storage: insert own folder or HR" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'employee-documents'
    and (public.is_hr_manager() or (storage.foldername(name))[1] = public.current_employee_id()::text)
  );
create policy "documents storage: delete own folder or HR" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'employee-documents'
    and (public.is_hr_manager() or (storage.foldername(name))[1] = public.current_employee_id()::text)
  );

-- ============================================================
-- Optional sample data (skipped if already present)
-- ============================================================
insert into public.qualifications (employee_id, degree, field_of_study, institution, year, status, submitted_by)
select 'a0000000-0000-4000-8000-000000000001', 'Bachelor of Science', 'Computer Science', 'University of Texas', '2015', 'approved', null
where not exists (select 1 from public.qualifications q where q.employee_id = 'a0000000-0000-4000-8000-000000000001' and q.degree = 'Bachelor of Science');

insert into public.qualifications (employee_id, degree, field_of_study, institution, year, status, submitted_by)
select 'a0000000-0000-4000-8000-000000000001', 'AWS Certified Solutions Architect', 'Cloud Computing', 'Amazon Web Services', '2023', 'pending', null
where not exists (select 1 from public.qualifications q where q.employee_id = 'a0000000-0000-4000-8000-000000000001' and q.degree = 'AWS Certified Solutions Architect');

insert into public.pending_changes (employee_id, field, old_value, new_value, status, submitted_by)
select 'a0000000-0000-4000-8000-000000000001', 'position', 'Software Engineer', 'Senior Software Engineer', 'pending', null
where not exists (select 1 from public.pending_changes c where c.employee_id = 'a0000000-0000-4000-8000-000000000001' and c.new_value = 'Senior Software Engineer');