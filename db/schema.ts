import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const investigations = sqliteTable("investigations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  data: text("data").notNull(),
}, (table) => [index("investigations_owner_created").on(table.userId, table.createdAt)]);

export const investigationEvents = sqliteTable("investigation_events", {
  investigationId: text("investigation_id").notNull().references(() => investigations.id),
  sequence: integer("sequence").notNull(),
  data: text("data").notNull(),
}, (table) => [primaryKey({ columns: [table.investigationId, table.sequence] })]);

export const planEntitlements = sqliteTable("plan_entitlements", {
  subscriptionId: text("subscription_id").primaryKey(),
  userId: text("user_id").notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  data: text("data").notNull(),
}, (table) => [index("plan_entitlements_owner").on(table.userId, table.eventTimestamp)]);
export const planUsage = sqliteTable("plan_usage", {
  userId: text("user_id").notNull(),
  period: text("period").notNull(),
  email: text("email").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.period] })]);
export const planSync = sqliteTable("plan_sync", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  syncedAt: text("synced_at").notNull(),
});
