import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, getUserFromToken } from "@/lib/session";

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const db = await createClient();

  if (!db || !token) redirect("/login");

  const user = await getUserFromToken(db, token);
  if (!user) redirect("/login");

  redirect(user.role === "hr_manager" ? "/portal/hr" : "/portal/employee");
}