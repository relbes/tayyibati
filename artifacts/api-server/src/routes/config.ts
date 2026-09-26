import { Router } from "express";
import { db, appConfigTable, aiProviderStatusTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./admin";

// Sensitive keys that must NEVER be returned in plaintext over the API or exposed publicly
const SECRET_KEYS = new Set(["openai_api_key", "gemini_api_key"]);

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase()) || key.toLowerCase().endsWith("_api_key") || key.toLowerCase().endsWith("_secret");
}

const router = Router();

router.get("/config/public", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.isPublic, "true"));
    const config: Record<string, string> = {};
    for (const row of rows) {
      // Strictly prevent any secret key from leaking to public config even if erroneously flagged
      if (!isSecretKey(row.key)) {
        config[row.key] = row.value;
      }
    }
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get public config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/config", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(appConfigTable);
    // Sanitize secret keys for the Admin UI: do not send the raw plaintext key
    const sanitized = rows.map((row) => {
      if (isSecretKey(row.key)) {
        const isConfigured = Boolean(row.value && row.value.trim().length > 0);
        return {
          ...row,
          value: isConfigured ? "••••••••••••••••" : "",
          isConfigured,
        };
      }
      return {
        ...row,
        isConfigured: Boolean(row.value && row.value.trim().length > 0),
      };
    });
    res.json(sanitized);
  } catch (err) {
    req.log.error({ err }, "Failed to get config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/config/:key", requireAdmin, async (req, res) => {
  try {
    const key = req.params.key as string;
    const { value, isPublic } = req.body;
    if (value === undefined || value === null) {
      return void res.status(400).json({ error: "value is required" });
    }

    // Keys that must always be public so client applications can read them
    const ALWAYS_PUBLIC_KEYS = new Set(["google_login_enabled"]);

    // Never allow secret keys to be marked public
    let publicFlag: string | undefined;
    if (isSecretKey(key)) {
      publicFlag = "false";
    } else if (ALWAYS_PUBLIC_KEYS.has(key)) {
      publicFlag = "true";
    } else if (isPublic !== undefined) {
      publicFlag = isPublic === true || isPublic === "true" ? "true" : "false";
    }

    const [existing] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, key));

    let recordId: number;
    let finalDescription: string | null = null;
    let finalPublic: string = publicFlag ?? "false";

    if (existing) {
      const updateData: Record<string, any> = {
        value: String(value),
        updatedAt: new Date(),
      };
      if (publicFlag !== undefined) {
        updateData.isPublic = publicFlag;
      }
      const [updated] = await db
        .update(appConfigTable)
        .set(updateData)
        .where(eq(appConfigTable.key, key))
        .returning();

      recordId = updated.id;
      finalDescription = updated.description;
      finalPublic = updated.isPublic;
    } else {
      const [created] = await db
        .insert(appConfigTable)
        .values({ key, value: String(value), isPublic: publicFlag ?? "false" })
        .returning();

      recordId = created.id;
      finalDescription = created.description;
      finalPublic = created.isPublic;
    }

    // When an AI key is updated with a non-empty value, reset any stale provider errors
    if (key === "openai_api_key" || key === "gemini_api_key") {
      const providerKey = key === "openai_api_key" ? "openai" : "gemini";
      const hasKey = Boolean(String(value).trim().length > 10);
      try {
        const [existingStatus] = await db
          .select()
          .from(aiProviderStatusTable)
          .where(eq(aiProviderStatusTable.provider, providerKey));

        if (existingStatus) {
          await db
            .update(aiProviderStatusTable)
            .set({
              isConfigured: hasKey,
              operationalStatus: hasKey ? "HEALTHY" : "ERROR",
              consecutiveFailures: 0,
              connectivityStatus: "UNCHECKED",
              updatedAt: new Date(),
            })
            .where(eq(aiProviderStatusTable.provider, providerKey));
        } else if (hasKey) {
          await db.insert(aiProviderStatusTable).values({
            provider: providerKey,
            isConfigured: true,
            operationalStatus: "HEALTHY",
            connectivityStatus: "UNCHECKED",
            billingDashboardUrl:
              providerKey === "openai"
                ? "https://platform.openai.com/usage"
                : "https://console.cloud.google.com/billing",
          });
        }
      } catch {
        // Non-fatal if table not yet migrated
      }
    }

    // Return sanitized response — never echo raw secret keys back
    const isConfigured = Boolean(String(value).trim().length > 0);
    res.json({
      id: recordId,
      key,
      value: isSecretKey(key) ? (isConfigured ? "••••••••••••••••" : "") : String(value),
      isConfigured,
      description: finalDescription,
      isPublic: finalPublic,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
