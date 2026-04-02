import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const motorcycleCategoriesTable = pgTable("motorcycle_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const motorcycleSubcategoriesTable = pgTable("motorcycle_subcategories", {
  id: serial("id").primaryKey(),
  motorcycleCategoryId: integer("motorcycle_category_id").notNull().references(() => motorcycleCategoriesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const motorcycleBrandsTable = pgTable("motorcycle_brands", {
  id: serial("id").primaryKey(),
  motorcycleCategoryId: integer("motorcycle_category_id").references(() => motorcycleCategoriesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
