"use client";

import { useAuth } from "@/context/auth-context";
import NotificationCenter from "@/components/notification-center";

export default function HrNotificationsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <NotificationCenter userId={user.id} />;
}