ALTER TABLE "news_posts" ADD COLUMN "featured_image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "featured_image_alt" varchar(180);--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_featured_image_alt_required" CHECK ("news_posts"."featured_image_url" is null or length(trim("news_posts"."featured_image_alt")) > 0);