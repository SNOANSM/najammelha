import { eq, gt, and, sql } from "drizzle-orm";
import { db, pointsTable, usersTable } from "@workspace/db";

/** Total points ever earned (never reduced by store redemptions). */
export async function getLifetimePoints(userId: string): Promise<number> {
  const [earned] = await db
    .select({ total: sql<number>`coalesce(sum(${pointsTable.amount}), 0)::int` })
    .from(pointsTable)
    .where(and(eq(pointsTable.userId, userId), gt(pointsTable.amount, 0)));
  const [user] = await db.select({ points: usersTable.points }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return Math.max(earned?.total ?? 0, user?.points ?? 0);
}
