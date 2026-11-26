import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, heartbeatRuns, issueComments, issues } from "@paperclipai/db";
import { recoveryPostgresSupport as support, startRecoveryPostgres } from "./helpers/recovery-postgres.js";
import { findPendingChatMessages } from "../services/resume-pending-chat-messages.js";

(support.supported ? describe : describe.skip)("chat messages sent while an agent was paused", () => {
  let db: ReturnType<typeof createDb>;
  let temporary: Awaited<ReturnType<typeof startRecoveryPostgres>>;
  beforeAll(async () => { temporary = await startRecoveryPostgres("resume-pending-"); db = createDb(temporary.connectionString); }, 30_000);
  afterAll(async () => { await temporary?.cleanup(); });

  it("finds only chats whose newest current-session message is a person's, sent after pausing", async () => {
    const companyId = randomUUID(), agentId = randomUUID();
    const pausedAt = new Date(Date.now() - 60_000);
    await db.insert(companies).values({ id: companyId, name: "Resume", issuePrefix: companyId.slice(0, 8) });
    await db.insert(agents).values({ id: agentId, companyId, name: "Helper", status: "paused", adapterType: "process", pausedAt });
    const chat = async (generation = 0) => {
      const [row] = await db.insert(issues).values({ companyId, title: "Chat", status: "in_progress", conversationAgentId: agentId,
        conversationUserId: `operator-${randomUUID()}`, conversationState: "active", assigneeAgentId: agentId, conversationSessionGeneration: generation }).returning();
      return row;
    };
    const say = (issueId: string, authorType: "user" | "agent", at: Date, generation = 0) => db.insert(issueComments).values({ companyId, issueId, authorType,
      authorUserId: authorType === "user" ? "operator" : null, authorAgentId: authorType === "agent" ? agentId : null,
      body: "hi", createdAt: at, conversationSessionGeneration: generation }).returning();
    const now = new Date();
    const waiting = await chat(); const [message] = await say(waiting.id, "user", now);
    const answered = await chat(); await say(answered.id, "user", now); await say(answered.id, "agent", new Date(now.getTime() + 1000));
    const before = await chat(); await say(before.id, "user", new Date(pausedAt.getTime() - 60_000));
    const reset = await chat(1); await say(reset.id, "user", now, 0);
    const running = await chat(); await say(running.id, "user", now);
    const [run] = await db.insert(heartbeatRuns).values({ companyId, agentId, status: "running" }).returning();
    await db.update(issues).set({ executionRunId: run.id }).where((await import("drizzle-orm")).eq(issues.id, running.id));

    expect(await findPendingChatMessages(db, { companyId, agentId, pausedAt })).toEqual([{ issueId: waiting.id, commentId: message.id }]);
    expect(await findPendingChatMessages(db, { companyId, agentId, pausedAt: null })).toEqual([]);
  });
});
