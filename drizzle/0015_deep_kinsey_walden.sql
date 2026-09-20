CREATE TYPE "public"."proposal_category" AS ENUM('environment', 'mobility', 'public_spaces', 'culture', 'social', 'development', 'other');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('new', 'reviewing', 'archived');--> statement-breakpoint
CREATE TYPE "public"."proposal_submission_mode" AS ENUM('anonymous', 'contact');--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" varchar(180) NOT NULL,
	"category" "proposal_category" NOT NULL,
	"content" varchar(5000) NOT NULL,
	"submission_mode" "proposal_submission_mode" NOT NULL,
	"contact_email" varchar(320),
	"status" "proposal_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_title_not_empty" CHECK (length(trim("proposals"."title")) > 0),
	CONSTRAINT "proposals_content_not_empty" CHECK (length(trim("proposals"."content")) > 0),
	CONSTRAINT "proposals_contact_consistent" CHECK (("proposals"."submission_mode" = 'anonymous' and "proposals"."contact_email" is null) or ("proposals"."submission_mode" = 'contact' and "proposals"."contact_email" is not null and length(trim("proposals"."contact_email")) > 0)),
	CONSTRAINT "proposals_email_normalized" CHECK ("proposals"."contact_email" is null or "proposals"."contact_email" = lower(trim("proposals"."contact_email")))
);
--> statement-breakpoint
CREATE INDEX "proposals_status_created_at_idx" ON "proposals" USING btree ("status","created_at");