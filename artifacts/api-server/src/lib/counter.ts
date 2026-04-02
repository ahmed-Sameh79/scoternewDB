import { db } from "@workspace/db";
import { documentSequencesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

async function nextSeq(prefix: string, padLen = 4): Promise<string> {
  const [row] = await db
    .insert(documentSequencesTable)
    .values({ prefix, lastValue: 1 })
    .onConflictDoUpdate({
      target: documentSequencesTable.prefix,
      set: { lastValue: sql`${documentSequencesTable.lastValue} + 1` },
    })
    .returning({ lastValue: documentSequencesTable.lastValue });
  return `${prefix}-${String(row.lastValue).padStart(padLen, "0")}`;
}

export const nextPoNumber = () => nextSeq("PO");
export const nextGrnNumber = () => nextSeq("GRN");
export const nextWoNumber = () => nextSeq("WO");
export const nextInvoiceNumber = () => nextSeq("INV");
export const nextReturnNumber = () => nextSeq("RET");

export function initCounters() {}
