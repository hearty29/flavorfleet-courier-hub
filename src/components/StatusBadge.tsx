import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  pending: "bg-accent text-accent-foreground",
  preparing: "bg-secondary text-secondary-foreground",
  ready: "bg-primary/15 text-primary",
  picked_up: "bg-primary text-primary-foreground",
  delivered: "bg-success text-primary-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  approved: "bg-success text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", styles[status])}>
      {status.replace("_", " ")}
    </span>
  );
}
