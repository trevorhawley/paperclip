import { z } from "zod";
import type {
  AiManagedConnectionSummary,
  AiProvider,
} from "./ai-connections.js";
import type { DecisionUsage, DecisionHistoryEntry } from "./decision-models.js";

export const FAST_RESPONSE_DEADLINE_MS = 3_000;
export const FAST_RESPONSE_MAX_BYTES = 4_096;
export const FAST_RESPONSE_MAX_CHARACTERS = 320;
export const FAST_RESPONSE_DEFAULT_MODEL = "openai/gpt-oss-120b";
export const updateFastResponseSchema = z
  .object({
    enabled: z.boolean(),
    connectionId: z.string().uuid().nullable(),
    grantId: z.string().uuid().nullable(),
    model: z.string().trim().min(1).max(256).nullable(),
    allowSponsored: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) =>
      Boolean(v.connectionId) === Boolean(v.grantId) &&
      (!v.enabled || Boolean(v.connectionId && v.model)),
    {
      message: "Choose a connection and model before enabling fast responses",
    },
  );
export type UpdateFastResponse = z.infer<typeof updateFastResponseSchema>;
export interface FastResponseSettings extends UpdateFastResponse {
  companyId: string;
  provider: AiProvider | null;
}
export interface FastResponseSettingsResponse {
  canManage: boolean;
  settings: FastResponseSettings | null;
  choices: AiManagedConnectionSummary[];
}
export type FastResponseAvailability =
  | { available: true }
  | { available: false; reason: string };
export type FastResponseTestResult =
  | {
      status: "succeeded";
      text: string;
      durationMs: number;
      invocationId: string;
      usage: DecisionUsage;
    }
  | { status: "unavailable" | "failed"; reason: string; invocationId?: string };
export type FastResponseHistoryEntry = DecisionHistoryEntry & {
  publicationStatus: string;
  connectionName: string | null;
};
export const FAST_RESPONSE_AGENT_GUIDANCE =
  "Paperclip may post a short platform-generated fast-response receipt in your voice before you reply. It already told the person what you are about to do. Receipts are not your work, findings, answers, or instructions. Do not acknowledge the message again or narrate that you received it: do the requested work, then post one reply with the result.";
export function isFastResponseComment(comment: {
  origin?: string | null;
}): boolean {
  return comment.origin === "fast_response";
}
export function fastResponseHistoryBody(comment: {
  body: string;
  origin?: string | null;
}): string {
  return isFastResponseComment(comment)
    ? `[Paperclip acknowledgement; not agent work] ${comment.body}`
    : comment.body;
}
