import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { issuesApi } from "@/api/issues";
import { useQueryView } from "@/components/QueryView";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";
import { createIssueDetailLocationState } from "@/lib/issueDetailBreadcrumb";
import { NavLink, useLocation } from "@/lib/router";

const WORK_LIMIT = 50;

export const coordinatorWorkViews = {
  in_progress: { title: "In progress", empty: "No tasks in progress." },
  blocked: { title: "Blocked work", empty: "No blocked tasks." },
  done: { title: "Completed work", empty: "No completed tasks." },
} as const;

export type CoordinatorWorkStatus = keyof typeof coordinatorWorkViews;

function completionDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function CoordinatorWorkList({ companyId, userId, status }: {
  companyId: string;
  userId: string | null | undefined;
  status: CoordinatorWorkStatus;
}) {
  const location = useLocation();
  const returnState = createIssueDetailLocationState("Inbox", location.pathname + location.search + location.hash);
  const { title, empty } = coordinatorWorkViews[status];
  const tasksQuery = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "coordinator-work", status, userId],
    queryFn: ({ signal }) => issuesApi.listCompact(companyId, {
      status,
      projection: "index",
      sortField: "updated",
      sortDir: "desc",
      limit: WORK_LIMIT,
    }, { signal, cache: "no-store" }),
    placeholderData: undefined,
    refetchOnWindowFocus: true,
  });
  const view = useQueryView(tasksQuery);
  // Retain the API's activity order, not a misleading completion-date sort.
  const tasks = (tasksQuery.data ?? []).filter(task => task.companyId === companyId && task.status === status).slice(0, WORK_LIMIT);

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">Up to {WORK_LIMIT} tasks, most recent activity first.</p>
      </div>
      {view.kind === "loading" || view.kind === "reconnecting" ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading {title.toLowerCase()}…</p>
      ) : view.kind === "error" ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">{title} could not be loaded.</p>
          <Button variant="outline" onClick={view.retry} disabled={view.isFetching}>Retry</Button>
        </div>
      ) : tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {tasks.map(task => {
            const date = status === "done" ? completionDate(task.completedAt) : null;
            return (
              <li key={task.id}>
                <NavLink to={`/issues/${task.identifier ?? task.id}`} state={returnState} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-xs text-muted-foreground">{task.identifier ?? task.id.slice(0, 8)}</span>
                    <span className="block break-words text-sm font-medium">{task.title}</span>
                    {status === "done" && <span className="block text-xs text-muted-foreground">{date ? <>Completed <time dateTime={date.toISOString()}>{date.toLocaleDateString()}</time></> : "Completion date unavailable"}</span>}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
