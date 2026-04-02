import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, subcategoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

/* ─────────────────────────────── CATEGORIES ─────────────────────────────── */

router.get("/categories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const categories = await db
      .select()
      .from(categoriesTable)
      .orderBy(categoriesTable.name);
    res.json(categories);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/categories", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { name, description, imageUrl } = req.body;
    if (!name) {
      res.status(400).json({ error: "Bad Request", message: "name is required" });
      return;
    }
    const [category] = await db
      .insert(categoriesTable)
      .values({ name, description, imageUrl: imageUrl ?? null })
      .returning();
    await logAudit(req, "create", "categories", category.id, null, { name });
    res.status(201).json(category);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/categories/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id));
    if (!category) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(category);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/categories/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!before) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    const { name, description, imageUrl } = req.body;
    const [category] = await db
      .update(categoriesTable)
      .set({ name, description, imageUrl: imageUrl ?? undefined, updatedAt: new Date() })
      .where(eq(categoriesTable.id, id))
      .returning();
    await logAudit(req, "update", "categories", id, before, category);
    res.json(category);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/categories/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!category) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    const subcats = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.categoryId, id));
    if (subcats.length > 0) {
      res.status(422).json({ error: "Cannot delete category with subcategories. Delete subcategories first." });
      return;
    }
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    await logAudit(req, "delete", "categories", id, category, null);
    res.json({ message: "Category deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ────────────────────────────── SUBCATEGORIES ───────────────────────────── */

router.get("/subcategories", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { categoryId } = req.query as Record<string, string>;
    const rows = await db
      .select({
        id: subcategoriesTable.id,
        categoryId: subcategoriesTable.categoryId,
        name: subcategoriesTable.name,
        description: subcategoriesTable.description,
        imageUrl: subcategoriesTable.imageUrl,
        createdAt: subcategoriesTable.createdAt,
        updatedAt: subcategoriesTable.updatedAt,
        categoryName: categoriesTable.name,
      })
      .from(subcategoriesTable)
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(categoryId ? eq(subcategoriesTable.categoryId, parseInt(categoryId)) : undefined)
      .orderBy(subcategoriesTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/subcategories", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { categoryId, name, description, imageUrl } = req.body;
    if (!categoryId || !name) {
      res.status(400).json({ error: "Bad Request", message: "categoryId and name are required" });
      return;
    }
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parseInt(categoryId)));
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const [subcategory] = await db
      .insert(subcategoriesTable)
      .values({ categoryId: parseInt(categoryId), name, description, imageUrl: imageUrl ?? null })
      .returning();
    await logAudit(req, "create", "subcategories", subcategory.id, null, { name, categoryId });
    res.status(201).json(subcategory);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/subcategories/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [sub] = await db
      .select({
        id: subcategoriesTable.id,
        categoryId: subcategoriesTable.categoryId,
        name: subcategoriesTable.name,
        description: subcategoriesTable.description,
        createdAt: subcategoriesTable.createdAt,
        categoryName: categoriesTable.name,
      })
      .from(subcategoriesTable)
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(eq(subcategoriesTable.id, id));
    if (!sub) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    res.json(sub);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/subcategories/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, id));
    if (!before) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    const { categoryId, name, description, imageUrl } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (categoryId !== undefined) updates.categoryId = parseInt(categoryId);
    const [sub] = await db
      .update(subcategoriesTable)
      .set(updates)
      .where(eq(subcategoriesTable.id, id))
      .returning();
    await logAudit(req, "update", "subcategories", id, before, sub);
    res.json(sub);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/subcategories/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [sub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, id));
    if (!sub) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    await db.delete(subcategoriesTable).where(eq(subcategoriesTable.id, id));
    await logAudit(req, "delete", "subcategories", id, sub, null);
    res.json({ message: "Subcategory deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
