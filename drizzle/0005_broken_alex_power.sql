CREATE TYPE "public"."outbound_communication_channel" AS ENUM('email', 'pec');--> statement-breakpoint
CREATE TYPE "public"."outbound_communication_status" AS ENUM('draft', 'sent', 'delivered', 'failed');--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'CommunicationRecorded';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'CommunicationSent';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'CommunicationDelivered';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'CommunicationFailed';--> statement-breakpoint
CREATE TABLE "outbound_communications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"report_id" varchar(64) NOT NULL,
	"recipient_id" varchar(64),
	"recipient_name_snapshot" varchar(160) NOT NULL,
	"recipient_organization_snapshot" varchar(200) NOT NULL,
	"recipient_address_snapshot" varchar(320) NOT NULL,
	"channel" "outbound_communication_channel" NOT NULL,
	"subject" varchar(240) NOT NULL,
	"body" varchar(6000) NOT NULL,
	"status" "outbound_communication_status" NOT NULL,
	"external_message_id" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	CONSTRAINT "outbound_communications_id_not_empty" CHECK (length(trim("outbound_communications"."id")) > 0),
	CONSTRAINT "outbound_communications_recipient_name_not_empty" CHECK (length(trim("outbound_communications"."recipient_name_snapshot")) > 0),
	CONSTRAINT "outbound_communications_recipient_organization_not_empty" CHECK (length(trim("outbound_communications"."recipient_organization_snapshot")) > 0),
	CONSTRAINT "outbound_communications_recipient_address_not_empty" CHECK (length(trim("outbound_communications"."recipient_address_snapshot")) > 0),
	CONSTRAINT "outbound_communications_subject_not_empty" CHECK (length(trim("outbound_communications"."subject")) > 0),
	CONSTRAINT "outbound_communications_body_not_empty" CHECK (length(trim("outbound_communications"."body")) > 0),
	CONSTRAINT "outbound_communications_delivered_at_status" CHECK ("outbound_communications"."delivered_at" is null or "outbound_communications"."status" = 'delivered'),
	CONSTRAINT "outbound_communications_failed_at_status" CHECK ("outbound_communications"."failed_at" is null or "outbound_communications"."status" = 'failed'),
	CONSTRAINT "outbound_communications_sent_at_required" CHECK ("outbound_communications"."status" not in ('sent', 'delivered') or "outbound_communications"."sent_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "outbound_communications_report_id_idx" ON "outbound_communications" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "outbound_communications_recipient_id_idx" ON "outbound_communications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "outbound_communications_status_idx" ON "outbound_communications" USING btree ("status");