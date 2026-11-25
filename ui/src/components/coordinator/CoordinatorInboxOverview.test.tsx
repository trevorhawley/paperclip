// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { CoordinatorInboxOverview } from "./CoordinatorInboxOverview";

const fixture = vi.hoisted(() => ({
  live: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/api/heartbeats", () => ({ heartbeatsApi: { liveRunsForCompany: fixture.live } }));
vi.mock("@/api/issues", () => ({ issuesApi: { listCompact: fixture.list } }));
vi.mock("@/api/projects", () => ({ projectsApi: { list: async () => [{ id: "project", name: "Editorial" }] } }));
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { issuePrefix: "PAP" } }) }));

it("separates running and queued work from stored status, and shows the blocker owner", async () => {
  const task = (id: string, title: string) => ({ id, title, companyId: "company", identifier: `PAP-${id}`, projectId: "project" });
  const active = task("1", "Running task");
  fixture.live.mockResolvedValue([
    { id: "run-1", status: "running", agentId: "agent", agentName: "Researcher", issueId: active.id, currentStatusMessage: "Reviewing sources" },
    { id: "run-2", status: "queued", agentId: "agent", agentName: "Researcher" },
  ]);
  fixture.list.mockImplementation(async (_company, filters) => filters.ids ? [active] : ({
    in_progress: [active, task("2", "Status only")],
    blocked: [{ ...task("3", "Waiting for access"), blockedInboxAttention: {
      owner: { label: "Workspace owner" }, action: { label: "Approve access", detail: "Approve the requested access" },
    } }],
    done: [{ ...task("4", "Finished task"), completedAt: "2026-11-25T10:00:00Z" }],
  })[filters.status as string]);
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const testGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(<QueryClientProvider client={client}>
      <MemoryRouter><CoordinatorInboxOverview companyId="company" userId="owner" agents={new Map()} /></MemoryRouter>
    </QueryClientProvider>));
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.querySelector('[aria-label="Executing now"]')?.textContent).toMatch(/Running task.*Running.*Reviewing sources.*Queued/);
    });
    expect(container.querySelector('[aria-label="Marked in progress"]')?.textContent).toContain("Status only");
    expect(container.querySelector('[aria-label="Marked in progress"]')?.textContent).not.toContain("Running task");
    expect(container.querySelector('[aria-label="Blocked work"]')?.textContent).toMatch(/Approve the requested access.*Workspace owner/);
    expect(container.querySelector('[aria-label="Recently completed"]')?.textContent).toContain("Finished task");
  } finally {
    await act(async () => root.unmount());
    client.clear();
    testGlobal.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
