import { Router } from "express";
import { db } from "@workspace/db";
import {
  motorcyclesTable, warehousesTable, motorcycleStatusEnum, motorcycleConditionEnum,
  motorcycleBrandsTable, motorcycleSubcategoriesTable, motorcycleCategoriesTable,
  subcategoriesTable, categoriesTable,
} from "@workspace/db/schema";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/motorcycles", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, status, condition, warehouseId, brandId, motorcycleCategoryId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (search) conditions.push(ilike(motorcyclesTable.model, `%${search}%`));
    const motoValidStatuses = motorcycleStatusEnum.enumValues;
    if (status && motoValidStatuses.includes(status as typeof motoValidStatuses[number])) {
      conditions.push(eq(motorcyclesTable.status, status as typeof motoValidStatuses[number]));
    }
    const motoValidConditions = motorcycleConditionEnum.enumValues;
    if (condition && motoValidConditions.includes(condition as typeof motoValidConditions[number])) {
      conditions.push(eq(motorcyclesTable.condition, condition as typeof motoValidConditions[number]));
    }
    if (warehouseId) conditions.push(eq(motorcyclesTable.warehouseId, parseInt(warehouseId)));
    if (brandId) conditions.push(eq(motorcyclesTable.brandId, parseInt(brandId)));
    if (motorcycleCategoryId) conditions.push(eq(motorcycleCategoriesTable.id, parseInt(motorcycleCategoryId)));

    const motos = await db
      .select({
        id: motorcyclesTable.id,
        make: motorcyclesTable.make,
        model: motorcyclesTable.model,
        year: motorcyclesTable.year,
        vin: motorcyclesTable.vin,
        color: motorcyclesTable.color,
        engineSize: motorcyclesTable.engineSize,
        mileage: motorcyclesTable.mileage,
        condition: motorcyclesTable.condition,
        status: motorcyclesTable.status,
        brandId: motorcyclesTable.brandId,
        brandName: motorcycleBrandsTable.name,
        motorcycleSubcategoryId: motorcyclesTable.motorcycleSubcategoryId,
        motorcycleSubcategoryName: motorcycleSubcategoriesTable.name,
        motorcycleCategoryName: motorcycleCategoriesTable.name,
        subcategoryId: motorcyclesTable.subcategoryId,
        subcategoryName: subcategoriesTable.name,
        categoryName: categoriesTable.name,
        costPrice: motorcyclesTable.costPrice,
        sellingPrice: motorcyclesTable.sellingPrice,
        imageUrl: motorcyclesTable.imageUrl,
        engineCc: motorcyclesTable.engineCc,
        topSpeed: motorcyclesTable.topSpeed,
        fuelCapacity: motorcyclesTable.fuelCapacity,
        weight: motorcyclesTable.weight,
        seatHeight: motorcyclesTable.seatHeight,
        transmission: motorcyclesTable.transmission,
        fuelType: motorcyclesTable.fuelType,
        features: motorcyclesTable.features,
        warehouseId: motorcyclesTable.warehouseId,
        warehouseName: warehousesTable.name,
        createdAt: motorcyclesTable.createdAt,
      })
      .from(motorcyclesTable)
      .leftJoin(warehousesTable, eq(motorcyclesTable.warehouseId, warehousesTable.id))
      .leftJoin(motorcycleBrandsTable, eq(motorcyclesTable.brandId, motorcycleBrandsTable.id))
      .leftJoin(motorcycleSubcategoriesTable, eq(motorcyclesTable.motorcycleSubcategoryId, motorcycleSubcategoriesTable.id))
      .leftJoin(motorcycleCategoriesTable, eq(motorcycleSubcategoriesTable.motorcycleCategoryId, motorcycleCategoriesTable.id))
      .leftJoin(subcategoriesTable, eq(motorcyclesTable.subcategoryId, subcategoriesTable.id))
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(motorcyclesTable.make, motorcyclesTable.model);
    res.json(motos);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/motorcycles", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { make, model, year, vin, color, engineSize, mileage, condition, status, brandId, motorcycleSubcategoryId, subcategoryId, costPrice, sellingPrice, warehouseId, imageUrl, engineCc, topSpeed, fuelCapacity, weight, seatHeight, transmission, fuelType, features } = req.body;
    if (!model || !year) { res.status(400).json({ error: "Bad Request", message: "model and year are required" }); return; }
    const [moto] = await db.insert(motorcyclesTable).values({
      make: make ?? "",
      model, year, vin, color, engineSize, mileage,
      condition: condition ?? "new",
      status: status ?? "available",
      brandId: brandId ?? null,
      motorcycleSubcategoryId: motorcycleSubcategoryId ?? null,
      subcategoryId: subcategoryId ?? null,
      costPrice: costPrice?.toString() ?? "0",
      sellingPrice: sellingPrice?.toString() ?? "0",
      imageUrl: imageUrl ?? null,
      warehouseId,
      engineCc: engineCc ?? null,
      topSpeed: topSpeed ?? null,
      fuelCapacity: fuelCapacity?.toString() ?? null,
      weight: weight ?? null,
      seatHeight: seatHeight ?? null,
      transmission: transmission ?? null,
      fuelType: fuelType ?? null,
      features: features ?? null,
    }).returning();
    await logAudit(req, "create", "motorcycles", moto.id, null, { make, model, year });
    res.status(201).json(moto);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/motorcycles/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [moto] = await db
      .select({
        id: motorcyclesTable.id,
        make: motorcyclesTable.make,
        model: motorcyclesTable.model,
        year: motorcyclesTable.year,
        vin: motorcyclesTable.vin,
        color: motorcyclesTable.color,
        engineSize: motorcyclesTable.engineSize,
        mileage: motorcyclesTable.mileage,
        condition: motorcyclesTable.condition,
        status: motorcyclesTable.status,
        brandId: motorcyclesTable.brandId,
        brandName: motorcycleBrandsTable.name,
        motorcycleSubcategoryId: motorcyclesTable.motorcycleSubcategoryId,
        motorcycleSubcategoryName: motorcycleSubcategoriesTable.name,
        motorcycleCategoryName: motorcycleCategoriesTable.name,
        subcategoryId: motorcyclesTable.subcategoryId,
        costPrice: motorcyclesTable.costPrice,
        sellingPrice: motorcyclesTable.sellingPrice,
        imageUrl: motorcyclesTable.imageUrl,
        engineCc: motorcyclesTable.engineCc,
        topSpeed: motorcyclesTable.topSpeed,
        fuelCapacity: motorcyclesTable.fuelCapacity,
        weight: motorcyclesTable.weight,
        seatHeight: motorcyclesTable.seatHeight,
        transmission: motorcyclesTable.transmission,
        fuelType: motorcyclesTable.fuelType,
        features: motorcyclesTable.features,
        warehouseId: motorcyclesTable.warehouseId,
        warehouseName: warehousesTable.name,
        createdAt: motorcyclesTable.createdAt,
      })
      .from(motorcyclesTable)
      .leftJoin(warehousesTable, eq(motorcyclesTable.warehouseId, warehousesTable.id))
      .leftJoin(motorcycleBrandsTable, eq(motorcyclesTable.brandId, motorcycleBrandsTable.id))
      .leftJoin(motorcycleSubcategoriesTable, eq(motorcyclesTable.motorcycleSubcategoryId, motorcycleSubcategoriesTable.id))
      .leftJoin(motorcycleCategoriesTable, eq(motorcycleSubcategoriesTable.motorcycleCategoryId, motorcycleCategoriesTable.id))
      .where(eq(motorcyclesTable.id, id));
    if (!moto) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(moto);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/motorcycles/:id", requireRole("admin", "storekeeper", "sales"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(motorcyclesTable).where(eq(motorcyclesTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = ["make", "model", "year", "vin", "color", "engineSize", "mileage", "condition", "status", "brandId", "motorcycleSubcategoryId", "subcategoryId", "warehouseId", "imageUrl", "engineCc", "topSpeed", "fuelCapacity", "weight", "seatHeight", "transmission", "fuelType", "features"] as const;
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.costPrice !== undefined) updates.costPrice = req.body.costPrice.toString();
    if (req.body.sellingPrice !== undefined) updates.sellingPrice = req.body.sellingPrice.toString();
    const [moto] = await db.update(motorcyclesTable).set(updates).where(eq(motorcyclesTable.id, id)).returning();
    await logAudit(req, "update", "motorcycles", id, before, moto);
    res.json(moto);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/motorcycles/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [moto] = await db.select().from(motorcyclesTable).where(eq(motorcyclesTable.id, id));
    if (!moto) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(motorcyclesTable).where(eq(motorcyclesTable.id, id));
    await logAudit(req, "delete", "motorcycles", id, moto, null);
    res.json({ message: "Motorcycle deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
