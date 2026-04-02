import { Router } from "express";
import { db } from "@workspace/db";
import { inspectionsTable, motorcyclesTable, usersTable } from "@workspace/db/schema";
import { eq, and, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/inspections", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { motorcycleId } = req.query as { motorcycleId?: string };
    const conditions: SQL[] = [];
    if (motorcycleId) conditions.push(eq(inspectionsTable.motorcycleId, parseInt(motorcycleId)));

    const inspections = await db
      .select({
        id: inspectionsTable.id,
        motorcycleId: inspectionsTable.motorcycleId,
        make: motorcyclesTable.make,
        model: motorcyclesTable.model,
        year: motorcyclesTable.year,
        vin: motorcyclesTable.vin,
        inspectorId: inspectionsTable.inspectorId,
        inspectorName: usersTable.fullName,
        overallGrade: inspectionsTable.overallGrade,
        engineCondition: inspectionsTable.engineCondition,
        bodyCondition: inspectionsTable.bodyCondition,
        electricalCondition: inspectionsTable.electricalCondition,
        tiresCondition: inspectionsTable.tiresCondition,
        brakeCondition: inspectionsTable.brakeCondition,
        notes: inspectionsTable.notes,
        imageUrls: inspectionsTable.imageUrls,
        isCertified: inspectionsTable.isCertified,
        createdAt: inspectionsTable.createdAt,
      })
      .from(inspectionsTable)
      .leftJoin(motorcyclesTable, eq(inspectionsTable.motorcycleId, motorcyclesTable.id))
      .leftJoin(usersTable, eq(inspectionsTable.inspectorId, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(inspectionsTable.createdAt);
    res.json(inspections);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/inspections", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const { motorcycleId, overallGrade, engineCondition, bodyCondition, electricalCondition, tiresCondition, brakeCondition, notes, imageUrls, isCertified } = req.body;
    if (!motorcycleId || !overallGrade) { res.status(400).json({ error: "Bad Request", message: "motorcycleId, overallGrade required" }); return; }
    const [inspection] = await db.insert(inspectionsTable).values({
      motorcycleId,
      inspectorId: req.user!.id,
      overallGrade,
      engineCondition,
      bodyCondition,
      electricalCondition,
      tiresCondition,
      brakeCondition,
      notes,
      imageUrls,
      isCertified: isCertified ?? false,
    }).returning();

    // Mark motorcycle as pre_owned
    await db.update(motorcyclesTable).set({ status: "pre_owned", updatedAt: new Date() }).where(eq(motorcyclesTable.id, motorcycleId));

    await logAudit(req, "create", "inspections", inspection.id, null, { motorcycleId, overallGrade });
    res.status(201).json(inspection);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/inspections/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [inspection] = await db
      .select({
        id: inspectionsTable.id,
        motorcycleId: inspectionsTable.motorcycleId,
        make: motorcyclesTable.make,
        model: motorcyclesTable.model,
        year: motorcyclesTable.year,
        vin: motorcyclesTable.vin,
        inspectorId: inspectionsTable.inspectorId,
        inspectorName: usersTable.fullName,
        overallGrade: inspectionsTable.overallGrade,
        engineCondition: inspectionsTable.engineCondition,
        bodyCondition: inspectionsTable.bodyCondition,
        electricalCondition: inspectionsTable.electricalCondition,
        tiresCondition: inspectionsTable.tiresCondition,
        brakeCondition: inspectionsTable.brakeCondition,
        notes: inspectionsTable.notes,
        imageUrls: inspectionsTable.imageUrls,
        isCertified: inspectionsTable.isCertified,
        createdAt: inspectionsTable.createdAt,
        updatedAt: inspectionsTable.updatedAt,
      })
      .from(inspectionsTable)
      .leftJoin(motorcyclesTable, eq(inspectionsTable.motorcycleId, motorcyclesTable.id))
      .leftJoin(usersTable, eq(inspectionsTable.inspectorId, usersTable.id))
      .where(eq(inspectionsTable.id, id));
    if (!inspection) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(inspection);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/inspections/:id", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { overallGrade, engineCondition, bodyCondition, electricalCondition, tiresCondition, brakeCondition, notes, imageUrls, isCertified } = req.body;
    const [inspection] = await db.update(inspectionsTable).set({ overallGrade, engineCondition, bodyCondition, electricalCondition, tiresCondition, brakeCondition, notes, imageUrls, isCertified, updatedAt: new Date() }).where(eq(inspectionsTable.id, id)).returning();
    await logAudit(req, "update", "inspections", id, before, inspection);
    res.json(inspection);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/inspections/:id", requireRole("admin", "technician"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
    if (!inspection) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(inspectionsTable).where(eq(inspectionsTable.id, id));
    await logAudit(req, "delete", "inspections", id, inspection, null);
    res.json({ message: "Inspection deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
