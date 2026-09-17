import { createClient } from "@/lib/supabase/client";
import type { NotificationType, SessionUser } from "@/lib/types";

/**
 * Record a system action in the audit log. Never throws — auditing must
 * never break the action that triggered it.
 */
export async function logAudit(opts: {
  user?: SessionUser | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}): Promise<void> {
  try {
    await createClient().from("audit_logs").insert({
      user_id: opts.user?.id ?? null,
      user_employee_id: opts.user?.employee_id ?? null,
      action: opts.action,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      summary: opts.summary ?? null,
      old_value: opts.oldValue ?? null,
      new_value: opts.newValue ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // Non-fatal by design.
  }
}

/** Create an in-app notification for a user. Never throws. */
export async function notify(opts: {
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  try {
    await createClient().from("notifications").insert({
      user_id: opts.userId,
      type: opts.type ?? "general",
      title: opts.title,
      body: opts.body ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
    });
  } catch {
    // Non-fatal by design.
  }
}