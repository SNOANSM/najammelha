import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { GetDashboardResponse, GetAdminOverviewResponse } from "@workspace/api-zod";
import { db, notificationsTable, redemptionsTable, reportsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();
const labels: Record<string, string> = {
  received: "تم استلام البلاغ",
  reviewing: "قيد المراجعة",
  referred: "تمت الإحالة",
  resolved: "تمت المعالجة",
  closed: "مغلق",
};

function toReport(report: typeof reportsTable.$inferSelect) {
  return {
    ...report,
    statusLabel: labels[report.status] ?? report.status,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

async function ensureSeeded() {
  return;
}

router.get("/dashboard", async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "يرجى تسجيل الدخول أولًا." });
    return;
  }
  const userId = req.authUser.id;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const reports = await db.select().from(reportsTable).where(eq(reportsTable.userId, userId)).orderBy(desc(reportsTable.createdAt));
  const notifications = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, userId)).orderBy(desc(notificationsTable.createdAt));
  const points = user?.points ?? 0;
  const level = points >= 1800 ? "صانع أثر" : points >= 1200 ? "مساهم مميز" : points >= 500 ? "مساهم نشط" : "مساهم جديد";
  res.json(GetDashboardResponse.parse({
    name: user?.name ?? "مستخدم نجمّلها",
    initials: (user?.name ?? "مستخدم").slice(0, 2),
    points,
    reportsCount: reports.length,
    resolvedCount: reports.filter((report) => report.status === "resolved").length,
    contributionRate: reports.length ? Math.round((reports.filter((report) => report.status === "resolved").length / reports.length) * 100) : 0,
    level,
    nextLevelPoints: points >= 1800 ? 0 : points >= 1200 ? 1800 : 1200,
    reports: reports.map(toReport),
    notifications: notifications.map((notification) => ({ ...notification, createdAt: notification.createdAt.toISOString() })),
  }));
});

router.get("/admin/overview", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "هذه الصفحة مخصصة للإدارة." });
    return;
  }
  await ensureSeeded();
  const reports = await db.select().from(reportsTable);
  const users = await db.select().from(usersTable);
  const redemptions = await db.select().from(redemptionsTable);
  const byCategory = new Map<string, number>();
  const byArea = new Map<string, number>();
  for (const report of reports) {
    byCategory.set(report.categoryLabel, (byCategory.get(report.categoryLabel) ?? 0) + 1);
    byArea.set(report.locationName, (byArea.get(report.locationName) ?? 0) + 1);
  }
  res.json(GetAdminOverviewResponse.parse({
    totalReports: reports.length,
    newReports: reports.filter((report) => report.status === "received").length,
    reviewingReports: reports.filter((report) => report.status === "reviewing").length,
    resolvedReports: reports.filter((report) => report.status === "resolved").length,
    usersCount: users.length,
    totalPoints: users.reduce((sum, user) => sum + user.points, 0),
    totalRedemptions: redemptions.length,
    totalPointsRedeemed: redemptions.reduce((sum, redemption) => sum + redemption.costPoints, 0),
    byCategory: Array.from(byCategory, ([label, value]) => ({ label, value })),
    byArea: Array.from(byArea, ([label, value]) => ({ label, value })),
  }));
});

export default router;