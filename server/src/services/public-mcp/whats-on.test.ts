import { describe, expect, it } from "vitest";
import { publicMcpCapabilities } from "./capabilities.js";

describe("paperclip_whats_on", () => {
  it("returns one compact briefing from a handful of reads", async () => {
    const tool = publicMcpCapabilities.find(c => c.name === "paperclip_whats_on")!;
    expect(tool.write).toBeFalsy();
    const calls: string[] = [];
    const api = async (_p: unknown, _m: string, path: string) => {
      calls.push(path);
      if (path.includes("/attention")) return { items: [{ sourceKind: "approval", subject: { title: "Approve pricing" }, relatedIssue: { identifier: "TRE-9" } }] };
      if (path.endsWith("/agents")) return [{ name: "Writer", status: "paused", pauseReason: "manual" }, { name: "Coder", status: "idle" }];
      const status = /status=([a-z_]+)/.exec(path)![1];
      return [{ id: "1", identifier: `TRE-${status}`, title: `A ${status} task`, status, updatedAt: "2026-11-27T00:00:00Z" }];
    };
    const principal = { company: { issuePrefix: "TRE" } } as never;
    const out = await tool.run(principal, tool.schema.parse({ companyId: "5d7ea143-032f-41e4-80c1-096911db8325" }), api as never, "http://127.0.0.1:3100") as Record<string, any>;
    expect(out.needsYou).toMatchObject({ count: 1, inboxUrl: "http://127.0.0.1:3100/TRE/decisions", items: [{ title: "Approve pricing", task: "TRE-9" }] });
    expect(out.blocked[0]).toMatchObject({ identifier: "TRE-blocked", url: "http://127.0.0.1:3100/TRE/issues/TRE-blocked" });
    expect(out.inProgress[0].status).toBe("in_progress");
    expect(out.recentlyDone[0].status).toBe("done");
    expect(out.setupIssues).toEqual([{ agent: "Writer", status: "paused", pauseReason: "manual" }]);
    expect(calls).toHaveLength(5);
  });
});
