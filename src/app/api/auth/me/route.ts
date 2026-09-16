import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserFromToken, SESSION_COOKIE } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const db = await createClient();
  if (!db || !token) return NextResponse.json({ user: null });

  const user = await getUserFromToken(db, token);
  return NextResponse.json({ user });
}