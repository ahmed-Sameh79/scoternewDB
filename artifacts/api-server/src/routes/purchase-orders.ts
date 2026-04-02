import { Router } from "express";
import { db } from "@workspace/db";
import { purchaseOrdersTable, purchaseOrderLinesTable, vendorsTable, partsTable, poStatusEnum } from "@workspace/db/schema";
import { eq, and, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextPoNumber } from "../lib/counter";

const router = Router();

router.get("/purchase-orders", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, vendorId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    const poValidStatuses = poStatusEnum.enumValues;
    if (status && poValidStatuses.includes(status as typeof poValidStatuses[number])) {
      conditions.push(eq(purchaseOrdersTable.status, status as typeof poValidStatuses[number]));
    }
    if (vendorId) conditions.push(eq(purchaseOrdersTable.vendorId, parseInt(vendorId)));

    const pos = await db
      .select({ id: purchaseOrdersTable.id, poNumber: purchaseOrdersTable.poNumber, vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name, status: purchaseOrdersTable.status, totalAmount: purchaseOrdersTable.totalAmount, notes: purchaseOrdersTable.notes, orderedAt: purchaseOrdersTable.orderedAt, createdBy: purchaseOrdersTable.createdBy, createdAt: purchaseOrdersTable.createdAt })
      .from(purchaseOrdersTable)
      .leftJoin(vendorsTable, eq(purchaseOrdersTable.vendorId, vendorsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(purchaseOrdersTable.createdAt);
    res.json(pos);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/purchase-orders", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { vendorId, notes, lines } = req.body;
    if (!vendorId || !lines?.length) { res.status(400).json({ error: "Bad Request", message: "vendorId and lines required" }); return; }

    let totalAmount = 0;
    for (const line of lines) totalAmount += (line.quantity || 0) * (line.unitCost || 0);

    const poNumber = await nextPoNumber();
    const [po] = await db.insert(purchaseOrdersTable).values({
      poNumber,
      vendorId,
      notes,
      totalAmount: totalAmount.toString(),
      createdBy: req.user!.id,
    }).returning();

    for (const line of lines) {
      await db.insert(purchaseOrderLinesTable).values({
        purchaseOrderId: po.id,
        partId: line.partId,
        quantity: line.quantity,
        unitCost: line.unitCost.toString(),
        totalCost: (line.quantity * line.unitCost).toString(),
      });
    }
    await logAudit(req, "create", "purchase_orders", po.id, null, { poNumber: po.poNumber, vendorId });
    res.status(201).json(po);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/purchase-orders/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [po] = await db
      .select({ id: purchaseOrdersTable.id, poNumber: purchaseOrdersTable.poNumber, vendorId: purchaseOrdersTable.vendorId, vendorName: vendorsTable.name, status: purchaseOrdersTable.status, totalAmount: purchaseOrdersTable.totalAmount, notes: purchaseOrdersTable.notes, orderedAt: purchaseOrdersTable.orderedAt, createdBy: purchaseOrdersTable.createdBy, createdAt: purchaseOrdersTable.createdAt })
      .from(purchaseOrdersTable)
      .leftJoin(vendorsTable, eq(purchaseOrdersTable.vendorId, vendorsTable.id))
      .where(eq(purchaseOrdersTable.id, id));
    if (!po) { res.status(404).json({ error: "Not Found" }); return; }

    const lines = await db
      .select({ id: purchaseOrderLinesTable.id, purchaseOrderId: purchaseOrderLinesTable.purchaseOrderId, partId: purchaseOrderLinesTable.partId, partSku: partsTable.sku, partName: partsTable.name, quantity: purchaseOrderLinesTable.quantity, unitCost: purchaseOrderLinesTable.unitCost, totalCost: purchaseOrderLinesTable.totalCost })
      .from(purchaseOrderLinesTable)
      .leftJoin(partsTable, eq(purchaseOrderLinesTable.partId, partsTable.id))
      .where(eq(purchaseOrderLinesTable.purchaseOrderId, id));
    res.json({ ...po, lines });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/purchase-orders/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { notes, status } = req.body;
    const [po] = await db.update(purchaseOrdersTable).set({ notes, status, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
    await logAudit(req, "update", "purchase_orders", id, before, po);
    res.json(po);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/purchase-orders/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
    if (!po) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, id));
    await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
    await logAudit(req, "delete", "purchase_orders", id, po, null);
    res.json({ message: "Purchase order deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/purchase-orders/:id/confirm", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const [po] = await db.update(purchaseOrdersTable).set({ status: "ordered", orderedAt: new Date(), updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
    await logAudit(req, "update", "purchase_orders", id, { status: before.status }, { status: "ordered", action: "confirmed" });
    res.json(po);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
