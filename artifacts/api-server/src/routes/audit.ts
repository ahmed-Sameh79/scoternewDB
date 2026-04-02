import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable, auditActionEnum } from "@workspace/db/schema";
import { eq, and, SQL } from "drizzle-orm";
import { requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/audit-logs", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { entity, userId, action } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (entity) conditions.push(eq(auditLogsTable.entity, entity));
    if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId)));
    const auditValidActions = auditActionEnum.enumValues;
    if (action && auditValidActions.includes(action as typeof auditValidActions[number])) {
      conditions.push(eq(auditLogsTable.action, action as typeof auditValidActions[number]));
    }

    const logs = await db
      .select({
        id: auditLogsTable.id,
        userId: auditLogsTable.userId,
        userName: usersTable.fullName,
        action: auditLogsTable.action,
        entity: auditLogsTable.entity,
        entityId: auditLogsTable.entityId,
        before: auditLogsTable.before,
        after: auditLogsTable.after,
        ipAddress: auditLogsTable.ipAddress,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(auditLogsTable.createdAt)
      .limit(500);
    res.json(logs);
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
