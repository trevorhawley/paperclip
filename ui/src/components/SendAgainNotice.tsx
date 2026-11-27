import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { agentsApi } from "@/api/agents";
import { Button } from "@/components/ui/button";

type ChatComment = { id: string; authorType?: string | null; authorUserId?: string | null; authorAgentId?: string | null;
  body: string; createdAt: string | Date; deletedAt?: string | Date | null };

const QUIET_MS = 90_000;

/** The person's newest message got no reply and nothing is running or
 * explained: offer to wake the agent for that same message (no duplicate). */
export function pendingUnansweredMessage(comments: readonly ChatComment[], opts: { hasLiveRuns: boolean; explained: boolean; now?: number }) {
  if (opts.hasLiveRuns || opts.explained) return null;
  const latest = [...comments].filter(comment => !comment.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!latest) return null;
  const fromPerson = latest.authorType === "user" || (!latest.authorType && !!latest.authorUserId && !latest.authorAgentId);
  if (!fromPerson || latest.body.trim() === "/new") return null;
  return (opts.now ?? Date.now()) - new Date(latest.createdAt).getTime() >= QUIET_MS ? latest : null;
}

export function SendAgainNotice({ comments, hasLiveRuns, explained, agentId, companyId, issueId }: {
  comments: readonly ChatComment[]; hasLiveRuns: boolean; explained: boolean; agentId: string; companyId: string; issueId: string;
}) {
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string | null>(null);
  const message = pendingUnansweredMessage(comments, { hasLiveRuns, explained });
  const wake = useMutation({
    mutationFn: (commentId: string) => agentsApi.wakeup(agentId, {
      source: "on_demand", triggerDetail: "manual", reason: "issue_commented",
      payload: { issueId, commentId, mutation: "comment" },
      idempotencyKey: `send-again:${commentId}:${Date.now()}`,
    }, companyId),
    onSuccess: (result, commentId) => {
      // A refused wake is a hidden blocker too: say so instead of hiding the button.
      const status = (result as { status?: string } | null)?.status;
      if (status === "skipped") { setSkipped("The agent couldn't start. Check Setup issues in the Inbox."); return; }
      setSkipped(null);
      setSentFor(commentId);
    },
  });
  if (!message || sentFor === message.id) return null;
  return <div role="status" data-send-again className="mx-auto flex w-full max-w-3xl items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
    <span className="min-w-0 flex-1">No reply to your last message yet.</span>
    {skipped ? <span className="text-destructive">{skipped}</span> : null}
    {wake.isError ? <span className="text-destructive">{wake.error instanceof Error ? wake.error.message : "Couldn't send."}</span> : null}
    <Button size="sm" variant="ghost" disabled={wake.isPending} onClick={() => wake.mutate(message.id)}>{wake.isPending ? "Sending…" : "Send again"}</Button>
  </div>;
}
