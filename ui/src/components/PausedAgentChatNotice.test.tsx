// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { PausedAgentChatNotice } from "./PausedAgentChatNotice";

const resume = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/api/agents", () => ({ agentsApi: { resume } }));

it("explains a paused agent won't reply and resumes it on request", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const render = (status: string) => act(async () => root.render(<QueryClientProvider client={client}>
    <PausedAgentChatNotice agent={{ id: "a1", companyId: "c1", name: "DEV Test Agent", status } as never} />
  </QueryClientProvider>));
  await render("idle");
  expect(container.textContent).toBe("");
  await render("paused");
  expect(container.textContent).toContain("DEV Test Agent is paused");
  await act(async () => container.querySelector("button")!.click());
  expect(resume).toHaveBeenCalledWith("a1", "c1");
  await vi.waitFor(() => expect(container.textContent).toBe(""));
  await act(async () => root.unmount());
});
