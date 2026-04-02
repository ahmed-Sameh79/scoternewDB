import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, invoiceLinesTable, workOrdersTable, partsTable, motorcyclesTable, returnsTable, invoiceStatusEnum } from "@workspace/db/schema";
import { eq, and, SQL, sql } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextInvoiceNumber, nextReturnNumber } from "../lib/counter";

const router = Router();

router.get("/invoices", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, customerId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    const invValidStatuses = invoiceStatusEnum.enumValues;
    if (status && invValidStatuses.includes(status as typeof invValidStatuses[number])) {
      conditions.push(eq(invoicesTable.status, status as typeof invValidStatuses[number]));
    }

    const invs = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        customerName: invoicesTable.customerName,
        customerPhone: invoicesTable.customerPhone,
        workOrderId: invoicesTable.workOrderId,
        woNumber: workOrdersTable.woNumber,
        status: invoicesTable.status,
        subtotal: invoicesTable.subtotal,
        taxAmount: invoicesTable.taxAmount,
        totalAmount: invoicesTable.totalAmount,
        paymentMethod: invoicesTable.paymentMethod,
        createdBy: invoicesTable.createdBy,
        createdAt: invoicesTable.createdAt,
      })
      .from(invoicesTable)
      .leftJoin(workOrdersTable, eq(invoicesTable.workOrderId, workOrdersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(invoicesTable.createdAt);
    res.json(invs);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/invoices", requireRole("admin", "sales"), async (req: AuthRequest, res) => {
  try {
    const { customerName, customerPhone, workOrderId, lines, paymentMethod, taxRate } = req.body;
    if (!customerName || !lines?.length) { res.status(400).json({ error: "Bad Request", message: "customerName and lines required" }); return; }

    let subtotal = 0;
    for (const line of lines) subtotal += (line.quantity || 0) * (line.unitPrice || 0);
    const taxAmount = subtotal * ((taxRate ?? 0) / 100);
    const totalAmount = subtotal + taxAmount;
    const invoiceNumber = await nextInvoiceNumber();

    const inv = await db.transaction(async (tx) => {
      const [newInv] = await tx.insert(invoicesTable).values({
        invoiceNumber,
        customerName,
        customerPhone,
        workOrderId,
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paymentMethod,
        createdBy: req.user!.id,
      }).returning();

      for (const line of lines) {
        await tx.insert(invoiceLinesTable).values({
          invoiceId: newInv.id,
          partId: line.partId ?? null,
          motorcycleId: line.motorcycleId ?? null,
          description: line.description ?? "",
          quantity: line.quantity,
          unitPrice: line.unitPrice.toString(),
          totalPrice: (line.quantity * line.unitPrice).toString(),
        });
        if (line.partId) {
          const [part] = await tx.select({ qty: partsTable.quantityOnHand }).from(partsTable).where(eq(partsTable.id, line.partId));
          if (!part || part.qty < line.quantity) {
            throw new Error(`Insufficient stock for part ID ${line.partId}: available ${part?.qty ?? 0}, requested ${line.quantity}`);
          }
          await tx.update(partsTable).set({
            quantityOnHand: sql`${partsTable.quantityOnHand} - ${line.quantity}`,
            updatedAt: new Date(),
          }).where(eq(partsTable.id, line.partId));
        }
        if (line.motorcycleId) {
          await tx.update(motorcyclesTable).set({ status: "sold", updatedAt: new Date() }).where(eq(motorcyclesTable.id, line.motorcycleId));
        }
      }

      if (workOrderId) {
        await tx.update(workOrdersTable).set({ status: "invoiced", updatedAt: new Date() }).where(eq(workOrdersTable.id, workOrderId));
      }
      return newInv;
    });

    await logAudit(req, "create", "invoices", inv.id, null, { invoiceNumber: inv.invoiceNumber, customerName });
    res.status(201).json(inv);
  } catch (err: unknown) {
    const getStockMsg = (e: unknown): string => {
      if (!(e instanceof Error)) return "";
      if (e.message.startsWith("Insufficient stock")) return e.message;
      const cause = (e as Error & { cause?: unknown }).cause;
      if (cause instanceof Error && cause.message.startsWith("Insufficient stock")) return cause.message;
      return "";
    };
    const stockMsg = getStockMsg(err);
    if (stockMsg) {
      res.status(422).json({ error: "Insufficient Stock", message: stockMsg });
      return;
    }
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [inv] = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        customerName: invoicesTable.customerName,
        customerPhone: invoicesTable.customerPhone,
        workOrderId: invoicesTable.workOrderId,
        woNumber: workOrdersTable.woNumber,
        status: invoicesTable.status,
        subtotal: invoicesTable.subtotal,
        taxAmount: invoicesTable.taxAmount,
        totalAmount: invoicesTable.totalAmount,
        paymentMethod: invoicesTable.paymentMethod,
        qrCode: invoicesTable.qrCode,
        createdBy: invoicesTable.createdBy,
        createdAt: invoicesTable.createdAt,
      })
      .from(invoicesTable)
      .leftJoin(workOrdersTable, eq(invoicesTable.workOrderId, workOrdersTable.id))
      .where(eq(invoicesTable.id, id));
    if (!inv) { res.status(404).json({ error: "Not Found" }); return; }

    const lines = await db
      .select({ id: invoiceLinesTable.id, invoiceId: invoiceLinesTable.invoiceId, partId: invoiceLinesTable.partId, partName: partsTable.name, motorcycleId: invoiceLinesTable.motorcycleId, description: invoiceLinesTable.description, quantity: invoiceLinesTable.quantity, unitPrice: invoiceLinesTable.unitPrice, totalPrice: invoiceLinesTable.totalPrice })
      .from(invoiceLinesTable)
      .leftJoin(partsTable, eq(invoiceLinesTable.partId, partsTable.id))
      .where(eq(invoiceLinesTable.invoiceId, id));
    res.json({ ...inv, lines });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/invoices/:id", requireRole("admin", "sales"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { status, paymentMethod } = req.body;
    const [inv] = await db.update(invoicesTable).set({ status, paymentMethod, updatedAt: new Date() }).where(eq(invoicesTable.id, id)).returning();
    await logAudit(req, "update", "invoices", id, before, inv);
    res.json(inv);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Returns
router.get("/returns", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rets = await db
      .select({ id: returnsTable.id, returnNumber: returnsTable.returnNumber, invoiceId: returnsTable.invoiceId, invoiceNumber: invoicesTable.invoiceNumber, reason: returnsTable.reason, refundAmount: returnsTable.refundAmount, createdBy: returnsTable.createdBy, createdAt: returnsTable.createdAt })
      .from(returnsTable)
      .leftJoin(invoicesTable, eq(returnsTable.invoiceId, invoicesTable.id))
      .orderBy(returnsTable.createdAt);
    res.json(rets);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/returns", requireRole("admin", "sales"), async (req: AuthRequest, res) => {
  try {
    const { invoiceId, reason, refundAmount } = req.body;
    if (!invoiceId || !reason || !refundAmount) { res.status(400).json({ error: "Bad Request", message: "invoiceId, reason, refundAmount required" }); return; }

    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    if (!invoice) { res.status(404).json({ error: "Not Found", message: "Invoice not found" }); return; }
    if (invoice.status === "returned") {
      res.status(422).json({ error: "Already Returned", message: "A return has already been processed for this invoice" });
      return;
    }
    if (invoice.status !== "paid") {
      res.status(422).json({ error: "Invalid State", message: `Cannot return invoice with status '${invoice.status}'. Only paid invoices can be returned.` });
      return;
    }

    const lines = await db.select().from(invoiceLinesTable).where(eq(invoiceLinesTable.invoiceId, invoiceId));
    const returnNumber = await nextReturnNumber();

    const ret = await db.transaction(async (tx) => {
      const [newRet] = await tx.insert(returnsTable).values({
        returnNumber,
        invoiceId,
        reason,
        refundAmount: refundAmount.toString(),
        createdBy: req.user!.id,
      }).returning();

      for (const line of lines) {
        if (line.partId) {
          await tx.update(partsTable).set({
            quantityOnHand: sql`${partsTable.quantityOnHand} + ${line.quantity}`,
            updatedAt: new Date(),
          }).where(eq(partsTable.id, line.partId));
        }
        if (line.motorcycleId) {
          await tx.update(motorcyclesTable).set({ status: "available", updatedAt: new Date() }).where(eq(motorcyclesTable.id, line.motorcycleId));
        }
      }

      await tx.update(invoicesTable).set({ status: "returned", updatedAt: new Date() }).where(eq(invoicesTable.id, invoiceId));
      return newRet;
    });

    await logAudit(req, "create", "returns", ret.id, null, { returnNumber: ret.returnNumber, invoiceId, linesRestored: lines.length });
    res.status(201).json(ret);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/returns/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [ret] = await db
      .select({ id: returnsTable.id, returnNumber: returnsTable.returnNumber, invoiceId: returnsTable.invoiceId, invoiceNumber: invoicesTable.invoiceNumber, reason: returnsTable.reason, refundAmount: returnsTable.refundAmount, createdBy: returnsTable.createdBy, createdAt: returnsTable.createdAt })
      .from(returnsTable)
      .leftJoin(invoicesTable, eq(returnsTable.invoiceId, invoicesTable.id))
      .where(eq(returnsTable.id, id));
    if (!ret) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(ret);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
