import { Router } from "express";
import { db } from "@workspace/db";
import { grnTable, grnLinesTable, purchaseOrdersTable, vendorsTable, partsTable, binsTable, usersTable } from "@workspace/db/schema";
import { eq, and, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextGrnNumber } from "../lib/counter";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/grn", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { purchaseOrderId } = req.query as { purchaseOrderId?: string };
    const conditions: SQL[] = [];
    if (purchaseOrderId) conditions.push(eq(grnTable.purchaseOrderId, parseInt(purchaseOrderId)));

    const grns = await db
      .select({ id: grnTable.id, grnNumber: grnTable.grnNumber, purchaseOrderId: grnTable.purchaseOrderId, poNumber: purchaseOrdersTable.poNumber, vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name, receivedAt: grnTable.receivedAt, receivedBy: grnTable.receivedBy, receivedByName: usersTable.fullName, notes: grnTable.notes, createdAt: grnTable.createdAt })
      .from(grnTable)
      .leftJoin(purchaseOrdersTable, eq(grnTable.purchaseOrderId, purchaseOrdersTable.id))
      .leftJoin(vendorsTable, eq(purchaseOrdersTable.vendorId, vendorsTable.id))
      .leftJoin(usersTable, eq(grnTable.receivedBy, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(grnTable.createdAt);
    res.json(grns);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/grn", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { purchaseOrderId, notes, lines } = req.body;
    if (!purchaseOrderId || !lines?.length) { res.status(400).json({ error: "Bad Request", message: "purchaseOrderId and lines required" }); return; }

    const grnNumber = await nextGrnNumber();
    const grn = await db.transaction(async (tx) => {
      const [newGrn] = await tx.insert(grnTable).values({
        grnNumber,
        purchaseOrderId,
        receivedBy: req.user!.id,
        notes,
      }).returning();

      for (const line of lines) {
        await tx.insert(grnLinesTable).values({
          grnId: newGrn.id,
          partId: line.partId,
          quantityReceived: line.quantityReceived,
          binId: line.binId ?? null,
        });
        await tx.update(partsTable).set({
          quantityOnHand: sql`${partsTable.quantityOnHand} + ${line.quantityReceived}`,
          updatedAt: new Date(),
        }).where(eq(partsTable.id, line.partId));
      }

      await tx.update(purchaseOrdersTable).set({ status: "partially_received", updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, purchaseOrderId));
      return newGrn;
    });

    await logAudit(req, "create", "grn", grn.id, null, { grnNumber: grn.grnNumber, purchaseOrderId });
    res.status(201).json(grn);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/grn/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [grn] = await db
      .select({ id: grnTable.id, grnNumber: grnTable.grnNumber, purchaseOrderId: grnTable.purchaseOrderId, poNumber: purchaseOrdersTable.poNumber, vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name, receivedAt: grnTable.receivedAt, receivedBy: grnTable.receivedBy, notes: grnTable.notes, createdAt: grnTable.createdAt })
      .from(grnTable)
      .leftJoin(purchaseOrdersTable, eq(grnTable.purchaseOrderId, purchaseOrdersTable.id))
      .leftJoin(vendorsTable, eq(purchaseOrdersTable.vendorId, vendorsTable.id))
      .where(eq(grnTable.id, id));
    if (!grn) { res.status(404).json({ error: "Not Found" }); return; }

    const lines = await db
      .select({ id: grnLinesTable.id, grnId: grnLinesTable.grnId, partId: grnLinesTable.partId, partSku: partsTable.sku, partName: partsTable.name, quantityReceived: grnLinesTable.quantityReceived, binId: grnLinesTable.binId, binLabel: binsTable.label })
      .from(grnLinesTable)
      .leftJoin(partsTable, eq(grnLinesTable.partId, partsTable.id))
      .leftJoin(binsTable, eq(grnLinesTable.binId, binsTable.id))
      .where(eq(grnLinesTable.grnId, id));
    res.json({ ...grn, lines });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
