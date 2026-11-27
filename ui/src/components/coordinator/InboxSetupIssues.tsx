import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { Button } from "@/components/ui/button";
import { InboxSection } from "./InboxSection";
import { getWorktreeInstanceId, isWorktreeRuntime } from "@/lib/worktree-branding";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";
import { agentRouteRef } from "@/lib/utils";
import { resolveWorktreeRunExecutionDisplayState } from "@/pages/InstanceExperimentalSettings";

/**
 * Hidden blockers, shown where Trevor looks first. Each row says what is
 * stopping work and offers the fix in one click. Renders nothing when clear.
 */
export function InboxSetupIssues({ companyId, agents }: { companyId: string; agents: Agent[] }) {
  const client = useQueryClient();
  const experimental = useQuery({ queryKey: queryKeys.instance.experimentalSettings, queryFn: () => instanceSettingsApi.getExperimental() });
  const resume = useMutation({
    mutationFn: (agent: Agent) => agentsApi.resume(agent.id, agent.companyId),
    onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) }); },
  });
  const runsOff = isWorktreeRuntime()
    && resolveWorktreeRunExecutionDisplayState(experimental.data, getWorktreeInstanceId()).kind !== "armed";
  const paused = agents.filter(agent => agent.status === "paused" && agent.pauseReason !== "budget");
  const budget = agents.filter(agent => agent.status === "paused" && agent.pauseReason === "budget");
  // Failed runs have their own section with the task and error; don't repeat them here.
  if (!runsOff && !paused.length && !budget.length) return null;
  const row = (key: string, text: React.ReactNode, action?: React.ReactNode) =>
    <div key={key} className="flex min-w-0 items-center gap-3 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber-500" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {action}
    </div>;
  return <InboxSection label="Setup issues" count={(runsOff ? 1 : 0) + paused.length + budget.length}>
    {runsOff && row("runs-off", "Agent runs are switched off on this instance, so nothing will start.",
      <Link className="shrink-0 text-xs underline-offset-2 hover:underline" to="/company/settings/instance/experimental">Turn on</Link>)}
    {paused.map(agent => row(`paused-${agent.id}`, <><span className="font-medium">{agent.name}</span> is paused and won't pick up tasks or chat messages.</>,
      <Button size="sm" variant="ghost" className="shrink-0" disabled={resume.isPending} onClick={() => resume.mutate(agent)}>Resume</Button>))}
    {budget.map(agent => row(`budget-${agent.id}`, <><span className="font-medium">{agent.name}</span> hit its budget and is stopped.</>,
      <Link className="shrink-0 text-xs underline-offset-2 hover:underline" to={`/agents/${agentRouteRef(agent)}/budgets`}>Review budget</Link>))}
    {resume.isError ? <p role="alert" className="text-xs text-destructive">{resume.error instanceof Error ? resume.error.message : "Couldn't resume."}</p> : null}
  </InboxSection>;
}
