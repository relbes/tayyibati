/**
 * Tayyibati Mock Product Provider (Phase 7.2)
 * Priority: 999 (Lowest)
 */

import type { ProductProvider, ProviderHealth } from "./ProductProvider";
import type { Product } from "../productAnalysisEngine";

export class MockProductProvider implements ProductProvider {
  public id = "mock_provider";
  public name = "Mock Test Product Provider";
  public priority = 999;
  public enabled = true;

  public async lookupBarcode(barcode: string): Promise<Product | null> {
    if (!this.enabled) return null;
    if (barcode === "999999999999") {
      return {
        productId: "PROD_MOCK_999",
        barcode: "999999999999",
        brand: "MockBrand",
        productName: "Mock Test Product",
        country: "Mockland",
        manufacturer: "Mock Corp",
        ingredientText: "ماء، سكر",
        language: "ar",
        knowledgeVersion: "2.1",
      };
    }
    return null;
  }

  public async health(): Promise<ProviderHealth> {
    return {
      status: "HEALTHY",
      latencyMs: 0.1,
      lastChecked: new Date().toISOString(),
    };
  }
}
