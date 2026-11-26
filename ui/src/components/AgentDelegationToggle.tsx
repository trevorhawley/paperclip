import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

/** Opt-in: lets this agent's coordinator chat hand substantial work to the
 * best-suited agent instead of always assigning itself. Off by default. */
export function AgentDelegationToggle({ agent, refs }: { agent: Pick<Agent, "id" | "companyId" | "metadata">; refs?: string[] }) {
  const client = useQueryClient();
  const on = (agent.metadata as Record<string, unknown> | null | undefined)?.canDelegate === true;
  const save = useMutation({
    mutationFn: (next: boolean) => agentsApi.update(agent.id, { metadata: { ...(agent.metadata ?? {}), canDelegate: next } }, agent.companyId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.agents.list(agent.companyId) });
      for (const ref of new Set([agent.id, ...(refs ?? [])])) void client.invalidateQueries({ queryKey: queryKeys.agents.detail(ref) });
    },
  });
  return <span className="inline-flex items-center gap-2">
    <button type="button" data-agent-delegation aria-pressed={on} disabled={save.isPending} onClick={() => save.mutate(!on)}
      title={on ? "This agent's chat may hand deep work to a better-suited agent. Click to turn off." : "Let this agent's chat hand deep work (research, writing, coding) to a better-suited agent."}
      className={cn("rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "border-border text-muted-foreground")}>
      {save.isPending ? "Saving…" : on ? "Delegates deep work" : "Delegation off"}
    </button>
    {save.isError ? <span role="alert" className="text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Couldn't save."}</span> : null}
  </span>;
}
