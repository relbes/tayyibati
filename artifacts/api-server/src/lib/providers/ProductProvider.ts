/**
 * Tayyibati Product Provider Interface (Phase 7.2)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/PRODUCT_PROVIDER_FRAMEWORK.md
 * - See docs/ARCHITECTURE_RULES.md (Rule 2: Modular Provider Abstraction)
 * - See docs/ENGINEERING_PRINCIPLES.md (Interface Segregation, Decoupled Architecture)
 */

import type { Product } from "../productAnalysisEngine";

export interface ProviderHealth {
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  lastChecked: string;
  error?: string;
}

export interface ProductProvider {
  id: string;
  name: string;
  priority: number; // Lowest number = highest priority (e.g. 1 is highest, 999 is lowest)
  enabled: boolean;
  lookupBarcode(barcode: string): Promise<Product | null>;
  health(): Promise<ProviderHealth>;
}
