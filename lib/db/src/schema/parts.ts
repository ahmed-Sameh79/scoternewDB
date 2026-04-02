import { pgTable, serial, text, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { warehousesTable, binsTable } from "./warehouses";
import { subcategoriesTable } from "./categories";

export const partConditionEnum = pgEnum("part_condition", ["new", "used"]);

export const partsTable = pgTable("parts", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  condition: partConditionEnum("condition").notNull().default("new"),
  modelCompatibility: text("model_compatibility"),
  subcategoryId: integer("subcategory_id").references(() => subcategoriesTable.id),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(5),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0"),
  imageUrl: text("image_url"),
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  binId: integer("bin_id").references(() => binsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPartSchema = createInsertSchema(partsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof partsTable.$inferSelect;
