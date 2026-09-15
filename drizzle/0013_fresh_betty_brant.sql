ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportAddedToTransmission';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'ReportRemovedFromTransmission';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'TransmissionSent';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'TransmissionDelivered';--> statement-breakpoint
ALTER TYPE "public"."report_event_type" ADD VALUE 'TransmissionFailed';--> statement-breakpoint
CREATE TABLE "transmission_reports" (
	"transmission_id" varchar(64) NOT NULL,
	"report_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transmission_reports" ADD CONSTRAINT "transmission_reports_transmission_id_outbound_communications_id_fk" FOREIGN KEY ("transmission_id") REFERENCES "public"."outbound_communications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transmission_reports" ADD CONSTRAINT "transmission_reports_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "transmission_reports_transmission_report_unique" ON "transmission_reports" USING btree ("transmission_id","report_id");--> statement-breakpoint
CREATE INDEX "transmission_reports_transmission_id_idx" ON "transmission_reports" USING btree ("transmission_id");--> statement-breakpoint
CREATE INDEX "transmission_reports_report_id_idx" ON "transmission_reports" USING btree ("report_id");--> statement-breakpoint
INSERT INTO "transmission_reports" ("transmission_id", "report_id", "created_at")
SELECT "id", "report_id", "created_at"
FROM "outbound_communications"
ON CONFLICT DO NOTHING;
