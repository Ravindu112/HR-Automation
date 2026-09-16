import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { deleteSession, EXPIRES_COOKIE, ROLE_COOKIE, SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const db = await createClient();
  if (db) await deleteSession(db, token);
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ROLE_COOKIE);
  cookieStore.delete(EXPIRES_COOKIE);
  return NextResponse.json({ ok: true });
}