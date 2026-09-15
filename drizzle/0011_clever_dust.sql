ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportMarkedAsDuplicate';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportDuplicateLinkRemoved';--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "duplicate_of_report_id" varchar(64);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_duplicate_of_report_id_reports_id_fk" FOREIGN KEY ("duplicate_of_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "reports_duplicate_of_report_id_idx" ON "reports" USING btree ("duplicate_of_report_id");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_not_duplicate_of_self" CHECK ("reports"."duplicate_of_report_id" is null or "reports"."duplicate_of_report_id" <> "reports"."id");