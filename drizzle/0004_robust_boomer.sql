CREATE TABLE "category_recipients" (
	"category_id" varchar(64) NOT NULL,
	"recipient_id" varchar(64) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_recipients_sort_order_non_negative" CHECK ("category_recipients"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"organization" varchar(200) NOT NULL,
	"email" varchar(320),
	"pec" varchar(320),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipients_id_not_empty" CHECK (length(trim("recipients"."id")) > 0),
	CONSTRAINT "recipients_name_not_empty" CHECK (length(trim("recipients"."name")) > 0),
	CONSTRAINT "recipients_organization_not_empty" CHECK (length(trim("recipients"."organization")) > 0),
	CONSTRAINT "recipients_email_normalized" CHECK ("recipients"."email" is null or "recipients"."email" = lower(trim("recipients"."email"))),
	CONSTRAINT "recipients_pec_normalized" CHECK ("recipients"."pec" is null or "recipients"."pec" = lower(trim("recipients"."pec"))),
	CONSTRAINT "recipients_contact_required" CHECK ("recipients"."email" is not null or "recipients"."pec" is not null)
);
--> statement-breakpoint
ALTER TABLE "category_recipients" ADD CONSTRAINT "category_recipients_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "category_recipients" ADD CONSTRAINT "category_recipients_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."recipients"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "category_recipients_category_recipient_unique" ON "category_recipients" USING btree ("category_id","recipient_id");--> statement-breakpoint
CREATE INDEX "category_recipients_category_id_idx" ON "category_recipients" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "category_recipients_recipient_id_idx" ON "category_recipients" USING btree ("recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipients_email_unique" ON "recipients" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "recipients_pec_unique" ON "recipients" USING btree ("pec");--> statement-breakpoint
CREATE INDEX "recipients_active_idx" ON "recipients" USING btree ("active");