import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { loopbackCanonicalHost } from "./loopback-canonical-host.js";

function app(bindHost: string) {
  const a = express();
  a.use(loopbackCanonicalHost(bindHost));
  a.all("*path", (_req, res) => { res.send("ok"); });
  return a;
}

it("sends localhost page loads to 127.0.0.1, keeping path and query", async () => {
  const res = await request(app("127.0.0.1")).get("/auth?next=%2FTRE%2Fapps").set("Host", "localhost:3100");
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe("http://127.0.0.1:3100/auth?next=%2FTRE%2Fapps");
});

it("leaves API, MCP, non-GET and already-canonical requests alone", async () => {
  const a = app("127.0.0.1");
  expect((await request(a).get("/api/health").set("Host", "localhost:3100")).status).toBe(200);
  expect((await request(a).get("/mcp/paperclip").set("Host", "localhost:3100")).status).toBe(200);
  expect((await request(a).post("/auth").set("Host", "localhost:3100")).status).toBe(200);
  expect((await request(a).get("/auth").set("Host", "127.0.0.1:3100")).status).toBe(200);
  expect((await request(app("0.0.0.0")).get("/auth").set("Host", "localhost:3100")).status).toBe(200);
});
