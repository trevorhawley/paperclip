import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { latestFailedRunsByAgent, type Agent, type CompactIssue, type HeartbeatRun } from "@paperclipai/shared";
import { heartbeatsApi } from "@/api/heartbeats";
import { issuesApi } from "@/api/issues";
import { projectsApi } from "@/api/projects";
import { Button } from "@/components/ui/button";
import { createIssueDetailLocationState } from "@/lib/issueDetailBreadcrumb";
import { useVisibilityRefetchInterval } from "@/lib/polling";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useLocation } from "@/lib/router";

const LIMIT = 6;
const FAILED_RUN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function issueIdForRun(run: HeartbeatRun) {
  if (run.issueId) return run.issueId;
  const context = run.contextSnapshot;
  const id = context?.["issueId"] ?? context?.["taskId"];
  return typeof id === "string" && id ? id : null;
}

export function CoordinatorInboxOverview({ companyId, userId, agents }: {
  companyId: string;
  userId: string | null | undefined;
  agents: Map<string, Agent>;
}) {
  const location = useLocation();
  const returnState = createIssueDetailLocationState("Inbox", location.pathname + location.search);
  const refetchInterval = useVisibilityRefetchInterval({ visibleMs: 15_000 });
  const live = useQuery({
    queryKey: ["coordinator-inbox-runs", companyId, userId],
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId, { limit: 24 }),
    refetchInterval,
  });
  const projects = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
  });
  const projectNames = useMemo(() => new Map(projects.data?.map(project => [project.id, project.name])), [projects.data]);
  const work = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "inbox-overview", userId],
    queryFn: async ({ signal }) => {
      const list = (status: "in_progress" | "blocked" | "done") => issuesApi.listCompact(companyId, {
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
    refetchInterval,
  });
  const failures = useQuery({
    queryKey: ["coordinator-inbox-failed-runs", companyId, userId],
    queryFn: () => heartbeatsApi.list(companyId, undefined, 200, { summary: true, latestFailuresOnly: true }),
    refetchInterval,
  });
  const failedRuns = latestFailedRunsByAgent(failures.data ?? [])
    .filter(run => Date.now() - new Date(run.finishedAt ?? run.createdAt).getTime() < FAILED_RUN_WINDOW_MS)
    .slice(0, LIMIT);
  const liveIds = [...new Set([
    ...(live.data ?? []).flatMap(run => run.issueId ? [run.issueId] : []),
    ...failedRuns.flatMap(run => { const id = issueIdForRun(run); return id ? [id] : []; }),
  ])].sort();
  const liveTasks = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "inbox-run-tasks", userId, liveIds],
    queryFn: ({ signal }) => issuesApi.listCompact(companyId, { ids: liveIds, projection: "index", limit: liveIds.length }, { signal }),
    enabled: liveIds.length > 0,
  });
  const issueById = new Map([...(work.data?.active ?? []), ...(liveTasks.data ?? [])]
    .filter(task => task.companyId === companyId).map(task => [task.id, task]));
  const running = (live.data ?? []).filter(run => run.status === "running" &&
    (!run.execution || run.execution.phase === "working" || run.execution.phase === "finishing"));
  const runningIds = new Set(running.map(run => run.id));
  const waiting = (live.data ?? []).filter(run => !runningIds.has(run.id));
  const executingIds = new Set(running.map(run => run.issueId));
  function taskName(task: CompactIssue) {
    return <Link className="font-medium hover:underline" state={returnState} to={`/issues/${task.identifier ?? task.id}`}>
      {task.identifier ? `${task.identifier} · ` : ""}{task.title}
    </Link>;
  }
  function taskContext(task: CompactIssue, agentId = task.assigneeAgentId) {
    const agent = agentId ? agents.get(agentId) : undefined;
    const model = agent?.adapterConfig?.model;
    return [agent?.name, task.projectId ? projectNames.get(task.projectId) : undefined,
      typeof model === "string" && model.trim() ? `Configured model: ${model}` : undefined].filter(Boolean).join(" · ");
  }

  const failedTasks = failedRuns.map(run => ({ run, task: issueById.get(issueIdForRun(run) ?? "") }))
    .filter(({ task }) => task?.status !== "done" && task?.status !== "cancelled");

  return <div className="space-y-4">
    <section aria-label="Executing now" className="space-y-1">
      <h2 className="text-sm font-semibold">Executing now</h2>
      {live.isPending ? <p role="status">Checking execution…</p> : live.isError ? <p role="alert">Execution status could not be loaded. <Button variant="ghost" size="sm" onClick={() => void live.refetch()}>Retry</Button></p> :
        !running.length && !waiting.length ? <p className="text-sm text-muted-foreground">No live runs.</p> : null}
      {[...running, ...waiting].slice(0, LIMIT).map(run => {
        const task = run.issueId ? issueById.get(run.issueId) : undefined;
        const progress = run.currentStatusMessage?.trim() || run.lastAssistantSnippet?.trim();
        const time = run.lastUsefulActionAt ?? run.execution?.lastConfirmedActivityAt;
        return <article key={run.id} className="min-w-0 space-y-0.5 border-b border-border/60 py-1.5 text-sm last:border-0">
          {task ? taskName(task) : <span className="font-medium">{run.agentName}</span>}
          <p className="truncate text-xs text-muted-foreground">{[run.execution?.label ?? (run.status === "queued" ? "Queued" : "Running"), task ? taskContext(task, run.agentId) || run.agentName : null].filter(Boolean).join(" · ")}</p>
          {progress && <p className="truncate text-xs">{progress}</p>}
          {time && <p className="text-xs text-muted-foreground">Last confirmed progress <time dateTime={time}>{new Date(time).toLocaleString()}</time></p>}
        </article>;
      })}
    </section>
    {failures.isError ? <p role="alert" className="text-sm">Failed runs could not be loaded. <Button variant="ghost" size="sm" onClick={() => void failures.refetch()}>Retry</Button></p> :
      failedTasks.length > 0 && <section aria-label="Runs that failed" className="space-y-1">
        <h2 className="text-sm font-semibold">Runs that failed</h2>
        {failedTasks.map(({ run, task }) => {
          const agent = agents.get(run.agentId);
          const time = run.finishedAt ?? run.createdAt;
          return <article key={run.id} className="min-w-0 space-y-0.5 border-b border-border/60 py-1.5 text-sm last:border-0">
            {task ? taskName(task) : <span className="font-medium">{agent?.name ?? "Agent run"}</span>}
            <p className="truncate text-xs text-muted-foreground">{[run.status === "timed_out" ? "Timed out" : "Failed", agent?.name].filter(Boolean).join(" · ")}</p>
            {run.error?.trim() && <p className="truncate text-xs">{run.error.trim()}</p>}
            <p className="text-xs text-muted-foreground"><time dateTime={new Date(time).toISOString()}>{new Date(time).toLocaleString()}</time> · <Link className="underline" to={`/agents/${run.agentId}/runs/${run.id}`}>View run</Link></p>
          </article>;
        })}
      </section>}
    {work.isPending ? <p role="status">Loading recent work…</p> : work.isError ?
      <p role="alert">Recent work could not be loaded. <Button variant="ghost" size="sm" onClick={() => void work.refetch()}>Retry</Button></p> : null}
    {work.data && <div className="grid gap-4 md:grid-cols-3">
      <section aria-label="Blocked work" className="space-y-1">
        <h2 className="text-sm font-semibold">Blocked work</h2>
        {work.data.blocked.length === 0 && <p className="text-sm text-muted-foreground">No blocked tasks.</p>}
        {work.data.blocked.map(task => {
          const blocker = task.blockedInboxAttention;
          return <article key={task.id} className="min-w-0 space-y-0.5 border-b border-border/60 py-1.5 text-sm last:border-0">
            {taskName(task)}
            {taskContext(task) && <p className="truncate text-xs text-muted-foreground">{taskContext(task)}</p>}
            {blocker?.action && <p className="truncate text-xs">{blocker.action.detail || blocker.action.label}</p>}
            {blocker?.owner.label && <p className="truncate text-xs text-muted-foreground">Responsible for unblocking: {blocker.owner.label}</p>}
            {!blocker && task.blockedBy?.filter(issue => issue.status !== "done").map(issue => <p key={issue.id} className="truncate text-xs">Waiting on {issue.identifier} {issue.title}</p>)}
          </article>;
        })}
      </section>
      <section aria-label="Marked in progress" className="space-y-1">
        <h2 className="text-sm font-semibold">Marked in progress</h2>
        {work.data.active.filter(task => !executingIds.has(task.id)).map(task => <p key={task.id} className="truncate text-sm">
          {taskName(task)} {taskContext(task) && <span className="text-muted-foreground"> · {taskContext(task)}</span>}
        </p>)}
        {!work.data.active.some(task => !executingIds.has(task.id)) && <p className="text-sm text-muted-foreground">No other tasks marked in progress.</p>}
      </section>
      <section aria-label="Recently completed" className="space-y-1">
        <h2 className="text-sm font-semibold">Recently completed</h2>
        {!work.data.completed.some(task => task.completedAt != null) && <p className="text-sm text-muted-foreground">No completed tasks.</p>}
        {work.data.completed.filter(task => task.completedAt != null).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()).map(task => <p key={task.id} className="truncate text-sm">
          {taskName(task)} {taskContext(task) && <span className="text-muted-foreground"> · {taskContext(task)}</span>}
        </p>)}
      </section>
    </div>}
  </div>;
}
