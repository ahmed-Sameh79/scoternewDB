import { Router } from "express";
import { db } from "@workspace/db";
import { warehousesTable, binsTable, zonesTable, aislesTable, shelvesTable } from "@workspace/db/schema";
import { eq, and, sql, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/warehouses", requireAuth, async (req: AuthRequest, res) => {
  try {
    const warehouses = await db.select({
      id: warehousesTable.id,
      name: warehousesTable.name,
      location: warehousesTable.location,
      description: warehousesTable.description,
      isActive: warehousesTable.isActive,
      createdAt: warehousesTable.createdAt,
      updatedAt: warehousesTable.updatedAt,
      binCount: sql<number>`(SELECT COUNT(*) FROM bins WHERE bins.warehouse_id = ${warehousesTable.id})::int`,
      zoneCount: sql<number>`(SELECT COUNT(*) FROM zones WHERE zones.warehouse_id = ${warehousesTable.id})::int`,
    }).from(warehousesTable).orderBy(warehousesTable.name);
    res.json(warehouses);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/warehouses", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { name, location, description } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "name required" }); return; }
    const [wh] = await db.insert(warehousesTable).values({ name, location, description }).returning();
    await logAudit(req, "create", "warehouses", wh.id, null, { name });
    res.status(201).json(wh);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/warehouses/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [wh] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id));
    if (!wh) { res.status(404).json({ error: "Not Found" }); return; }
    const bins = await db.select().from(binsTable).where(eq(binsTable.warehouseId, id)).orderBy(binsTable.zone, binsTable.aisle, binsTable.shelf, binsTable.bin);
    const zones = await db.select().from(zonesTable).where(eq(zonesTable.warehouseId, id)).orderBy(zonesTable.code);
    res.json({ ...wh, bins, zones });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/warehouses/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { name, location, description } = req.body;
    const [wh] = await db.update(warehousesTable).set({ name, location, description, updatedAt: new Date() }).where(eq(warehousesTable.id, id)).returning();
    await logAudit(req, "update", "warehouses", id, before, wh);
    res.json(wh);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/warehouses/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [wh] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id));
    if (!wh) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(warehousesTable).where(eq(warehousesTable.id, id));
    await logAudit(req, "delete", "warehouses", id, wh, null);
    res.json({ message: "Warehouse deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Zones ────────────────────────────────────────────────────────────────────

router.get("/warehouses/:warehouseId/zones", requireAuth, async (req: AuthRequest, res) => {
  try {
    const warehouseId = parseInt(String(req.params.warehouseId));
    const zones = await db.select({
      id: zonesTable.id,
      warehouseId: zonesTable.warehouseId,
      code: zonesTable.code,
      name: zonesTable.name,
      createdAt: zonesTable.createdAt,
      aisleCount: sql<number>`(SELECT COUNT(*) FROM aisles WHERE aisles.zone_id = ${zonesTable.id})::int`,
    }).from(zonesTable).where(eq(zonesTable.warehouseId, warehouseId)).orderBy(zonesTable.code);
    res.json(zones);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/warehouses/:warehouseId/zones", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const warehouseId = parseInt(String(req.params.warehouseId));
    const { code, name } = req.body;
    if (!code || !name) { res.status(400).json({ error: "Bad Request", message: "code and name required" }); return; }
    const [zone] = await db.insert(zonesTable).values({ warehouseId, code, name }).returning();
    res.status(201).json(zone);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Aisles ───────────────────────────────────────────────────────────────────

router.get("/zones/:zoneId/aisles", requireAuth, async (req: AuthRequest, res) => {
  try {
    const zoneId = parseInt(String(req.params.zoneId));
    const aisles = await db.select({
      id: aislesTable.id,
      zoneId: aislesTable.zoneId,
      code: aislesTable.code,
      name: aislesTable.name,
      createdAt: aislesTable.createdAt,
      shelfCount: sql<number>`(SELECT COUNT(*) FROM shelves WHERE shelves.aisle_id = ${aislesTable.id})::int`,
    }).from(aislesTable).where(eq(aislesTable.zoneId, zoneId)).orderBy(aislesTable.code);
    res.json(aisles);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/zones/:zoneId/aisles", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const zoneId = parseInt(String(req.params.zoneId));
    const { code, name } = req.body;
    if (!code || !name) { res.status(400).json({ error: "Bad Request", message: "code and name required" }); return; }
    const [aisle] = await db.insert(aislesTable).values({ zoneId, code, name }).returning();
    res.status(201).json(aisle);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Shelves ──────────────────────────────────────────────────────────────────

router.get("/aisles/:aisleId/shelves", requireAuth, async (req: AuthRequest, res) => {
  try {
    const aisleId = parseInt(String(req.params.aisleId));
    const shelves = await db.select({
      id: shelvesTable.id,
      aisleId: shelvesTable.aisleId,
      code: shelvesTable.code,
      name: shelvesTable.name,
      createdAt: shelvesTable.createdAt,
      binCount: sql<number>`(SELECT COUNT(*) FROM bins WHERE bins.shelf_id = ${shelvesTable.id})::int`,
    }).from(shelvesTable).where(eq(shelvesTable.aisleId, aisleId)).orderBy(shelvesTable.code);
    res.json(shelves);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/aisles/:aisleId/shelves", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const aisleId = parseInt(String(req.params.aisleId));
    const { code, name } = req.body;
    if (!code || !name) { res.status(400).json({ error: "Bad Request", message: "code and name required" }); return; }
    const [shelf] = await db.insert(shelvesTable).values({ aisleId, code, name }).returning();
    res.status(201).json(shelf);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Bins ─────────────────────────────────────────────────────────────────────

router.get("/bins", async (req: AuthRequest, res) => {
  try {
    const bins = await db.select().from(binsTable).orderBy(binsTable.zone, binsTable.aisle, binsTable.shelf, binsTable.bin);
    res.json(bins);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/warehouses/:warehouseId/bins", async (req: AuthRequest, res) => {
  try {
    const warehouseId = parseInt(String(req.params.warehouseId));
    const { zone, aisle } = req.query as { zone?: string; aisle?: string };
    const conditions: SQL[] = [eq(binsTable.warehouseId, warehouseId)];
    if (zone) conditions.push(eq(binsTable.zone, zone));
    if (aisle) conditions.push(eq(binsTable.aisle, aisle));
    const bins = await db.select().from(binsTable).where(and(...conditions)).orderBy(binsTable.zone, binsTable.aisle, binsTable.shelf, binsTable.bin);
    res.json(bins);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/warehouses/:warehouseId/bins", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const warehouseId = parseInt(String(req.params.warehouseId));
    const { zone, aisle, shelf, bin, shelfId } = req.body;
    if (!zone || !aisle || !shelf || !bin) { res.status(400).json({ error: "Bad Request", message: "zone, aisle, shelf, bin required" }); return; }
    const label = `${zone}-${aisle}-${shelf}-${bin}`;
    const [b] = await db.insert(binsTable).values({ warehouseId, zone, aisle, shelf, bin, label, shelfId: shelfId ?? null }).returning();
    res.status(201).json(b);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
