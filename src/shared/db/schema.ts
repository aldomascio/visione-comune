import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  varchar,
} from "drizzle-orm/pg-core";
import {
  MODERATION_STATUSES,
  PUBLIC_REPORT_STATUSES,
  REPORT_SOURCES,
} from "@/modules/reports/domain";

export const publicReportStatusEnum = pgEnum("public_report_status", [
  ...PUBLIC_REPORT_STATUSES,
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  ...MODERATION_STATUSES,
]);

export const reportSourceEnum = pgEnum("report_source", [...REPORT_SOURCES]);

export const reportEventTypeEnum = pgEnum("report_event_type", [
  "ReportCreated",
  "ReportApproved",
  "ReportRejected",
  "ReportCommunicated",
  "ReportResolved",
  "CommunicationRecorded",
  "CommunicationSent",
  "CommunicationDelivered",
  "CommunicationFailed",
  "ReportMarkedAsDuplicate",
  "ReportDuplicateLinkRemoved",
]);

export const reportEventVisibilityEnum = pgEnum("report_event_visibility", [
  "public",
  "internal",
]);

export const adminRoleEnum = pgEnum("admin_role", ["admin"]);

export const reportAttachmentTypeEnum = pgEnum("report_attachment_type", [
  "image",
]);

export const outboundCommunicationChannelEnum = pgEnum(
  "outbound_communication_channel",
  ["email", "pec"],
);

export const outboundCommunicationStatusEnum = pgEnum(
  "outbound_communication_status",
  ["draft", "sent", "delivered", "failed"],
);

export const newsPostStatusEnum = pgEnum("news_post_status", [
  "draft",
  "published",
]);

export const categories = pgTable(
  "categories",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    check("categories_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("categories_name_not_empty", sql`length(trim(${table.name})) > 0`),
    check("categories_slug_not_empty", sql`length(trim(${table.slug})) > 0`),
  ],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 512 }).notNull(),
    role: adminRoleEnum("role").notNull().default("admin"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_users_email_unique").on(table.email),
    index("admin_users_active_idx").on(table.active),
    check("admin_users_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("admin_users_email_not_empty", sql`length(trim(${table.email})) > 0`),
    check(
      "admin_users_email_normalized",
      sql`${table.email} = lower(trim(${table.email}))`,
    ),
    check(
      "admin_users_password_hash_not_empty",
      sql`length(trim(${table.passwordHash})) > 0`,
    ),
  ],
);

export const recipients = pgTable(
  "recipients",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    organization: varchar("organization", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }),
    pec: varchar("pec", { length: 320 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recipients_email_unique").on(table.email),
    uniqueIndex("recipients_pec_unique").on(table.pec),
    index("recipients_active_idx").on(table.active),
    check("recipients_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("recipients_name_not_empty", sql`length(trim(${table.name})) > 0`),
    check(
      "recipients_organization_not_empty",
      sql`length(trim(${table.organization})) > 0`,
    ),
    check(
      "recipients_email_normalized",
      sql`${table.email} is null or ${table.email} = lower(trim(${table.email}))`,
    ),
    check(
      "recipients_pec_normalized",
      sql`${table.pec} is null or ${table.pec} = lower(trim(${table.pec}))`,
    ),
    check(
      "recipients_contact_required",
      sql`${table.email} is not null or ${table.pec} is not null`,
    ),
  ],
);

export const categoryRecipients = pgTable(
  "category_recipients",
  {
    categoryId: varchar("category_id", { length: 64 })
      .notNull()
      .references(() => categories.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    recipientId: varchar("recipient_id", { length: 64 })
      .notNull()
      .references(() => recipients.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("category_recipients_category_recipient_unique").on(
      table.categoryId,
      table.recipientId,
    ),
    index("category_recipients_category_id_idx").on(table.categoryId),
    index("category_recipients_recipient_id_idx").on(table.recipientId),
    check(
      "category_recipients_sort_order_non_negative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
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
      .references(() => categories.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    address: varchar("address", { length: 500 }),
    source: reportSourceEnum("source").notNull().default("platform"),
    createdByAdminId: varchar("created_by_admin_id", { length: 64 }).references(
      () => adminUsers.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    duplicateOfReportId: varchar("duplicate_of_report_id", {
      length: 64,
    }).references((): AnyPgColumn => reports.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    publicStatus: publicReportStatusEnum("public_status"),
    moderationStatus: moderationStatusEnum("moderation_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    communicatedAt: timestamp("communicated_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("reports_public_code_unique").on(table.publicCode),
    index("reports_category_id_idx").on(table.categoryId),
    index("reports_created_by_admin_id_idx").on(table.createdByAdminId),
    index("reports_duplicate_of_report_id_idx").on(table.duplicateOfReportId),
    index("reports_public_status_idx").on(table.publicStatus),
    index("reports_moderation_status_idx").on(table.moderationStatus),
    check("reports_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check(
      "reports_public_code_format",
      sql`${table.publicCode} ~ '^VC-[0-9A-Z]{8}$'`,
    ),
    check("reports_title_not_empty", sql`length(trim(${table.title})) > 0`),
    check(
      "reports_description_not_empty",
      sql`length(trim(${table.description})) > 0`,
    ),
    check("reports_latitude_range", sql`${table.latitude} between -90 and 90`),
    check(
      "reports_longitude_range",
      sql`${table.longitude} between -180 and 180`,
    ),
    check(
      "reports_not_duplicate_of_self",
      sql`${table.duplicateOfReportId} is null or ${table.duplicateOfReportId} <> ${table.id}`,
    ),
    check(
      "reports_public_status_requires_approval",
      sql`(${table.moderationStatus} = 'approved' and ${table.publicStatus} is not null)
        or (${table.moderationStatus} <> 'approved' and ${table.publicStatus} is null)`,
    ),
    check(
      "reports_public_status_requires_published_at",
      sql`${table.publicStatus} is null or ${table.publishedAt} is not null`,
    ),
    check(
      "reports_communicated_or_resolved_requires_communicated_at",
      sql`${table.publicStatus} not in ('communicated', 'resolved') or ${table.communicatedAt} is not null`,
    ),
    check(
      "reports_resolved_requires_resolved_at",
      sql`${table.publicStatus} is distinct from 'resolved' or ${table.resolvedAt} is not null`,
    ),
  ],
);

export const reportEvents = pgTable(
  "report_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: reportEventTypeEnum("type").notNull(),
    visibility: reportEventVisibilityEnum("visibility").notNull(),
    publicStatus: publicReportStatusEnum("public_status"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("report_events_report_id_idx").on(table.reportId),
    index("report_events_visibility_idx").on(table.visibility),
    check("report_events_id_not_empty", sql`length(trim(${table.id})) > 0`),
  ],
);

export const reportAttachments = pgTable(
  "report_attachments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: reportAttachmentTypeEnum("type").notNull(),
    storageKey: varchar("storage_key", { length: 300 }).notNull(),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("report_attachments_report_id_unique").on(table.reportId),
    uniqueIndex("report_attachments_storage_key_unique").on(table.storageKey),
    index("report_attachments_report_id_idx").on(table.reportId),
    check(
      "report_attachments_id_not_empty",
      sql`length(trim(${table.id})) > 0`,
    ),
    check(
      "report_attachments_storage_key_not_empty",
      sql`length(trim(${table.storageKey})) > 0`,
    ),
    check(
      "report_attachments_mime_type_not_empty",
      sql`length(trim(${table.mimeType})) > 0`,
    ),
    check("report_attachments_size_positive", sql`${table.size} > 0`),
  ],
);

export const reportConfirmations = pgTable(
  "report_confirmations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    antiAbuseKey: varchar("anti_abuse_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("report_confirmations_report_anti_abuse_unique").on(
      table.reportId,
      table.antiAbuseKey,
    ),
    index("report_confirmations_report_id_idx").on(table.reportId),
    check(
      "report_confirmations_id_not_empty",
      sql`length(trim(${table.id})) > 0`,
    ),
    check(
      "report_confirmations_anti_abuse_key_not_empty",
      sql`length(trim(${table.antiAbuseKey})) > 0`,
    ),
  ],
);

export const outboundCommunications = pgTable(
  "outbound_communications",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    reportId: varchar("report_id", { length: 64 })
      .notNull()
      .references(() => reports.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    recipientId: varchar("recipient_id", { length: 64 }).references(
      () => recipients.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    recipientNameSnapshot: varchar("recipient_name_snapshot", {
      length: 160,
    }).notNull(),
    recipientOrganizationSnapshot: varchar("recipient_organization_snapshot", {
      length: 200,
    }).notNull(),
    recipientAddressSnapshot: varchar("recipient_address_snapshot", {
      length: 320,
    }).notNull(),
    channel: outboundCommunicationChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 240 }).notNull(),
    body: varchar("body", { length: 6000 }).notNull(),
    status: outboundCommunicationStatusEnum("status").notNull(),
    externalMessageId: varchar("external_message_id", { length: 320 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (table) => [
    index("outbound_communications_report_id_idx").on(table.reportId),
    index("outbound_communications_recipient_id_idx").on(table.recipientId),
    index("outbound_communications_status_idx").on(table.status),
    check(
      "outbound_communications_id_not_empty",
      sql`length(trim(${table.id})) > 0`,
    ),
    check(
      "outbound_communications_recipient_name_not_empty",
      sql`length(trim(${table.recipientNameSnapshot})) > 0`,
    ),
    check(
      "outbound_communications_recipient_organization_not_empty",
      sql`length(trim(${table.recipientOrganizationSnapshot})) > 0`,
    ),
    check(
      "outbound_communications_recipient_address_not_empty",
      sql`length(trim(${table.recipientAddressSnapshot})) > 0`,
    ),
    check(
      "outbound_communications_subject_not_empty",
      sql`length(trim(${table.subject})) > 0`,
    ),
    check(
      "outbound_communications_body_not_empty",
      sql`length(trim(${table.body})) > 0`,
    ),
    check(
      "outbound_communications_delivered_at_status",
      sql`${table.deliveredAt} is null or ${table.status} = 'delivered'`,
    ),
    check(
      "outbound_communications_failed_at_status",
      sql`${table.failedAt} is null or ${table.status} = 'failed'`,
    ),
    check(
      "outbound_communications_sent_at_required",
      sql`${table.status} not in ('sent', 'delivered') or ${table.sentAt} is not null`,
    ),
  ],
);
export const newsPosts = pgTable(
  "news_posts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    title: varchar("title", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    excerpt: varchar("excerpt", { length: 320 }),
    featuredImageUrl: varchar("featured_image_url", { length: 500 }),
    featuredImageAlt: varchar("featured_image_alt", { length: 180 }),
    content: varchar("content", { length: 12000 }).notNull(),
    contentJson: jsonb("content_json").notNull(),
    status: newsPostStatusEnum("status").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("news_posts_slug_unique").on(table.slug),
    index("news_posts_status_idx").on(table.status),
    index("news_posts_published_at_idx").on(table.publishedAt),
    check("news_posts_id_not_empty", sql`length(trim(${table.id})) > 0`),
    check("news_posts_title_not_empty", sql`length(trim(${table.title})) > 0`),
    check("news_posts_slug_not_empty", sql`length(trim(${table.slug})) > 0`),
    check(
      "news_posts_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "news_posts_content_not_empty",
      sql`length(trim(${table.content})) > 0`,
    ),
    check(
      "news_posts_content_json_object",
      sql`jsonb_typeof(${table.contentJson}) = 'object'`,
    ),
    check(
      "news_posts_featured_image_alt_required",
      sql`${table.featuredImageUrl} is null or length(trim(${table.featuredImageAlt})) > 0`,
    ),
    check(
      "news_posts_published_requires_published_at",
      sql`${table.status} <> 'published' or ${table.publishedAt} is not null`,
    ),
  ],
);

export type CategoryRecord = typeof categories.$inferSelect;
export type NewCategoryRecord = typeof categories.$inferInsert;
export type RecipientRecord = typeof recipients.$inferSelect;
export type NewRecipientRecord = typeof recipients.$inferInsert;
export type CategoryRecipientRecord = typeof categoryRecipients.$inferSelect;
export type NewCategoryRecipientRecord = typeof categoryRecipients.$inferInsert;
export type ReportRecord = typeof reports.$inferSelect;
export type NewReportRecord = typeof reports.$inferInsert;
export type ReportEventRecord = typeof reportEvents.$inferSelect;
export type NewReportEventRecord = typeof reportEvents.$inferInsert;
export type ReportAttachmentRecord = typeof reportAttachments.$inferSelect;
export type NewReportAttachmentRecord = typeof reportAttachments.$inferInsert;
export type ReportConfirmationRecord = typeof reportConfirmations.$inferSelect;
export type NewReportConfirmationRecord =
  typeof reportConfirmations.$inferInsert;
export type OutboundCommunicationRecord =
  typeof outboundCommunications.$inferSelect;
export type NewOutboundCommunicationRecord =
  typeof outboundCommunications.$inferInsert;
export type NewsPostRecord = typeof newsPosts.$inferSelect;
export type NewNewsPostRecord = typeof newsPosts.$inferInsert;
export type AdminUserRecord = typeof adminUsers.$inferSelect;
export type NewAdminUserRecord = typeof adminUsers.$inferInsert;
