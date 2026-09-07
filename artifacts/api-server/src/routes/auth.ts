import { Router, type IRouter, type Request, type Response } from "express";
import { RegisterAccountBody, LoginAccountBody, GetCurrentUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { clearSession, createSession, hashPassword, safeUser, verifyPassword } from "../lib/auth";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@najammelha.kw";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Najammelha@2026";

router.get("/auth/user", (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "يرجى تسجيل الدخول أولًا." });
    return;
  }
  res.json(GetCurrentUserResponse.parse(safeUser(req.authUser)));
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = RegisterAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "أدخل الاسم والبريد وكلمة مرور من 8 أحرف على الأقل." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (email === ADMIN_EMAIL) {
    res.status(400).json({ error: "هذا البريد مخصص للإدارة." });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(400).json({ error: "هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول." });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    id: `user-${randomUUID()}`,
    name: parsed.data.name.trim(),
    email,
    passwordHash: hashPassword(parsed.data.password),
    points: 0,
    isAdmin: false,
  }).returning();
  await createSession(user.id, res);
  res.status(201).json(GetCurrentUserResponse.parse(safeUser(user)));
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "أدخل البريد وكلمة المرور." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user && email === ADMIN_EMAIL) {
    [user] = await db.insert(usersTable).values({
      id: "admin-user",
      name: "إدارة نجمّلها",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      points: 0,
      isAdmin: true,
    }).returning();
  }
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة." });
    return;
  }
  await createSession(user.id, res);
  res.json(GetCurrentUserResponse.parse(safeUser(user)));
});

router.post("/auth/logout", async (req, res) => {
  await clearSession(req, res);
  res.json({ success: true });
});

export default router;