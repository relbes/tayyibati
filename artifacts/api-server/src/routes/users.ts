import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { userUsageTable, usersTable, subscriptionPlansTable, appConfigTable, passwordResetsTable } from "@workspace/db";
import { eq, and, ilike, or, desc, isNull } from "drizzle-orm";
import { sendPasswordResetEmail } from "../lib/email";

const FREE_DAILY_LIMIT = 10;

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

type PublicUser = Omit<typeof usersTable.$inferSelect, "passwordHash"> & { hasPassword: boolean };

function toPublicUser(row: typeof usersTable.$inferSelect): PublicUser {
  const { passwordHash, ...rest } = row;
  return { ...rest, hasPassword: !!passwordHash };
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

router.get("/users/usage", async (req, res) => {
  try {
    const { userId } = req.query as Record<string, string>;
    if (!userId) return void res.status(400).json({ error: "userId is required" });

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

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (existing) {
      // Account already exists — treat register like a login when credentials match,
      // otherwise reject so we never silently overwrite an account or sign in
      // without proof of ownership.
      if (existing.passwordHash) {
        if (!password) {
          return void res.status(401).json({ error: "Account exists. Sign in with your password." });
        }
        const ok = await bcrypt.compare(String(password), existing.passwordHash);
        if (!ok) return void res.status(401).json({ error: "Account exists. Wrong password." });
      }
      const updates: Record<string, unknown> = {};
      if (!existing.passwordHash && password) {
        updates.passwordHash = await bcrypt.hash(String(password), 10);
      }
      if (name && !existing.name) updates.name = String(name);
      if (avatar) updates.avatar = String(avatar);
      let row = existing;
      if (Object.keys(updates).length > 0) {
        const [updated] = await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, existing.id))
          .returning();
        row = updated;
      }
      return void res.json(toPublicUser(row));
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
    res.status(201).json(toPublicUser(created));
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

    if (user.passwordHash) {
      if (!password) return void res.status(400).json({ error: "Password is required" });
      const ok = await bcrypt.compare(String(password), user.passwordHash);
      if (!ok) return void res.status(401).json({ error: "Invalid email or password" });
    } else if (password) {
      // Legacy account with no password set — set it on first login.
      const hash = await bcrypt.hash(String(password), 10);
      const [updated] = await db
        .update(usersTable)
        .set({ passwordHash: hash })
        .where(eq(usersTable.id, user.id))
        .returning();
      return void res.json(toPublicUser(updated));
    }

    res.json(toPublicUser(user));
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

router.get("/users", async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;
    const base = db.select().from(usersTable);
    const rows = search
      ? await base
          .where(or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`)))
          .orderBy(desc(usersTable.createdAt))
      : await base.orderBy(desc(usersTable.createdAt));
    res.json(rows.map(toPublicUser));
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id));
    if (!user) return void res.status(404).json({ error: "Not found" });
    res.json(toPublicUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", async (req, res) => {
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
    res.json(toPublicUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/plan", async (req, res) => {
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
    res.json(toPublicUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to enroll user in plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
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

router.delete("/users/:id", async (req, res) => {
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
