// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AgentStatusControl } from "./AgentStatusControl";

vi.mock("@/api/agents", () => ({ agentsApi: { pause: vi.fn(), resume: vi.fn() } }));

it("always shows the agent's status in plain words", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const render = (status: string) => act(async () => root.render(<QueryClientProvider client={new QueryClient()}>
    <AgentStatusControl agent={{ id: "a", companyId: "c", name: "Helper", status } as never} />
  </QueryClientProvider>));
  await render("paused");
  expect(container.querySelector("[data-agent-status]")?.getAttribute("aria-label")).toBe("Status: Paused. Change status");
  await render("idle");
  expect(container.textContent).toContain("Active");
  await render("terminated");
  expect(container.querySelector("button")).toBeNull();
  expect(container.textContent).toContain("Terminated");
  await act(async () => root.unmount());
});
