CREATE TABLE "site_public_settings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"facebook_url" varchar(500),
	"instagram_url" varchar(500),
	"tiktok_url" varchar(500),
	"contact_email" varchar(320),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_public_settings_singleton" CHECK ("site_public_settings"."id" = 'public-contact'),
	CONSTRAINT "site_public_settings_contact_email_normalized" CHECK ("site_public_settings"."contact_email" is null or "site_public_settings"."contact_email" = lower(trim("site_public_settings"."contact_email")))
);
