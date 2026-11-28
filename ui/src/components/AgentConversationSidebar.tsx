import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Plus, Search, Trash2, Users, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "./ui/badge";
import type { Agent } from "@paperclipai/shared";
import { AgentChatPicker } from "@/components/AgentChatPicker";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "@/lib/router";
import { agentRouteRef, cn } from "@/lib/utils";
import { chatThreadHref } from "@/hooks/useAgentChatNavigation";

export interface AgentConversationSidebarProps {
  agents: Agent[];
  /** Agents with a saved conversation; defaults to every listed agent. */
  existingChatAgentIds?: readonly string[];
  availableAgents?: Agent[];
  activeId?: string;
  previews?: Record<string, string>;
  unreadAgentIds?: readonly string[];
  unreadMessageCounts?: ReadonlyMap<string, number>;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  initialSearch?: string;
  onSelect?: (agent: Agent, signal?: AbortSignal) => void | Promise<void>;
  onBrowse?: () => void;
  onAddChat?: (agent: Agent, signal?: AbortSignal) => void | Promise<void>;
  historyLoading?: boolean;
  historyError?: Error | null;
  onRetryHistory?: () => void;
  onCreateAgent?: () => void;
  renderAgentAction?: (agent: Agent) => ReactNode;
  /** Agents you have a chat with, most recent first. Enables the Chats | Agents tabs. */
  conversationAgentIds?: readonly string[];
  chatMeta?: Record<string, { projectName: string | null; updatedAt: string }>;
  /** Chat threads, most recent first. When given, the Chats tab lists these as Recents. */
  threads?: readonly ChatThreadRow[];
  activeThreadId?: string | null;
  onThreadSelect?: () => void;
  /** Archive (true) or restore (false) a thread. Archived threads leave Recents. */
  onArchiveThread?: (threadId: string, archived: boolean) => void | Promise<void>;
  /** Permanently delete a thread, after the person confirms. */
  onDeleteThread?: (threadId: string) => void | Promise<void>;
}

export interface ChatThreadRow {
  id: string;
  title: string;
  agent: Agent;
  projectName: string | null;
  updatedAt: string;
  unreadCount: number;
  unread: boolean;
  working: boolean;
  archived?: boolean;
}

/** Searchable chat navigation: Recents (threads) and Agents. */
export function AgentConversationSidebar({ agents, existingChatAgentIds, availableAgents = agents, activeId, previews = {}, unreadAgentIds = [], unreadMessageCounts, loading = false, error, onRetry, initialSearch = "", onSelect, onBrowse, onAddChat, historyLoading, historyError, onRetryHistory, onCreateAgent, renderAgentAction, conversationAgentIds, chatMeta = {}, threads, activeThreadId, onThreadSelect, onArchiveThread, onDeleteThread }: AgentConversationSidebarProps) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const unreadIds = useMemo(() => new Set(unreadAgentIds), [unreadAgentIds]);
  const query = search.trim().toLocaleLowerCase();
  const tabbed = conversationAgentIds !== undefined;
  // Until the person picks a tab, show Chats whenever there are any (they load after mount).
  const [chosenTab, setTab] = useState<"chats" | "agents" | null>(null);
  const tab = chosenTab ?? (conversationAgentIds?.length || threads?.length ? "chats" : "agents");
  const showThreads = tabbed && tab === "chats" && threads !== undefined;
  const [showArchived, setShowArchived] = useState(false);
  const [deleting, setDeleting] = useState<ChatThreadRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  async function runThreadAction(action: () => void | Promise<void>, failure: string) {
    setActionError(null);
    try { await action(); } catch (error) { setActionError(error instanceof Error && error.message ? `${failure} ${error.message}` : failure); }
  }
  const archivedCount = (threads ?? []).filter(thread => thread.archived).length;
  // Search covers archived chats too; otherwise Recents and Archived are separate views.
  const visibleThreads = (threads ?? []).filter(thread =>
    (query ? true : !!thread.archived === showArchived)
    && `${thread.title} ${thread.agent.name} ${thread.projectName ?? ""}`.toLocaleLowerCase().includes(query));
  const chatIds = new Set(conversationAgentIds ?? []);
  // Agents keeps the full eligible list (open chat, then recent chats, then A–Z).
  const pool = !tabbed || tab === "agents" ? agents : agents.filter(agent => chatIds.has(agent.id));
  const visible = pool.filter(agent => `${agent.name} ${agent.title ?? ""} ${agent.role} ${chatMeta[agent.id]?.projectName ?? ""}`.toLocaleLowerCase().includes(query));
  function focusSearch() {
    setSearch("");
    searchRef.current?.focus();
  }
  return <aside aria-labelledby={headingId} className="flex h-full min-h-0 flex-col border-r border-border bg-background">
    <h2 id={headingId} className="sr-only">Chat contacts</h2>
    <div className="flex shrink-0 items-center gap-2 px-3 pb-3 pt-5">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input ref={searchRef} aria-label="Search chats" placeholder="Search chats" value={search} onChange={event => setSearch(event.target.value)}
          onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setSearch(""); } }}
          className="h-9 pl-8 pr-8 text-xs md:text-xs" />
        {search && <Button variant="ghost" size="icon-xs" aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={focusSearch}><X className="size-3" /></Button>}
      </div>
    </div>
    {tabbed && <div className="flex shrink-0 flex-col gap-1 px-3 pb-2">
      <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => setPickerOpen(true)}><Plus className="size-4" />New chat</Button>
      <div role="tablist" aria-label="Chat lists" className="flex gap-1">
        {(["chats", "agents"] as const).map(value => <button key={value} type="button" role="tab" aria-selected={tab === value}
          onClick={() => setTab(value)}
          className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", tab === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60")}>
          {value === "chats" ? "Recents" : "Agents"}
        </button>)}
      </div>
    </div>}
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 scrollbar-auto-hide">
      <span role="status" className="sr-only">{loading ? "Loading agents" : `${visible.length} ${visible.length === 1 ? "agent" : "agents"}`}</span>
      {historyLoading && <p role="status" className="px-2 text-xs text-muted-foreground">Loading chat history…</p>}
      {historyError && <div role="alert" className="flex flex-col items-start gap-2 px-2 py-3">
        <p className="text-xs text-muted-foreground">Some chat history couldn’t load.</p>
        <Button variant="outline" size="sm" onClick={onRetryHistory}>Retry chat history</Button>
      </div>}
      {actionError && <p role="alert" className="px-2 text-xs text-destructive">{actionError}</p>}
      {showThreads && !error && !loading ? visibleThreads.length ? <nav aria-label="Recent chats" className="flex flex-col">
        {visibleThreads.map(thread => {
          const selected = activeThreadId === thread.id;
          const hasUnread = thread.unreadCount > 0 || thread.unread;
          const actions = (onArchiveThread || onDeleteThread) && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Chat actions for ${thread.title}`}
                className="absolute right-1 top-1.5 flex size-6 items-center justify-center rounded-md bg-accent text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/thread:opacity-100 data-[state=open]:opacity-100">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onArchiveThread && <DropdownMenuItem onSelect={() => void runThreadAction(() => onArchiveThread(thread.id, !thread.archived), "Couldn’t update this chat.")}>
                {thread.archived ? <><ArchiveRestore className="size-4" />Restore</> : <><Archive className="size-4" />Archive</>}
              </DropdownMenuItem>}
              {onArchiveThread && onDeleteThread && <DropdownMenuSeparator />}
              {onDeleteThread && <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(thread)}><Trash2 className="size-4" />Delete</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>;
          return <div key={thread.id} className="group/thread relative">{actions}<Link to={chatThreadHref(thread.agent, thread.id)} aria-current={selected ? "page" : undefined}
            title={thread.title}
            onClick={() => onThreadSelect?.()}
            className={cn("flex min-w-0 flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60 group-hover/thread:bg-accent/60")}>
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("min-w-0 flex-1 truncate text-sm", hasUnread && "font-semibold")}>{thread.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{thread.working ? "Working…" : formatChatTime(thread.updatedAt)}</span>
              {thread.unreadCount > 0 ? <Badge variant="ghost" aria-label={`${thread.unreadCount} unread`} className="shrink-0 bg-primary font-mono tabular-nums text-primary-foreground">{thread.unreadCount}</Badge>
                : hasUnread ? <span role="img" aria-label="Unread" className="size-2 shrink-0 rounded-full bg-primary" /> : null}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <AgentAvatar agent={thread.agent} size={16} />
              <span className="min-w-0 truncate">{[thread.projectName ?? "No project", thread.agent.name].join(" / ")}</span>
              {thread.archived && <span className="shrink-0">· Archived</span>}
            </span>
          </Link></div>;
        })}
      </nav> : <div className="flex flex-col items-start gap-2 px-2 py-6">
        <p className="text-sm font-medium">{query ? "No chats found" : showArchived ? "No archived chats" : "No chats yet"}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{query ? "Try another title, project or agent." : showArchived ? "Archived chats appear here." : "Start one with New chat."}</p>
      </div> : null}
      {showThreads && !error && !loading && !query && (archivedCount > 0 || showArchived) && <button type="button"
        onClick={() => setShowArchived(value => !value)}
        className="self-start rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground">
        {showArchived ? "← Back to Recents" : `Archived (${archivedCount})`}
      </button>}
      {showThreads && !error && !loading ? null : error ? <div role="alert" className="flex flex-col items-start gap-2 px-2 py-6"><p className="text-sm">Couldn’t load your chats.</p><Button variant="outline" size="sm" onClick={onRetry}>Try again</Button></div> : loading ? <div aria-hidden="true" className="flex flex-col gap-1">
        {[0, 1, 2, 3].map(index => <div key={index} className="flex items-center gap-3 rounded-md px-2 py-3 motion-safe:animate-pulse">
          <div className="size-8 shrink-0 rounded-lg bg-muted" />
          <div className="flex flex-1 flex-col gap-2"><div className="h-3 w-2/3 rounded-sm bg-muted" /><div className="h-2 w-full rounded-sm bg-muted" /></div>
        </div>)}
      </div> : visible.length ? <nav aria-label="Agent conversations" className="flex flex-col gap-1">
        {visible.map(agent => {
          const unreadCount = unreadMessageCounts?.get(agent.id) ?? 0;
          const hasUnread = unreadCount > 0 || unreadIds.has(agent.id);
          return <div key={agent.id} className="agent-pin-row agent-contact-pin-row group/agent-pin relative rounded-md" data-selected={activeId === agent.id || undefined} data-has-unread={hasUnread || undefined}><Link to={`/chats/${encodeURIComponent(agent.status === "terminated" ? agent.id : agentRouteRef(agent))}`}
          aria-current={activeId === agent.id ? "page" : undefined}
          title={`${agent.name}${agent.title ? ` · ${agent.title}` : ""}`}
          onClick={event => { if (onSelect) { event.preventDefault(); onSelect(agent); } }}
          className={cn("agent-contact-row flex min-w-0 items-center gap-3 rounded-md px-2.5 text-left", tabbed ? "py-2" : "py-3", " transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", renderAgentAction && hasUnread && "pr-12", activeId === agent.id ? "bg-accent text-accent-foreground" : "group-hover/agent-pin:bg-accent/60 group-focus-within/agent-pin:bg-accent/60")}>
          <AgentAvatar agent={agent} size={tabbed ? 32 : 40} />
          <span className="agent-pin-text flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{agent.name}</span>
            <span className="truncate text-xs text-muted-foreground">{agent.status === "terminated" ? "Terminated"
              : tabbed && tab === "chats" && chatMeta[agent.id]
                ? [chatMeta[agent.id].projectName, formatChatTime(chatMeta[agent.id].updatedAt)].filter(Boolean).join(" · ") || (agent.title ?? agent.role)
                : agent.title ?? agent.role}</span>
          </span>
          {unreadCount > 0 ? <Badge variant="ghost" aria-label={`${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"} from ${agent.name}`} className="shrink-0 bg-primary font-mono tabular-nums text-primary-foreground">{unreadCount}</Badge>
            : unreadIds.has(agent.id) && <span role="img" aria-label={`Unread messages from ${agent.name}`} className="size-2 shrink-0 rounded-full bg-primary" />}
        </Link>{renderAgentAction?.(agent)}</div>;
        })}
      </nav> : !agents.length && (historyLoading || historyError) ? null : <div className="flex flex-col items-start gap-2 px-2 py-6">
        <p className="text-sm font-medium">{agents.length ? "No agents found" : "No chats yet"}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{agents.length ? "Try another name or role." : "Choose an agent to start a conversation."}</p>
        {!agents.length && <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>Choose an agent</Button>}
        {agents.length > 0 && <Button variant="outline" size="sm" onClick={focusSearch}>Clear search</Button>}
      </div>}
      {onCreateAgent && !loading && !error && (!tabbed || tab === "agents") && <button type="button" onClick={onCreateAgent}
        className="flex min-w-0 items-center gap-3 rounded-md px-2.5 py-3 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center"><span className="agent-contact-create flex size-8 items-center justify-center bg-muted"><Plus className="size-5 text-foreground" /></span></span>
        <span className="text-sm font-medium">Create a new agent</span>
      </button>}
    </div>
    {onBrowse && <div className="shrink-0 px-3 py-4">
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-2 text-muted-foreground" onClick={onBrowse}>
        <Users className="size-4" />Browse all agents
      </Button>
    </div>}
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>“{deleting?.title}” and its messages will be permanently deleted. This can’t be undone. Archive it instead if you might need it later.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { const thread = deleting; setDeleting(null); if (thread && onDeleteThread) void runThreadAction(() => onDeleteThread(thread.id), "Couldn’t delete this chat."); }}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AgentChatPicker agents={availableAgents} open={pickerOpen} onOpenChange={setPickerOpen}
      unreadMessageCounts={unreadMessageCounts}
      existingChatAgentIds={existingChatAgentIds ?? agents.map(agent => agent.id)} loading={loading} error={error} onRetry={onRetry}
      renderAgentIcon={agent => <AgentAvatar agent={agent} size={32} />}
      onSelect={async (agent, signal) => {
        if (onAddChat) await onAddChat(agent, signal);
        else if (onSelect) await onSelect(agent, signal);
        else navigate(`/chats/${encodeURIComponent(agentRouteRef(agent))}`);
        if (!signal?.aborted) setSearch("");
      }} />
  </aside>;
}

function formatChatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
