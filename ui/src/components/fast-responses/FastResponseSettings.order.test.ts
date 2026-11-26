import { expect, it } from "vitest";
import { orderFastResponseModels } from "./FastResponseSettings";

it("hides batch models and puts recommended fast models first", () => {
  const ordered = orderFastResponseModels([
    { id: "zeta/model" }, { id: "openai/gpt-5.5-pro:batch" }, { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" }, { id: "alpha/model" },
  ]);
  expect(ordered.map(m => m.id)).toEqual(["anthropic/claude-haiku-5.5", "alpha/model", "zeta/model"]);
  expect(ordered[0].label).toBe("Recommended · Claude Haiku 5.5");
});
