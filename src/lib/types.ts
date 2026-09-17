export type UserRole = "hr_manager" | "employee";
export type UserStatus = "pending" | "verified" | "rejected";
export type IdStatus = "unused" | "claimed";
export type DocumentCategory = "id" | "certificate" | "educational" | "contract" | "other";
export type LeaveType = "annual" | "sick" | "casual" | "maternity" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type QualificationType = "educational" | "professional";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "holiday";
export type NotificationType =
  | "general"
  | "leave"
  | "profile"
  | "registration"
  | "announcement"
  | "training"
  | "document"
  | "performance";

export interface SessionUser {
  id: string;
  employee_id: string;
  role: UserRole;
  status: UserStatus;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  profile_picture_path: string | null;
  skills: string[];
  cv_path: string | null;
  cv_file_name: string | null;
  cv_size_bytes: number | null;
  cv_updated_at: string | null;
}

export interface AppUser extends SessionUser {
  password_hash: string;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface EmployeeId {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  status: IdStatus;
  created_by: string | null;
  created_at: string;
  claimed_at: string | null;
}

export interface Document {
  id: string;
  user_id: string;
  name: string;
  category: DocumentCategory;
  file_name: string;
  file_path: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  is_half_day: boolean;
  working_days: number;
  balance_year: number;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  applicant?: Pick<AppUser, "first_name" | "last_name" | "department" | "position" | "profile_picture_path"> | null;
}

export interface Qualification {
  id: string;
  user_id: string;
  qualification_type: QualificationType;
  title: string;
  institution: string | null;
  year: string | null;
  status: ReviewStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  applicant?: Pick<AppUser, "first_name" | "last_name" | "department" | "position" | "profile_picture_path"> | null;
}

export interface ProfileChangeRequest {
  id: string;
  user_id: string;
  field: string;
  field_label: string;
  current_value: string | null;
  new_value: string;
  status: ReviewStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  applicant?: Pick<AppUser, "first_name" | "last_name" | "department" | "position" | "profile_picture_path"> | null;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  work_minutes: number;
  is_late: boolean;
  status: AttendanceStatus;
  status_reason: string | null;
  corrected_by: string | null;
  correction_reason: string | null;
  source: string;
  created_at: string;
  applicant?: Pick<AppUser, "first_name" | "last_name" | "department" | "position" | "profile_picture_path"> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  balance_year: number;
  allocated: number;
  used: number;
  carried_forward: number;
}

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  type: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_employee_id: string | null;
  action: string;
  summary: string | null;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "id", label: "ID / Passport" },
  { value: "certificate", label: "Certificate" },
  { value: "educational", label: "Educational" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "casual", label: "Casual leave" },
  { value: "maternity", label: "Maternity leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "other", label: "Other" },
];

export const QUALIFICATION_TYPES: {
  value: QualificationType;
  label: string;
}[] = [
  { value: "educational", label: "Educational" },
  { value: "professional", label: "Professional" },
];

export const PROFILE_FIELDS: { field: string; label: string }[] = [
  { field: "first_name", label: "First name" },
  { field: "last_name", label: "Last name" },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "date_of_birth", label: "Date of birth" },
  { field: "address", label: "Address" },
];

export const PROFILE_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  PROFILE_FIELDS.map((f) => [f.field, f.label])
);