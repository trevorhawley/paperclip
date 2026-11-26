import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { inferApiBaseFromConfig } from "../commands/client/common.js";

afterEach(() => { vi.unstubAllEnvs(); });

function configWith(server: Record<string, unknown>) {
  const dir = mkdtempSync(path.join(tmpdir(), "pc-infer-"));
  const file = path.join(dir, "config.json");
  writeFileSync(file, JSON.stringify({
    $meta: { version: 1, updatedAt: "2026-11-26T00:00:00.000Z", source: "configure" },
    database: { mode: "embedded-postgres" }, logging: { mode: "file" }, server,
  }));
  return file;
}

it("uses the server's configured host so browser links pass the origin check", () => {
  vi.stubEnv("PAPERCLIP_SERVER_HOST", "");
  vi.stubEnv("PAPERCLIP_SERVER_PORT", "");
  expect(inferApiBaseFromConfig(configWith({ host: "127.0.0.1", port: 3100 }))).toBe("http://127.0.0.1:3100");
  expect(inferApiBaseFromConfig(configWith({ port: 4000 }))).toBe("http://127.0.0.1:4000");
  vi.stubEnv("PAPERCLIP_SERVER_HOST", "box.local");
  expect(inferApiBaseFromConfig(configWith({ host: "127.0.0.1", port: 3100 }))).toBe("http://box.local:3100");
});
