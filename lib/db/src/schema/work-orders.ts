import { pgTable, serial, text, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { motorcyclesTable } from "./motorcycles";
import { usersTable } from "./users";
import { partsTable } from "./parts";
import { binsTable } from "./warehouses";

export const workOrderStatusEnum = pgEnum("work_order_status", ["draft", "parts_reserved", "ready_for_invoice", "invoiced", "cancelled"]);

export const workOrdersTable = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  woNumber: text("wo_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  motorcycleId: integer("motorcycle_id").references(() => motorcyclesTable.id),
  description: text("description").notNull(),
  status: workOrderStatusEnum("status").notNull().default("draft"),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  laborCost: numeric("labor_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPartsCost: numeric("total_parts_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workOrderLinesTable = pgTable("work_order_lines", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => workOrdersTable.id),
  partId: integer("part_id").notNull().references(() => partsTable.id),
  binId: integer("bin_id").references(() => binsTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWorkOrderSchema = createInsertSchema(workOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkOrderLineSchema = createInsertSchema(workOrderLinesTable).omit({ id: true, createdAt: true });
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type InsertWorkOrderLine = z.infer<typeof insertWorkOrderLineSchema>;
export type WorkOrder = typeof workOrdersTable.$inferSelect;
export type WorkOrderLine = typeof workOrderLinesTable.$inferSelect;
