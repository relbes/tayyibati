import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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

router.post("/plans", async (req, res) => {
  try {
    const { name, nameEn, dailyLimit, price, currency, billingCycle, features, isActive, sortOrder } = req.body;
    if (!name || !nameEn) return void res.status(400).json({ error: "name and nameEn are required" });
    const [plan] = await db
      .insert(subscriptionPlansTable)
      .values({
        name,
        nameEn,
        dailyLimit: dailyLimit ?? 10,
        price: price ?? "0",
        currency: currency ?? "SAR",
        billingCycle: billingCycle ?? "free",
        features: typeof features === "string" ? features : JSON.stringify(features ?? []),
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

router.patch("/plans/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, nameEn, dailyLimit, price, currency, billingCycle, features, isActive, sortOrder } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (nameEn !== undefined) updates.nameEn = nameEn;
    if (dailyLimit !== undefined) updates.dailyLimit = dailyLimit;
    if (price !== undefined) updates.price = price;
    if (currency !== undefined) updates.currency = currency;
    if (billingCycle !== undefined) updates.billingCycle = billingCycle;
    if (features !== undefined) updates.features = typeof features === "string" ? features : JSON.stringify(features);
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

router.delete("/plans/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
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
