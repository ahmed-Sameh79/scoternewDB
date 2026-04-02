import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { purchaseOrdersTable } from "./purchase-orders";
import { partsTable } from "./parts";
import { binsTable } from "./warehouses";
import { usersTable } from "./users";

export const grnTable = pgTable("grn", {
  id: serial("id").primaryKey(),
  grnNumber: text("grn_number").notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrdersTable.id),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  receivedBy: integer("received_by").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const grnLinesTable = pgTable("grn_lines", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull().references(() => grnTable.id),
  partId: integer("part_id").notNull().references(() => partsTable.id),
  quantityReceived: integer("quantity_received").notNull(),
  binId: integer("bin_id").references(() => binsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGrnSchema = createInsertSchema(grnTable).omit({ id: true, createdAt: true });
export const insertGrnLineSchema = createInsertSchema(grnLinesTable).omit({ id: true, createdAt: true });
export type InsertGrn = z.infer<typeof insertGrnSchema>;
export type InsertGrnLine = z.infer<typeof insertGrnLineSchema>;
export type Grn = typeof grnTable.$inferSelect;
export type GrnLine = typeof grnLinesTable.$inferSelect;
