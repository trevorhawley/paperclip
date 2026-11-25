import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, CompactIssue } from "@paperclipai/shared";
import { heartbeatsApi } from "@/api/heartbeats";
import { issuesApi } from "@/api/issues";
import { projectsApi } from "@/api/projects";
import { Button } from "@/components/ui/button";
import { createIssueDetailLocationState } from "@/lib/issueDetailBreadcrumb";
import { useVisibilityRefetchInterval } from "@/lib/polling";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useLocation } from "@/lib/router";

const LIMIT = 6;

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
  const liveIds = [...new Set((live.data ?? []).flatMap(run => run.issueId ? [run.issueId] : []))].sort();
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

  return <div className="space-y-5">
    <section aria-label="Executing now" className="space-y-2">
      <h2 className="text-lg font-medium">Executing now</h2>
      {live.isPending ? <p role="status">Checking execution…</p> : live.isError ? <p role="alert">Execution status could not be loaded. <Button variant="ghost" onClick={() => void live.refetch()}>Retry</Button></p> :
        !running.length && !waiting.length ? <p className="text-sm text-muted-foreground">No live runs.</p> : null}
      {[...running, ...waiting].slice(0, LIMIT).map(run => {
        const task = run.issueId ? issueById.get(run.issueId) : undefined;
        const progress = run.currentStatusMessage?.trim() || run.lastAssistantSnippet?.trim();
        const time = run.lastUsefulActionAt ?? run.execution?.lastConfirmedActivityAt;
        return <article key={run.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
          {task ? taskName(task) : <span className="font-medium">{run.agentName}</span>}
          <p className="text-muted-foreground">{[run.execution?.label ?? (run.status === "queued" ? "Queued" : "Running"), task ? taskContext(task, run.agentId) || run.agentName : null].filter(Boolean).join(" · ")}</p>
          {progress && <p className="line-clamp-2 break-words">{progress}</p>}
          {time && <p className="text-xs text-muted-foreground">Last confirmed progress <time dateTime={time}>{new Date(time).toLocaleString()}</time></p>}
        </article>;
      })}
    </section>
    {work.isPending ? <p role="status">Loading recent work…</p> : work.isError ?
      <p role="alert">Recent work could not be loaded. <Button variant="ghost" onClick={() => void work.refetch()}>Retry</Button></p> : null}
    {work.data && <>
      <section aria-label="Blocked work" className="space-y-2">
        <h2 className="text-lg font-medium">Blocked work</h2>
        {work.data.blocked.length === 0 && <p className="text-sm text-muted-foreground">No blocked tasks.</p>}
        {work.data.blocked.map(task => {
          const blocker = task.blockedInboxAttention;
          return <article key={task.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
            {taskName(task)}
            {taskContext(task) && <p className="text-muted-foreground">{taskContext(task)}</p>}
            {blocker?.action && <p>{blocker.action.detail || blocker.action.label}</p>}
            {blocker?.owner.label && <p className="text-muted-foreground">Responsible for unblocking: {blocker.owner.label}</p>}
            {!blocker && task.blockedBy?.filter(issue => issue.status !== "done").map(issue => <p key={issue.id}>Waiting on {issue.identifier} {issue.title}</p>)}
          </article>;
        })}
      </section>
      <section aria-label="Marked in progress" className="space-y-2">
        <h2 className="text-lg font-medium">Marked in progress</h2>
        {work.data.active.filter(task => !executingIds.has(task.id)).map(task => <p key={task.id} className="text-sm">
          {taskName(task)} {taskContext(task) && <span className="text-muted-foreground"> · {taskContext(task)}</span>}
        </p>)}
        {!work.data.active.some(task => !executingIds.has(task.id)) && <p className="text-sm text-muted-foreground">No other tasks marked in progress.</p>}
      </section>
      <section aria-label="Recently completed" className="space-y-2">
        <h2 className="text-lg font-medium">Recently completed</h2>
        {!work.data.completed.some(task => task.completedAt != null) && <p className="text-sm text-muted-foreground">No completed tasks.</p>}
        {work.data.completed.filter(task => task.completedAt != null).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()).map(task => <p key={task.id} className="text-sm">
          {taskName(task)} {taskContext(task) && <span className="text-muted-foreground"> · {taskContext(task)}</span>}
        </p>)}
      </section>
    </>}
  </div>;
}
