import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@paperclipai/db";
import { errorHandler } from "../middleware/index.js";
import { trevorMemoryRoutes } from "../routes/trevor-memory.js";

const localProvider = process.env.PAPERCLIP_TEST_LOCAL_MEMORY_URL;
const companyId = "80fa82f1-2e08-44ad-a3f1-4238099ab70c";
const ownerId = "synthetic-owner";

describe.skipIf(!localProvider)("local Supabase Memory provider", () => {
  afterEach(() => {
    delete process.env.PAPERCLIP_MEMORY_COMPANY_ID;
    delete process.env.PAPERCLIP_MEMORY_OWNER_ID;
    delete process.env.PAPERCLIP_MEMORY_READ_TOKEN;
    delete process.env.PAPERCLIP_MEMORY_URL;
    vi.restoreAllMocks();
  });

  it("retrieves synthetic recent, search and detail records through the board route", async () => {
    process.env.PAPERCLIP_MEMORY_COMPANY_ID = companyId;
    process.env.PAPERCLIP_MEMORY_OWNER_ID = ownerId;
    process.env.PAPERCLIP_MEMORY_READ_TOKEN = "t".repeat(50);
    process.env.PAPERCLIP_MEMORY_URL = "https://synthetic.supabase.co/functions/v1/paperclip-memory-read";
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (input !== process.env.PAPERCLIP_MEMORY_URL || !localProvider?.startsWith("http://127.0.0.1:")) {
        throw new Error("Unexpected provider destination");
      }
      return realFetch(localProvider, init);
    });
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "membership" }] }) }) }),
    } as unknown as Db;
    const app = express();
    app.use((req, _res, next) => {
      req.actor = { type: "board", source: "session", userId: ownerId, companyIds: [companyId] };
      next();
    });
    app.use("/api", trevorMemoryRoutes(db));
    app.use(errorHandler);
    const path = `/api/companies/${companyId}/trevor-memory`;
    const recent = await request(app).get(path);
    expect(recent.status).toBe(200);
    expect(recent.body.sessions).toHaveLength(25);
    const search = await request(app).get(path).query({ query: "garden" });
    expect(search.status).toBe(200);
    expect(search.body.sessions[0].title).toBe("Synthetic garden planning");
    const detail = await request(app).get(path).query({ id: "e89be275-6381-422e-bd7c-383819a9d541" });
    expect(detail.status).toBe(200);
    expect(detail.body.sessions[0].decisions).toEqual(["Plan beds"]);
  });
});
