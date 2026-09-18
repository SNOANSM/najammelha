import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import {
  CreateReportBody,
  GetReportParams,
  ListReportsQueryParams,
  UpdateReportBody,
  UpdateReportParams,
  SupportReportParams,
  GetStatsResponse,
  ListCategoriesResponse,
  ListReportsResponse,
  CreateReportResponse,
  GetReportResponse,
  UpdateReportResponse,
  SupportReportResponse,
} from "@workspace/api-zod";
import { db, categoriesTable, locationsTable, notificationsTable, pointsTable, reportsTable, usersTable } from "@workspace/db";
import { hashPassword } from "../lib/auth";
import { AGENCIES, getAgency, prepareReferral } from "../lib/agencies";
import { routeReport, type RoutingImage } from "../lib/agency-router";
import { levelFor } from "../lib/levels";
import { getLifetimePoints } from "../lib/points";
import { loadUpload, uploadKeyFromPath } from "../lib/uploads";

const router: IRouter = Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@najammelha.kw";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Najammelha@2026";
const statusLabels: Record<string, string> = {
  received: "تم استلام البلاغ",
  reviewing: "قيد المراجعة",
  referred: "تمت الإحالة",
  resolved: "تمت المعالجة",
  closed: "مغلق",
};
const categorySeed = [
  ["roads", "طرق وحفر", "طرق وحفر", "road"],
  ["lighting", "إنارة", "إنارة", "lightbulb"],
  ["cleanliness", "نظافة", "نظافة", "sparkles"],
  ["sidewalks", "أرصفة", "أرصفة", "blocks"],
  ["parks", "حدائق", "حدائق", "trees"],
  ["facilities", "مرافق عامة", "مرافق عامة", "building"],
  ["visual", "تشوه بصري", "تشوه بصري", "eye"],
  ["other", "أخرى", "أخرى", "more-horizontal"],
] as const;

function demoImage(label: string, background: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="${background}"/><path d="M0 430h960v210H0z" fill="#d7d3ca"/><path d="M0 470h960" stroke="#faf8f1" stroke-width="8" stroke-dasharray="36 28"/><circle cx="710" cy="210" r="72" fill="#f8e8bb" opacity=".45"/><path d="M510 410c26-70 132-88 164-4v58H500z" fill="#2d4e3e" opacity=".88"/><text x="48" y="90" font-family="Arial" font-size="42" font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getUserId(req: Request) {
  return req.authUser?.id || "";
}

function getUserName(req: Request) {
  return req.authUser?.name || "مستخدم نجمّلها";
}

let seedPromise: Promise<void> | undefined;

async function seedDatabase() {
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL)).limit(1);
  if (!admin) {
    // The seeded admin row may already exist under an older ADMIN_EMAIL. Re-point
    // it instead of inserting a duplicate id, which used to fail every request.
    const [seeded] = await db.select().from(usersTable).where(eq(usersTable.id, "admin-user")).limit(1);
    if (seeded) {
      await db.update(usersTable).set({ email: ADMIN_EMAIL, passwordHash: hashPassword(ADMIN_PASSWORD), isAdmin: true }).where(eq(usersTable.id, seeded.id));
    } else {
      await db.insert(usersTable).values({ id: "admin-user", name: "إدارة نجمّلها", email: ADMIN_EMAIL, passwordHash: hashPassword(ADMIN_PASSWORD), points: 0, isAdmin: true });
    }
  } else if (!admin.passwordHash || !admin.isAdmin) {
    await db.update(usersTable).set({ passwordHash: admin.passwordHash || hashPassword(ADMIN_PASSWORD), isAdmin: true }).where(eq(usersTable.id, admin.id));
  }
  const existingCategories = await db.select({ id: categoriesTable.id }).from(categoriesTable).limit(1);
  if (existingCategories.length === 0) await db.insert(categoriesTable).values(categorySeed.map(([id, name, label, icon]) => ({ id, name, label, icon })));
}

function ensureSeeded() {
  // A failed seed must not be cached, or every later request would fail too.
  seedPromise ??= seedDatabase().catch((error) => {
    seedPromise = undefined;
    throw error;
  });
  return seedPromise;
}

type ReportRow = typeof reportsTable.$inferSelect;

function isOwner(req: Request, report: ReportRow) {
  return !!req.authUser && req.authUser.id === report.userId;
}

/** Only the admin, the reporter, or (once resolved) the public may see a report. */
function canView(req: Request, report: ReportRow) {
  return !!req.authUser?.isAdmin || isOwner(req, report) || report.status === "resolved";
}

/**
 * Shapes a report for whoever is asking. Admins get everything (exact
 * coordinates, author, AI agency reasoning); the reporter gets their own report
 * without the routing internals; the public only ever gets resolved reports
 * with the author, coordinates and agency stripped.
 */
function toReport(report: ReportRow, req: Request) {
  const base = {
    ...report,
    statusLabel: statusLabels[report.status] ?? report.status,
    isDemo: report.isDemo,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
  if (req.authUser?.isAdmin) return base;
  if (isOwner(req, report)) return { ...base, agencyReason: null, agencyConfidence: null, agencySource: null };
  return {
    ...base,
    userId: "",
    authorName: undefined,
    latitude: 0,
    longitude: 0,
    locationExact: false,
    agencyId: null,
    agencyName: null,
    agencyReason: null,
    agencyConfidence: null,
    agencySource: null,
  };
}

async function loadReportImage(objectPath: string): Promise<RoutingImage | null> {
  const key = uploadKeyFromPath(objectPath);
  if (!key) return null;
  const upload = await loadUpload(key);
  return upload ? { mediaType: upload.contentType, base64: upload.data.toString("base64") } : null;
}

router.get("/stats", async (_req, res) => {
  await ensureSeeded();
  const rows = await db.select().from(reportsTable);
  const data = GetStatsResponse.parse({
    totalReports: rows.length,
    resolvedReports: rows.filter((r) => r.status === "resolved").length,
    communityContributions: rows.reduce((sum, r) => sum + r.supportCount, 0),
    activeAreas: new Set(rows.map((r) => r.locationName)).size,
  });
  res.json(data);
});

router.get("/categories", async (_req, res) => {
  await ensureSeeded();
  const data = await db.select().from(categoriesTable);
  res.json(ListCategoriesResponse.parse(data));
});

router.get("/reports", async (req, res) => {
  await ensureSeeded();
  const parsed = ListReportsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "فلاتر البلاغات غير صالحة." });
    return;
  }
  const { status = "all", category, search, sort = "latest", mine } = parsed.data;
  if (mine && !req.authUser) {
    res.status(401).json({ error: "يرجى تسجيل الدخول أولًا." });
    return;
  }
  const clauses = [];
  if (status !== "all") clauses.push(eq(reportsTable.status, status));
  if (category) clauses.push(eq(reportsTable.category, category));
  if (search) clauses.push(ilike(reportsTable.title, `%${search}%`));
  if (mine) clauses.push(eq(reportsTable.userId, getUserId(req)));
  // Other people's reports are private: everyone but the admin only sees resolved ones.
  else if (!req.authUser?.isAdmin) clauses.push(eq(reportsTable.status, "resolved"));
  const rows = await db.select().from(reportsTable).where(clauses.length ? and(...clauses) : undefined).orderBy(sort === "supported" ? desc(reportsTable.supportCount) : desc(reportsTable.createdAt));
  res.json(ListReportsResponse.parse(rows.map((row) => toReport(row, req))));
});

router.post("/reports", async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "سجّل الدخول أولًا حتى تقدر ترسل البلاغ." });
    return;
  }
  await ensureSeeded();
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "يرجى إكمال الصورة والتصنيف والوصف والموقع قبل الإرسال." });
    return;
  }
  const category = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parsed.data.category)).limit(1);
  const level = levelFor(await getLifetimePoints(req.authUser.id));

  // The AI looks at the photo + text and suggests the responsible agency. This
  // only records a suggestion for the admin: nothing is sent to any agency.
  let routing: Awaited<ReturnType<typeof routeReport>> | undefined;
  try {
    routing = await routeReport(
      { title: parsed.data.title, description: parsed.data.description, category: parsed.data.category, locationName: parsed.data.locationName },
      {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        model: process.env.AGENCY_AI_MODEL,
        loadImage: () => loadReportImage(parsed.data.image),
      },
    );
  } catch (error) {
    req.log.error({ err: error }, "Agency routing failed; report will be created without a suggestion");
  }
  const agency = getAgency(routing?.agencyId);

  const [report] = await db.insert(reportsTable).values({
    ...parsed.data,
    locationExact: parsed.data.locationExact ?? false,
    userId: req.authUser.id,
    authorName: req.authUser.name,
    categoryLabel: category[0]?.label ?? "أخرى",
    status: "received",
    points: level.reportPoints,
    supportCount: 0,
    isDemo: false,
    agencyId: agency?.id ?? null,
    agencyName: agency?.name ?? null,
    agencyReason: routing?.reason ?? null,
    agencyConfidence: routing?.confidence ?? null,
    agencySource: routing?.source ?? null,
  }).returning();
  req.log.info({ reportId: report.id, agencyId: agency?.id ?? null, source: routing?.source ?? null, sent: false }, "Agency referral prepared (simulated, nothing was sent)");
  await db.insert(pointsTable).values({ userId: req.authUser.id, reportId: report.id, amount: level.reportPoints, reason: "إرسال بلاغ صالح" });
  await db.update(usersTable).set({ points: sql`${usersTable.points} + ${level.reportPoints}` }).where(eq(usersTable.id, req.authUser.id));
  res.status(201).json(CreateReportResponse.parse(toReport(report, req)));
});

router.get("/reports/:id", async (req, res) => {
  await ensureSeeded();
  const parsed = GetReportParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "رقم البلاغ غير صالح." });
    return;
  }
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, parsed.data.id)).limit(1);
  if (!report || !canView(req, report)) {
    res.status(404).json({ error: "البلاغ غير موجود." });
    return;
  }
  res.json(GetReportResponse.parse(toReport(report, req)));
});

router.patch("/reports/:id", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "تحديث البلاغات مخصص للإدارة." });
    return;
  }
  await ensureSeeded();
  const params = UpdateReportParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateReportBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "التحديث غير صالح." });
    return;
  }
  const [before] = await db.select().from(reportsTable).where(eq(reportsTable.id, params.data.id)).limit(1);
  if (!before) {
    res.status(404).json({ error: "البلاغ غير موجود." });
    return;
  }
  const { agencyId, ...changes } = body.data;
  const override = agencyId === undefined ? undefined : getAgency(agencyId);
  if (agencyId !== undefined && !override) {
    res.status(400).json({ error: "الجهة غير معروفة." });
    return;
  }
  const [report] = await db.update(reportsTable).set({
    ...changes,
    ...(override ? { agencyId: override.id, agencyName: override.name, agencyReason: "حددتها الإدارة.", agencyConfidence: 1, agencySource: "admin" } : {}),
    updatedAt: new Date(),
  }).where(eq(reportsTable.id, params.data.id)).returning();
  if (changes.status && changes.status !== before.status) {
    await db.insert(notificationsTable).values({
      userId: report.userId,
      title: "تم تحديث حالة بلاغك",
      body: `بلاغك في منطقة ${report.locationName} انتقل إلى مرحلة ${statusLabels[report.status]}${report.status === "referred" && report.agencyName ? ` (${report.agencyName})` : ""}.`,
      read: false,
    });
    if (changes.status === "resolved") {
      const bonus = levelFor(await getLifetimePoints(report.userId)).resolvedBonus;
      await db.insert(pointsTable).values({ userId: report.userId, reportId: report.id, amount: bonus, reason: "تمت معالجة البلاغ" });
      await db.update(usersTable).set({ points: sql`${usersTable.points} + ${bonus}` }).where(eq(usersTable.id, report.userId));
    }
  }
  res.json(UpdateReportResponse.parse(toReport(report, req)));
});

router.get("/agencies", (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "هذه الصفحة مخصصة للإدارة." });
    return;
  }
  res.json(AGENCIES.map(({ id, name }) => ({ id, name })));
});

// Admin-only preview of the message that would be sent to the suggested
// agency. It is never sent: prepareReferral has no transport.
router.get("/reports/:id/referral-preview", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "هذه الصفحة مخصصة للإدارة." });
    return;
  }
  const id = Number(req.params.id);
  const [report] = Number.isInteger(id) ? await db.select().from(reportsTable).where(eq(reportsTable.id, id)).limit(1) : [];
  const draft = report?.agencyId ? prepareReferral(report, report.agencyId) : null;
  if (!draft) {
    res.status(404).json({ error: "لا توجد جهة مقترحة لهذا البلاغ." });
    return;
  }
  res.json(draft);
});

router.delete("/reports/:id", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "حذف البلاغات مخصص للإدارة." });
    return;
  }
  const params = UpdateReportParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "رقم البلاغ غير صالح." });
    return;
  }
  const [report] = await db.delete(reportsTable).where(eq(reportsTable.id, params.data.id)).returning();
  if (!report) {
    res.status(404).json({ error: "البلاغ غير موجود." });
    return;
  }
  await db.delete(locationsTable).where(eq(locationsTable.reportId, params.data.id));
  res.status(204).send();
});

router.post("/reports/:id/support", async (req, res) => {
  await ensureSeeded();
  const params = SupportReportParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "البلاغ غير صالح." });
    return;
  }
  // Only resolved reports are public, so only those can be supported.
  const [report] = await db.update(reportsTable).set({ supportCount: sql`${reportsTable.supportCount} + 1`, updatedAt: new Date() }).where(and(eq(reportsTable.id, params.data.id), eq(reportsTable.status, "resolved"))).returning();
  if (!report) {
    res.status(404).json({ error: "البلاغ غير موجود." });
    return;
  }
  res.json(SupportReportResponse.parse(toReport(report, req)));
});

export default router;