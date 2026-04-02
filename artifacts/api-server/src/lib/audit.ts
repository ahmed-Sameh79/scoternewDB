import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import type { AuthRequest } from "../middlewares/auth";

export async function logAudit(
  req: AuthRequest,
  action: "create" | "update" | "delete",
  entity: string,
  entityId: number | null,
  before?: unknown,
  after?: unknown
) {
  try {
    await db.insert(auditLogsTable).values({
      userId: req.user?.id ?? null,
      action,
      entity,
      entityId: entityId ?? undefined,
      before: before ?? null,
      after: after ?? null,
      ipAddress: req.ip ?? null,
    });
  } catch {
    // Audit failures must never break the main operation
  }
}
