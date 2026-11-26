import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { issueComments, issues, type Db } from "@paperclipai/db";

export type PendingChatMessage = { issueId: string; commentId: string };

/**
 * Chats whose newest message is a person's, sent while the agent was paused,
 * with nothing running for it. Resuming the agent answers these instead of
 * leaving them silently unanswered.
 */
export async function findPendingChatMessages(db: Db, input: {
  companyId: string; agentId: string; pausedAt: Date | null; limit?: number;
}): Promise<PendingChatMessage[]> {
  if (!input.pausedAt) return [];
  const chats = await db.select({ id: issues.id, generation: issues.conversationSessionGeneration, runId: issues.executionRunId })
    .from(issues)
    .where(and(eq(issues.companyId, input.companyId), eq(issues.conversationAgentId, input.agentId), isNull(issues.hiddenAt)))
    .orderBy(desc(issues.updatedAt))
    .limit(input.limit ?? 20);
  const pending: PendingChatMessage[] = [];
  for (const chat of chats) {
    if (chat.runId) continue;
    const [latest] = await db.select({ id: issueComments.id, authorType: issueComments.authorType,
      authorUserId: issueComments.authorUserId, generation: issueComments.conversationSessionGeneration })
      .from(issueComments)
      .where(and(eq(issueComments.companyId, input.companyId), eq(issueComments.issueId, chat.id),
        isNull(issueComments.deletedAt), gte(issueComments.createdAt, input.pausedAt)))
      .orderBy(desc(issueComments.createdAt), desc(issueComments.id))
      .limit(1);
    const fromPerson = latest && (latest.authorType === "user" || (!latest.authorType && !!latest.authorUserId));
    const currentSession = latest && (latest.generation == null || latest.generation === chat.generation);
    if (fromPerson && currentSession) pending.push({ issueId: chat.id, commentId: latest.id });
  }
  return pending;
}
