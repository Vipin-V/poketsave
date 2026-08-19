import type { Urgency } from "@/lib/bookmarks";

const styles: Record<Urgency, string> = {
  ok: "border-primary/40 text-primary",
  soon: "border-warn/50 text-warn",
  critical: "border-danger/60 text-danger",
  expired: "border-border text-muted-foreground",
};

export function DeadlinePill({ urgency, label }: { urgency: Urgency; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${styles[urgency]}`}
    >
      {label}
    </span>
  );
}
