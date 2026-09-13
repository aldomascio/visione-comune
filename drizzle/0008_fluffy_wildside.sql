ALTER TABLE "news_posts" ADD COLUMN "content_json" jsonb;--> statement-breakpoint
UPDATE "news_posts"
SET "content_json" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
    )
  )
)
WHERE length(trim("content")) > 0;--> statement-breakpoint
UPDATE "news_posts"
SET "content_json" = jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph')))
WHERE "content_json" IS NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "content_json" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_content_json_object" CHECK (jsonb_typeof("news_posts"."content_json") = 'object');