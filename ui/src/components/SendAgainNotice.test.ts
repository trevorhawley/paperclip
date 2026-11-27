import { expect, it } from "vitest";
import { pendingUnansweredMessage } from "./SendAgainNotice";

const now = Date.parse("2026-11-27T10:00:00Z");
const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

it("offers Send again only for a person's quiet, unexplained, unanswered message", () => {
  const person = { id: "m1", authorType: "user", body: "weather in Bali?", createdAt: at(120) };
  const agent = { id: "r1", authorType: "agent", authorAgentId: "a", body: "Sunny.", createdAt: at(60) };
  expect(pendingUnansweredMessage([person], { hasLiveRuns: false, explained: false, now })?.id).toBe("m1");
  expect(pendingUnansweredMessage([person, agent], { hasLiveRuns: false, explained: false, now })).toBeNull();
  expect(pendingUnansweredMessage([{ ...person, createdAt: at(30) }], { hasLiveRuns: false, explained: false, now })).toBeNull();
  expect(pendingUnansweredMessage([person], { hasLiveRuns: true, explained: false, now })).toBeNull();
  expect(pendingUnansweredMessage([person], { hasLiveRuns: false, explained: true, now })).toBeNull();
  expect(pendingUnansweredMessage([{ ...person, body: "/new" }], { hasLiveRuns: false, explained: false, now })).toBeNull();
});
