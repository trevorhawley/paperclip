import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";

/** A paused agent never wakes, so a chat message to it would otherwise sit
 * silently. Say so above the conversation and offer to resume it. */
export function PausedAgentChatNotice({ agent }: { agent: Pick<Agent, "id" | "name" | "companyId" | "status"> }) {
  const client = useQueryClient();
  const resume = useMutation({
    mutationFn: () => agentsApi.resume(agent.id, agent.companyId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.agents.list(agent.companyId) });
      void client.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
    },
  });
  if (agent.status !== "paused" || resume.isSuccess) return null;
  return <div role="status" data-paused-agent-notice className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
    <span className="min-w-0 flex-1">
      <span className="font-medium">{agent.name} is paused</span>
      <span className="text-muted-foreground">, so it won't reply to new messages.</span>
    </span>
    {resume.isError ? <span className="text-xs text-destructive">{resume.error instanceof Error ? resume.error.message : "Couldn't resume."}</span> : null}
    <Button size="sm" variant="ghost" disabled={resume.isPending} onClick={() => resume.mutate()}>{resume.isPending ? "Resuming…" : "Resume"}</Button>
  </div>;
}
