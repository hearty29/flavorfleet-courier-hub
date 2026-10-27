import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Placed", cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300" },
    confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300" },
    preparing: { label: "Preparing", cls: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300" },
    ready: { label: "Ready", cls: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300" },
    picked_up: { label: "On The Way", cls: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300" },
    on_delivery: { label: "On The Way", cls: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300" },
    delivered: { label: "Delivered", cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300" },
    cancelled: { label: "Cancelled", cls: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    rejected: { label: "Rejected", cls: "bg-rose-100 text-rose-800 border-rose-300" },
  };

  const current = map[status] || { label: status.replace("_", " "), cls: "bg-muted text-muted-foreground border-border" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize transition-colors",
        current.cls,
        className
      )}
    >
      {current.label}
    </span>
  );
}
