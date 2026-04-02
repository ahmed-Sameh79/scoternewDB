import { Router } from "express";
import { db } from "@workspace/db";
import { partsTable, warehousesTable, binsTable, partConditionEnum, subcategoriesTable, categoriesTable } from "@workspace/db/schema";
import { eq, or, ilike, lte, and, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/parts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, warehouseId, condition, lowStock, categoryId, subcategoryId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (search) {
      conditions.push(or(ilike(partsTable.sku, `%${search}%`), ilike(partsTable.name, `%${search}%`), ilike(partsTable.modelCompatibility, `%${search}%`))!);
    }
    if (warehouseId) conditions.push(eq(partsTable.warehouseId, parseInt(warehouseId)));
    const partConditions = partConditionEnum.enumValues;
    if (condition && partConditions.includes(condition as typeof partConditions[number])) {
      conditions.push(eq(partsTable.condition, condition as typeof partConditions[number]));
    }
    if (lowStock === "true") conditions.push(lte(partsTable.quantityOnHand, partsTable.reorderPoint));
    if (subcategoryId) conditions.push(eq(partsTable.subcategoryId, parseInt(subcategoryId)));
    if (categoryId) conditions.push(eq(subcategoriesTable.categoryId, parseInt(categoryId)));

    const parts = await db
      .select({
        id: partsTable.id,
        sku: partsTable.sku,
        name: partsTable.name,
        description: partsTable.description,
        condition: partsTable.condition,
        modelCompatibility: partsTable.modelCompatibility,
        subcategoryId: partsTable.subcategoryId,
        subcategoryName: subcategoriesTable.name,
        categoryName: categoriesTable.name,
        quantityOnHand: partsTable.quantityOnHand,
        reorderPoint: partsTable.reorderPoint,
        costPrice: partsTable.costPrice,
        sellingPrice: partsTable.sellingPrice,
        imageUrl: partsTable.imageUrl,
        warehouseId: partsTable.warehouseId,
        binId: partsTable.binId,
        binLabel: binsTable.label,
        warehouseName: warehousesTable.name,
        createdAt: partsTable.createdAt,
      })
      .from(partsTable)
      .leftJoin(warehousesTable, eq(partsTable.warehouseId, warehousesTable.id))
      .leftJoin(binsTable, eq(partsTable.binId, binsTable.id))
      .leftJoin(subcategoriesTable, eq(partsTable.subcategoryId, subcategoriesTable.id))
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(partsTable.name);
    res.json(parts);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/parts", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { sku, name, description, condition, modelCompatibility, subcategoryId, quantityOnHand, reorderPoint, costPrice, sellingPrice, warehouseId, binId, imageUrl } = req.body;
    if (!sku || !name || !condition) { res.status(400).json({ error: "Bad Request", message: "sku, name, condition required" }); return; }
    const [part] = await db.insert(partsTable).values({
      sku, name, description, condition, modelCompatibility,
      subcategoryId: subcategoryId ?? null,
      quantityOnHand: quantityOnHand ?? 0,
      reorderPoint: reorderPoint ?? 5,
      costPrice: costPrice?.toString() ?? "0",
      sellingPrice: sellingPrice?.toString() ?? "0",
      warehouseId, binId, imageUrl: imageUrl ?? null,
    }).returning();
    await logAudit(req, "create", "parts", part.id, null, { sku, name });
    res.status(201).json(part);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/parts/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [part] = await db
      .select({
        id: partsTable.id,
        sku: partsTable.sku,
        name: partsTable.name,
        description: partsTable.description,
        condition: partsTable.condition,
        modelCompatibility: partsTable.modelCompatibility,
        subcategoryId: partsTable.subcategoryId,
        subcategoryName: subcategoriesTable.name,
        categoryName: categoriesTable.name,
        quantityOnHand: partsTable.quantityOnHand,
        reorderPoint: partsTable.reorderPoint,
        costPrice: partsTable.costPrice,
        sellingPrice: partsTable.sellingPrice,
        imageUrl: partsTable.imageUrl,
        warehouseId: partsTable.warehouseId,
        binId: partsTable.binId,
        binLabel: binsTable.label,
        warehouseName: warehousesTable.name,
        createdAt: partsTable.createdAt,
      })
      .from(partsTable)
      .leftJoin(warehousesTable, eq(partsTable.warehouseId, warehousesTable.id))
      .leftJoin(binsTable, eq(partsTable.binId, binsTable.id))
      .leftJoin(subcategoriesTable, eq(partsTable.subcategoryId, subcategoriesTable.id))
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(eq(partsTable.id, id));
    if (!part) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(part);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/parts/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(partsTable).where(eq(partsTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["name", "description", "condition", "modelCompatibility", "subcategoryId", "quantityOnHand", "reorderPoint", "warehouseId", "binId", "imageUrl"] as const;
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.costPrice !== undefined) updates.costPrice = req.body.costPrice.toString();
    if (req.body.sellingPrice !== undefined) updates.sellingPrice = req.body.sellingPrice.toString();
    const [part] = await db.update(partsTable).set(updates).where(eq(partsTable.id, id)).returning();
    await logAudit(req, "update", "parts", id, before, part);
    res.json(part);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/parts/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [part] = await db.select().from(partsTable).where(eq(partsTable.id, id));
    if (!part) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(partsTable).where(eq(partsTable.id, id));
    await logAudit(req, "delete", "parts", id, part, null);
    res.json({ message: "Part deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
