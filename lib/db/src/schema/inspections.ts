import { pgTable, serial, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { motorcyclesTable } from "./motorcycles";
import { usersTable } from "./users";

export const inspectionGradeEnum = pgEnum("inspection_grade", ["excellent", "good", "fair", "poor"]);

export const inspectionsTable = pgTable("inspections", {
  id: serial("id").primaryKey(),
  motorcycleId: integer("motorcycle_id").notNull().references(() => motorcyclesTable.id),
  inspectorId: integer("inspector_id").references(() => usersTable.id),
  overallGrade: inspectionGradeEnum("overall_grade").notNull(),
  engineCondition: text("engine_condition"),
  bodyCondition: text("body_condition"),
  electricalCondition: text("electrical_condition"),
  tiresCondition: text("tires_condition"),
  brakeCondition: text("brake_condition"),
  notes: text("notes"),
  imageUrls: text("image_urls").array(),
  isCertified: boolean("is_certified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspectionsTable.$inferSelect;
