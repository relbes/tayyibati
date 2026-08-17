import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./admin";

const router = Router();

// ==========================================
// PUBLIC ENDPOINT FOR MOBILE CLIENTS
// ==========================================
router.get("/subscription-plans", async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, "true"))
      .orderBy(subscriptionPlansTable.sortOrder);

    const mappedPlans = plans.map((plan) => {
      let featuresAr: string[] = [];
      let featuresEn: string[] = [];
      try {
        featuresAr = plan.featuresAr ? JSON.parse(plan.featuresAr) : [];
        if (!Array.isArray(featuresAr)) featuresAr = [];
      } catch {
        featuresAr = [];
      }
      try {
        featuresEn = plan.featuresEn ? JSON.parse(plan.featuresEn) : [];
        if (!Array.isArray(featuresEn)) featuresEn = [];
      } catch {
        featuresEn = [];
      }

      return {
        id: plan.id,
        nameAr: plan.name,
        nameEn: plan.nameEn,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        descriptionAr: plan.descriptionAr,
        descriptionEn: plan.descriptionEn,
        featuresAr,
        featuresEn,
        dailyLimit: plan.dailyLimit,
        dailyTextLimit: plan.dailyTextLimit,
        dailyImageLimit: plan.dailyImageLimit,
        isPopular: plan.isPopular,
        displayOrder: plan.sortOrder,
        sortOrder: plan.sortOrder,
        revenueCatProductId: plan.revenueCatProductId,
        revenueCatEntitlementId: plan.revenueCatEntitlementId,
        isActive: plan.isActive,
      };
    });

    res.json(mappedPlans);
  } catch (err) {
    req.log.error({ err }, "Failed to list public subscription plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================================
// NEW ADMIN ENDPOINTS
// ==========================================

// Admin: List all subscription plans
router.get("/admin/subscription-plans", requireAdmin, async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(subscriptionPlansTable.sortOrder);
    res.json(plans);
  } catch (err) {
    req.log.error({ err }, "Failed to list admin subscription plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: Create subscription plan
router.post("/admin/subscription-plans", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      nameEn,
      dailyLimit,
      dailyTextLimit,
      dailyImageLimit,
      price,
      currency,
      billingCycle,
      features,
      featuresAr,
      featuresEn,
      descriptionAr,
      descriptionEn,
      isPopular,
      revenueCatProductId,
      revenueCatEntitlementId,
      isActive,
      sortOrder,
    } = req.body;

    if (!name || !nameEn) {
      return void res.status(400).json({ error: "name and nameEn are required" });
    }

    const [plan] = await db
      .insert(subscriptionPlansTable)
      .values({
        name,
        nameEn,
        dailyLimit: dailyLimit ?? 10,
        dailyTextLimit: dailyTextLimit ?? 10,
        dailyImageLimit: dailyImageLimit ?? 5,
        price: price ?? "0",
        currency: currency ?? "SAR",
        billingCycle: billingCycle ?? "free",
        features: typeof features === "string" ? features : JSON.stringify(features ?? []),
        featuresAr: typeof featuresAr === "string" ? featuresAr : JSON.stringify(featuresAr ?? []),
        featuresEn: typeof featuresEn === "string" ? featuresEn : JSON.stringify(featuresEn ?? []),
        descriptionAr: descriptionAr ?? null,
        descriptionEn: descriptionEn ?? null,
        isPopular: isPopular ?? false,
        revenueCatProductId: revenueCatProductId ?? null,
        revenueCatEntitlementId: revenueCatEntitlementId ?? null,
        isActive: isActive ?? "true",
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to create admin subscription plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: Update subscription plan
router.patch("/admin/subscription-plans/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const {
      name,
      nameEn,
      dailyLimit,
      dailyTextLimit,
      dailyImageLimit,
      price,
      currency,
      billingCycle,
      features,
      featuresAr,
      featuresEn,
      descriptionAr,
      descriptionEn,
      isPopular,
      revenueCatProductId,
      revenueCatEntitlementId,
      isActive,
      sortOrder,
    } = req.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (nameEn !== undefined) updates.nameEn = nameEn;
    if (dailyLimit !== undefined) updates.dailyLimit = dailyLimit;
    if (dailyTextLimit !== undefined) updates.dailyTextLimit = dailyTextLimit;
    if (dailyImageLimit !== undefined) updates.dailyImageLimit = dailyImageLimit;
    if (price !== undefined) updates.price = price;
    if (currency !== undefined) updates.currency = currency;
    if (billingCycle !== undefined) updates.billingCycle = billingCycle;
    if (features !== undefined) {
      updates.features = typeof features === "string" ? features : JSON.stringify(features);
    }
    if (featuresAr !== undefined) {
      updates.featuresAr = typeof featuresAr === "string" ? featuresAr : JSON.stringify(featuresAr);
    }
    if (featuresEn !== undefined) {
      updates.featuresEn = typeof featuresEn === "string" ? featuresEn : JSON.stringify(featuresEn);
    }
    if (descriptionAr !== undefined) updates.descriptionAr = descriptionAr;
    if (descriptionEn !== undefined) updates.descriptionEn = descriptionEn;
    if (isPopular !== undefined) updates.isPopular = isPopular;
    if (revenueCatProductId !== undefined) updates.revenueCatProductId = revenueCatProductId;
    if (revenueCatEntitlementId !== undefined) updates.revenueCatEntitlementId = revenueCatEntitlementId;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [plan] = await db
      .update(subscriptionPlansTable)
      .set(updates)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();

    if (!plan) return void res.status(404).json({ error: "Not found" });
    res.json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to update admin subscription plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: Delete subscription plan
router.delete("/admin/subscription-plans/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [deleted] = await db
      .delete(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();

    if (!deleted) return void res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete admin subscription plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================================
// LEGACY COMPATIBILITY ENDPOINTS
// ==========================================

router.get("/plans", async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(subscriptionPlansTable.sortOrder);
    res.json(plans);
  } catch (err) {
    req.log.error({ err }, "Failed to list plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/plans", requireAdmin, async (req, res) => {
  try {
    const { name, nameEn, dailyLimit, dailyTextLimit, dailyImageLimit, price, currency, billingCycle, features, isActive, sortOrder } = req.body;
    if (!name || !nameEn) return void res.status(400).json({ error: "name and nameEn are required" });
    const [plan] = await db
      .insert(subscriptionPlansTable)
      .values({
        name,
        nameEn,
        dailyLimit: dailyLimit ?? 10,
        dailyTextLimit: dailyTextLimit ?? 10,
        dailyImageLimit: dailyImageLimit ?? 5,
        price: price ?? "0",
        currency: currency ?? "SAR",
        billingCycle: billingCycle ?? "free",
        features: typeof features === "string" ? features : JSON.stringify(features ?? []),
        featuresAr: typeof features === "string" ? features : JSON.stringify(features ?? []),
        isActive: isActive ?? "true",
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to create plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/plans/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, nameEn, dailyLimit, dailyTextLimit, dailyImageLimit, price, currency, billingCycle, features, isActive, sortOrder } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (nameEn !== undefined) updates.nameEn = nameEn;
    if (dailyLimit !== undefined) updates.dailyLimit = dailyLimit;
    if (dailyTextLimit !== undefined) updates.dailyTextLimit = dailyTextLimit;
    if (dailyImageLimit !== undefined) updates.dailyImageLimit = dailyImageLimit;
    if (price !== undefined) updates.price = price;
    if (currency !== undefined) updates.currency = currency;
    if (billingCycle !== undefined) updates.billingCycle = billingCycle;
    if (features !== undefined) {
      updates.features = typeof features === "string" ? features : JSON.stringify(features);
      updates.featuresAr = typeof features === "string" ? features : JSON.stringify(features);
    }
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [plan] = await db
      .update(subscriptionPlansTable)
      .set(updates)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();
    if (!plan) return void res.status(404).json({ error: "Not found" });
    res.json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to update plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/plans/bulk-limits", requireAdmin, async (req, res) => {
  try {
    const { dailyTextLimit, dailyImageLimit } = req.body;
    const updates: Record<string, unknown> = {};
    if (dailyTextLimit !== undefined) updates.dailyTextLimit = dailyTextLimit;
    if (dailyImageLimit !== undefined) updates.dailyImageLimit = dailyImageLimit;
    if (Object.keys(updates).length === 0) {
      return void res.status(400).json({ error: "No fields to update" });
    }
    await db.update(subscriptionPlansTable).set(updates);
    const plans = await db.select().from(subscriptionPlansTable).orderBy(subscriptionPlansTable.sortOrder);
    res.json(plans);
  } catch (err) {
    req.log.error({ err }, "Failed to bulk update plan limits");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/plans/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [deleted] = await db
      .delete(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();
    if (!deleted) return void res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
