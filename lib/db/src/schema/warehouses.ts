import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const zonesTable = pgTable("zones", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aislesTable = pgTable("aisles", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shelvesTable = pgTable("shelves", {
  id: serial("id").primaryKey(),
  aisleId: integer("aisle_id").notNull().references(() => aislesTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const binsTable = pgTable("bins", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  shelfId: integer("shelf_id").references(() => shelvesTable.id),
  zone: text("zone").notNull(),
  aisle: text("aisle").notNull(),
  shelf: text("shelf").notNull(),
  bin: text("bin").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertZoneSchema = createInsertSchema(zonesTable).omit({ id: true, createdAt: true });
export const insertAisleSchema = createInsertSchema(aislesTable).omit({ id: true, createdAt: true });
export const insertShelfSchema = createInsertSchema(shelvesTable).omit({ id: true, createdAt: true });
export const insertBinSchema = createInsertSchema(binsTable).omit({ id: true, createdAt: true });

export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type InsertAisle = z.infer<typeof insertAisleSchema>;
export type InsertShelf = z.infer<typeof insertShelfSchema>;
export type InsertBin = z.infer<typeof insertBinSchema>;
export type Warehouse = typeof warehousesTable.$inferSelect;
export type Zone = typeof zonesTable.$inferSelect;
export type Aisle = typeof aislesTable.$inferSelect;
export type Shelf = typeof shelvesTable.$inferSelect;
export type Bin = typeof binsTable.$inferSelect;
