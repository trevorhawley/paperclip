// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Conversations } from "./Conversations";
import { api } from "@/api/client";

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company", selectedCompany: null }),
}));
vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));
const nativeFixture = vi.hoisted(() => ({ chats: [] as Array<Record<string, unknown>> }));
vi.mock("@/hooks/useAgentChatNavigation", () => ({
  useAgentChatNavigation: () => ({ chats: { data: nativeFixture.chats, isError: false, refetch: vi.fn() } }),
}));
vi.mock("@/api/client", () => ({
  api: { get: vi.fn().mockResolvedValue([{
    id: "paperclip-update", task: { id: "task", identifier: "PAP-1", title: "Recorded update", projectId: null },
    recordedAt: "2026-11-25T00:00:00Z", discussion: "Recorded discussion", platform: "Codex", model: null, chatUrl: null,
  }]) },
}));
vi.mock("@/api/projects", () => ({ projectsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/components/MarkdownBody", () => ({ MarkdownBody: ({ children }: { children: string }) => <div>{children}</div> }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const container = document.createElement("div");
document.body.appendChild(container);
let root: ReturnType<typeof createRoot> | undefined;
let client: QueryClient | undefined;

async function waitForText(value: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (container.textContent?.includes(value)) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  throw new Error(`Missing text: ${value}`);
}

afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
  nativeFixture.chats = [];
  container.replaceChildren();
});

describe("Conversations", () => {
  it("filters synthetic standalone memory alongside recorded work", async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => root!.render(
      <QueryClientProvider client={client!}>
        <MemoryRouter initialEntries={["/conversations?preview=memory"]}>
          <Conversations />
        </MemoryRouter>
      </QueryClientProvider>,
    ));
    await waitForText("Planning a community garden");
    expect(container.textContent).toContain("Recorded update");
    const source = container.querySelector<HTMLSelectElement>('select[aria-label="Source"]')!;
    await act(async () => {
      source.value = "memory";
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Recorded update");
    expect(container.textContent).toContain("Decisions");
    expect(container.textContent).toContain("Action items");
    expect(container.textContent).toContain("Which site has reliable shade?");
    expect(container.textContent).not.toContain("Open task");
    const date = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    await act(async () => {
      date.value = "2026-11-24";
      date.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("Planning a community garden");
    expect(container.textContent).not.toContain("Notes on learning SQL");
  });
  it("keeps a loading failure distinct from an empty library", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Network unavailable"));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => root!.render(
      <QueryClientProvider client={client!}>
        <MemoryRouter initialEntries={["/conversations"]}>
          <Conversations />
        </MemoryRouter>
      </QueryClientProvider>,
    ));
    await waitForText("Conversation updates could not be loaded.");
    expect(container.textContent).not.toContain("No conversations available.");
    expect(container.textContent).toContain("Retry");
  });

  it("shows existing native chats without creating or sending messages", async () => {
    nativeFixture.chats = [{
      id: "chat-1", title: "Chat with Planner", conversationAgentId: "agent-1",
      updatedAt: "2026-11-26T09:00:00Z", projectId: null, description: null,
    }];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => root!.render(
      <QueryClientProvider client={client!}>
        <MemoryRouter initialEntries={["/conversations"]}>
          <Conversations />
        </MemoryRouter>
      </QueryClientProvider>,
    ));
    await waitForText("Recorded update");
    expect(container.textContent).toContain("Chat with Planner");
    expect(container.querySelector('a[href="/chats/agent-1"]')?.textContent).toContain("Open chat");
    const source = container.querySelector<HTMLSelectElement>('select[aria-label="Source"]')!;
    await act(async () => {
      source.value = "native";
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Recorded update");
    expect(container.textContent).toContain("Native agent chat");
  });

});
