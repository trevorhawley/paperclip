// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationTaskLinks } from "./ConversationTaskLinks";

const fixture = vi.hoisted(() => ({
  links: [] as Array<{ id: string; issueId: string; identifier: string; title: string }>,
  add: vi.fn(), remove: vi.fn(), search: vi.fn(),
}));
vi.mock("@/api/client", () => ({
  api: {
    get: async () => fixture.links,
    post: fixture.add,
    delete: fixture.remove,
  },
}));
vi.mock("@/api/issues", () => ({ issuesApi: { listCompact: fixture.search } }));
vi.mock("@/lib/router", async () => {
  const { Link } = await import("react-router-dom");
  return { Link };
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const container = document.createElement("div");
document.body.appendChild(container);
let root: ReturnType<typeof createRoot>;
let client: QueryClient;
async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
  container.replaceChildren();
  fixture.links = [];
  vi.clearAllMocks();
});

describe("Conversation task links", () => {
  it("displays related tasks and removes only the selected relationship", async () => {
    fixture.links = [{ id: "link-1", issueId: "issue-1", identifier: "PAP-1", title: "Existing task" }];
    fixture.remove.mockResolvedValue(undefined);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter>
      <ConversationTaskLinks companyId="company" userId="owner" source="memory" conversationId="conversation" />
    </MemoryRouter></QueryClientProvider>));
    await flush();
    expect(container.querySelector('a[href="/issues/PAP-1"]')?.textContent).toContain("Existing task");
    const remove = container.querySelector<HTMLButtonElement>('button[aria-label="Remove link to Existing task"]');
    expect(remove).toBeTruthy();
    await act(async () => remove!.click());
    expect(fixture.remove).toHaveBeenCalledWith("/issues/issue-1/conversation-task-links/link-1");
  });
});
