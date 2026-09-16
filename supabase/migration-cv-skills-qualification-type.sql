-- ============================================================
-- HR System - Migration: CV, skills & qualification types
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Adds:
--   • app_users.cv_path / cv_file_name / cv_size_bytes / cv_updated_at
--       – the employee's CV uploaded as a PDF (one per user, replaceable)
--   • app_users.skills  – free-form skill tags (text array)
--   • qualifications.qualification_type  – educational | professional
-- ============================================================

-- 1. CV document (stored in the private hr-documents bucket)
alter table public.app_users
  add column if not exists cv_path text,
  add column if not exists cv_file_name text,
  add column if not exists cv_size_bytes bigint,
  add column if not exists cv_updated_at timestamptz;

-- 2. Skills as a text array (defaults to an empty list)
alter table public.app_users
  add column if not exists skills text[] not null default '{}';

-- 3. Home screen / profile dashboard groups qualifications by type
alter table public.qualifications
  add column if not exists qualification_type text not null default 'educational'
  check (qualification_type in ('educational', 'professional'));