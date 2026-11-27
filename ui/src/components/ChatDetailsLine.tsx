import { useQuery } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { projectsApi } from "@/api/projects";
import { useCoordinatorChatTaskHandoffs } from "@/components/coordinator/CoordinatorChatTaskHandoffs";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";
import { projectRouteRef } from "@/lib/utils";

/** One quiet line saying what this chat is: who, which project, what it produced, since when. */
export function ChatDetailsLine({ agent, chat }: { agent: Pick<Agent, "name" | "companyId">; chat: Pick<Issue, "id" | "projectId" | "createdAt"> | null }) {
  const projects = useQuery({ queryKey: queryKeys.projects.list(agent.companyId), queryFn: () => projectsApi.list(agent.companyId), enabled: !!chat?.projectId });
  const handoffs = useCoordinatorChatTaskHandoffs(chat?.id ?? null);
  if (!chat) return null;
  const project = chat.projectId ? projects.data?.find(item => item.id === chat.projectId) : undefined;
  const tasks = handoffs.handoffs;
  const started = new Date(chat.createdAt);
  return <p data-chat-details className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
    <span>With <span className="font-medium text-foreground">{agent.name}</span></span>
    <span aria-hidden>·</span>
    {project ? <Link className="hover:underline" to={`/projects/${projectRouteRef(project)}/context`}>{project.name}</Link> : <span>No project</span>}
    {tasks.length > 0 && <>
      <span aria-hidden>·</span>
      <span className="min-w-0 truncate">{tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}:{" "}
        {tasks.slice(0, 2).map((task, index) => <span key={task.id}>{index > 0 ? ", " : ""}<Link className="hover:underline" to={`/issues/${task.identifier ?? task.issueId}`}>{task.identifier ?? task.title}</Link></span>)}
        {tasks.length > 2 ? ` +${tasks.length - 2}` : ""}</span>
    </>}
    {!Number.isNaN(started.getTime()) && <><span aria-hidden>·</span><span>Started {started.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></>}
  </p>;
}
