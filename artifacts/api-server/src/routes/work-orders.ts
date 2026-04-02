import { Router } from "express";
import { db } from "@workspace/db";
import { workOrdersTable, workOrderLinesTable, motorcyclesTable, usersTable, partsTable, binsTable, workOrderStatusEnum } from "@workspace/db/schema";
import { eq, and, SQL, sql, lte } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextWoNumber } from "../lib/counter";

const router = Router();

router.get("/work-orders", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, assignedTo, stale } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    const woValidStatuses = workOrderStatusEnum.enumValues;
    if (status && woValidStatuses.includes(status as typeof woValidStatuses[number])) {
      conditions.push(eq(workOrdersTable.status, status as typeof woValidStatuses[number]));
    }
    if (assignedTo) conditions.push(eq(workOrdersTable.assignedTo, parseInt(assignedTo)));
    if (stale === "true") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      conditions.push(lte(workOrdersTable.updatedAt, sevenDaysAgo));
    }

    const wos = await db
      .select({
        id: workOrdersTable.id,
        woNumber: workOrdersTable.woNumber,
        customerName: workOrdersTable.customerName,
        customerPhone: workOrdersTable.customerPhone,
        motorcycleId: workOrdersTable.motorcycleId,
        motorcycleName: sql<string>`concat(${motorcyclesTable.year}, ' ', ${motorcyclesTable.make}, ' ', ${motorcyclesTable.model})`,
        description: workOrdersTable.description,
        status: workOrdersTable.status,
        assignedTo: workOrdersTable.assignedTo,
        assignedToName: usersTable.fullName,
        laborCost: workOrdersTable.laborCost,
        totalPartsCost: workOrdersTable.totalPartsCost,
        createdBy: workOrdersTable.createdBy,
        createdAt: workOrdersTable.createdAt,
        updatedAt: workOrdersTable.updatedAt,
      })
      .from(workOrdersTable)
      .leftJoin(motorcyclesTable, eq(workOrdersTable.motorcycleId, motorcyclesTable.id))
      .leftJoin(usersTable, eq(workOrdersTable.assignedTo, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(workOrdersTable.createdAt);
    res.json(wos);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/work-orders", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const { customerName, customerPhone, motorcycleId, description, assignedTo, laborCost, lines } = req.body;
    if (!customerName || !description) { res.status(400).json({ error: "Bad Request", message: "customerName and description required" }); return; }

    let totalPartsCost = 0;
    if (lines) for (const line of lines) totalPartsCost += (line.quantity || 0) * (line.unitPrice || 0);

    const woNumber = await nextWoNumber();

    const wo = await db.transaction(async (tx) => {
      const [newWo] = await tx.insert(workOrdersTable).values({
        woNumber,
        customerName,
        customerPhone,
        motorcycleId,
        description,
        assignedTo,
        laborCost: laborCost?.toString() ?? "0",
        totalPartsCost: totalPartsCost.toString(),
        createdBy: req.user!.id,
      }).returning();

      if (lines && lines.length > 0) {
        for (const line of lines) {
          const [part] = await tx.select({ qty: partsTable.quantityOnHand }).from(partsTable).where(eq(partsTable.id, line.partId));
          if (!part || part.qty < line.quantity) {
            throw new Error(`Insufficient stock for part ID ${line.partId}: available ${part?.qty ?? 0}, requested ${line.quantity}`);
          }
          await tx.insert(workOrderLinesTable).values({
            workOrderId: newWo.id,
            partId: line.partId,
            binId: line.binId ?? null,
            quantity: line.quantity,
            unitPrice: line.unitPrice.toString(),
            totalPrice: (line.quantity * line.unitPrice).toString(),
          });
          await tx.update(partsTable).set({
            quantityOnHand: sql`${partsTable.quantityOnHand} - ${line.quantity}`,
            updatedAt: new Date(),
          }).where(eq(partsTable.id, line.partId));
        }
        await tx.update(workOrdersTable).set({ status: "parts_reserved", updatedAt: new Date() }).where(eq(workOrdersTable.id, newWo.id));
      }

      return newWo;
    });

    await logAudit(req, "create", "work_orders", wo.id, null, { woNumber: wo.woNumber, customerName });
    res.status(201).json(wo);
  } catch (err: unknown) {
    const getMsg = (e: unknown): string => {
      if (!(e instanceof Error)) return "";
      if (e.message.startsWith("Insufficient stock")) return e.message;
      const cause = (e as Error & { cause?: unknown }).cause;
      if (cause instanceof Error && cause.message.startsWith("Insufficient stock")) return cause.message;
      return "";
    };
    const stockMsg = getMsg(err);
    if (stockMsg) {
      res.status(422).json({ error: "Insufficient Stock", message: stockMsg });
      return;
    }
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/work-orders/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [wo] = await db
      .select({
        id: workOrdersTable.id,
        woNumber: workOrdersTable.woNumber,
        customerName: workOrdersTable.customerName,
        customerPhone: workOrdersTable.customerPhone,
        motorcycleId: workOrdersTable.motorcycleId,
        motorcycleName: sql<string>`concat(${motorcyclesTable.year}, ' ', ${motorcyclesTable.make}, ' ', ${motorcyclesTable.model})`,
        description: workOrdersTable.description,
        status: workOrdersTable.status,
        assignedTo: workOrdersTable.assignedTo,
        assignedToName: usersTable.fullName,
        laborCost: workOrdersTable.laborCost,
        totalPartsCost: workOrdersTable.totalPartsCost,
        createdBy: workOrdersTable.createdBy,
        createdAt: workOrdersTable.createdAt,
        updatedAt: workOrdersTable.updatedAt,
      })
      .from(workOrdersTable)
      .leftJoin(motorcyclesTable, eq(workOrdersTable.motorcycleId, motorcyclesTable.id))
      .leftJoin(usersTable, eq(workOrdersTable.assignedTo, usersTable.id))
      .where(eq(workOrdersTable.id, id));
    if (!wo) { res.status(404).json({ error: "Not Found" }); return; }

    const lines = await db
      .select({ id: workOrderLinesTable.id, workOrderId: workOrderLinesTable.workOrderId, partId: workOrderLinesTable.partId, partSku: partsTable.sku, partName: partsTable.name, binId: workOrderLinesTable.binId, binLabel: binsTable.label, quantity: workOrderLinesTable.quantity, unitPrice: workOrderLinesTable.unitPrice, totalPrice: workOrderLinesTable.totalPrice })
      .from(workOrderLinesTable)
      .leftJoin(partsTable, eq(workOrderLinesTable.partId, partsTable.id))
      .leftJoin(binsTable, eq(workOrderLinesTable.binId, binsTable.id))
      .where(eq(workOrderLinesTable.workOrderId, id));
    res.json({ ...wo, lines });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/work-orders/:id", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["customerName", "customerPhone", "motorcycleId", "description", "status", "assignedTo"] as const;
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.laborCost !== undefined) updates.laborCost = req.body.laborCost.toString();
    const [wo] = await db.update(workOrdersTable).set(updates).where(eq(workOrdersTable.id, id)).returning();
    await logAudit(req, "update", "work_orders", id, before, wo);
    res.json(wo);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const VALID_WO_TRANSITIONS: Record<string, string[]> = {
  draft: ["parts_reserved", "cancelled"],
  parts_reserved: ["ready_for_invoice", "draft", "cancelled"],
  ready_for_invoice: ["invoiced", "parts_reserved", "cancelled"],
  invoiced: [],
  cancelled: [],
};

router.patch("/work-orders/:id/status", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status } = req.body;
    const patchValidStatuses = workOrderStatusEnum.enumValues;
    if (!status || !patchValidStatuses.includes(status as typeof patchValidStatuses[number])) {
      res.status(400).json({ error: "Bad Request", message: `status must be one of: ${patchValidStatuses.join(", ")}` });
      return;
    }
    const typedStatus = status as typeof patchValidStatuses[number];
    const [before] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }

    const allowedNext = VALID_WO_TRANSITIONS[before.status] ?? [];
    if (!allowedNext.includes(typedStatus)) {
      res.status(422).json({ error: "Invalid Transition", message: `Cannot move from '${before.status}' to '${typedStatus}'. Allowed: ${allowedNext.join(", ") || "none"}` });
      return;
    }

    const [wo] = await db.update(workOrdersTable).set({ status: typedStatus, updatedAt: new Date() }).where(eq(workOrdersTable.id, id)).returning();
    await logAudit(req, "update", "work_orders", id, { status: before.status }, { status });
    res.json(wo);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/work-orders/:id", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
    if (!wo) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(workOrderLinesTable).where(eq(workOrderLinesTable.workOrderId, id));
    await db.delete(workOrdersTable).where(eq(workOrdersTable.id, id));
    await logAudit(req, "delete", "work_orders", id, wo, null);
    res.json({ message: "Work order deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
