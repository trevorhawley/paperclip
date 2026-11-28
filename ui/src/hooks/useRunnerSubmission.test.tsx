// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { TaskInterruptionPresentation } from "@paperclipai/shared";
import type { IssueChatComment } from "../lib/issue-chat-messages";
import { ExecutionBlockerNotice } from "../components/ExecutionBlockerNotice";
import { useRunnerSubmission } from "./useRunnerSubmission";

it("settles a newer saved message while the same Retry explanation remains visible", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const wait: TaskInterruptionPresentation = { intentId: "retry", responsibility: "system", state: "failed",
    canRetry: true, nextRetryAt: null, userAction: null, observedRunId: "failed-run", sourceRunIds: ["failed-run"],
    retryWait: { reason: "remote_cleanup", message: "Retry is waiting for the previous environment to stop. Your message is saved." } };
  function View({ interruption = wait, comments = [] }: { interruption?: TaskInterruptionPresentation; comments?: IssueChatComment[] }) {
    const submission = useRunnerSubmission({ issueId: "task", agentId: "agent", agent: { status: "idle" },
      issueStatus: "blocked", runId: null, comments, interruption });
    return <><button onClick={() => submission.begin("message")}>Send</button>
      {submission.pending && <span>{submission.takingLonger ? "Taking longer than usual…" : "Thinking"}</span>}
      <ExecutionBlockerNotice presentation={interruption} canRetry onRetry={() => {}} /></>;
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => container.querySelector("button")!.click());
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(container.textContent).toContain("Taking longer than usual…");
    const comments: IssueChatComment[] = [{ id: "comment", clientRequestId: "message", companyId: "company", issueId: "task",
      authorType: "user", authorAgentId: null, authorUserId: "board", body: "Keep my saved message.",
      presentation: null, metadata: null, createdAt: new Date(), updatedAt: new Date() }];
    await act(async () => root.render(<View comments={comments} />));
    expect(container.textContent).toContain("Taking longer than usual…");
    await act(async () => root.render(<View comments={comments} interruption={{ ...wait, intentId: "new-message-receipt" }} />));
    expect(container.textContent).not.toContain("Taking longer than usual…");
    expect(container.textContent).not.toContain("Thinking");
    expect(container.textContent).toContain(wait.retryWait!.message);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.useRealTimers();
  }
});

it("settles when the chat front door answered and the chat returned to review", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  function View({ comments = [], issueStatus = "in_progress" }: { comments?: IssueChatComment[]; issueStatus?: string }) {
    const submission = useRunnerSubmission({ issueId: "chat", agentId: "agent", agent: { status: "idle" },
      issueStatus, runId: null, comments });
    return <><button onClick={() => submission.begin("hello")}>Send</button>{submission.pending && <span>Pending</span>}</>;
  }
  const at = new Date();
  const user = { id: "u", clientRequestId: "hello", companyId: "c", issueId: "chat", authorType: "user", authorAgentId: null,
    authorUserId: "board", body: "hi", presentation: null, metadata: null, createdAt: at, updatedAt: at } as IssueChatComment;
  const reply = { ...user, id: "a", clientRequestId: null, authorType: "agent", authorAgentId: "agent", authorUserId: null,
    body: "Hi, I'm here.", createdAt: new Date(at.getTime() + 2000) } as IssueChatComment;
  try {
    await act(async () => root.render(<View />));
    await act(async () => container.querySelector("button")!.click());
    await act(async () => root.render(<View comments={[user]} />));
    expect(container.textContent).toContain("Pending");
    // A work receipt alone keeps waiting for the agent turn.
    await act(async () => root.render(<View comments={[user, reply]} />));
    expect(container.textContent).toContain("Pending");
    await act(async () => root.render(<View comments={[user, reply]} issueStatus="in_review" />));
    expect(container.textContent).not.toContain("Pending");
  } finally {
    await act(async () => root.unmount()); container.remove();
  }
});
