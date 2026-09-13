CREATE TYPE "public"."report_attachment_type" AS ENUM('image');--> statement-breakpoint
CREATE TABLE "report_attachments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"report_id" varchar(64) NOT NULL,
	"type" "report_attachment_type" NOT NULL,
	"storage_key" varchar(300) NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_attachments_id_not_empty" CHECK (length(trim("report_attachments"."id")) > 0),
	CONSTRAINT "report_attachments_storage_key_not_empty" CHECK (length(trim("report_attachments"."storage_key")) > 0),
	CONSTRAINT "report_attachments_mime_type_not_empty" CHECK (length(trim("report_attachments"."mime_type")) > 0),
	CONSTRAINT "report_attachments_size_positive" CHECK ("report_attachments"."size" > 0)
);
--> statement-breakpoint
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "report_attachments_report_id_unique" ON "report_attachments" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_attachments_storage_key_unique" ON "report_attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments" USING btree ("report_id");