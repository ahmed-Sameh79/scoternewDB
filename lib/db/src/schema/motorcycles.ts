import { pgTable, serial, text, integer, numeric, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { warehousesTable } from "./warehouses";
import { subcategoriesTable } from "./categories";
import { motorcycleBrandsTable, motorcycleSubcategoriesTable } from "./motorcycle-meta";

export const motorcycleStatusEnum = pgEnum("motorcycle_status", ["available", "sold", "in_service", "pre_owned"]);
export const motorcycleConditionEnum = pgEnum("motorcycle_condition", ["new", "used"]);

export const motorcyclesTable = pgTable("motorcycles", {
  id: serial("id").primaryKey(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  vin: text("vin"),
  color: text("color"),
  engineSize: text("engine_size"),
  mileage: integer("mileage"),
  condition: motorcycleConditionEnum("condition").notNull().default("new"),
  status: motorcycleStatusEnum("status").notNull().default("available"),
  brandId: integer("brand_id").references(() => motorcycleBrandsTable.id),
  motorcycleSubcategoryId: integer("motorcycle_subcategory_id").references(() => motorcycleSubcategoriesTable.id),
  subcategoryId: integer("subcategory_id").references(() => subcategoriesTable.id),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0"),
  imageUrl: text("image_url"),
  engineCc: integer("engine_cc"),
  topSpeed: integer("top_speed"),
  fuelCapacity: numeric("fuel_capacity", { precision: 5, scale: 2 }),
  weight: integer("weight"),
  seatHeight: integer("seat_height"),
  transmission: text("transmission"),
  fuelType: text("fuel_type"),
  features: text("features"),
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMotorcycleSchema = createInsertSchema(motorcyclesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMotorcycle = z.infer<typeof insertMotorcycleSchema>;
export type Motorcycle = typeof motorcyclesTable.$inferSelect;
