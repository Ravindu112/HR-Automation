import { avatarUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

interface AvatarProps {
  firstName: string;
  lastName: string;
  picturePath?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export default function Avatar({
  firstName,
  lastName,
  picturePath,
  size = "md",
  className,
}: AvatarProps) {
  const src = avatarUrl(picturePath);
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-gray-200",
          SIZES[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white",
        SIZES[size],
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}