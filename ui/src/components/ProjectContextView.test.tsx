// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { Project } from "@paperclipai/shared";
import { ProjectContextView } from "./ProjectContextView";

const fixture = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/api/attention", () => ({ attentionApi: {
  list: async () => ({ items: [
    { id: "a1", sourceKind: "decision", subject: { id: "d1", title: "Approve launch copy" }, whyNow: "Agent asked", project: { id: "p1", name: "Launch" } },
    { id: "a2", sourceKind: "decision", subject: { id: "d2", title: "Other project decision" }, whyNow: "", project: { id: "p2", name: "Other" } },
  ] }),
  history: async () => ({ items: [{ id: "h1", title: "Pick pricing tier", label: "Approved", issueIdentifier: "PAP-9", issueTitle: "Pricing", resolvedAt: "2026-11-25T10:00:00Z", href: "/issues/PAP-9" }], nextCursor: null }),
} }));
vi.mock("@/api/issues", () => ({ issuesApi: { listCompact: fixture.list } }));
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { issuePrefix: "PAP" } }) }));
vi.mock("@/components/MarkdownBody", () => ({ MarkdownBody: ({ children }: { children: string }) => <div>{children}</div> }));

it("collects a project's purpose, open decisions, work and recent decisions in one view", async () => {
  fixture.list.mockImplementation(async (_company: string, filters: { status: string; projectId: string }) => {
    expect(filters.projectId).toBe("p1");
    return ({
      in_progress: [{ id: "1", identifier: "PAP-1", title: "Write landing page" }],
      blocked: [{ id: "2", identifier: "PAP-2", title: "Connect Stripe", blockedInboxAttention: { action: { label: "Add API key" } } }],
      done: [{ id: "3", identifier: "PAP-3", title: "Outline offer" }],
    } as Record<string, unknown[]>)[filters.status];
  });
  const project = { id: "p1", name: "Launch", description: "Sell the SEO course.", goals: [{ id: "g", title: "First 10 sales" }] } as unknown as Project;
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  g.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter>
      <ProjectContextView project={project} companyId="c" />
    </MemoryRouter></QueryClientProvider>));
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.querySelector('[aria-label="Recent decisions"]')?.textContent).toContain("Pick pricing tier");
      expect(container.querySelector('[aria-label="Work"]')?.textContent).toMatch(/Connect Stripe.*Add API key.*Write landing page.*Outline offer/);
    });
    expect(container.querySelector('[aria-label="About this project"]')?.textContent).toMatch(/Sell the SEO course.*First 10 sales/);
    const needs = container.querySelector('[aria-label="Needs you"]')?.textContent;
    expect(needs).toContain("Approve launch copy");
    expect(needs).not.toContain("Other project decision");
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});
