CREATE TYPE "public"."report_attachment_review_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportAttachmentAdded';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportAttachmentApproved';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportAttachmentRejected';--> statement-breakpoint
DROP INDEX "report_attachments_report_id_unique";--> statement-breakpoint
ALTER TABLE "report_attachments" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
UPDATE "report_attachments" SET "type" = 'report_photo' WHERE "type" = 'image';--> statement-breakpoint
DROP TYPE "public"."report_attachment_type";--> statement-breakpoint
CREATE TYPE "public"."report_attachment_type" AS ENUM('report_photo', 'resolution_photo');--> statement-breakpoint
ALTER TABLE "report_attachments" ALTER COLUMN "type" SET DATA TYPE "public"."report_attachment_type" USING "type"::"public"."report_attachment_type";--> statement-breakpoint
ALTER TABLE "report_attachments" ADD COLUMN "review_status" "report_attachment_review_status";--> statement-breakpoint
UPDATE "report_attachments"
SET "review_status" = case
  when exists (
    select 1
    from "reports"
    where "reports"."id" = "report_attachments"."report_id"
      and "reports"."moderation_status" = 'approved'
      and "reports"."public_status" is not null
      and "reports"."published_at" is not null
  ) then 'approved'::"public"."report_attachment_review_status"
  else 'pending_review'::"public"."report_attachment_review_status"
end;--> statement-breakpoint
ALTER TABLE "report_attachments" ALTER COLUMN "review_status" SET DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "report_attachments" ALTER COLUMN "review_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "report_attachments" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "report_attachments" SET "reviewed_at" = "created_at" WHERE "review_status" = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "report_attachments_report_type_unique" ON "report_attachments" USING btree ("report_id","type");--> statement-breakpoint
CREATE INDEX "report_attachments_review_status_idx" ON "report_attachments" USING btree ("review_status");--> statement-breakpoint
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_reviewed_at_status" CHECK ("report_attachments"."reviewed_at" is null or "report_attachments"."review_status" in ('approved', 'rejected'));
