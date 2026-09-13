CREATE TYPE "public"."news_post_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" varchar(180) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"excerpt" varchar(320),
	"content" varchar(12000) NOT NULL,
	"status" "news_post_status" NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_posts_id_not_empty" CHECK (length(trim("news_posts"."id")) > 0),
	CONSTRAINT "news_posts_title_not_empty" CHECK (length(trim("news_posts"."title")) > 0),
	CONSTRAINT "news_posts_slug_not_empty" CHECK (length(trim("news_posts"."slug")) > 0),
	CONSTRAINT "news_posts_slug_format" CHECK ("news_posts"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "news_posts_content_not_empty" CHECK (length(trim("news_posts"."content")) > 0),
	CONSTRAINT "news_posts_published_requires_published_at" CHECK ("news_posts"."status" <> 'published' or "news_posts"."published_at" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "news_posts_slug_unique" ON "news_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_posts_status_idx" ON "news_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "news_posts_published_at_idx" ON "news_posts" USING btree ("published_at");