"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { UserRole } from "@/lib/types";

/**
 * Redirects a portal layout to /login when there is no session and to
 * the other portal when the user's role does not match `allowed`.
 */
export function usePortalGuard(allowed: UserRole) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== allowed) {
      router.replace(user.role === "hr_manager" ? "/portal/hr" : "/portal/employee");
    }
  }, [loading, user, allowed, router]);

  return { user, loading, signOut };
}