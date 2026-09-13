import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
import {
  MODERATION_STATUSES,
  PUBLIC_REPORT_STATUSES
} from "@/modules/reports/domain";

export const publicReportStatusEnum = pgEnum("public_report_status", [
  ...PUBLIC_REPORT_STATUSES
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  ...MODERATION_STATUSES
]);

export const reportEventTypeEnum = pgEnum("report_event_type", [
  "ReportCreated",
  "ReportApproved",
  "ReportRejected",
  "ReportCommunicated",
  "ReportResolved"
]);

export const reportEventVisibilityEnum = pgEnum("report_event_visibility", [
  "public",
  "internal"
]);

export const adminRoleEnum = pgEnum("admin_role", ["admin"]);

export const reportAttachmentTypeEnum = pgEnum("report_attachment_type", ["image"]);

export const categories = pgTable(
  "categories",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    check("categories_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("categories_name_not_empty", sql`length(trim(${table.name})) > 0`),
    check("categories_slug_not_empty", sql`length(trim(${table.slug})) > 0`)
  ]
);

export const reports = pgTable(
  "reports",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    publicCode: varchar("public_code", { length: 11 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: varchar("description", { length: 4000 }).notNull(),
    categoryId: varchar("category_id", { length: 64 })
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    address: varchar("address", { length: 500 }),
    publicStatus: publicReportStatusEnum("public_status"),
    moderationStatus: moderationStatusEnum("moderation_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    communicatedAt: timestamp("communicated_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("reports_public_code_unique").on(table.publicCode),
    index("reports_category_id_idx").on(table.categoryId),
    index("reports_public_status_idx").on(table.publicStatus),
    index("reports_moderation_status_idx").on(table.moderationStatus),
    check("reports_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("reports_public_code_format", sql`${table.publicCode} ~ '^VC-[0-9A-Z]{8}$'`),
    check("reports_title_not_empty", sql`length(trim(${table.title})) > 0`),
    check("reports_description_not_empty", sql`length(trim(${table.description})) > 0`),
    check("reports_latitude_range", sql`${table.latitude} between -90 and 90`),
    check("reports_longitude_range", sql`${table.longitude} between -180 and 180`),
    check(
      "reports_public_status_requires_approval",
      sql`(${table.moderationStatus} = 'approved' and ${table.publicStatus} is not null)
        or (${table.moderationStatus} <> 'approved' and ${table.publicStatus} is null)`
    ),
    check(
      "reports_public_status_requires_published_at",
      sql`${table.publicStatus} is null or ${table.publishedAt} is not null`
    ),
    check(
      "reports_communicated_or_resolved_requires_communicated_at",
      sql`${table.publicStatus} not in ('communicated', 'resolved') or ${table.communicatedAt} is not null`
    ),
    check(
      "reports_resolved_requires_resolved_at",
      sql`${table.publicStatus} is distinct from 'resolved' or ${table.resolvedAt} is not null`
    )
  ]
);

export const reportEvents = pgTable(
  "report_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: reportEventTypeEnum("type").notNull(),
    visibility: reportEventVisibilityEnum("visibility").notNull(),
    publicStatus: publicReportStatusEnum("public_status"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("report_events_report_id_idx").on(table.reportId),
    index("report_events_visibility_idx").on(table.visibility),
    check("report_events_id_not_empty", sql`length(trim(${table.id})) > 0`)
  ]
);



export const reportAttachments = pgTable(
  "report_attachments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: reportAttachmentTypeEnum("type").notNull(),
    storageKey: varchar("storage_key", { length: 300 }).notNull(),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("report_attachments_report_id_unique").on(table.reportId),
    uniqueIndex("report_attachments_storage_key_unique").on(table.storageKey),
    index("report_attachments_report_id_idx").on(table.reportId),
    check("report_attachments_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("report_attachments_storage_key_not_empty", sql`length(trim(${table.storageKey})) > 0`),
    check("report_attachments_mime_type_not_empty", sql`length(trim(${table.mimeType})) > 0`),
    check("report_attachments_size_positive", sql`${table.size} > 0`)
  ]
);


export const reportConfirmations = pgTable(
  "report_confirmations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
    antiAbuseKey: varchar("anti_abuse_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("report_confirmations_report_anti_abuse_unique").on(
      table.reportId,
      table.antiAbuseKey
    ),
    index("report_confirmations_report_id_idx").on(table.reportId),
    check("report_confirmations_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check(
      "report_confirmations_anti_abuse_key_not_empty",
      sql`length(trim(${table.antiAbuseKey})) > 0`
    )
  ]
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 512 }).notNull(),
    role: adminRoleEnum("role").notNull().default("admin"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("admin_users_email_unique").on(table.email),
    index("admin_users_active_idx").on(table.active),
    check("admin_users_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("admin_users_email_not_empty", sql`length(trim(${table.email})) > 0`),
    check("admin_users_email_normalized", sql`${table.email} = lower(trim(${table.email}))`),
    check("admin_users_password_hash_not_empty", sql`length(trim(${table.passwordHash})) > 0`)
  ]
);

export type CategoryRecord = typeof categories.$inferSelect;
export type NewCategoryRecord = typeof categories.$inferInsert;
export type ReportRecord = typeof reports.$inferSelect;
export type NewReportRecord = typeof reports.$inferInsert;
export type ReportEventRecord = typeof reportEvents.$inferSelect;
export type NewReportEventRecord = typeof reportEvents.$inferInsert;
export type ReportAttachmentRecord = typeof reportAttachments.$inferSelect;
export type NewReportAttachmentRecord = typeof reportAttachments.$inferInsert;
export type ReportConfirmationRecord = typeof reportConfirmations.$inferSelect;
export type NewReportConfirmationRecord = typeof reportConfirmations.$inferInsert;
export type AdminUserRecord = typeof adminUsers.$inferSelect;
export type NewAdminUserRecord = typeof adminUsers.$inferInsert;
