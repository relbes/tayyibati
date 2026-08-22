import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Request, Response } from "express";
import { db, adminUsersTable, adminSessionsTable, type AdminUser } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const COOKIE_NAME = "tayyibati_admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function seedInitialAdmin(): Promise<void> {
  try {
    const existing = await db.select().from(adminUsersTable).limit(1);
    if (existing.length > 0) {
      return; // Already initialized
    }

    const rawPassword = (process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || "").trim();
    if (!rawPassword) {
      console.warn("[ADMIN AUTH] Initial admin seeding skipped: ADMIN_INITIAL_PASSWORD is not configured.");
      return;
    }

    const username = (process.env.ADMIN_INITIAL_USERNAME || "admin").trim();
    const email = (process.env.ADMIN_INITIAL_EMAIL || "admin@tayyibati.local").trim();

    const passwordHash = await hashPassword(rawPassword);
    const id = "admin_" + crypto.randomBytes(8).toString("hex");

    await db.insert(adminUsersTable).values({
      id,
      username,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    });

    console.log("[ADMIN AUTH] Initial admin account seeded successfully");
  } catch (err) {
    console.error("[ADMIN AUTH] Failed to seed initial admin account:", err);
  }
}

/**
 * Creates a server-side session and sets HttpOnly cookie.
 */
export async function createAdminSession(adminUserId: string, res: Response): Promise<string> {
  const sessionId = "sess_" + crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(adminSessionsTable).values({
    id: sessionId,
    adminUserId,
    expiresAt,
  });

  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return sessionId;
}

/**
 * Destroys session on logout.
 */
export async function destroyAdminSession(req: Request, res: Response): Promise<void> {
  const sessionId = getSessionIdFromRequest(req);
  if (sessionId) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, sessionId));
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Invalidates all active sessions for a specific admin user (e.g. after password change).
 */
export async function invalidateAllAdminSessions(adminUserId: string, res?: Response): Promise<void> {
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.adminUserId, adminUserId));
  if (res) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
  }
}

function getSessionIdFromRequest(req: Request): string | null {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

/**
 * Validates active admin session.
 */
export async function getAdminSession(req: Request): Promise<{ admin: AdminUser; sessionId: string } | null> {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;

  const now = new Date();
  const rows = await db
    .select({
      session: adminSessionsTable,
      admin: adminUsersTable,
    })
    .from(adminSessionsTable)
    .innerJoin(adminUsersTable, eq(adminSessionsTable.adminUserId, adminUsersTable.id))
    .where(and(eq(adminSessionsTable.id, sessionId), gt(adminSessionsTable.expiresAt, now)));

  if (rows.length === 0) {
    // Delete expired session if present
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, sessionId)).catch(() => {});
    return null;
  }

  const { admin } = rows[0];
  if (!admin.isActive) {
    return null;
  }

  return { admin, sessionId };
}
