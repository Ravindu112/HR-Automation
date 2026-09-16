"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, LogOut, Menu, X } from "lucide-react";
import Avatar from "@/components/avatar";
import type { SessionUser } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
  badge?: number;
}

interface PortalShellProps {
  brand: string;
  subtitle: string;
  accent?: string;
  nav: NavItem[];
  user: SessionUser;
  onSignOut: () => void;
  children: React.ReactNode;
}

export default function PortalShell({
  brand,
  subtitle,
  accent = "bg-indigo-600",
  nav,
  user,
  onSignOut,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Collapse only affects md+ screens; on mobile the drawer always shows expanded.
  const hideLabels = collapsed;

  const isActive = (href: string) =>
    href === "/portal/hr" || href === "/portal/employee"
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white", accent)}>
            HR
          </div>
          <p className="truncate text-sm font-semibold text-white">{brand}</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-gray-900 transition-all duration-200 md:static md:z-auto md:translate-x-0",
          collapsed && "md:w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-800 px-3">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white", accent)}>
            HR
          </div>
          <div className={cn("min-w-0", hideLabels && "md:hidden")}>
            <p className="truncate text-sm font-semibold text-white">{brand}</p>
            <p className="truncate text-[10px] text-gray-400">{subtitle}</p>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden rounded p-1 text-gray-400 hover:text-white md:block"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded p-1 text-gray-400 hover:text-white md:hidden"
            title="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn("sidebar-link", isActive(item.href) && "sidebar-link-active")}
              title={hideLabels ? item.label : undefined}
            >
              <item.icon size={18} />
              <span className={cn("flex-1 truncate", hideLabels && "md:hidden")}>
                {item.label}
              </span>
              {item.badge ? (
                <span
                  className={cn(
                    "rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-gray-900",
                    hideLabels && "md:hidden"
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-800 p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Avatar
              firstName={user.first_name}
              lastName={user.last_name}
              picturePath={user.profile_picture_path}
              size="sm"
            />
            <div className={cn("min-w-0", hideLabels && "md:hidden")}>
              <p className="truncate text-xs font-semibold text-white">
                {user.first_name} {user.last_name}
              </p>
              <p className="truncate text-[10px] text-gray-400">{user.employee_id}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setMobileOpen(false);
              onSignOut();
            }}
            className="sidebar-link w-full text-left"
            title="Sign out"
          >
            <LogOut size={18} />
            <span className={cn(hideLabels && "md:hidden")}>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}