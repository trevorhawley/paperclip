export interface ExternalConversationUpdate {
  id: string;
  task: { id: string; identifier: string | null; title: string; projectId: string | null };
  recordedByUserId: string | null;
  recordedAt: string;
  discussion: string;
  platform: string | null;
  model: string | null;
  chatUrl: string | null;
}
