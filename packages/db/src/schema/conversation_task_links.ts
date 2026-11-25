import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const conversationTaskLinks = pgTable(
  "conversation_task_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    ownerUserId: text("owner_user_id").notNull(),
    conversationSource: text("conversation_source").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueLink: uniqueIndex("conversation_task_links_unique").on(
      table.companyId, table.ownerUserId, table.conversationSource, table.conversationId, table.issueId,
    ),
    issueIndex: index("conversation_task_links_issue_idx").on(table.companyId, table.issueId),
    companyIssueFk: foreignKey({
      name: "conversation_task_links_company_issue_fk",
      columns: [table.companyId, table.issueId],
      foreignColumns: [issues.companyId, issues.id],
    }).onDelete("cascade"),
    sourceCheck: check("conversation_task_links_source_check", sql`${table.conversationSource} in ('memory', 'native')`),
  }),
);
