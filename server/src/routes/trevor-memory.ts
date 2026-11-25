import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { companyMemberships, type Db } from "@paperclipai/db";
import { z } from "zod";
import { badRequest, forbidden, HttpError, notFound } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";

const endpoint = "https://hvhictpiwbmkfblbmird.supabase.co/functions/v1/paperclip-memory-read";
const querySchema = z.object({
  query: z.string().trim().max(500).optional(),
  id: z.string().uuid().optional(),
}).strict();
const recordSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  session_date: z.string().nullable(),
  source: z.string().nullable(),
  project: z.string().nullable(),
  summary: z.string().nullable(),
  decisions: z.array(z.string()).nullable(),
  action_items: z.array(z.string()).nullable(),
  open_questions: z.array(z.string()).nullable(),
  chat_url: z.string().url().refine(value => /^https?:\/\//i.test(value)).nullable(),
}).strict();
const responseSchema = z.object({ sessions: z.array(recordSchema).max(25) }).strict();

export function trevorMemoryRoutes(db: Db) {
  const router = Router();
  router.get("/companies/:companyId/trevor-memory", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const companyId = req.params.companyId as string;
    const configuredCompany = process.env.PAPERCLIP_MEMORY_COMPANY_ID;
    const configuredUser = process.env.PAPERCLIP_MEMORY_OWNER_ID;
    const credential = process.env.PAPERCLIP_MEMORY_READ_TOKEN;
    if (!configuredCompany || !configuredUser || !credential || companyId !== configuredCompany) {
      throw notFound("Memory provider unavailable");
    }
    if (req.actor.type !== "board" || req.actor.source !== "session" || req.actor.userId !== configuredUser) {
      throw forbidden("Memory access is restricted to its configured owner");
    }
    assertCompanyAccess(req, companyId);
    const [membership] = await db.select({ id: companyMemberships.id }).from(companyMemberships).where(and(
      eq(companyMemberships.companyId, companyId),
      eq(companyMemberships.principalType, "user"),
      eq(companyMemberships.principalId, configuredUser),
      eq(companyMemberships.status, "active"),
      eq(companyMemberships.membershipRole, "owner"),
    )).limit(1);
    if (!membership) throw forbidden("Active owner membership required");
    const query = querySchema.safeParse(req.query);
    if (!query.success || (query.data.id && query.data.query)) throw badRequest("Invalid memory query");
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-memory-read-token": credential },
        body: JSON.stringify({ ...query.data, limit: 25 }),
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || !response.body) throw new Error("Provider unavailable");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 512 * 1024) { await reader.cancel(); throw new Error("Response too large"); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const parsed = responseSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
      if (!parsed.success) throw new Error("Invalid provider response");
      res.json(parsed.data);
    } catch {
      throw new HttpError(502, "Memory provider unavailable");
    }
  });
  return router;
}
