import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  createSession,
  deleteSession,
  getUserFromToken,
  normalizeEmployeeId,
  publicProfile,
  EXPIRES_COOKIE,
  ROLE_COOKIE,
  SESSION_COOKIE,
  SESSION_DURATION_DAYS,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const employeeId = normalizeEmployeeId(String(body.employee_id ?? ""));
  const password = String(body.password ?? "");

  if (!employeeId || !password) {
    return NextResponse.json(
      { error: "Enter your employee ID and password." },
      { status: 400 }
    );
  }

  const db = await createClient();
  if (!db) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 }
    );
  }

  const { data: user } = await db
    .from("app_users")
    .select("id, password_hash, role, status, rejection_reason, *")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json(
      { error: "This employee ID is not registered. Ask your HR manager to register your ID first." },
      { status: 400 }
    );
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
  }

  if (user.status === "pending") {
    return NextResponse.json(
      { error: "Your account is still awaiting HR manager verification. Please check again later." },
      { status: 403 }
    );
  }

  if (user.status === "rejected") {
    return NextResponse.json(
      { error: `Your registration was rejected by HR${user.rejection_reason ? ` (${user.rejection_reason})` : ""}. Contact your HR manager.` },
      { status: 403 }
    );
  }

  const token = randomBytes(32).toString("hex");
  const ok = await createSession(db, user.id, token);
  if (!ok) {
    return NextResponse.json({ error: "Could not start a session." }, { status: 500 });
  }

  // Confirm the new session actually resolves to a user before issuing
  // cookies. This catches an out-of-date database schema (e.g. the CV /
  // skills migration not applied) at login time, so the browser never
  // reaches a portal <-> login redirect loop that looks like an endless
  // loading screen.
  const sessionUser = await getUserFromToken(db, token);
  if (!sessionUser) {
    await deleteSession(db, token);
    return NextResponse.json(
      {
        error:
          "Could not validate your session. The database schema may be out of date — ask the administrator to run the latest Supabase migration.",
      },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  // Lightweight routing cookies read by middleware so it never has to
  // query the database. The real session is validated on every portal
  // render via /api/auth/me.
  cookieStore.set(ROLE_COOKIE, user.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  cookieStore.set(
    EXPIRES_COOKIE,
    new Date(Date.now() + maxAge * 1000).toISOString(),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    }
  );

  return NextResponse.json({
    redirect: sessionUser.role === "hr_manager" ? "/portal/hr" : "/portal/employee",
    user: publicProfile(sessionUser),
  });
}