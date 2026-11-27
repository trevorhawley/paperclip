import { describe, expect, it } from "vitest";
import { deriveChatTitle, isDefaultChatTitle } from "./chat-thread-title.js";

describe("chat thread titles", () => {
  it("recognises default titles", () => {
    expect(isDefaultChatTitle("New chat")).toBe(true);
    expect(isDefaultChatTitle("Chat with Chief of Staff")).toBe(true);
    expect(isDefaultChatTitle("Deviled egg recipe")).toBe(false);
  });
  it("uses the first sentence, trimmed", () => {
    expect(deriveChatTitle("Deviled egg recipe please. Make it spicy!")).toBe("Deviled egg recipe please");
    expect(deriveChatTitle("  **Plan** the   Q1 launch  ")).toBe("Plan the Q1 launch");
  });
  it("cuts long messages at a word", () => {
    const title = deriveChatTitle("I'm looking to see if this chat ends up creating a chat thread under something like Recents");
    expect(title!.endsWith("…")).toBe(true);
    expect(title!.length).toBeLessThanOrEqual(61);
  });
  it("skips commands and empty text", () => {
    expect(deriveChatTitle("/new")).toBeNull();
    expect(deriveChatTitle("   ")).toBeNull();
  });
});
