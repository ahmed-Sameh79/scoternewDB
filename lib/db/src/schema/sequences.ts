import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const documentSequencesTable = pgTable("document_sequences", {
  id: serial("id").primaryKey(),
  prefix: text("prefix").notNull().unique(),
  lastValue: integer("last_value").notNull().default(0),
});
