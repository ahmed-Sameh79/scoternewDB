import { Router } from "express";
import { db } from "@workspace/db";
import {
  partsTable, subcategoriesTable, categoriesTable,
  motorcyclesTable, motorcycleBrandsTable, motorcycleSubcategoriesTable, motorcycleCategoriesTable,
} from "@workspace/db/schema";
import { eq, ilike, and, or, SQL } from "drizzle-orm";

const router = Router();

router.get("/parts", async (req, res) => {
  try {
    const { search, categoryId, subcategoryId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (search) {
      conditions.push(or(ilike(partsTable.name, `%${search}%`), ilike(partsTable.sku, `%${search}%`), ilike(partsTable.modelCompatibility, `%${search}%`))!);
    }
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
        sellingPrice: partsTable.sellingPrice,
        imageUrl: partsTable.imageUrl,
        quantityOnHand: partsTable.quantityOnHand,
        subcategoryId: partsTable.subcategoryId,
        subcategoryName: subcategoriesTable.name,
        categoryName: categoriesTable.name,
      })
      .from(partsTable)
      .leftJoin(subcategoriesTable, eq(partsTable.subcategoryId, subcategoriesTable.id))
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(partsTable.name);
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/motorcycles", async (req, res) => {
  try {
    const { search, brandId, categoryId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (search) {
      conditions.push(or(ilike(motorcyclesTable.make, `%${search}%`), ilike(motorcyclesTable.model, `%${search}%`))!);
    }
    if (brandId) conditions.push(eq(motorcyclesTable.brandId, parseInt(brandId)));
    if (categoryId) conditions.push(eq(motorcycleSubcategoriesTable.motorcycleCategoryId, parseInt(categoryId)));

    const motos = await db
      .select({
        id: motorcyclesTable.id,
        make: motorcyclesTable.make,
        model: motorcyclesTable.model,
        year: motorcyclesTable.year,
        color: motorcyclesTable.color,
        engineSize: motorcyclesTable.engineSize,
        sellingPrice: motorcyclesTable.sellingPrice,
        status: motorcyclesTable.status,
        condition: motorcyclesTable.condition,
        imageUrl: motorcyclesTable.imageUrl,
        brandId: motorcyclesTable.brandId,
        brandName: motorcycleBrandsTable.name,
        motorcycleSubcategoryId: motorcyclesTable.motorcycleSubcategoryId,
        subcategoryName: motorcycleSubcategoriesTable.name,
        engineCc: motorcyclesTable.engineCc,
        topSpeed: motorcyclesTable.topSpeed,
        fuelCapacity: motorcyclesTable.fuelCapacity,
        weight: motorcyclesTable.weight,
        seatHeight: motorcyclesTable.seatHeight,
        transmission: motorcyclesTable.transmission,
        fuelType: motorcyclesTable.fuelType,
        features: motorcyclesTable.features,
      })
      .from(motorcyclesTable)
      .leftJoin(motorcycleBrandsTable, eq(motorcyclesTable.brandId, motorcycleBrandsTable.id))
      .leftJoin(motorcycleSubcategoriesTable, eq(motorcyclesTable.motorcycleSubcategoryId, motorcycleSubcategoriesTable.id))
      .leftJoin(motorcycleCategoriesTable, eq(motorcycleSubcategoriesTable.motorcycleCategoryId, motorcycleCategoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(motorcyclesTable.make);
    res.json(motos);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", detail: String(err) });
  }
});

router.get("/categories", async (_req, res) => {
  try {
    const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/motorcycle-brands", async (_req, res) => {
  try {
    const brands = await db.select().from(motorcycleBrandsTable).orderBy(motorcycleBrandsTable.name);
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/motorcycle-categories", async (_req, res) => {
  try {
    const cats = await db.select().from(motorcycleCategoriesTable).orderBy(motorcycleCategoriesTable.name);
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
