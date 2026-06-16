import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { userUsageTable, usersTable, subscriptionPlansTable, appConfigTable, passwordResetsTable } from "@workspace/db";
import { eq, and, ilike, or, desc, isNull } from "drizzle-orm";
import { sendPasswordResetEmail } from "../lib/email";
import { issueToken } from "../lib/session";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "./admin";

const FREE_DAILY_LIMIT = 10;
const MAX_FAILED_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Per-email registration rate limit (in-memory, no DB required)
// 3 attempts per email per hour to block rotating-IP abuse.
// ---------------------------------------------------------------------------
const EMAIL_REGISTER_MAX = 3;
const EMAIL_REGISTER_WINDOW_MS = 60 * 60 * 1000;

interface EmailAttemptRecord {
  count: number;
  resetAt: number;
}

const emailRegisterAttempts = new Map<string, EmailAttemptRecord>();

function checkEmailRegisterLimit(email: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const record = emailRegisterAttempts.get(email);
  if (!record || now >= record.resetAt) {
    emailRegisterAttempts.set(email, { count: 1, resetAt: now + EMAIL_REGISTER_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (record.count >= EMAIL_REGISTER_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count++;
  return { allowed: true, retryAfterSec: 0 };
}

const router = Router();

function stableIdFromEmail(email: string): string {
  return (
    "user_" +
    Buffer.from(email.toLowerCase()).toString("base64").replace(/[^a-z0-9]/gi, "").slice(0, 16)
  );
}

async function getFreeDailyLimit(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "free_daily_limit"));
    const val = parseInt(row?.value ?? "10", 10);
    return isNaN(val) ? FREE_DAILY_LIMIT : val;
  } catch {
    return FREE_DAILY_LIMIT;
  }
}

type PublicUser = Omit<typeof usersTable.$inferSelect, "passwordHash" | "failedLoginAttempts" | "lockedUntil"> & { hasPassword: boolean };

type AdminUser = PublicUser & {
  isLocked: boolean;
  lockedUntil: string | null;
  failedLoginAttempts: number;
};

function toPublicUser(row: typeof usersTable.$inferSelect): PublicUser {
  const { passwordHash, failedLoginAttempts: _fa, lockedUntil: _lu, ...rest } = row;
  return { ...rest, hasPassword: !!passwordHash };
}

function toAdminUser(row: typeof usersTable.$inferSelect): AdminUser {
  const { passwordHash, ...rest } = row;
  const now = Date.now();
  const isLocked = !!rest.lockedUntil && rest.lockedUntil.getTime() > now;
  return {
    ...rest,
    hasPassword: !!passwordHash,
    isLocked,
    lockedUntil: rest.lockedUntil ? rest.lockedUntil.toISOString() : null,
  };
}

async function syncTodayUsagePremium(userId: string, isPremium: boolean): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const [existing] = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));
  if (existing) {
    await db
      .update(userUsageTable)
      .set({ isPremium: isPremium ? "true" : "false" })
      .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));
  }
}

// ---------------------------------------------------------------------------
// Specific routes first (must be registered before /users/:id)
// ---------------------------------------------------------------------------

router.get("/users/usage", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const today = new Date().toISOString().split("T")[0];
    const [row] = await db
      .select()
      .from(userUsageTable)
      .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));

    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const isPremium = account?.isPremium === "true" || row?.isPremium === "true";

    let planDailyLimit: number | null = null;
    if (account?.planId != null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, account.planId));
      if (plan) planDailyLimit = plan.dailyLimit;
    }

    const freeLimit = await getFreeDailyLimit();
    const dailyCount = row?.count ?? 0;
    const dailyLimit = isPremium
      ? planDailyLimit != null && planDailyLimit >= 0
        ? planDailyLimit
        : 9999
      : planDailyLimit != null && planDailyLimit >= 0
        ? planDailyLimit
        : freeLimit;
    const remainingToday = dailyLimit >= 9999 ? 9999 : Math.max(0, dailyLimit - dailyCount);

    res.json({ userId, dailyCount, dailyLimit, isPremium, remainingToday });
  } catch (err) {
    req.log.error({ err }, "Failed to get user usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/register", async (req, res) => {
  try {
    const { email, name, password, provider, avatar, id } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return void res.status(400).json({ error: "email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return void res.status(400).json({ error: "Invalid email" });
    }

    const emailLimit = checkEmailRegisterLimit(normalizedEmail);
    if (!emailLimit.allowed) {
      res.setHeader("Retry-After", String(emailLimit.retryAfterSec));
      return void res.status(429).json({
        error: "Too many registration attempts for this email. Please try again later.",
        retryAfterSec: emailLimit.retryAfterSec,
      });
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (existing) {
      // Account already exists — treat register like a login when credentials match,
      // otherwise reject so we never silently overwrite an account or sign in
      // without proof of ownership.
      if (!existing.passwordHash) {
        // Account was created via Google or another passwordless flow.
        // Refuse to set a new password here — doing so would let any caller
        // take over the account without proving ownership.
        return void res.status(401).json({ error: "Account registered with a different sign-in method. Please use the correct sign-in method." });
      }
      if (!password) {
        return void res.status(401).json({ error: "Account exists. Sign in with your password." });
      }
      // Enforce lockout before comparing the password.
      if (existing.lockedUntil && existing.lockedUntil.getTime() > Date.now()) {
        const secondsLeft = Math.ceil((existing.lockedUntil.getTime() - Date.now()) / 1000);
        return void res.status(423).json({
          error: "Account temporarily locked due to too many failed login attempts. Try again later.",
          lockedUntil: existing.lockedUntil.toISOString(),
          secondsLeft,
        });
      }
      const ok = await bcrypt.compare(String(password), existing.passwordHash);
      if (!ok) {
        const nextAttempts = existing.failedLoginAttempts + 1;
        const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
        await db
          .update(usersTable)
          .set({
            failedLoginAttempts: nextAttempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : existing.lockedUntil,
          })
          .where(eq(usersTable.id, existing.id));
        if (shouldLock) {
          return void res.status(423).json({
            error: "Account temporarily locked due to too many failed login attempts. Try again later.",
            lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString(),
            secondsLeft: Math.ceil(LOCKOUT_DURATION_MS / 1000),
          });
        }
        return void res.status(401).json({
          error: "Account exists. Wrong password.",
          remainingAttempts: MAX_FAILED_LOGIN_ATTEMPTS - nextAttempts,
        });
      }
      const updates: Record<string, unknown> = {
        failedLoginAttempts: 0,
        lockedUntil: null,
      };
      if (name && !existing.name) updates.name = String(name);
      if (avatar) updates.avatar = String(avatar);
      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, existing.id))
        .returning();
      return void res.json({ ...toPublicUser(updated), token: issueToken(updated.id) });
    }

    const userId = id ?? stableIdFromEmail(normalizedEmail);
    const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;
    const [created] = await db
      .insert(usersTable)
      .values({
        id: userId,
        email: normalizedEmail,
        name: name ? String(name) : normalizedEmail.split("@")[0],
        passwordHash,
        provider: provider === "google" ? "google" : "email",
        avatar: avatar ? String(avatar) : null,
      })
      .returning();
    res.status(201).json({ ...toPublicUser(created), token: issueToken(created.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to register user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return void res.status(400).json({ error: "email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (!user) return void res.status(401).json({ error: "Invalid email or password" });

    // Check account lockout before any password work.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const secondsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      return void res.status(423).json({
        error: "Account temporarily locked due to too many failed login attempts. Try again later.",
        lockedUntil: user.lockedUntil.toISOString(),
        secondsLeft,
      });
    }

    if (user.passwordHash) {
      if (!password) return void res.status(400).json({ error: "Password is required" });
      const ok = await bcrypt.compare(String(password), user.passwordHash);
      if (!ok) {
        const nextAttempts = user.failedLoginAttempts + 1;
        const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
        await db
          .update(usersTable)
          .set({
            failedLoginAttempts: nextAttempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : user.lockedUntil,
          })
          .where(eq(usersTable.id, user.id));
        if (shouldLock) {
          return void res.status(423).json({
            error: "Account temporarily locked due to too many failed login attempts. Try again later.",
            lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString(),
            secondsLeft: Math.ceil(LOCKOUT_DURATION_MS / 1000),
          });
        }
        return void res.status(401).json({
          error: "Invalid email or password",
          remainingAttempts: MAX_FAILED_LOGIN_ATTEMPTS - nextAttempts,
        });
      }
    } else {
      // Account has no password (Google/OAuth or other passwordless account).
      // Reject unconditionally — whether or not the caller supplied a password —
      // to prevent email-only account takeover. Passwordless accounts must
      // authenticate via their original sign-in method, not this endpoint.
      return void res.status(401).json({ error: "This account uses a different sign-in method. Please use the correct sign-in method." });
    }

    // Successful login — reset failure counter and any expired lock.
    const [loggedIn] = await db
      .update(usersTable)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json({ ...toPublicUser(loggedIn), token: issueToken(loggedIn.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to login user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Forgot / reset password (self-service via emailed code)
// ---------------------------------------------------------------------------

function generateResetCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/users/forgot-password", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return void res.status(400).json({ error: "email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Always respond 200 to avoid leaking which emails are registered.
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (!user) return void res.json({ ok: true });

    const code = generateResetCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidate any previous outstanding codes for this user.
    await db.delete(passwordResetsTable).where(eq(passwordResetsTable.userId, user.id));
    await db.insert(passwordResetsTable).values({ userId: user.id, codeHash, expiresAt });

    try {
      await sendPasswordResetEmail(normalizedEmail, code);
    } catch (err) {
      req.log.error({ err }, "Failed to send reset email");
      return void res.status(502).json({ error: "Could not send reset email. Try again later." });
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to start password reset");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/reset-password-with-code", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return void res.status(400).json({ error: "email is required" });
    }
    if (!code || typeof code !== "string") {
      return void res.status(400).json({ error: "code is required" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4) {
      return void res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Single generic message for all failure modes to avoid leaking account
    // state or signalling code-guessing progress.
    const INVALID = "Invalid or expired code. Request a new one.";
    const MAX_ATTEMPTS = 5;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (!user) return void res.status(400).json({ error: INVALID });

    const [reset] = await db
      .select()
      .from(passwordResetsTable)
      .where(and(eq(passwordResetsTable.userId, user.id), isNull(passwordResetsTable.usedAt)))
      .orderBy(desc(passwordResetsTable.createdAt));

    if (!reset || reset.expiresAt.getTime() < Date.now() || reset.attempts >= MAX_ATTEMPTS) {
      return void res.status(400).json({ error: INVALID });
    }

    const ok = await bcrypt.compare(String(code), reset.codeHash);
    if (!ok) {
      // Count the failed guess; burn the code once too many wrong tries occur.
      const nextAttempts = reset.attempts + 1;
      await db
        .update(passwordResetsTable)
        .set({
          attempts: nextAttempts,
          usedAt: nextAttempts >= MAX_ATTEMPTS ? new Date() : reset.usedAt,
        })
        .where(eq(passwordResetsTable.id, reset.id));
      return void res.status(400).json({ error: INVALID });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    await db.update(passwordResetsTable).set({ usedAt: new Date() }).where(eq(passwordResetsTable.id, reset.id));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reset password with code");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;
    const base = db.select().from(usersTable);
    const rows = search
      ? await base
          .where(or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`)))
          .orderBy(desc(usersTable.createdAt))
      : await base.orderBy(desc(usersTable.createdAt));
    res.json(rows.map(toAdminUser));
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", requireAdmin, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));
    if (!user) return void res.status(404).json({ error: "Not found" });
    res.json(toAdminUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { name, email, isPremium, planId } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name);
    if (email !== undefined) updates.email = String(email).trim().toLowerCase();
    if (isPremium !== undefined) updates.isPremium = isPremium === true || isPremium === "true" ? "true" : "false";
    if (planId !== undefined) updates.planId = planId === null ? null : Number(planId);
    if (Object.keys(updates).length === 0) {
      return void res.status(400).json({ error: "No fields to update" });
    }

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!user) return void res.status(404).json({ error: "Not found" });
    if (updates.isPremium !== undefined) {
      await syncTodayUsagePremium(user.id, user.isPremium === "true");
    }
    res.json(toAdminUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/plan", requireAdmin, async (req, res) => {
  try {
    const { planId } = req.body ?? {};
    if (planId === undefined) return void res.status(400).json({ error: "planId is required" });

    let isPremium = false;
    let resolvedPlanId: number | null = null;
    if (planId !== null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, Number(planId)));
      if (!plan) return void res.status(404).json({ error: "Plan not found" });
      resolvedPlanId = plan.id;
      const freeLimit = await getFreeDailyLimit();
      isPremium = plan.dailyLimit < 0 || plan.dailyLimit > freeLimit || parseFloat(plan.price) > 0;
    }

    const [user] = await db
      .update(usersTable)
      .set({ planId: resolvedPlanId, isPremium: isPremium ? "true" : "false" })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!user) return void res.status(404).json({ error: "Not found" });
    await syncTodayUsagePremium(user.id, isPremium);
    res.json(toAdminUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to enroll user in plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/unlock", requireAdmin, async (req, res) => {
  try {
    const [user] = await db
      .update(usersTable)
      .set({ lockedUntil: null, failedLoginAttempts: 0 })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!user) return void res.status(404).json({ error: "Not found" });
    req.log.info({ userId: req.params.id }, "Admin unlocked user account");
    res.json(toAdminUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to unlock user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { password } = req.body ?? {};
    if (!password || String(password).length < 4) {
      return void res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const [user] = await db
      .update(usersTable)
      .set({ passwordHash: hash })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!user) return void res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reset password");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!deleted) return void res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
