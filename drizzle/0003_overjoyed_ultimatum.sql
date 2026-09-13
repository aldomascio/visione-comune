CREATE TABLE "report_confirmations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"report_id" varchar(64) NOT NULL,
	"anti_abuse_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_confirmations_id_not_empty" CHECK (length(trim("report_confirmations"."id")) > 0),
	CONSTRAINT "report_confirmations_anti_abuse_key_not_empty" CHECK (length(trim("report_confirmations"."anti_abuse_key")) > 0)
);
--> statement-breakpoint
ALTER TABLE "report_confirmations" ADD CONSTRAINT "report_confirmations_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "report_confirmations_report_anti_abuse_unique" ON "report_confirmations" USING btree ("report_id","anti_abuse_key");--> statement-breakpoint
CREATE INDEX "report_confirmations_report_id_idx" ON "report_confirmations" USING btree ("report_id");