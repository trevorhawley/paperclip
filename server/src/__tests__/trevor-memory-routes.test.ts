import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@paperclipai/db";
import { errorHandler } from "../middleware/index.js";
import { trevorMemoryRoutes } from "../routes/trevor-memory.js";

const companyId = "80fa82f1-2e08-44ad-a3f1-4238099ab70c";
const ownerId = "test-owner";
const membership = vi.fn();
const db = {
  select: () => ({ from: () => ({ where: () => ({ limit: membership }) }) }),
} as unknown as Db;

function appFor(actor: object) {
  const app = express();
  app.use((req, _res, next) => { req.actor = actor as typeof req.actor; next(); });
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", trevorMemoryRoutes(db));
  app.use(errorHandler);
  return app;
}

const owner = { type: "board", source: "session", userId: ownerId, companyIds: [companyId] };
const path = `/api/companies/${companyId}/trevor-memory`;

beforeEach(() => {
  process.env.PAPERCLIP_MEMORY_URL = "https://synthetic-project.supabase.co/functions/v1/paperclip-memory-read";
  process.env.PAPERCLIP_MEMORY_COMPANY_ID = companyId;
  process.env.PAPERCLIP_MEMORY_OWNER_ID = ownerId;
  process.env.PAPERCLIP_MEMORY_READ_TOKEN = "synthetic-test-credential";
  membership.mockResolvedValue([{ id: "membership" }]);
});
afterEach(() => {
  delete process.env.PAPERCLIP_MEMORY_URL;
  delete process.env.PAPERCLIP_MEMORY_COMPANY_ID;
  delete process.env.PAPERCLIP_MEMORY_OWNER_ID;
  delete process.env.PAPERCLIP_MEMORY_READ_TOKEN;
  vi.restoreAllMocks();
});

describe("Trevor Memory read access", () => {
  it("fails closed when unconfigured and denies other people and agents", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    delete process.env.PAPERCLIP_MEMORY_READ_TOKEN;
    expect((await request(appFor(owner)).get(path)).status).toBe(404);
    process.env.PAPERCLIP_MEMORY_READ_TOKEN = "synthetic-test-credential";
    expect((await request(appFor({ ...owner, userId: "another-user" })).get(path)).status).toBe(403);
    expect((await request(appFor({ type: "agent", companyId, source: "agent_key" })).get(path)).status).toBe(403);
    membership.mockResolvedValue([]);
    expect((await request(appFor(owner)).get(path)).status).toBe(403);
    expect((await request(appFor(owner)).get("/api/companies/2748b3c0-44d7-4b29-b58e-a1548791fa77/trevor-memory")).status).toBe(404);
    process.env.PAPERCLIP_MEMORY_URL = "http://127.0.0.1/functions/v1/paperclip-memory-read";
    expect((await request(appFor(owner)).get(path)).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns bounded synthetic records only to the configured owner", async () => {
    const record = {
      id: "c2e43e5c-264a-487d-8df3-17219d7401be", title: "Synthetic session",
      session_date: "2026-11-25", source: "Codex", project: null, summary: "Summary",
      decisions: [], action_items: [], open_questions: [], chat_url: null,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ sessions: [record] })));
    const result = await request(appFor(owner)).get(path).query({ query: "synthetic" });
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toContain("no-store");
    expect(result.body.sessions).toEqual([record]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://synthetic-project.supabase.co/functions/v1/paperclip-memory-read");
    expect(options?.redirect).toBe("error");
    expect(JSON.parse(String(options?.body))).toEqual({ query: "synthetic", limit: 25 });
  });

  it("does not block other Paperclip requests while the provider is slow", async () => {
    let release!: (response: Response) => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      entered();
      return new Promise<Response>(resolve => { release = resolve; });
    });
    const app = appFor(owner);
    const pending = request(app).get(path).then(result => result);
    await started;
    expect((await request(app).get("/health")).body).toEqual({ ok: true });
    release(new Response(JSON.stringify({ sessions: [] })));
    expect((await pending).status).toBe(200);
  });

  it("returns a recoverable error when the remote request times out", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    const result = await request(appFor(owner)).get(path);
    expect(result.status).toBe(502);
    expect(result.body.error).toBe("Memory provider unavailable");
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it("fails safely for a provider error or invalid response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ sessions: [{ secret: "not allowed" }] })));
    const result = await request(appFor(owner)).get(path);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("not allowed");
  });
});
