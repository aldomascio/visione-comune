CREATE TYPE "public"."admin_role" AS ENUM('admin');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(512) NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_id_not_empty" CHECK (length(trim("admin_users"."id")) > 0),
	CONSTRAINT "admin_users_email_not_empty" CHECK (length(trim("admin_users"."email")) > 0),
	CONSTRAINT "admin_users_email_normalized" CHECK ("admin_users"."email" = lower(trim("admin_users"."email"))),
	CONSTRAINT "admin_users_password_hash_not_empty" CHECK (length(trim("admin_users"."password_hash")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_users_active_idx" ON "admin_users" USING btree ("active");