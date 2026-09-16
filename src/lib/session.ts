import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "hr_session";
export const ROLE_COOKIE = "hr_role";
export const EXPIRES_COOKIE = "hr_expires";
export const SESSION_DURATION_DAYS = 30;

export function normalizeEmployeeId(value: string): string {
  return value.trim().toUpperCase();
}

const USER_SELECT =
  "id, employee_id, role, status, first_name, last_name, email, phone, date_of_birth, address, department, position, profile_picture_path";

export function mapSessionUser(row: Record<string, unknown>): SessionUser {
  return {
    id: row.id as string,
    employee_id: row.employee_id as string,
    role: row.role as SessionUser["role"],
    status: row.status as SessionUser["status"],
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    date_of_birth: (row.date_of_birth as string) ?? null,
    address: (row.address as string) ?? null,
    department: (row.department as string) ?? null,
    position: (row.position as string) ?? null,
    profile_picture_path: (row.profile_picture_path as string) ?? null,
  };
}

/**
 * Look up the active user for a session token. Returns null when the
 * token is unknown or has expired.
 */
export async function getUserFromToken(
  db: SupabaseClient,
  token: string | null | undefined
): Promise<SessionUser | null> {
  if (!token) return null;

  const { data, error } = await db
    .from("sessions")
    .select(`expires_at, app_users(${USER_SELECT})`)
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  const expires = new Date(data.expires_at as string).getTime();
  if (expires < Date.now()) return null;

  const user = Array.isArray(data.app_users) ? data.app_users[0] : data.app_users;
  if (!user || user.status !== "verified") return null;

  return mapSessionUser(user as unknown as Record<string, unknown>);
}

/**
 * Create a session row for a user and return the raw token to store
 * in a cookie.
 */
export async function createSession(
  db: SupabaseClient,
  userId: string,
  token: string
): Promise<boolean> {
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );
  const { error } = await db.from("sessions").insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  return !error;
}

/** Delete every session row for a token (used on logout). */
export async function deleteSession(
  db: SupabaseClient,
  token: string | null | undefined
): Promise<void> {
  if (!token) return;
  await db.from("sessions").delete().eq("token", token);
}

/** Map a public profile payload. */
export function publicProfile(
  user: SessionUser & Partial<Record<string, unknown>>
) {
  return {
    id: user.id,
    employee_id: user.employee_id,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
    date_of_birth: user.date_of_birth,
    address: user.address,
    department: user.department,
    position: user.position,
    profile_picture_path: user.profile_picture_path,
  };
}