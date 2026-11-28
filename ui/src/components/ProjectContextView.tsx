import { useQuery } from "@tanstack/react-query";
import type { CompactIssue, Project } from "@paperclipai/shared";
import { attentionApi } from "@/api/attention";
import { issuesApi } from "@/api/issues";
import { MarkdownBody } from "@/components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { coordinatorAttentionQueryKey } from "@/lib/coordinator-attention";
import { createIssueDetailLocationState } from "@/lib/issueDetailBreadcrumb";
import { attentionDetailLine } from "@/lib/attention";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useLocation } from "@/lib/router";

const LIMIT = 5;

/**
 * One page that answers "where is this project?": what it is for, what needs
 * Trevor, what is moving or stuck, and what was recently decided or finished.
 * Read-only; every item links to the existing task or Inbox view.
 */
export function ProjectContextView({ project, companyId }: { project: Project; companyId: string }) {
  const location = useLocation();
  const returnState = createIssueDetailLocationState(project.name, location.pathname + location.search);
  const attention = useQuery({
    queryKey: coordinatorAttentionQueryKey(companyId),
    queryFn: () => attentionApi.list(companyId, { all: true }),
  });
  const decisions = useQuery({
    queryKey: [...queryKeys.attention(companyId), "history", { projectId: project.id, limit: LIMIT }],
    queryFn: () => attentionApi.history(companyId, { projectId: project.id, limit: LIMIT }),
  });
  const work = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "project-context", project.id],
    queryFn: async ({ signal }) => {
      const list = (status: "in_progress" | "blocked" | "done") => issuesApi.listCompact(companyId, {
        projectId: project.id,
        status,
        projection: "index",
        sortField: "updated",
        sortDir: "desc",
        limit: LIMIT,
        ...(status === "blocked" ? { includeBlockedInboxAttention: true, includeBlockedBy: true } : {}),
      }, { signal });
      const [active, blocked, completed] = await Promise.all([list("in_progress"), list("blocked"), list("done")]);
      return { active, blocked, completed };
    },
  });
  const needsYou = (attention.data?.items ?? []).filter(item => item.project?.id === project.id);
  const goals = project.goals ?? [];

  function taskLink(task: CompactIssue) {
    return <Link className="font-medium hover:underline" state={returnState} to={`/issues/${task.identifier ?? task.id}`}>
      {task.identifier ? `${task.identifier} · ` : ""}{task.title}
    </Link>;
  }
  function failed(label: string, retry: () => unknown) {
    return <p role="alert" className="text-sm">{label} could not be loaded. <Button variant="ghost" size="sm" onClick={() => void retry()}>Retry</Button></p>;
  }
  function tasks(label: string, list: CompactIssue[] | undefined, empty: string, detail?: (task: CompactIssue) => React.ReactNode) {
    return <section aria-label={label} className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h3>
      {!list?.length ? <p className="text-sm text-muted-foreground">{empty}</p> : list.map(task => <div key={task.id} className="min-w-0 truncate">
        {taskLink(task)}{detail?.(task)}
      </div>)}
    </section>;
  }

  return <div className="mx-auto max-w-4xl space-y-5 text-sm" data-project-context>
    <section aria-label="About this project" className="space-y-1.5">
      <h2 className="text-sm font-semibold">About this project</h2>
      {project.description?.trim()
        ? <MarkdownBody className="text-sm">{project.description}</MarkdownBody>
        : <p className="text-sm text-muted-foreground">No description yet. Add one under Configuration so agents and you share the same context.</p>}
      {goals.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Goals: </span>{goals.map(goal => goal.title).join(" · ")}</p>}
    </section>

    <section aria-label="Needs you" className="space-y-1.5">
      <h2 className="text-sm font-semibold">Needs you</h2>
      {attention.isPending ? <p role="status" className="text-sm text-muted-foreground">Checking decisions…</p>
        : attention.isError ? failed("Decisions", attention.refetch)
        : !needsYou.length ? <p className="text-sm text-muted-foreground">Nothing in this project is waiting on you.</p>
        : <>
          {needsYou.slice(0, LIMIT).map(item => <div key={item.id} className="min-w-0 border-b border-border/60 py-2.5 last:border-0">
            <p className="truncate font-medium">{item.subject.title ?? item.whyNow}</p>
            <p className="truncate text-xs text-muted-foreground">{[attentionDetailLine(item) ?? item.whyNow, item.relatedIssue?.identifier].filter(Boolean).join(" · ")}</p>
          </div>)}
          <Link className="text-xs text-muted-foreground underline-offset-2 hover:underline" to="/decisions?work=pending">Decide in the Inbox ({needsYou.length})</Link>
        </>}
    </section>

    <section aria-label="Work" className="space-y-4">
      <h2 className="text-sm font-semibold">Work</h2>
      {work.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading work…</p>
        : work.isError ? failed("Work", work.refetch)
        : <div className="grid gap-4 md:grid-cols-3">
          {tasks("Blocked", work.data.blocked, "Nothing blocked.", task => {
            const reason = task.blockedInboxAttention?.action?.detail || task.blockedInboxAttention?.action?.label
              || task.blockedBy?.filter(issue => issue.status !== "done").map(issue => `Waiting on ${issue.identifier ?? issue.title}`).join(", ");
            return reason ? <p className="truncate text-xs text-muted-foreground">{reason}</p> : null;
          })}
          {tasks("In progress", work.data.active, "Nothing in progress.")}
          {tasks("Recently completed", work.data.completed, "Nothing completed yet.")}
        </div>}
    </section>

    <section aria-label="Recent decisions" className="space-y-1.5">
      <h2 className="text-sm font-semibold">Recent decisions</h2>
      {decisions.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading decisions…</p>
        : decisions.isError ? failed("Decision history", decisions.refetch)
        : !decisions.data.items.length ? <p className="text-sm text-muted-foreground">No decisions recorded for this project yet.</p>
        : decisions.data.items.map(item => <p key={item.id} className="truncate">
          <Link className="hover:underline" state={returnState} to={item.href}>{item.title}</Link>
          <span className="text-muted-foreground"> · {item.label} · {item.issueIdentifier ?? item.issueTitle} · <time dateTime={item.resolvedAt}>{new Date(item.resolvedAt).toLocaleDateString()}</time></span>
        </p>)}
    </section>
  </div>;
}
