import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const FREE_MONTHLY_LIMIT_DEFAULT = 10;

/**
 * Reads `free_monthly_limit` from the app_config table.
 * Falls back to 10 if the key is missing or the value is not a valid integer.
 */
export async function getFreeMonthlyLimit(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "free_monthly_limit"));
    const val = parseInt(row?.value ?? String(FREE_MONTHLY_LIMIT_DEFAULT), 10);
    return isNaN(val) ? FREE_MONTHLY_LIMIT_DEFAULT : val;
  } catch {
    return FREE_MONTHLY_LIMIT_DEFAULT;
  }
}
