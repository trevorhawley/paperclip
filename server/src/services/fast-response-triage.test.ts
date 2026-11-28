import { describe, expect, it } from "vitest";
import { fastResponsePrompt, parseTriage } from "./fast-response-provider.js";

describe("front door triage", () => {
  it("reads the ANSWER / WORK tag", () => {
    expect(parseTriage("ANSWER\nHi Trevor, I'm here. What do you need?")).toEqual({ kind: "answer", text: "Hi Trevor, I'm here. What do you need?" });
    expect(parseTriage("WORK: I'll pull the GSC data for example.com.")).toEqual({ kind: "work", text: "I'll pull the GSC data for example.com." });
    expect(parseTriage("I'll draft the plan now.")).toEqual({ kind: "work", text: "I'll draft the plan now." });
  });
  it("uses the triage instructions only when asked", () => {
    expect(fastResponsePrompt({ agentName: "A", message: "hi", triage: true })).toContain("ANSWER or WORK");
    expect(fastResponsePrompt({ agentName: "A", message: "hi" })).not.toContain("ANSWER or WORK");
  });
});
