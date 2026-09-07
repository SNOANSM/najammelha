import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

export type AuthUser = typeof usersTable.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const COOKIE_NAME = "najammelha_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, res: Response) {
  const token = randomUUID() + randomBytes(24).toString("hex");
  await db.insert(sessionsTable).values({
    tokenHash: tokenHash(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 86400000,
    path: "/",
  });
}

export async function clearSession(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash(token)));
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const [session] = await db.select().from(sessionsTable).where(and(eq(sessionsTable.tokenHash, tokenHash(token)), gt(sessionsTable.expiresAt, new Date()))).limit(1);
    if (session) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
      if (user) req.authUser = user;
    }
  }
  next();
}

export function safeUser(user: AuthUser) {
  return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, points: user.points };
}