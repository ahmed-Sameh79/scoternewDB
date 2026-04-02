import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/vendors", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search } = req.query as { search?: string };
    const vendors = await db.select().from(vendorsTable)
      .where(search ? ilike(vendorsTable.name, `%${search}%`) : undefined)
      .orderBy(vendorsTable.name);
    res.json(vendors);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/vendors", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const { name, contactPerson, email, phone, address, taxNumber, notes } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "name required" }); return; }
    const [vendor] = await db.insert(vendorsTable).values({ name, contactPerson, email, phone, address, taxNumber, notes }).returning();
    await logAudit(req, "create", "vendors", vendor.id, null, { name });
    res.status(201).json(vendor);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/vendors/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
    if (!vendor) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(vendor);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/vendors/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { name, contactPerson, email, phone, address, taxNumber, notes } = req.body;
    const [vendor] = await db.update(vendorsTable).set({ name, contactPerson, email, phone, address, taxNumber, notes, updatedAt: new Date() }).where(eq(vendorsTable.id, id)).returning();
    await logAudit(req, "update", "vendors", id, before, vendor);
    res.json(vendor);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/vendors/:id", requireRole("admin", "storekeeper"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
    if (!vendor) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
    await logAudit(req, "delete", "vendors", id, vendor, null);
    res.json({ message: "Vendor deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
