import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { issuesApi } from "@/api/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/lib/router";

type TaskLink = { id: string; issueId: string; identifier: string | null; title: string };

export function ConversationTaskLinks({ companyId, source, conversationId, userId }: {
  companyId: string;
  source: "memory" | "native";
  conversationId: string;
  userId: string;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const queryKey = ["conversation-task-links", companyId, userId, source, conversationId];
  const links = useQuery({
    queryKey,
    queryFn: () => api.get<TaskLink[]>(`/companies/${companyId}/conversation-task-links?${new URLSearchParams({ source, conversationId })}`),
  });
  const tasks = useQuery({
    queryKey: ["conversation-link-task-search", companyId, userId, term],
    queryFn: () => issuesApi.listCompact(companyId, { q: term, limit: 10, projection: "index" }),
    enabled: term.length >= 2,
  });
  const add = useMutation({
    mutationFn: (issueId: string) => api.post(`/issues/${issueId}/conversation-task-links`, { source, conversationId }),
    onSuccess: () => { setSearch(""); void client.invalidateQueries({ queryKey }); },
  });
  const remove = useMutation({
    mutationFn: (link: TaskLink) => api.delete(`/issues/${link.issueId}/conversation-task-links/${link.id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey }),
  });
  const linked = new Set((links.data ?? []).map(link => link.issueId));
  return <section className="space-y-2">
    <h3 className="text-sm font-semibold">Related tasks</h3>
    {links.isPending && <p className="text-sm text-muted-foreground" role="status">Loading related tasks…</p>}
    {links.isError && <p className="text-sm" role="alert">Related tasks could not be loaded. <button className="underline" onClick={() => void links.refetch()}>Retry</button></p>}
    {links.data?.length === 0 && <p className="text-sm text-muted-foreground">No related tasks.</p>}
    {links.data && links.data.length > 0 && <ul className="space-y-1">
      {links.data.map(link => <li key={link.id} className="flex items-center gap-2 text-sm">
        <Link className="min-w-0 flex-1 underline" to={`/issues/${link.identifier ?? link.issueId}`}>
          {[link.identifier, link.title].filter(Boolean).join(" · ")}
        </Link>
        <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(link)} aria-label={`Remove link to ${link.title}`}>Remove</Button>
      </li>)}
    </ul>}
    <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks to link" aria-label="Search tasks to link" />
    {term.length >= 2 && tasks.isPending && <p role="status" className="text-sm text-muted-foreground">Searching tasks…</p>}
    {tasks.isError && <p role="alert" className="text-sm">Tasks could not be loaded. <button className="underline" onClick={() => void tasks.refetch()}>Retry</button></p>}
    {term.length >= 2 && tasks.data && <ul className="space-y-1">
      {tasks.data.filter(task => !linked.has(task.id)).map(task => <li key={task.id}>
        <button type="button" disabled={add.isPending} onClick={() => add.mutate(task.id)} className="text-left text-sm underline">
          {[task.identifier, task.title].filter(Boolean).join(" · ")}
        </button>
      </li>)}
    </ul>}
    {(add.isError || remove.isError) && <p role="alert" className="text-sm">The task link could not be updated. Try again.</p>}
  </section>;
}
