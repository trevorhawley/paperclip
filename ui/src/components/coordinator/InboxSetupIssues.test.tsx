// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { InboxSetupIssues } from "./InboxSetupIssues";

const resume = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/api/agents", () => ({ agentsApi: { resume } }));
vi.mock("@/api/instanceSettings", () => ({ instanceSettingsApi: { getExperimental: async () => ({ enableWorktreeRunExecution: false }) } }));
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { issuePrefix: "PAP" } }) }));
vi.mock("@/lib/worktree-branding", () => ({ isWorktreeRuntime: () => true, getWorktreeInstanceId: () => "wt" }));

it("lists hidden blockers with one-click fixes, and nothing when clear", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const agent = (id: string, status: string, pauseReason: string | null = null) => ({ id, companyId: "c", name: id, status, pauseReason, urlKey: id }) as never;
  await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>
    <InboxSetupIssues companyId="c" agents={[agent("Writer", "paused", "manual"), agent("Coder", "error"), agent("Ops", "paused", "budget"), agent("Idle", "idle")]} />
  </MemoryRouter></QueryClientProvider>));
  await vi.waitFor(() => expect(container.textContent).toContain("Agent runs are switched off"));
  expect(container.textContent).toMatch(/Writer is paused.*Ops hit its budget/);
  expect(container.textContent).not.toContain("Coder");
  expect(container.textContent).not.toContain("Idle");
  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Resume")!.click());
  expect(resume).toHaveBeenCalledWith("Writer", "c");
  await act(async () => root.unmount());
});
