import { cn } from "@/lib/utils";
import type { UserStatus, IdStatus, LeaveStatus, ReviewStatus, UserRole, DocumentCategory, QualificationType } from "@/lib/types";

const STYLES: Record<string, string> = {
  // user / review statuses
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  approved: "bg-green-50 text-green-700 ring-green-600/20",
  verified: "bg-green-50 text-green-700 ring-green-600/20",
  rejected: "bg-red-50 text-red-600 ring-red-600/20",
  // employee id statuses
  unused: "bg-gray-100 text-gray-600 ring-gray-500/20",
  claimed: "bg-blue-50 text-blue-700 ring-blue-600/20",
  // roles
  hr_manager: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  employee: "bg-gray-100 text-gray-600 ring-gray-500/20",
  // document categories
  contract: "bg-purple-50 text-purple-700 ring-purple-600/20",
  id: "bg-teal-50 text-teal-700 ring-teal-600/20",
  certificate: "bg-blue-50 text-blue-700 ring-blue-600/20",
  educational: "bg-violet-50 text-violet-700 ring-violet-600/20",
  other: "bg-gray-100 text-gray-700 ring-gray-500/20",
  // qualification types
  professional: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  verified: "Verified",
  rejected: "Rejected",
  unused: "Unclaimed",
  claimed: "Claimed",
  hr_manager: "HR Manager",
  employee: "Employee",
  contract: "Contract",
  id: "ID / Passport",
  certificate: "Certificate",
  educational: "Educational",
  other: "Other",
  professional: "Professional",
};

type BadgeValue =
  | UserStatus
  | IdStatus
  | LeaveStatus
  | ReviewStatus
  | UserRole
  | DocumentCategory
  | QualificationType;

export default function Badge({
  value,
  className,
}: {
  value: BadgeValue;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[value],
        className
      )}
    >
      {LABELS[value] ?? value}
    </span>
  );
}