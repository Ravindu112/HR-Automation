import { createClient } from "@/lib/supabase/client";

export const BUCKET_DOCUMENTS = "hr-documents";
export const BUCKET_AVATARS = "hr-avatars";

function ext(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "bin";
}

/** Paths used while a registration is still pending (no user_id yet). */
export function pendingAvatarPath(employeeId: string, fileName: string): string {
  return `pending/${employeeId}/avatar.${ext(fileName)}`;
}
export function pendingDocumentPath(employeeId: string, fileName: string): string {
  return `pending/${employeeId}/${Date.now()}-${fileName}`;
}

/** Paths for a verified user. */
export function avatarPath(userId: string, fileName: string): string {
  return `${userId}/avatar.${ext(fileName)}`;
}
export function documentPath(userId: string, fileName: string): string {
  return `${userId}/${Date.now()}-${fileName}`;
}

export async function uploadFile(
  bucket: string,
  fullPath: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(fullPath, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return fullPath;
}

export async function deleteFile(bucket: string, fullPath: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(bucket).remove([fullPath]);
}

/** Public URL – avatars bucket is public. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  return supabase.storage.from(BUCKET_AVATARS).getPublicUrl(path).data.publicUrl;
}

/** Signed URL – documents bucket is private, link expires after 5 minutes. */
export async function documentUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTS)
    .createSignedUrl(path, 300);
  return error ? null : data.signedUrl;
}