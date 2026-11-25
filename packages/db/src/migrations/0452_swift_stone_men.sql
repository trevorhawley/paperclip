CREATE TABLE "conversation_task_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"conversation_source" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_task_links_source_check" CHECK ("conversation_task_links"."conversation_source" in ('memory', 'native'))
);
--> statement-breakpoint
ALTER TABLE "conversation_task_links" ADD CONSTRAINT "conversation_task_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_task_links" ADD CONSTRAINT "conversation_task_links_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_task_links" ADD CONSTRAINT "conversation_task_links_company_issue_fk" FOREIGN KEY ("company_id","issue_id") REFERENCES "public"."issues"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_task_links_unique" ON "conversation_task_links" USING btree ("company_id","owner_user_id","conversation_source","conversation_id","issue_id");--> statement-breakpoint
CREATE INDEX "conversation_task_links_issue_idx" ON "conversation_task_links" USING btree ("company_id","issue_id");