import { Router } from "express";
import { db } from "@workspace/db";
import { motorcycleCategoriesTable, motorcycleSubcategoriesTable, motorcycleBrandsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

// ─── Motorcycle Categories ───────────────────────────────────────────────────

router.get("/motorcycle-categories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const cats = await db.select().from(motorcycleCategoriesTable).orderBy(motorcycleCategoriesTable.name);
    res.json(cats);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/motorcycle-categories", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { name, description, imageUrl } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "name required" }); return; }
    const [cat] = await db.insert(motorcycleCategoriesTable).values({ name, description, imageUrl: imageUrl ?? null }).returning();
    await logAudit(req, "create", "motorcycle_categories", cat.id, null, { name });
    res.status(201).json(cat);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.put("/motorcycle-categories/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(motorcycleCategoriesTable).where(eq(motorcycleCategoriesTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { name, description, imageUrl } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    const [cat] = await db.update(motorcycleCategoriesTable).set(updates).where(eq(motorcycleCategoriesTable.id, id)).returning();
    await logAudit(req, "update", "motorcycle_categories", id, before, cat);
    res.json(cat);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/motorcycle-categories/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const subs = await db.select().from(motorcycleSubcategoriesTable).where(eq(motorcycleSubcategoriesTable.motorcycleCategoryId, id));
    if (subs.length > 0) { res.status(409).json({ error: "Conflict", message: "Category has subcategories. Delete them first." }); return; }
    const brands = await db.select().from(motorcycleBrandsTable).where(eq(motorcycleBrandsTable.motorcycleCategoryId, id));
    if (brands.length > 0) { res.status(409).json({ error: "Conflict", message: "Category has brands. Delete them first." }); return; }
    const [cat] = await db.select().from(motorcycleCategoriesTable).where(eq(motorcycleCategoriesTable.id, id));
    if (!cat) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(motorcycleCategoriesTable).where(eq(motorcycleCategoriesTable.id, id));
    await logAudit(req, "delete", "motorcycle_categories", id, cat, null);
    res.json({ message: "Deleted" });
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Motorcycle Subcategories ─────────────────────────────────────────────────

router.get("/motorcycle-subcategories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { motorcycleCategoryId } = req.query as Record<string, string>;
    let query = db
      .select({
        id: motorcycleSubcategoriesTable.id,
        name: motorcycleSubcategoriesTable.name,
        description: motorcycleSubcategoriesTable.description,
        imageUrl: motorcycleSubcategoriesTable.imageUrl,
        motorcycleCategoryId: motorcycleSubcategoriesTable.motorcycleCategoryId,
        categoryName: motorcycleCategoriesTable.name,
        createdAt: motorcycleSubcategoriesTable.createdAt,
      })
      .from(motorcycleSubcategoriesTable)
      .leftJoin(motorcycleCategoriesTable, eq(motorcycleSubcategoriesTable.motorcycleCategoryId, motorcycleCategoriesTable.id))
      .$dynamic();
    if (motorcycleCategoryId) {
      query = query.where(eq(motorcycleSubcategoriesTable.motorcycleCategoryId, parseInt(motorcycleCategoryId)));
    }
    const subs = await query.orderBy(motorcycleSubcategoriesTable.name);
    res.json(subs);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/motorcycle-subcategories", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { motorcycleCategoryId, name, description, imageUrl } = req.body;
    if (!name || !motorcycleCategoryId) { res.status(400).json({ error: "Bad Request", message: "name and motorcycleCategoryId required" }); return; }
    const [sub] = await db.insert(motorcycleSubcategoriesTable).values({ motorcycleCategoryId: parseInt(motorcycleCategoryId), name, description, imageUrl: imageUrl ?? null }).returning();
    await logAudit(req, "create", "motorcycle_subcategories", sub.id, null, { name });
    res.status(201).json(sub);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.put("/motorcycle-subcategories/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(motorcycleSubcategoriesTable).where(eq(motorcycleSubcategoriesTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { motorcycleCategoryId, name, description, imageUrl } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (motorcycleCategoryId !== undefined) updates.motorcycleCategoryId = parseInt(motorcycleCategoryId);
    const [sub] = await db.update(motorcycleSubcategoriesTable).set(updates).where(eq(motorcycleSubcategoriesTable.id, id)).returning();
    await logAudit(req, "update", "motorcycle_subcategories", id, before, sub);
    res.json(sub);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/motorcycle-subcategories/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [sub] = await db.select().from(motorcycleSubcategoriesTable).where(eq(motorcycleSubcategoriesTable.id, id));
    if (!sub) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(motorcycleSubcategoriesTable).where(eq(motorcycleSubcategoriesTable.id, id));
    await logAudit(req, "delete", "motorcycle_subcategories", id, sub, null);
    res.json({ message: "Deleted" });
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Motorcycle Brands ────────────────────────────────────────────────────────

router.get("/motorcycle-brands", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { motorcycleCategoryId } = req.query as Record<string, string>;
    let query = db
      .select({
        id: motorcycleBrandsTable.id,
        name: motorcycleBrandsTable.name,
        description: motorcycleBrandsTable.description,
        imageUrl: motorcycleBrandsTable.imageUrl,
        motorcycleCategoryId: motorcycleBrandsTable.motorcycleCategoryId,
        categoryName: motorcycleCategoriesTable.name,
        createdAt: motorcycleBrandsTable.createdAt,
      })
      .from(motorcycleBrandsTable)
      .leftJoin(motorcycleCategoriesTable, eq(motorcycleBrandsTable.motorcycleCategoryId, motorcycleCategoriesTable.id))
      .$dynamic();
    if (motorcycleCategoryId) {
      query = query.where(eq(motorcycleBrandsTable.motorcycleCategoryId, parseInt(motorcycleCategoryId)));
    }
    const brands = await query.orderBy(motorcycleBrandsTable.name);
    res.json(brands);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/motorcycle-brands", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { motorcycleCategoryId, name, description, imageUrl } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "name required" }); return; }
    const [brand] = await db.insert(motorcycleBrandsTable).values({
      motorcycleCategoryId: motorcycleCategoryId ? parseInt(motorcycleCategoryId) : null,
      name, description, imageUrl: imageUrl ?? null,
    }).returning();
    await logAudit(req, "create", "motorcycle_brands", brand.id, null, { name });
    res.status(201).json(brand);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.put("/motorcycle-brands/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(motorcycleBrandsTable).where(eq(motorcycleBrandsTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { motorcycleCategoryId, name, description, imageUrl } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (motorcycleCategoryId !== undefined) updates.motorcycleCategoryId = motorcycleCategoryId ? parseInt(motorcycleCategoryId) : null;
    const [brand] = await db.update(motorcycleBrandsTable).set(updates).where(eq(motorcycleBrandsTable.id, id)).returning();
    await logAudit(req, "update", "motorcycle_brands", id, before, brand);
    res.json(brand);
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/motorcycle-brands/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [brand] = await db.select().from(motorcycleBrandsTable).where(eq(motorcycleBrandsTable.id, id));
    if (!brand) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(motorcycleBrandsTable).where(eq(motorcycleBrandsTable.id, id));
    await logAudit(req, "delete", "motorcycle_brands", id, brand, null);
    res.json({ message: "Deleted" });
  } catch (err) { req.log.error({ err }); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
