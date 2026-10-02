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
