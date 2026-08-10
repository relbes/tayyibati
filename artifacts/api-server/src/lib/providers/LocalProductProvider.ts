/**
 * Tayyibati Local Database Product Provider (Phase 7.4)
 * Priority: 1 (Highest)
 *
 * GOVERNANCE MANDATE:
 * - LocalProductProvider MUST read ONLY from the Tayyibati ProductDatabase.
 * - Zero hardcoded fallback arrays.
 */

import type { ProductProvider, ProviderHealth } from "./ProductProvider";
import type { Product } from "../productAnalysisEngine";
import { ProductDatabase } from "../productDatabase";

export class LocalProductProvider implements ProductProvider {
  public id = "local_db";
  public name = "Tayyibati Product Database Provider";
  public priority = 1;
  public enabled = true;

  public async lookupBarcode(barcode: string): Promise<Product | null> {
    if (!this.enabled) return null;
    const dbRecord = ProductDatabase.searchProduct({ barcode });
    if (!dbRecord) return null;

    return {
      productId: dbRecord.productId || `PROD_${dbRecord.id}`,
      barcode: dbRecord.barcode,
      brand: dbRecord.brand,
      productName: dbRecord.nameAr || dbRecord.productName,
      country: dbRecord.country,
      manufacturer: dbRecord.manufacturer,
      ingredientText: dbRecord.ingredientText,
      language: dbRecord.language || "ar",
      knowledgeVersion: dbRecord.knowledgeVersion || "2.1",
      imageUrl: dbRecord.imageUrl,
    };
  }

  public async health(): Promise<ProviderHealth> {
    return {
      status: "HEALTHY",
      latencyMs: 0.1,
      lastChecked: new Date().toISOString(),
    };
  }
}
