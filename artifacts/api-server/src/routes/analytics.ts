import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, partsTable, motorcyclesTable, workOrdersTable, purchaseOrdersTable, invoiceLinesTable } from "@workspace/db/schema";
import { eq, sql, gte, lte, and } from "drizzle-orm";
import type { AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/analytics/dashboard", async (req: AuthRequest, res) => {
  try {
    const [revenueResult] = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${invoicesTable.totalAmount}), 0)`,
      invoiceCount: sql<number>`COUNT(*)::int`,
    }).from(invoicesTable).where(eq(invoicesTable.status, "paid"));

    const [pendingWO] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(workOrdersTable).where(
      sql`${workOrdersTable.status} NOT IN ('invoiced', 'cancelled')`
    );

    const [lowStockCount] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(partsTable).where(
      sql`${partsTable.quantityOnHand} <= ${partsTable.reorderPoint}`
    );

    const [availableMotos] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(motorcyclesTable).where(eq(motorcyclesTable.status, "available"));

    const [pendingPO] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(purchaseOrdersTable).where(
      sql`${purchaseOrdersTable.status} IN ('draft', 'ordered', 'partially_received')`
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleWorkOrders = await db.select({
      id: workOrdersTable.id,
      woNumber: workOrdersTable.woNumber,
      customerName: workOrdersTable.customerName,
      status: workOrdersTable.status,
      updatedAt: workOrdersTable.updatedAt,
    }).from(workOrdersTable).where(
      sql`${workOrdersTable.status} NOT IN ('invoiced', 'cancelled') AND ${workOrdersTable.updatedAt} < ${sevenDaysAgo}`
    ).orderBy(workOrdersTable.updatedAt).limit(5);

    const lowStockParts = await db.select({
      id: partsTable.id,
      sku: partsTable.sku,
      name: partsTable.name,
      quantityOnHand: partsTable.quantityOnHand,
      reorderPoint: partsTable.reorderPoint,
    }).from(partsTable).where(
      sql`${partsTable.quantityOnHand} <= ${partsTable.reorderPoint}`
    ).orderBy(sql`${partsTable.quantityOnHand} - ${partsTable.reorderPoint} ASC`).limit(5);

    const topParts = await db.select({
      partId: invoiceLinesTable.partId,
      name: partsTable.name,
      sku: partsTable.sku,
      totalQty: sql<number>`COALESCE(SUM(${invoiceLinesTable.quantity}), 0)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(${invoiceLinesTable.totalPrice}), 0)`,
    }).from(invoiceLinesTable)
      .innerJoin(invoicesTable, eq(invoiceLinesTable.invoiceId, invoicesTable.id))
      .leftJoin(partsTable, eq(invoiceLinesTable.partId, partsTable.id))
      .where(sql`${invoiceLinesTable.partId} IS NOT NULL AND ${invoicesTable.status} = 'paid'`)
      .groupBy(invoiceLinesTable.partId, partsTable.name, partsTable.sku)
      .orderBy(sql`SUM(${invoiceLinesTable.quantity}) DESC`)
      .limit(5);

    res.json({
      totalRevenue: parseFloat(revenueResult.totalRevenue ?? "0"),
      invoiceCount: revenueResult.invoiceCount,
      pendingWorkOrders: pendingWO.count,
      lowStockPartsCount: lowStockCount.count,
      availableMotorcycles: availableMotos.count,
      pendingPurchaseOrders: pendingPO.count,
      staleWorkOrders,
      lowStockParts,
      topParts: topParts.map(p => ({ ...p, totalRevenue: parseFloat(p.totalRevenue ?? "0") })),
    });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/sales", async (req: AuthRequest, res) => {
  try {
    const { period } = req.query as { period?: string };
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const dailySales = await db.select({
      date: sql<string>`DATE(${invoicesTable.createdAt})::text`,
      revenue: sql<string>`SUM(${invoicesTable.totalAmount})`,
      count: sql<number>`COUNT(*)::int`,
    }).from(invoicesTable)
      .where(and(eq(invoicesTable.status, "paid"), gte(invoicesTable.createdAt, since)))
      .groupBy(sql`DATE(${invoicesTable.createdAt})`)
      .orderBy(sql`DATE(${invoicesTable.createdAt})`);

    res.json(dailySales.map(r => ({ date: r.date, revenue: parseFloat(r.revenue ?? "0"), count: r.count })));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/inventory", async (req: AuthRequest, res) => {
  try {
    const byCondition = await db.select({
      condition: partsTable.condition,
      count: sql<number>`COUNT(*)::int`,
      totalValue: sql<string>`SUM(${partsTable.quantityOnHand} * ${partsTable.costPrice})`,
    }).from(partsTable).groupBy(partsTable.condition);

    const byStatus = await db.select({
      status: motorcyclesTable.status,
      count: sql<number>`COUNT(*)::int`,
    }).from(motorcyclesTable).groupBy(motorcyclesTable.status);

    res.json({
      parts: byCondition.map(r => ({ condition: r.condition, count: r.count, totalValue: parseFloat(r.totalValue ?? "0") })),
      motorcycles: byStatus,
    });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/service", async (req: AuthRequest, res) => {
  try {
    const byStatus = await db.select({
      status: workOrdersTable.status,
      count: sql<number>`COUNT(*)::int`,
    }).from(workOrdersTable).groupBy(workOrdersTable.status);

    res.json({ workOrders: byStatus });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/profit-loss", async (req: AuthRequest, res) => {
  try {
    const { period } = req.query as { period?: string };
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [revenue] = await db.select({
      total: sql<string>`COALESCE(SUM(${invoicesTable.totalAmount}), 0)`,
      taxTotal: sql<string>`COALESCE(SUM(${invoicesTable.taxAmount}), 0)`,
      subtotalSum: sql<string>`COALESCE(SUM(${invoicesTable.subtotal}), 0)`,
    }).from(invoicesTable).where(and(eq(invoicesTable.status, "paid"), gte(invoicesTable.createdAt, since)));

    const [cogsResult] = await db.select({
      cogs: sql<string>`COALESCE(SUM(${partsTable.costPrice} * ${invoiceLinesTable.quantity}), 0)`,
    })
      .from(invoiceLinesTable)
      .innerJoin(invoicesTable, and(eq(invoiceLinesTable.invoiceId, invoicesTable.id), eq(invoicesTable.status, "paid"), gte(invoicesTable.createdAt, since)))
      .leftJoin(partsTable, eq(invoiceLinesTable.partId, partsTable.id))
      .where(sql`${invoiceLinesTable.partId} IS NOT NULL`);

    const totalRevenue = parseFloat(revenue.total ?? "0");
    const totalTax = parseFloat(revenue.taxTotal ?? "0");
    const subtotal = parseFloat(revenue.subtotalSum ?? "0");
    const cogs = parseFloat(cogsResult?.cogs ?? "0");
    const grossProfit = subtotal - cogs;
    const netProfit = grossProfit - totalTax;

    res.json({
      period: `${days}d`,
      totalRevenue,
      totalTax,
      subtotal,
      cogs,
      grossProfit,
      netProfit,
      netRevenue: totalRevenue - totalTax,
    });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/stock-turnover", async (req: AuthRequest, res) => {
  try {
    const { period } = req.query as { period?: string };
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const soldQty = await db.select({
      partId: invoiceLinesTable.partId,
      totalSold: sql<number>`COALESCE(SUM(${invoiceLinesTable.quantity}), 0)::int`,
    }).from(invoiceLinesTable)
      .innerJoin(invoicesTable, and(
        eq(invoiceLinesTable.invoiceId, invoicesTable.id),
        eq(invoicesTable.status, "paid"),
        gte(invoicesTable.createdAt, since),
      ))
      .where(sql`${invoiceLinesTable.partId} IS NOT NULL`)
      .groupBy(invoiceLinesTable.partId);

    const soldMap = new Map(soldQty.map(r => [r.partId, r.totalSold]));

    const parts = await db.select({
      id: partsTable.id,
      sku: partsTable.sku,
      name: partsTable.name,
      quantityOnHand: partsTable.quantityOnHand,
      reorderPoint: partsTable.reorderPoint,
      costPrice: partsTable.costPrice,
      condition: partsTable.condition,
    }).from(partsTable).orderBy(partsTable.name);

    const result = parts.map(p => {
      const costPrice = parseFloat(String(p.costPrice ?? "0"));
      const qtyOnHand = p.quantityOnHand ?? 0;
      const qtySold = soldMap.get(p.id) ?? 0;
      const cogsForPeriod = qtySold * costPrice;
      const avgInventoryValue = qtyOnHand * costPrice;
      const periodYearFraction = days / 365;
      const turnoverRatio = avgInventoryValue > 0
        ? (cogsForPeriod / avgInventoryValue) / periodYearFraction
        : 0;
      const daysOnHand = turnoverRatio > 0 ? 365 / turnoverRatio : null;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        quantityOnHand: qtyOnHand,
        reorderPoint: p.reorderPoint,
        costPrice,
        condition: p.condition,
        stockValue: qtyOnHand * costPrice,
        qtySoldInPeriod: qtySold,
        turnoverRatio: parseFloat(turnoverRatio.toFixed(2)),
        daysOnHand: daysOnHand !== null ? parseFloat(daysOnHand.toFixed(1)) : null,
      };
    });

    res.json({ period: `${days}d`, parts: result });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/reorder-suggestions", async (req: AuthRequest, res) => {
  try {
    const parts = await db.select({
      id: partsTable.id,
      sku: partsTable.sku,
      name: partsTable.name,
      quantityOnHand: partsTable.quantityOnHand,
      reorderPoint: partsTable.reorderPoint,
      costPrice: partsTable.costPrice,
    }).from(partsTable)
      .where(sql`${partsTable.quantityOnHand} <= ${partsTable.reorderPoint}`)
      .orderBy(sql`${partsTable.quantityOnHand} - ${partsTable.reorderPoint} ASC`);

    res.json(parts.map(p => ({
      ...p,
      deficit: (p.reorderPoint ?? 0) - (p.quantityOnHand ?? 0),
      suggestedOrderQty: (p.reorderPoint ?? 10) * 2,
    })));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/stale-work-orders", async (req: AuthRequest, res) => {
  try {
    const { days: daysParam } = req.query as { days?: string };
    const staleThresholdDays = daysParam ? parseInt(daysParam) : 7;
    const cutoff = new Date(Date.now() - staleThresholdDays * 24 * 60 * 60 * 1000);

    const stale = await db.select({
      id: workOrdersTable.id,
      woNumber: workOrdersTable.woNumber,
      customerName: workOrdersTable.customerName,
      status: workOrdersTable.status,
      createdAt: workOrdersTable.createdAt,
      updatedAt: workOrdersTable.updatedAt,
    }).from(workOrdersTable)
      .where(and(
        sql`${workOrdersTable.status} NOT IN ('invoiced', 'cancelled')`,
        lte(workOrdersTable.updatedAt, cutoff)
      ))
      .orderBy(workOrdersTable.updatedAt);

    res.json(stale);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/analytics/top-parts", async (req: AuthRequest, res) => {
  try {
    const { limit: limitParam } = req.query as { limit?: string };
    const topN = limitParam ? parseInt(limitParam) : 10;

    const topParts = await db.select({
      partId: invoiceLinesTable.partId,
      partName: partsTable.name,
      partSku: partsTable.sku,
      totalQty: sql<number>`SUM(${invoiceLinesTable.quantity})::int`,
      totalRevenue: sql<string>`SUM(${invoiceLinesTable.totalPrice})`,
    }).from(invoiceLinesTable)
      .innerJoin(partsTable, eq(invoiceLinesTable.partId, partsTable.id))
      .where(sql`${invoiceLinesTable.partId} IS NOT NULL`)
      .groupBy(invoiceLinesTable.partId, partsTable.name, partsTable.sku)
      .orderBy(sql`SUM(${invoiceLinesTable.quantity}) DESC`)
      .limit(topN);

    res.json(topParts.map(p => ({
      ...p,
      totalRevenue: parseFloat(p.totalRevenue ?? "0"),
    })));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
