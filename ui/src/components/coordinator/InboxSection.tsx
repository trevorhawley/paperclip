import type { ReactNode } from "react";

/** One clearly bounded Inbox block: a header with a count, then compact rows. */
export function InboxSection({ label, count, children, action }: { label: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return <section aria-label={label} className="min-w-0 space-y-1 rounded-lg border border-border bg-card/40 px-3 py-2">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold">{label}</h2>
      {typeof count === "number" ? <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span> : null}
      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
    {children}
  </section>;
}
