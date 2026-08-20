import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db } from "@workspace/db";
import { userUsageTable, usersTable, subscriptionPlansTable, passwordResetsTable } from "@workspace/db";
import { eq, and, ilike, or, desc, isNull, ne } from "drizzle-orm";
import { sendPasswordResetEmail } from "../lib/email";
import { issueToken } from "../lib/session";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "./admin";
import { getFreeMonthlyLimit } from "../lib/config";
import { getUserPlanLimits } from "./analysis";

const REVENUECAT_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID;

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
  const hash = crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
  return "user_" + hash;
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [existing] = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));
  if (existing) {
    await db
      .update(userUsageTable)
      .set({ isPremium: isPremium ? "true" : "false" })
      .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));
  }
}

// ---------------------------------------------------------------------------
// Specific routes first (must be registered before /users/:id)
// ---------------------------------------------------------------------------

/**
 * Helper to parse active entitlements from RevenueCat API response (supports both v1 and v2 API schemas).
 */
interface RCActiveEntitlement {
  entitlementId: string;
  productId?: string;
}

function parseRevenueCatEntitlements(data: any): RCActiveEntitlement[] {
  const items: RCActiveEntitlement[] = [];
  if (!data || typeof data !== "object") return items;

  // Format 1: RevenueCat v2 API schema (`{ object: "list", items: [...] }`)
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (!item || typeof item !== "object") continue;
      const entId = item.entitlement_id || item.lookup_key || item.identifier || item.id;
      const prodId = item.product_identifier || item.product_id;
      const status = item.status;

      // If status exists (v2 subscription object), verify subscription is active
      if (status && status !== "active" && status !== "in_grace_period") {
        continue;
      }

      if (entId || prodId) {
        items.push({
          entitlementId: entId ? String(entId) : "premium",
          productId: prodId ? String(prodId) : undefined,
        });
      }
    }
  }

  // Format 2: RevenueCat v1 API schema (`{ subscriber: { entitlements: { [entId]: { ... } } } }`)
  const entitlementsMap = data.subscriber?.entitlements || data.entitlements;
  if (entitlementsMap && typeof entitlementsMap === "object" && !Array.isArray(entitlementsMap)) {
    const now = new Date().getTime();
    for (const [entId, entData] of Object.entries(entitlementsMap)) {
      if (!entData || typeof entData !== "object") continue;
      const ent = entData as any;
      const expiresDate = ent.expires_date;

      let isActive = true;
      if (expiresDate) {
        const expTime = new Date(expiresDate).getTime();
        if (!isNaN(expTime) && expTime <= now) {
          isActive = false;
        }
      }

      if (isActive) {
        items.push({
          entitlementId: String(entId),
          productId: ent.product_identifier ? String(ent.product_identifier) : undefined,
        });
      }
    }
  }

  // Format 3: RevenueCat v1 Subscriptions schema (`{ subscriber: { subscriptions: { [productId]: { ... } } } }`)
  const subscriptionsMap = data.subscriber?.subscriptions || data.subscriptions;
  if (subscriptionsMap && typeof subscriptionsMap === "object" && !Array.isArray(subscriptionsMap)) {
    const now = new Date().getTime();
    for (const [prodId, subData] of Object.entries(subscriptionsMap)) {
      if (!subData || typeof subData !== "object") continue;
      const sub = subData as any;
      const expiresDate = sub.expires_date;

      let isActive = true;
      if (expiresDate) {
        const expTime = new Date(expiresDate).getTime();
        if (!isNaN(expTime) && expTime <= now) {
          isActive = false;
        }
      }

      if (isActive) {
        // Only push if not already present
        const exists = items.some((i) => i.productId === String(prodId));
        if (!exists) {
          items.push({
            entitlementId: "premium",
            productId: String(prodId),
          });
        }
      }
    }
  }

  return items;
}

/**
 * POST /api/users/me/sync-premium
 * Verifies the caller's RevenueCat entitlement server-side and updates isPremium in the DB.
 * This is the ONLY way the mobile app should grant premium — never trust client-side flags alone.
 */
router.post("/users/me/sync-premium", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { appUserId, originalAppUserId, activeSubscriptions, activeEntitlements } = req.body ?? {};

  try {
    const secretKey = process.env.REVENUECAT_SECRET_KEY || process.env.REVENUECAT_API_KEY;

    // 1. Load user, current plan, and active database plans
    const [currentUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!currentUser) return void res.status(404).json({ error: "User not found" });

    const activePlans = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, "true"))
      .orderBy(subscriptionPlansTable.sortOrder);

    let currentPlan = null;
    if (currentUser.planId != null) {
      currentPlan = activePlans.find((p) => p.id === currentUser.planId) || null;
      if (!currentPlan) {
        const [plan] = await db
          .select()
          .from(subscriptionPlansTable)
          .where(eq(subscriptionPlansTable.id, currentUser.planId));
        currentPlan = plan || null;
      }
    }

    // 2. Call RevenueCat for primary userId
    let rcPremium = false;
    let matchedPlanFromRc: typeof activePlans[0] | null = null;
    let rcSuccess = false;
    let extractedEntitlements: RCActiveEntitlement[] = [];

    const connectors = new ReplitConnectors();
    let cachedV2ProjectId: string | null = process.env.REVENUECAT_PROJECT_ID || null;

    const resolveV2ProjectId = async (key: string): Promise<string | null> => {
      if (cachedV2ProjectId) return cachedV2ProjectId;
      if (process.env.REVENUECAT_PROJECT_ID) {
        cachedV2ProjectId = process.env.REVENUECAT_PROJECT_ID;
        return cachedV2ProjectId;
      }
      try {
        const projRes = await fetch("https://api.revenuecat.com/v2/projects", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        });
        if (projRes.ok) {
          const data = await projRes.json();
          if (Array.isArray(data.items) && data.items.length > 0) {
            cachedV2ProjectId = String(data.items[0].id);
            req.log.info({ projectId: cachedV2ProjectId }, "[SyncPremium] Automatically resolved RevenueCat v2 Project ID");
            return cachedV2ProjectId;
          }
        } else {
          req.log.warn({ status: projRes.status }, "[SyncPremium] Failed to query RevenueCat v2 projects list");
        }
      } catch (err) {
        req.log.warn({ err }, "[SyncPremium] Error querying RevenueCat v2 projects list");
      }
      return null;
    };

    const fetchRcEntitlements = async (targetId: string): Promise<{ success: boolean; items: RCActiveEntitlement[] }> => {
      let items: RCActiveEntitlement[] = [];
      let success = false;

      if (!secretKey) {
        req.log.warn({ targetId }, "[SyncPremium] REVENUECAT_SECRET_KEY is missing in server environment");
        return { success: false, items };
      }

      // 1. Resolve V2 Project ID
      const projectId = await resolveV2ProjectId(secretKey);

      // Attempt 1: Direct RevenueCat REST API v2 Active Entitlements
      if (projectId) {
        try {
          const v2EntRes = await fetch(
            `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(targetId)}/active_entitlements`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (v2EntRes.ok) {
            const data = await v2EntRes.json();
            items = parseRevenueCatEntitlements(data);
            success = true;
            req.log.info({ targetId, itemCount: items.length }, "[SyncPremium] RevenueCat v2 Active Entitlements API query successful");
          } else {
            req.log.warn({ status: v2EntRes.status, targetId }, "[SyncPremium] RevenueCat v2 Active Entitlements API returned non-OK status");
          }
        } catch (err) {
          req.log.warn({ err, targetId }, "[SyncPremium] RevenueCat v2 Active Entitlements API fetch error");
        }
      }

      // Attempt 2: Direct RevenueCat REST API v2 Subscriptions (if attempt 1 returned no active items)
      if (projectId && (!success || items.length === 0)) {
        try {
          const v2SubRes = await fetch(
            `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(targetId)}/subscriptions`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (v2SubRes.ok) {
            const data = await v2SubRes.json();
            const subItems = parseRevenueCatEntitlements(data);
            if (subItems.length > 0) {
              items = [...items, ...subItems];
              success = true;
              req.log.info({ targetId, subItemCount: subItems.length }, "[SyncPremium] RevenueCat v2 Subscriptions API query successful");
            }
          } else {
            req.log.warn({ status: v2SubRes.status, targetId }, "[SyncPremium] RevenueCat v2 Subscriptions API returned non-OK status");
          }
        } catch (err) {
          req.log.warn({ err, targetId }, "[SyncPremium] RevenueCat v2 Subscriptions API fetch error");
        }
      }

      // Attempt 3: Legacy RevenueCat REST API v1 (Fallback for v1 compatible secret keys)
      if (!success && !secretKey.startsWith("sk_")) {
        try {
          const directResV1 = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(targetId)}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/json",
              "X-Platform": "android",
            },
          });
          if (directResV1.ok) {
            const data = await directResV1.json();
            items = parseRevenueCatEntitlements(data);
            success = true;
          } else {
            req.log.warn({ status: directResV1.status, targetId }, "[SyncPremium] RevenueCat v1 REST API returned non-OK status");
          }
        } catch (err) {
          req.log.warn({ err, targetId }, "[SyncPremium] RevenueCat v1 REST API fetch error");
        }
      }

      return { success, items };
    };

    // Primary check for authenticated Tayyibati User ID
    const primaryResult = await fetchRcEntitlements(userId);
    rcSuccess = primaryResult.success;
    extractedEntitlements = primaryResult.items;

    const matchPlan = (items: RCActiveEntitlement[]) => {
      for (const ent of items) {
        if (ent.entitlementId) {
          const planByEnt = activePlans.find((p) => p.revenueCatEntitlementId === ent.entitlementId);
          if (planByEnt) return planByEnt;
        }
        if (ent.productId) {
          const rawId = ent.productId.split(":")[0];
          const planByProd = activePlans.find((p) => p.revenueCatProductId === ent.productId || p.revenueCatProductId === rawId);
          if (planByProd) return planByProd;
        }
      }
      return null;
    };

    // 3. Match primary entitlements against database plans
    if (rcSuccess && extractedEntitlements.length > 0) {
      rcPremium = true;
      matchedPlanFromRc = matchPlan(extractedEntitlements);
    }

    // 4. Secondary check for originalAppUserId if primary has no entitlement
    let rcOriginalUserIdHasEntitlement = false;
    let originalUserIdType: "anonymous" | "identified" | "same" | "none" = "none";

    const targetOriginalId = typeof originalAppUserId === "string" && originalAppUserId.trim() ? originalAppUserId.trim() : null;

    if (!rcPremium && targetOriginalId && targetOriginalId !== userId) {
      const origResult = await fetchRcEntitlements(targetOriginalId);
      if (origResult.success && origResult.items.length > 0) {
        rcOriginalUserIdHasEntitlement = true;
        const isAnon = targetOriginalId.startsWith("$RCAnonymousID") || targetOriginalId.includes("Anonymous");
        originalUserIdType = isAnon ? "anonymous" : "identified";

        // Sever-side verification confirmed active subscription on originalAppUserId!
        // Grant Premium to the authenticated user ID.
        rcPremium = true;
        for (const ent of origResult.items) {
          if (ent.entitlementId) {
            const planByEnt = activePlans.find((p) => p.revenueCatEntitlementId === ent.entitlementId);
            if (planByEnt) { matchedPlanFromRc = planByEnt; break; }
          }
          if (ent.productId) {
            const planByProd = activePlans.find((p) => p.revenueCatProductId === ent.productId);
            if (planByProd) { matchedPlanFromRc = planByProd; break; }
          }
        }
        req.log.info({ userId, targetOriginalId }, "[SyncPremium] Server-side RevenueCat API confirmed active subscription on originalAppUserId. Granting Premium.");
      }
    } else if (targetOriginalId === userId) {
      originalUserIdType = "same";
    }

    // 5. Preserve database state if RevenueCat API was unreachable
    if (!rcSuccess) {
      req.log.info({ userId }, "[SyncPremium] Preserving DB state due to RevenueCat API unavailability");
      return void res.json({
        isPremium: currentUser.isPremium === "true",
        planId: currentUser.planId,
        diagnostic: {
          tayyibatiUserId: userId,
          rcUserIdHasEntitlement: false,
          rcOriginalUserIdHasEntitlement: false,
          originalUserIdType: "none",
          syncSuccess: false,
          reason: "RevenueCat API is temporarily unreachable.",
        },
      });
    }

    const isRcManaged = currentPlan && currentPlan.revenueCatProductId != null && currentPlan.revenueCatProductId !== "";
    const isCurrentPlanAdminAssigned = currentPlan && currentPlan.billingCycle !== "free" && !isRcManaged;

    let finalPremium = currentUser.isPremium === "true";
    let finalPlanId = currentUser.planId;

    if (currentPlan && isCurrentPlanAdminAssigned) {
      finalPlanId = currentPlan.id;
      finalPremium = true;
      req.log.info({ userId }, "[SyncPremium] Preserving Admin-assigned plan");
    } else if (rcPremium) {
      finalPremium = true;
      if (matchedPlanFromRc) {
        finalPlanId = matchedPlanFromRc.id;
      } else if (finalPlanId == null || (currentPlan && currentPlan.billingCycle === "free")) {
        const fallbackPlan = activePlans.find((p) => p.billingCycle !== "free");
        if (fallbackPlan) {
          finalPlanId = fallbackPlan.id;
        }
      }
    } else if (currentUser.isPremium === "true" && !rcOriginalUserIdHasEntitlement) {
      // PREVENT FALSE DOWNGRADES: If user is currently Premium in DB and transfer/indexing may be pending, preserve DB state
      finalPremium = true;
      finalPlanId = currentUser.planId;
      req.log.info({ userId }, "[SyncPremium] Preserving existing Premium status during pending verification");
    } else {
      const freePlan = activePlans.find((p) => p.billingCycle === "free") || (await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.billingCycle, "free")).limit(1))[0];
      finalPlanId = freePlan ? freePlan.id : null;
      finalPremium = false;
    }

    // 6. Save updates to DB
    const [user] = await db
      .update(usersTable)
      .set({
        isPremium: finalPremium ? "true" : "false",
        planId: finalPlanId,
      })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!user) return void res.status(404).json({ error: "User not found" });
    await syncTodayUsagePremium(userId, finalPremium);

    let diagnosticReason = "";
    if (finalPremium) {
      diagnosticReason = "تم التحقق من استحقاق الاشتراك بنجاح وتحديث الحساب إلى ممتاز.";
    } else if (rcOriginalUserIdHasEntitlement) {
      if (originalUserIdType === "anonymous") {
        diagnosticReason = `تم العثور على اشتراك فعّال على الحساب المجهول (${targetOriginalId})، ولكن لم ينقل RevenueCat الاستحقاق إلى المستخدم (${userId}). يرجى التحقق من إعدادات Restore Behavior في لوحة التحكم (Transfer to new App User ID).`;
      } else {
        diagnosticReason = `تم العثور على اشتراك فعّال مرتبطة بالحساب الاصلي (${targetOriginalId}). يتطلب نقل الاشتراكات تفعيل خيار Transfer to new App User ID في RevenueCat.`;
      }
    } else if (Array.isArray(activeSubscriptions) && activeSubscriptions.length > 0) {
      diagnosticReason = `تم رصد شراء عبر متجر التطبيقات (${activeSubscriptions.join(", ")}), لكن خادم RevenueCat لم يرجع استحقاقاً فعّالاً لرمز المستخدم (${userId}).`;
    } else {
      diagnosticReason = `لم يتم العثور على أي استحقاق اشتراك فعّال لرمز المستخدم (${userId}).`;
    }

    req.log.info(
      {
        userId,
        rcSuccess,
        extractedEntitlementsCount: extractedEntitlements.length,
        rcUserIdHasEntitlement: rcPremium,
        rcOriginalUserIdHasEntitlement,
        originalUserIdType,
        matchedPlanId: matchedPlanFromRc?.id ?? null,
        finalPremium,
        finalPlanId,
      },
      "[SyncPremium] Premium sync completed with diagnostic result"
    );

    res.json({
      isPremium: finalPremium,
      planId: finalPlanId,
      diagnostic: {
        tayyibatiUserId: userId,
        rcAppUserIdOnDevice: typeof appUserId === "string" ? appUserId : undefined,
        rcOriginalAppUserIdOnDevice: targetOriginalId || undefined,
        rcUserIdHasEntitlement: rcPremium,
        rcOriginalUserIdHasEntitlement,
        originalUserIdType,
        entitlementIdMatched: matchedPlanFromRc?.revenueCatEntitlementId || null,
        productIdMatched: matchedPlanFromRc?.revenueCatProductId || null,
        syncSuccess: finalPremium,
        reason: diagnosticReason,
      },
    });
  } catch (err) {
    req.log.error({ err }, "[SyncPremium] Failed to sync premium from RevenueCat");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/usage", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [row] = await db
      .select()
      .from(userUsageTable)
      .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));

    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const limits = await getUserPlanLimits(userId);
    const isPremium = account?.isPremium === "true" || row?.isPremium === "true";

    const textLimit = limits.textLimit;
    const imageLimit = limits.imageLimit;

    const monthlyTextCount = row?.textCount ?? 0;
    const monthlyImageCount = row?.imageCount ?? 0;
    const textRemaining = textLimit < 0 ? 9999 : Math.max(0, textLimit - monthlyTextCount);
    const imageRemaining = imageLimit < 0 ? 9999 : Math.max(0, imageLimit - monthlyImageCount);

    res.json({ userId, monthlyTextCount, monthlyImageCount, textLimit, imageLimit, textRemaining, imageRemaining, isPremium });
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

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (!user) return void res.status(404).json({ error: "EMAIL_NOT_FOUND", exists: false });

    const code = generateResetCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidate any previous outstanding codes for this user.
    await db.delete(passwordResetsTable).where(eq(passwordResetsTable.userId, user.id));
    await db.insert(passwordResetsTable).values({ userId: user.id, codeHash, expiresAt });

    try {
      await sendPasswordResetEmail(normalizedEmail, code);
    } catch (err) {
      const errObj = err as any;
      req.log.error({
        err: errObj,
        resendError: errObj.resendError,
        status: errObj.resendError?.status ?? errObj.resendError?.statusCode,
        message: errObj.resendError?.message,
        code: errObj.resendError?.code,
        stack: errObj.resendError?.stack ?? errObj.stack
      }, "Failed to send reset email");
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

router.get("/users/me", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      return void res.status(404).json({ error: "Not found" });
    }

    let planInfo = null;
    if (user.planId != null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, user.planId));
      if (plan) {
        planInfo = {
          id: plan.id,
          nameAr: plan.name,
          nameEn: plan.nameEn,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isPremium: user.isPremium,
      planId: user.planId,
      provider: user.provider,
      avatar: user.avatar,
      plan: planInfo,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get current user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const targetId = req.params.id as string;
    if (req.userId !== targetId) {
      return void res.status(403).json({ error: "Access denied" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetId));

    if (!user) {
      return void res.status(404).json({ error: "Not found" });
    }

    let planInfo = null;
    if (user.planId != null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, user.planId));
      if (plan) {
        planInfo = {
          id: plan.id,
          nameAr: plan.name,
          nameEn: plan.nameEn,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isPremium: user.isPremium,
      planId: user.planId,
      provider: user.provider,
      avatar: user.avatar,
      plan: planInfo,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user by id");
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
      .where(eq(usersTable.id, req.params.id as string))
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
      const freeLimit = await getFreeMonthlyLimit();
      isPremium = plan.dailyLimit < 0 || plan.dailyLimit > freeLimit || parseFloat(plan.price) > 0;
    }

    const [user] = await db
      .update(usersTable)
      .set({ planId: resolvedPlanId, isPremium: isPremium ? "true" : "false" })
      .where(eq(usersTable.id, req.params.id as string))
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
      .where(eq(usersTable.id, req.params.id as string))
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
      .where(eq(usersTable.id, req.params.id as string))
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
      .where(eq(usersTable.id, req.params.id as string))
      .returning();
    if (!deleted) return void res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
