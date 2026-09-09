import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  AdminCreateRewardBody,
  AdminUpdateRewardBody,
  AdminUpdateRewardParams,
  RedeemRewardParams,
  ListRewardsResponse,
  ListRedemptionsResponse,
  RedeemRewardResponse,
  AdminListRewardsResponse,
  AdminCreateRewardResponse,
  AdminUpdateRewardResponse,
} from "@workspace/api-zod";
import { db, notificationsTable, pointsTable, redemptionsTable, rewardsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

const rewardSeed = [
  { title: "خصم على القهوة", description: "خصم 15% على أي مشروب في فروع قهوة الديوانية.", partnerName: "قهوة الديوانية", discountLabel: "15% خصم", costPoints: 150, stock: null, background: "#3f5945" },
  { title: "وجبة مجانية", description: "وجبة رئيسية مجانية عند زيارتك لمطعم بيت الطعم.", partnerName: "مطعم بيت الطعم", discountLabel: "وجبة مجانية", costPoints: 400, stock: 20, background: "#7a4a2b" },
  { title: "خصم على غسيل السيارة", description: "خصم 20% على باقات الغسيل الخارجي والداخلي.", partnerName: "غسيل السيارات الذكي", discountLabel: "20% خصم", costPoints: 250, stock: null, background: "#2d4e3e" },
  { title: "تذكرة سينما", description: "تذكرة دخول مجانية لأي عرض في سينمات الكويت.", partnerName: "سينمات الكويت", discountLabel: "تذكرة مجانية", costPoints: 600, stock: 10, background: "#3a3357" },
  { title: "خصم على القرطاسية", description: "خصم 10% على مستلزمات القرطاسية والكتب.", partnerName: "مكتبة الفانوس", discountLabel: "10% خصم", costPoints: 100, stock: null, background: "#5c4a2d" },
] as const;

function demoRewardImage(label: string, background: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="${background}"/><circle cx="800" cy="150" r="120" fill="#ffffff" opacity=".08"/><circle cx="120" cy="520" r="90" fill="#ffffff" opacity=".06"/><text x="48" y="330" font-family="Arial" font-size="46" font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let rewardSeedPromise: Promise<void> | undefined;

async function seedRewards() {
  const existing = await db.select({ id: rewardsTable.id }).from(rewardsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(rewardsTable).values(
    rewardSeed.map((reward) => ({
      title: reward.title,
      description: reward.description,
      image: demoRewardImage(reward.title, reward.background),
      partnerName: reward.partnerName,
      discountLabel: reward.discountLabel,
      costPoints: reward.costPoints,
      stock: reward.stock,
      isActive: true,
    })),
  );
}

function ensureRewardsSeeded() {
  rewardSeedPromise ??= seedRewards();
  return rewardSeedPromise;
}

function toReward(reward: typeof rewardsTable.$inferSelect) {
  return { ...reward, createdAt: reward.createdAt.toISOString() };
}

function toRedemption(redemption: typeof redemptionsTable.$inferSelect) {
  return { ...redemption, createdAt: redemption.createdAt.toISOString() };
}

function generateCode() {
  return `NJM-${randomBytes(3).toString("hex").toUpperCase()}`;
}

router.get("/rewards", async (_req, res) => {
  await ensureRewardsSeeded();
  const rows = await db.select().from(rewardsTable).where(eq(rewardsTable.isActive, true)).orderBy(rewardsTable.costPoints);
  res.json(ListRewardsResponse.parse(rows.map(toReward)));
});

router.get("/rewards/redemptions", async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "يرجى تسجيل الدخول أولًا." });
    return;
  }
  const rows = await db.select().from(redemptionsTable).where(eq(redemptionsTable.userId, req.authUser.id)).orderBy(desc(redemptionsTable.createdAt));
  res.json(ListRedemptionsResponse.parse(rows.map(toRedemption)));
});

router.post("/rewards/:id/redeem", async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "سجّل الدخول أولًا حتى تقدر تستبدل النقاط." });
    return;
  }
  const params = RedeemRewardParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "الجائزة غير صالحة." });
    return;
  }
  const userId = req.authUser.id;

  try {
    const redemption = await db.transaction(async (tx) => {
      const [reward] = await tx.select().from(rewardsTable).where(eq(rewardsTable.id, params.data.id)).limit(1);
      if (!reward || !reward.isActive) {
        throw new RedeemError(404, "الجائزة غير موجودة.");
      }
      if (reward.stock !== null && reward.stock <= 0) {
        throw new RedeemError(400, "نفدت الكمية المتاحة من هذه الجائزة.");
      }
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user || user.points < reward.costPoints) {
        throw new RedeemError(400, "نقاطك لا تكفي لاستبدال هذه الجائزة.");
      }

      const [deducted] = await tx
        .update(usersTable)
        .set({ points: sql`${usersTable.points} - ${reward.costPoints}` })
        .where(and(eq(usersTable.id, userId), sql`${usersTable.points} >= ${reward.costPoints}`))
        .returning();
      if (!deducted) {
        throw new RedeemError(400, "نقاطك لا تكفي لاستبدال هذه الجائزة.");
      }

      if (reward.stock !== null) {
        const [decremented] = await tx
          .update(rewardsTable)
          .set({ stock: sql`${rewardsTable.stock} - 1` })
          .where(and(eq(rewardsTable.id, reward.id), gt(rewardsTable.stock, 0)))
          .returning();
        if (!decremented) {
          throw new RedeemError(400, "نفدت الكمية المتاحة من هذه الجائزة.");
        }
      }

      let created: typeof redemptionsTable.$inferSelect | undefined;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        try {
          [created] = await tx
            .insert(redemptionsTable)
            .values({
              userId,
              rewardId: reward.id,
              code: generateCode(),
              costPoints: reward.costPoints,
              rewardTitle: reward.title,
              partnerName: reward.partnerName,
              discountLabel: reward.discountLabel,
            })
            .returning();
        } catch (cause) {
          if (attempt === 4) throw cause;
        }
      }
      if (!created) throw new RedeemError(500, "تعذر إنشاء كود الاستبدال.");

      await tx.insert(pointsTable).values({ userId, reportId: null, amount: -reward.costPoints, reason: `استبدال: ${reward.title}` });
      await tx.insert(notificationsTable).values({
        userId,
        title: "تم استبدال جائزتك",
        body: `استبدلت ${reward.title} مقابل ${reward.costPoints} نقطة. كود الاستبدال: ${created.code}`,
        read: false,
      });

      return created;
    });
    res.json(RedeemRewardResponse.parse(toRedemption(redemption)));
  } catch (cause) {
    if (cause instanceof RedeemError) {
      res.status(cause.status).json({ error: cause.message });
      return;
    }
    throw cause;
  }
});

router.get("/admin/rewards", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "إدارة المتجر مخصصة للإدارة." });
    return;
  }
  await ensureRewardsSeeded();
  const rows = await db.select().from(rewardsTable).orderBy(desc(rewardsTable.createdAt));
  res.json(AdminListRewardsResponse.parse(rows.map(toReward)));
});

router.post("/admin/rewards", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "إدارة المتجر مخصصة للإدارة." });
    return;
  }
  const parsed = AdminCreateRewardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "يرجى إكمال بيانات الجائزة قبل الإضافة." });
    return;
  }
  const [reward] = await db.insert(rewardsTable).values({ ...parsed.data, stock: parsed.data.stock ?? null, isActive: true }).returning();
  res.status(201).json(AdminCreateRewardResponse.parse(toReward(reward)));
});

router.patch("/admin/rewards/:id", async (req, res) => {
  if (!req.authUser?.isAdmin) {
    res.status(403).json({ error: "إدارة المتجر مخصصة للإدارة." });
    return;
  }
  const params = AdminUpdateRewardParams.safeParse({ id: Number(req.params.id) });
  const body = AdminUpdateRewardBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "تحديث الجائزة غير صالح." });
    return;
  }
  const [reward] = await db.update(rewardsTable).set(body.data).where(eq(rewardsTable.id, params.data.id)).returning();
  if (!reward) {
    res.status(404).json({ error: "الجائزة غير موجودة." });
    return;
  }
  res.json(AdminUpdateRewardResponse.parse(toReward(reward)));
});

class RedeemError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export default router;
