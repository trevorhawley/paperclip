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
import { Link, useSearchParams } from "@/lib/router";

export function Conversations() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => setBreadcrumbs([{ label: "Conversations" }]), [setBreadcrumbs]);
  return selectedCompanyId ? <ConversationHistory key={selectedCompanyId} companyId={selectedCompanyId} /> : null;
}

function ConversationHistory({ companyId }: { companyId: string }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [project, setProject] = useState("");
  const [params, setParams] = useSearchParams();
  const updates = useQuery({
    queryKey: ["external-conversation-updates", companyId],
    queryFn: () => api.get<ExternalConversationUpdate[]>(`/companies/${companyId}/external-conversation-updates`),
  });
  const projects = useQuery({
    queryKey: queryKeys.projects.list(companyId, { includeArchived: true }),
    queryFn: () => projectsApi.list(companyId, { includeArchived: true }),
  });
  const names = useMemo(() => new Map(projects.data?.map(item => [item.id, item.name])), [projects.data]);
  const platforms = useMemo(() => [...new Set(updates.data?.flatMap(item => item.platform ? [item.platform] : []))].sort(), [updates.data]);
  const projectIds = useMemo(() => [...new Set(updates.data?.flatMap(item => item.task.projectId ? [item.task.projectId] : []))], [updates.data]);
  const search = query.trim().toLowerCase();
  const visible = useMemo(() => updates.data?.filter(item =>
    (!platform || item.platform === platform) &&
    (!project || item.task.projectId === project) &&
    (!search || [item.task.title, item.task.identifier, item.platform, item.model,
      item.discussion, item.chatUrl, names.get(item.task.projectId ?? "")]
      .some(value => value?.toLowerCase().includes(search))),
  ) ?? [], [updates.data, platform, project, search, names]);
  const selectedId = params.get("update");
  const selected = selectedId ? updates.data?.find(item => item.id === selectedId) : visible[0];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground">Recent updates recorded by external AI assistants on Paperclip tasks.</p>
        </div>
        <Button asChild variant="outline"><Link to="/chats">Open native chat</Link></Button>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-full sm:max-w-xs" value={query} onChange={event => { setQuery(event.target.value); if (selectedId) setParams({}, { replace: true }); }}
          placeholder="Search conversation updates" aria-label="Search conversation updates" />
        <select aria-label="AI platform" className="rounded-md border bg-background p-2 text-sm"
          value={platform} onChange={event => { setPlatform(event.target.value); if (selectedId) setParams({}, { replace: true }); }}>
          <option value="">All platforms</option>
          {platforms.map(value => <option key={value}>{value}</option>)}
        </select>
        <select aria-label="Project" className="rounded-md border bg-background p-2 text-sm"
          value={project} onChange={event => { setProject(event.target.value); if (selectedId) setParams({}, { replace: true }); }}>
          <option value="">All projects</option>
          {projectIds.map(id => <option key={id} value={id}>{names.get(id) ?? "Project unavailable"}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">Latest 100 updates</span>
      </div>
      {updates.isPending && <p role="status">Loading conversation updates…</p>}
      {updates.isError && <div className="flex items-center gap-2" role="alert">
        <p>Conversation updates could not be loaded.</p>
        <Button variant="outline" onClick={() => void updates.refetch()}>Retry</Button>
      </div>}
      {updates.isSuccess && visible.length === 0 && <p className="text-sm text-muted-foreground">
        {updates.data.length ? "No updates match your filters." : "No external conversation updates are available yet."}
      </p>}
      {updates.isSuccess && (visible.length > 0 || selectedId) && (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {visible.length > 0 && <ul className="divide-y rounded-lg border">
            {visible.map(item => <li key={item.id}>
              <button type="button" aria-current={selected?.id === item.id ? "true" : undefined}
                className="w-full space-y-1 rounded-md p-3 text-left hover:bg-muted aria-current:bg-muted"
                onClick={() => setParams({ update: item.id })}>
                <span className="block truncate text-sm font-medium">{item.task.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[item.platform ?? "External AI", item.model, names.get(item.task.projectId ?? "")].filter(Boolean).join(" · ")}
                </span>
                <time className="block text-xs text-muted-foreground" dateTime={item.recordedAt}>
                  {new Date(item.recordedAt).toLocaleString()}
                </time>
              </button>
            </li>)}
          </ul>}
          {selected ? <article className="min-w-0 space-y-4 rounded-lg border p-4 md:col-span-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">External AI · Self-reported provenance</p>
              <h2 className="break-words text-lg font-semibold">{selected.task.title}</h2>
              <p className="break-words text-sm text-muted-foreground">
                {[selected.platform ?? "Platform unavailable", selected.model ?? "Model unavailable",
                  names.get(selected.task.projectId ?? "")].filter(Boolean).join(" · ")}
              </p>
              <time className="block text-xs text-muted-foreground" dateTime={selected.recordedAt}>
                {new Date(selected.recordedAt).toLocaleString()}
              </time>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/issues/${selected.task.identifier ?? selected.task.id}#comment-${selected.id}`}>
                  Open task {selected.task.identifier}
                </Link>
              </Button>
              {selected.chatUrl && <Button asChild variant="outline" size="sm">
                <a href={selected.chatUrl} target="_blank" rel="noopener noreferrer">Open original chat</a>
              </Button>}
            </div>
            <MarkdownBody className="break-words">{selected.discussion}</MarkdownBody>
          </article> : selectedId && <p className="text-sm text-muted-foreground md:col-span-2">This update is unavailable.</p>}
        </div>
      )}
    </main>
  );
}
