import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getUserFromToken,
  EXPIRES_COOKIE,
  ROLE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const db = await createClient();

  const fail = () => {
    // Clear the lightweight routing cookies so the middleware stops
    // bouncing the browser between the portal and /login (which renders
    // as an endless loading screen).
    const clear = { path: "/", maxAge: 0 };
    cookieStore.set(SESSION_COOKIE, "", clear);
    cookieStore.set(ROLE_COOKIE, "", clear);
    cookieStore.set(EXPIRES_COOKIE, "", clear);
    return NextResponse.json({ user: null });
  };

  if (!token) return NextResponse.json({ user: null });
  if (!db) return fail();

  const user = await getUserFromToken(db, token);
  if (!user) return fail();

  return NextResponse.json({ user });
}