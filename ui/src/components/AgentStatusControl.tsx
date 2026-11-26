import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Pause, Play } from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

const presentation: Record<string, { label: string; dot: string; hint: string }> = {
  active: { label: "Active", dot: "bg-green-500", hint: "Wakes for new tasks and messages." },
  idle: { label: "Active", dot: "bg-green-500", hint: "Idle. Wakes for new tasks and messages." },
  running: { label: "Running", dot: "bg-blue-500", hint: "Working on something now." },
  paused: { label: "Paused", dot: "bg-amber-500", hint: "Won't wake for tasks or chat messages until resumed." },
  error: { label: "Error", dot: "bg-red-500", hint: "Its last run failed. Check Runs for details." },
  pending_approval: { label: "Awaiting approval", dot: "bg-muted-foreground", hint: "Needs approval before it can run." },
  terminated: { label: "Terminated", dot: "bg-muted-foreground", hint: "Permanently stopped." },
};

/** The agent's status, always visible, and changeable where it is shown:
 * click it to pause or resume. Other lifecycle actions stay in the ⋯ menu. */
export function AgentStatusControl({ agent, refs }: { agent: Pick<Agent, "id" | "companyId" | "status" | "name">; refs?: string[] }) {
  const client = useQueryClient();
  const change = useMutation({
    mutationFn: (action: "pause" | "resume") =>
      action === "pause" ? agentsApi.pause(agent.id, agent.companyId) : agentsApi.resume(agent.id, agent.companyId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.agents.list(agent.companyId) });
      for (const ref of new Set([agent.id, ...(refs ?? [])])) void client.invalidateQueries({ queryKey: queryKeys.agents.detail(ref) });
    },
  });
  const view = presentation[agent.status] ?? { label: agent.status, dot: "bg-muted-foreground", hint: "" };
  const paused = agent.status === "paused";
  const changeable = paused || ["active", "idle", "running", "error"].includes(agent.status);
  const pill = <span className="inline-flex items-center gap-1.5">
    <span aria-hidden className={cn("size-2 rounded-full", view.dot)} />
    <span>{change.isPending ? (paused ? "Resuming…" : "Pausing…") : view.label}</span>
    {changeable ? <ChevronDown aria-hidden className="size-3 opacity-60" /> : null}
  </span>;
  if (!changeable) return <span data-agent-status className="text-sm text-muted-foreground" title={view.hint}>{pill}</span>;
  return <span className="inline-flex items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-agent-status aria-label={`Status: ${view.label}. Change status`} title={view.hint} disabled={change.isPending}
          className={cn("rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            paused ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border text-foreground")}>
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{view.hint}</p>
        {paused
          ? <DropdownMenuItem onSelect={() => change.mutate("resume")}><Play className="size-4" />Resume {agent.name}</DropdownMenuItem>
          : <DropdownMenuItem onSelect={() => change.mutate("pause")}><Pause className="size-4" />Pause {agent.name}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {change.isError ? <span role="alert" className="text-xs text-destructive">{change.error instanceof Error ? change.error.message : "Couldn't change status."}</span> : null}
  </span>;
}
