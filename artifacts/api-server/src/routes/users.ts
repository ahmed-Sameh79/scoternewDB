import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userRoleEnum } from "@workspace/db/schema";
import { eq, ilike, and, SQL } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/users", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { role, search } = req.query as { role?: string; search?: string };
    const conditions: SQL[] = [];
    const validRoles = userRoleEnum.enumValues;
    if (role && validRoles.includes(role as typeof validRoles[number])) {
      conditions.push(eq(usersTable.role, role as typeof validRoles[number]));
    }
    if (search) conditions.push(ilike(usersTable.fullName, `%${search}%`));

    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      email: usersTable.email,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(conditions.length ? and(...conditions) : undefined);
    res.json(users);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/users", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { username, fullName, role, email, password } = req.body;
    if (!username || !fullName || !role || !password) {
      res.status(400).json({ error: "Bad Request", message: "username, fullName, role, and password required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ username, fullName, role, email, passwordHash }).returning();
    await logAudit(req, "create", "users", user.id, null, { username, fullName, role });
    res.status(201).json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, email: user.email, isActive: user.isActive, createdAt: user.createdAt });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/users/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [user] = await db.select({ id: usersTable.id, username: usersTable.username, fullName: usersTable.fullName, role: usersTable.role, email: usersTable.email, isActive: usersTable.isActive, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(user);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/users/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!before) { res.status(404).json({ error: "Not Found" }); return; }
    const { fullName, role, email, isActive, password } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (fullName !== undefined) updates.fullName = fullName;
    if (role !== undefined) updates.role = role;
    if (email !== undefined) updates.email = email;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    await logAudit(req, "update", "users", id, { fullName: before.fullName, role: before.role }, { fullName: user.fullName, role: user.role });
    res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, email: user.email, isActive: user.isActive, createdAt: user.createdAt });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/users/:id/password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (req.user!.role !== "admin" && req.user!.id !== id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Bad Request", message: "currentPassword and newPassword required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Bad Request", message: "Password must be at least 6 characters" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "Not Found" }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Bad Request", message: "Current password is incorrect" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, id));
    await logAudit(req, "update", "users", id, null, { action: "password_changed" });
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/users/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "Not Found" }); return; }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    await logAudit(req, "delete", "users", id, user, null);
    res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
