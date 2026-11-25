import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentWakeupRequests, agents, companies, companyMemberships, createDb, fastResponseRequests, heartbeatRuns, issues } from "@paperclipai/db";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";
import { ensureHumanRoleDefaultGrants } from "../services/principal-access-compatibility.js";
import { recoveryPostgresSupport as support, startRecoveryPostgres } from "./helpers/recovery-postgres.js";

(support.supported ? describe : describe.skip)("conversation task links", () => {
  let database: Awaited<ReturnType<typeof startRecoveryPostgres>>;
  let db: ReturnType<typeof createDb>;
  const companyId = randomUUID();
  const owner = randomUUID();
  const other = randomUUID();
  const agentId = randomUUID();
  const nativeId = randomUUID();
  const firstId = randomUUID();
  const secondId = randomUUID();
  const memoryId = randomUUID();
  const privateId = randomUUID();
  const foreignCompany = randomUUID();
  const foreignId = randomUUID();

  function appFor(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.actor = { type: "board", source: "session", userId, companyIds: [companyId] };
      next();
    });
    app.use("/api", issueRoutes(db, { wakeup: async () => null } as never));
    app.use(errorHandler);
    return app;
  }
  beforeAll(async () => {
    database = await startRecoveryPostgres("conversation-links-");
    db = createDb(database.connectionString);
    await db.insert(companies).values({ id: companyId, name: "Synthetic company", issuePrefix: "SYN" });
    for (const userId of [owner, other]) {
      await db.insert(companyMemberships).values({
        companyId, principalType: "user", principalId: userId, status: "active",
        membershipRole: userId === owner ? "owner" : "operator",
      });
      await ensureHumanRoleDefaultGrants(db, { companyId, principalId: userId, membershipRole: userId === owner ? "owner" : "operator", grantedByUserId: null });
    }
    await db.insert(companies).values({ id: foreignCompany, name: "Other company", issuePrefix: "OTH" });
    await db.insert(agents).values({ id: agentId, companyId, name: "Synthetic agent", role: "engineer", status: "paused", adapterType: "process" });
    await db.insert(issues).values([
      { id: firstId, companyId, title: "First task" },
      { id: secondId, companyId, title: "Second task" },
      { id: nativeId, companyId, title: "Native conversation", conversationAgentId: agentId, conversationUserId: owner, assigneeAgentId: agentId, conversationState: "waiting", status: "in_review" },
      { id: privateId, companyId, title: "Private task", visibility: "private", privacyRootIssueId: privateId, createdByUserId: other },
      { id: foreignId, companyId: foreignCompany, title: "Foreign task" },
    ]);
    process.env.PAPERCLIP_MEMORY_COMPANY_ID = companyId;
    process.env.PAPERCLIP_MEMORY_OWNER_ID = owner;
  }, 90000);
  afterAll(async () => {
    delete process.env.PAPERCLIP_MEMORY_COMPANY_ID;
    delete process.env.PAPERCLIP_MEMORY_OWNER_ID;
    await db?.$client.end({ timeout: 0 });
    await database?.cleanup();
  });
  it("supports multiple tasks and conversations, retries, isolation and removal", async () => {
    const app = appFor(owner);
    const runsBefore = await db.select({ id: heartbeatRuns.id }).from(heartbeatRuns);
    const wakesBefore = await db.select({ id: agentWakeupRequests.id }).from(agentWakeupRequests);
    const fastBefore = await db.select({ id: fastResponseRequests.id }).from(fastResponseRequests);
    const ref = { source: "memory", conversationId: memoryId };
    const create = (issueId: string, body = ref) => request(app).post(`/api/issues/${issueId}/conversation-task-links`).send(body);
    const duplicates = await Promise.all([create(firstId), create(firstId), create(firstId)]);
    expect(duplicates.map(response => response.status).sort()).toEqual([200, 200, 201]);
    expect((await create(privateId)).status).toBe(404);
    expect([403, 404]).toContain((await create(foreignId)).status);
    expect((await create(secondId)).status).toBe(201);
    expect((await create(firstId, { source: "native", conversationId: nativeId })).status).toBe(201);
    const taskLinks = await request(app).get(`/api/issues/${firstId}/conversation-task-links`);
    expect(taskLinks.status).toBe(200);
    expect(taskLinks.body.map((row: { source: string }) => row.source).sort()).toEqual(["memory", "native"]);
    expect((await request(appFor(other)).get(`/api/issues/${firstId}/conversation-task-links`)).body).toEqual([]);
    const list = () => request(app).get(`/api/companies/${companyId}/conversation-task-links`).query(ref);
    const rows = await list();
    expect(rows.status).toBe(200);
    expect(rows.body.map((row: { issueId: string }) => row.issueId).sort()).toEqual([firstId, secondId].sort());
    expect((await request(appFor(other)).get(`/api/companies/${companyId}/conversation-task-links`).query(ref)).status).toBe(404);
    expect((await request(appFor(other)).post(`/api/issues/${firstId}/conversation-task-links`).send({ source: "native", conversationId: nativeId })).status).toBe(404);
    const firstLink = rows.body.find((row: { issueId: string }) => row.issueId === firstId);
    expect((await request(appFor(other)).delete(`/api/issues/${firstId}/conversation-task-links/${firstLink.id}`)).status).toBe(404);
    expect((await request(app).delete(`/api/issues/${firstId}/conversation-task-links/${firstLink.id}`)).status).toBe(204);
    expect((await list()).body).toHaveLength(1);
    expect(await db.select({ id: heartbeatRuns.id }).from(heartbeatRuns)).toEqual(runsBefore);
    expect(await db.select({ id: agentWakeupRequests.id }).from(agentWakeupRequests)).toEqual(wakesBefore);
    expect(await db.select({ id: fastResponseRequests.id }).from(fastResponseRequests)).toEqual(fastBefore);
  });
});
