import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExternalConversationUpdate } from "@paperclipai/shared";
import { api } from "@/api/client";
import { projectsApi } from "@/api/projects";
import { MarkdownBody } from "@/components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { useAgentChatNavigation } from "@/hooks/useAgentChatNavigation";
import type { MemoryPreviewSession } from "@/fixtures/conversation-memory-preview";
import { Link, useSearchParams } from "@/lib/router";

export function Conversations() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => setBreadcrumbs([{ label: "Conversations" }]), [setBreadcrumbs]);
  return selectedCompanyId ? <ConversationHistory key={selectedCompanyId} companyId={selectedCompanyId} /> : null;
}

function ConversationHistory({ companyId }: { companyId: string }) {
  const nativeChats = useAgentChatNavigation();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [project, setProject] = useState("");
  const [since, setSince] = useState("");
  const [params, setParams] = useSearchParams();
  const [source, setSource] = useState("");
  const showMemoryPreview = import.meta.env.DEV && params.get("preview") === "memory";
  const memory = useQuery({
    queryKey: ["synthetic-conversation-memory"],
    queryFn: async () => (await import("@/fixtures/conversation-memory-preview")).memoryPreviewSessions,
    enabled: showMemoryPreview,
  });
  const updates = useQuery({
    queryKey: ["external-conversation-updates", companyId],
    queryFn: () => api.get<ExternalConversationUpdate[]>(`/companies/${companyId}/external-conversation-updates`),
  });
  const projects = useQuery({
    queryKey: queryKeys.projects.list(companyId, { includeArchived: true }),
    queryFn: () => projectsApi.list(companyId, { includeArchived: true }),
  });
  const names = useMemo(() => new Map(projects.data?.map(item => [item.id, item.name])), [projects.data]);
  const entries = useMemo(() => {
    const paperclip = (updates.data ?? []).map(item => ({
      id: item.id,
      title: item.task.title,
      date: item.recordedAt,
      platform: item.platform ?? undefined,
      model: item.model ?? undefined,
      project: names.get(item.task.projectId ?? ""),
      summary: item.discussion,
      chatUrl: item.chatUrl ?? undefined,
      task: item.task,
      source: "paperclip" as const,
    }));
    const native = (nativeChats.chats.data ?? []).flatMap(chat => chat.conversationAgentId ? [{
      id: chat.id,
      title: chat.title,
      date: String(chat.updatedAt),
      platform: undefined,
      model: undefined,
      project: names.get(chat.projectId ?? ""),
      summary: chat.description ?? "",
      chatUrl: undefined,
      task: undefined,
      agentId: chat.conversationAgentId,
      source: "native" as const,
    }] : []);
    const samples = showMemoryPreview ? (memory.data ?? []).map((item: MemoryPreviewSession) => ({
      ...item,
      task: undefined,
      source: "memory" as const,
    })) : [];
    return [...paperclip, ...native, ...samples].sort((a, b) => b.date.localeCompare(a.date));
  }, [updates.data, names, memory.data, showMemoryPreview, nativeChats.chats.data]);
  const platforms = [...new Set(entries.flatMap(item => item.platform ? [item.platform] : []))].sort();
  const projectNames = [...new Set(entries.flatMap(item => item.project ? [item.project] : []))].sort();
  const search = query.trim().toLowerCase();
  const visible = entries.filter(item =>
    (!source || item.source === source) &&
    (!since || conversationCalendarDate(item.date) >= since) &&
    (!platform || item.platform === platform) &&
    (!project || item.project === project) &&
    (!search || [item.title, item.task?.identifier, item.platform, item.model,
      item.summary, item.chatUrl, item.project,
      ...(item.source === "memory" ? [...(item.decisions ?? []), ...(item.actionItems ?? []), ...(item.openQuestions ?? [])] : [])]
      .some(value => value?.toLowerCase().includes(search))),
  );
  const selectedId = params.get("update");
  const selected = selectedId ? entries.find(item => item.id === selectedId) : visible[0];
  function selectUpdate(id?: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("update", id);
    else next.delete("update");
    setParams(next, { replace: !id });
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground">{showMemoryPreview ? "Memory records in this preview are synthetic." : "Recent conversations recorded in Paperclip."}</p>
        </div>
        <Button asChild variant="outline"><Link to="/chats">Open native chat</Link></Button>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-full sm:max-w-xs" value={query} onChange={event => { setQuery(event.target.value); if (selectedId) selectUpdate(); }}
          placeholder="Search conversations" aria-label="Search conversations" />
        <select aria-label="Source" className="rounded-md border bg-background p-2 text-sm"
          value={source} onChange={event => { setSource(event.target.value); if (selectedId) selectUpdate(); }}>
          <option value="">All sources</option>
          <option value="paperclip">Paperclip</option>
          <option value="native">Native chat</option>
          {showMemoryPreview && <option value="memory">AI Memory preview</option>}
        </select>
        <select aria-label="AI platform" className="rounded-md border bg-background p-2 text-sm"
          value={platform} onChange={event => { setPlatform(event.target.value); if (selectedId) selectUpdate(); }}>
          <option value="">All platforms</option>
          {platforms.map(value => <option key={value}>{value}</option>)}
        </select>
        <select aria-label="Project" className="rounded-md border bg-background p-2 text-sm"
          value={project} onChange={event => { setProject(event.target.value); if (selectedId) selectUpdate(); }}>
          <option value="">All projects</option>
          {projectNames.map(name => <option key={name}>{name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          From date
          <Input type="date" value={since}
            onInput={event => { setSince(event.currentTarget.value); if (selectedId) selectUpdate(); }} />
        </label>
        {updates.isSuccess && updates.data.length >= 100 && (
          <p className="text-sm text-muted-foreground">Searching the latest 100 Paperclip updates.</p>
        )}
      </div>
      {updates.isPending && <p role="status">Loading conversation updates…</p>}
      {nativeChats.chats.isError && <div role="alert" className="flex items-center gap-2">
        <p>Native chats could not be loaded.</p>
        <Button variant="outline" onClick={() => void nativeChats.chats.refetch()}>Retry</Button>
      </div>}
      {updates.isError && <div className="flex items-center gap-2" role="alert">
        <p>Conversation updates could not be loaded.</p>
        <Button variant="outline" onClick={() => void updates.refetch()}>Retry</Button>
      </div>}
      {updates.isSuccess && visible.length === 0 && <p className="text-sm text-muted-foreground">
        {entries.length ? "No conversations match your filters." : "No conversations available."}
      </p>}
      {(visible.length > 0 || (!updates.isPending && selectedId)) && (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {visible.length > 0 && <ul className="divide-y rounded-lg border">
            {visible.map(item => <li key={item.id}>
              <button type="button" aria-current={selected?.id === item.id ? "true" : undefined}
                className="w-full space-y-1 rounded-md p-3 text-left hover:bg-muted aria-current:bg-muted"
                onClick={() => selectUpdate(item.id)}>
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[item.source === "paperclip" ? "Paperclip" : item.source === "native" ? "Native chat" : "AI Memory preview", item.platform, item.model, item.project].filter(Boolean).join(" · ")}
                </span>
                <time className="block text-xs text-muted-foreground" dateTime={item.date}>
                  {formatConversationDate(item.date)}
                </time>
              </button>
            </li>)}
          </ul>}
          {selected ? <article className="min-w-0 space-y-4 rounded-lg border p-4 md:col-span-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{selected.source === "paperclip" ? "Paperclip · Self-reported provenance" : selected.source === "native" ? "Native agent chat" : "AI Memory preview"}</p>
              <h2 className="break-words text-lg font-semibold">{selected.title}</h2>
              <p className="break-words text-sm text-muted-foreground">
                {[selected.platform, selected.model, selected.project].filter(Boolean).join(" · ")}
              </p>
              <time className="block text-xs text-muted-foreground" dateTime={selected.date}>
                {formatConversationDate(selected.date)}
              </time>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.source === "native" && <Button asChild variant="outline" size="sm">
                <Link to={`/chats/${encodeURIComponent(selected.agentId)}`}>Open chat</Link>
              </Button>}
              {selected.task && <Button asChild variant="outline" size="sm">
                <Link to={`/issues/${selected.task.identifier ?? selected.task.id}#comment-${selected.id}`}>
                  Open task {selected.task.identifier}
                </Link>
              </Button>}
              {selected.chatUrl && <Button asChild variant="outline" size="sm">
                <a href={selected.chatUrl} target="_blank" rel="noopener noreferrer">Open original chat</a>
              </Button>}
            </div>
            <MarkdownBody className="break-words">{selected.summary}</MarkdownBody>
            {selected.source === "memory" && <>
              <ConversationNotes title="Decisions" items={selected.decisions} />
              <ConversationNotes title="Action items" items={selected.actionItems} />
              <ConversationNotes title="Open questions" items={selected.openQuestions} />
            </>}
          </article> : selectedId && <p className="text-sm text-muted-foreground md:col-span-2">This update is unavailable.</p>}
        </div>
      )}
    </main>
  );
}

function ConversationNotes({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <section className="space-y-1">
    <h3 className="text-sm font-semibold">{title}</h3>
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  </section>;
}

function formatConversationDate(value: string) {
  const date = new Date(value);
  return value.length === 10 ? date.toLocaleDateString(undefined, { timeZone: "UTC" }) : date.toLocaleString();
}

function conversationCalendarDate(value: string) {
  if (value.length === 10) return value;
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
