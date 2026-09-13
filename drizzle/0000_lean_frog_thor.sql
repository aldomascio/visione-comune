CREATE TYPE "public"."moderation_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."public_report_status" AS ENUM('reported', 'communicated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."report_event_type" AS ENUM('ReportCreated', 'ReportApproved', 'ReportRejected', 'ReportCommunicated', 'ReportResolved');--> statement-breakpoint
CREATE TYPE "public"."report_event_visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_id_not_empty" CHECK (length(trim("categories"."id")) > 0),
	CONSTRAINT "categories_name_not_empty" CHECK (length(trim("categories"."name")) > 0),
	CONSTRAINT "categories_slug_not_empty" CHECK (length(trim("categories"."slug")) > 0)
);
--> statement-breakpoint
CREATE TABLE "report_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"report_id" varchar(64) NOT NULL,
	"type" "report_event_type" NOT NULL,
	"visibility" "report_event_visibility" NOT NULL,
	"public_status" "public_report_status",
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "report_events_id_not_empty" CHECK (length(trim("report_events"."id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"public_code" varchar(11) NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" varchar(4000) NOT NULL,
	"category_id" varchar(64) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"address" varchar(500),
	"public_status" "public_report_status",
	"moderation_status" "moderation_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"communicated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_id_not_empty" CHECK (length(trim("reports"."id")) > 0),
	CONSTRAINT "reports_public_code_format" CHECK ("reports"."public_code" ~ '^VC-[0-9A-Z]{8}$'),
	CONSTRAINT "reports_title_not_empty" CHECK (length(trim("reports"."title")) > 0),
	CONSTRAINT "reports_description_not_empty" CHECK (length(trim("reports"."description")) > 0),
	CONSTRAINT "reports_latitude_range" CHECK ("reports"."latitude" between -90 and 90),
	CONSTRAINT "reports_longitude_range" CHECK ("reports"."longitude" between -180 and 180),
	CONSTRAINT "reports_public_status_requires_approval" CHECK (("reports"."moderation_status" = 'approved' and "reports"."public_status" is not null)
        or ("reports"."moderation_status" <> 'approved' and "reports"."public_status" is null)),
	CONSTRAINT "reports_public_status_requires_published_at" CHECK ("reports"."public_status" is null or "reports"."published_at" is not null),
	CONSTRAINT "reports_communicated_or_resolved_requires_communicated_at" CHECK ("reports"."public_status" not in ('communicated', 'resolved') or "reports"."communicated_at" is not null),
	CONSTRAINT "reports_resolved_requires_resolved_at" CHECK ("reports"."public_status" is distinct from 'resolved' or "reports"."resolved_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "report_events_report_id_idx" ON "report_events" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_events_visibility_idx" ON "report_events" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_public_code_unique" ON "reports" USING btree ("public_code");--> statement-breakpoint
CREATE INDEX "reports_category_id_idx" ON "reports" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "reports_public_status_idx" ON "reports" USING btree ("public_status");--> statement-breakpoint
CREATE INDEX "reports_moderation_status_idx" ON "reports" USING btree ("moderation_status");