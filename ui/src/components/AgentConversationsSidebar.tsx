import { useMemo } from "react";
import { AgentConversationSidebar, type ChatThreadRow } from "./AgentConversationSidebar";
import { queryViewKind } from "./QueryView";
import { useAgentChatNavigation, useOpenAgentChat } from "@/hooks/useAgentChatNavigation";
import { useLocation, useNavigate } from "@/lib/router";
import { useSidebar } from "@/context/SidebarContext";
import { agentRouteRef } from "@/lib/utils";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { issuesApi } from "@/api/issues";
import { projectsApi } from "@/api/projects";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { resourceMembershipState, useResourceMemberships } from "@/hooks/useResourceMemberships";
import { useDialogActions } from "@/context/DialogContext";
import { AgentChatPin, useAgentChatPins } from "./AgentChatPin";

/** Account- and company-scoped data for the secondary chat navigation. */
export function AgentConversationsSidebar() {
  const { companyId, userId, agents, chats, session } = useAgentChatNavigation();
  const agentChatPins = useAgentChatPins();
  const unreadMessageCounts = useMemo(() => new Map((chats.data ?? [])
    .flatMap(chat => chat.conversationAgentId && chat.unreadMessageCount
      ? [[chat.conversationAgentId, chat.unreadMessageCount] as const] : [])), [chats.data]);
  const openChat = useOpenAgentChat(companyId, userId);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { openNewAgent } = useDialogActions();
  const memberships = useResourceMemberships(companyId);
  const { isMobile, setSidebarOpen } = useSidebar();
  const { pathname, search } = useLocation();
  const threadParam = new URLSearchParams(search).get("thread");
  const activeRef = pathname.split("/chats/")[1]?.split("/")[0];
  const roster = agents.data ?? [];
  // The active roster excludes terminated agents, but their history remains readable.
  const missingIds = agents.isSuccess ? [...new Set((chats.data ?? [])
    .flatMap(chat => chat.conversationAgentId && !roster.some(agent => agent.id === chat.conversationAgentId) ? [chat.conversationAgentId] : []))] : [];
  const historyAgents = useQueries({ queries: missingIds.map(id => ({
    queryKey: queryKeys.agents.detail(id), queryFn: () => agentsApi.get(id, companyId!),
  })) });
  const byId = new Map(roster.map(agent => [agent.id, agent]));
  for (const result of historyAgents) if (result.data) byId.set(result.data.id, result.data);
  const active = [...byId.values()].find(agent => agent.id === activeRef || (agent.status !== "terminated" && encodeURIComponent(agentRouteRef(agent)) === activeRef));
  const activeId = active?.id;
  const existingChatAgentIds = useMemo(() => {
    const ids = (chats.data ?? []).flatMap(chat => chat.conversationAgentId ? [chat.conversationAgentId] : []);
    if (activeId && !ids.includes(activeId)) ids.unshift(activeId);
    return ids;
  }, [chats.data, activeId]);
  const unreadAgentIds = useMemo(() => (chats.data ?? [])
    .flatMap(chat => chat.isUnreadForMe && chat.conversationAgentId ? [chat.conversationAgentId] : []), [chats.data]);
  // One row per agent on the Agents tab, even with several threads each.
  const conversations = [...new Map((chats.data ?? []).flatMap(chat => {
    const agent = chat.conversationAgentId ? byId.get(chat.conversationAgentId) : undefined;
    return agent ? [[agent.id, agent] as const] : [];
  })).values()];
  if (active && !conversations.some(agent => agent.id === active.id)) conversations.unshift(active);
  // Everyone you can chat with is listed, not only agents you've already
  // talked to: conversations first by recent activity, then the rest of the
  // roster alphabetically. Same eligibility rule as the Agents nav section —
  // terminated agents and agents you've left are omitted.
  const listedIds = new Set(conversations.map(agent => agent.id));
  const teammates = roster
    .filter(agent => !listedIds.has(agent.id) && agent.status !== "terminated"
      && (!memberships.isSuccess || resourceMembershipState(memberships.data, "agent", agent.id) !== "left"))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  const projects = useQuery({ queryKey: queryKeys.projects.list(companyId!), queryFn: () => projectsApi.list(companyId!), enabled: !!companyId });
  const projectNames = new Map((projects.data ?? []).map(project => [project.id, project.name]));
  // Each chat row says who it's with, which project, and when it last moved.
  const chatMeta = Object.fromEntries([...(chats.data ?? [])].reverse().flatMap(chat => chat.conversationAgentId ? [[chat.conversationAgentId, {
    projectName: chat.projectId ? projectNames.get(chat.projectId) ?? null : null,
    updatedAt: String(chat.updatedAt),
  }]] : []));
  // Recents: every thread, newest first, tagged with its project and agent.
  const threads: ChatThreadRow[] = (chats.data ?? []).flatMap(chat => {
    const agent = chat.conversationAgentId ? byId.get(chat.conversationAgentId) : undefined;
    return agent ? [{
      id: chat.id, title: chat.title, agent,
      projectName: chat.projectId ? projectNames.get(chat.projectId) ?? null : null,
      updatedAt: String(chat.updatedAt), unreadCount: chat.unreadMessageCount ?? 0,
      unread: !!chat.isUnreadForMe, working: chat.conversationState === "active",
      archived: !!chat.hiddenAt,
    }] : [];
  });
  const activeThreadId = threadParam ?? (activeId ? threads.find(thread => thread.agent.id === activeId)?.id ?? null : null);
  const previews = Object.fromEntries((chats.data ?? []).filter(chat => chat.conversationState === "active")
    .map(chat => [chat.conversationAgentId!, "Working…"]));
  return <AgentConversationSidebar key={`${companyId}:${userId}`} agents={[...conversations, ...teammates]} availableAgents={roster}
    existingChatAgentIds={existingChatAgentIds}
    conversationAgentIds={conversations.map(agent => agent.id)} chatMeta={chatMeta}
    threads={threads} activeThreadId={activeThreadId} onThreadSelect={() => { if (isMobile) setSidebarOpen(false); }}
    onArchiveThread={async (threadId, archived) => {
      await issuesApi.update(threadId, { hiddenAt: archived ? new Date().toISOString() : null });
      await client.invalidateQueries({ queryKey: queryKeys.agentChats.list(companyId, userId) });
      await client.invalidateQueries({ queryKey: ["agent-chat", companyId, userId] });
    }}
    onDeleteThread={async threadId => {
      await issuesApi.remove(threadId);
      client.setQueryData<Issue[]>(queryKeys.agentChats.list(companyId, userId), previous => previous?.filter(chat => chat.id !== threadId));
      await client.invalidateQueries({ queryKey: ["agent-chat", companyId, userId] });
      if (threadId === activeThreadId) navigate("/chats");
    }}
    activeId={active?.id} previews={previews}
    unreadAgentIds={unreadAgentIds}
    unreadMessageCounts={unreadMessageCounts}
    onCreateAgent={openNewAgent} renderAgentAction={agent => <AgentChatPin agent={agent} pins={agentChatPins} />}
    // Loaded chats stay listed through an outage (the banner covers it); an
    // outage before the first load is a skeleton, and only a real failure is an error.
    loading={[agents, chats, session].some(query => { const kind = queryViewKind(query); return kind === "loading" || kind === "reconnecting"; })}
    error={[agents, chats, session].find(query => queryViewKind(query) === "error")?.error ?? null}
    onRetry={() => { void agents.refetch(); void chats.refetch(); void session.refetch(); }}
    historyLoading={historyAgents.some(result => result.isPending)}
    historyError={historyAgents.find(result => queryViewKind(result) === "error")?.error}
    onRetryHistory={() => { historyAgents.filter(result => result.isError).forEach(result => { void result.refetch(); }); }}
    onAddChat={openChat}
    onSelect={agent => {
      navigate(`/chats/${encodeURIComponent(agent.status === "terminated" ? agent.id : agentRouteRef(agent))}`);
      if (isMobile) setSidebarOpen(false);
    }} />;
}
