/**
 * Tayyibati Barcode Intelligence Engine (Phase 7.2)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/BARCODE_ENGINE.md
 * - See docs/PRODUCT_PROVIDER_FRAMEWORK.md
 * - See docs/ARCHITECTURE_RULES.md (Rule 2: Barcode ONLY identifies products)
 *
 * MANDATE:
 * - Calls ONLY `ProviderRegistry.lookup(barcode)`.
 * - BarcodeEngine MUST NEVER know implementation details of providers or which provider answered.
 * - Presentation & compatibility independent.
 */

import type { Product } from "./productAnalysisEngine";
import { ProviderRegistry } from "./providers/ProviderRegistry";

export type BarcodeFormat = "EAN-8" | "EAN-13" | "UPC-A" | "UPC-E" | "GTIN-14" | "UNKNOWN";

export interface BarcodeValidationResult {
  isValid: boolean;
  normalizedBarcode: string;
  format: BarcodeFormat;
  error?: string;
}

export interface BarcodeMetrics {
  cacheHits: number;
  cacheMisses: number;
  providerCalls: number;
  totalLatencyMs: number;
  unknownBarcodes: number;
  failedLookups: number;
}

// Memory Cache
const BARCODE_CACHE = new Map<string, Product>();

export class BarcodeEngine {
  /**
   * Barcode Format Validation & Normalization
   */
  public static validateBarcode(rawBarcode: string): BarcodeValidationResult {
    const cleaned = (rawBarcode || "").trim().replace(/[-\s]/g, "");
    if (!/^\d+$/.test(cleaned)) {
      return { isValid: false, normalizedBarcode: cleaned, format: "UNKNOWN", error: "Barcode must contain digits only" };
    }

    const len = cleaned.length;
    let format: BarcodeFormat = "UNKNOWN";
    if (len === 8) format = "EAN-8";
    else if (len === 12) format = "UPC-A";
    else if (len === 13) format = "EAN-13";
    else if (len === 14) format = "GTIN-14";
    else if (len === 6) format = "UPC-E";

    if (format === "UNKNOWN") {
      return { isValid: false, normalizedBarcode: cleaned, format: "UNKNOWN", error: `Unsupported barcode length: ${len}` };
    }

    return { isValid: true, normalizedBarcode: cleaned, format };
  }

  /**
   * Universal Barcode Lookup Pipeline:
   * 1. Validate & Normalize
   * 2. Memory Cache Inspection (< 1.0 ms SLA)
   * 3. Delegate to `ProviderRegistry.lookup(barcode)`
   * 4. Cache & Return Product or Unknown Product Wrapper
   */
  public static async lookup(rawBarcode: string): Promise<{ product: Product | null; validation: BarcodeValidationResult; source: string; latencyMs: number }> {
    const tStart = performance.now();

    // 1. Validate
    const validation = this.validateBarcode(rawBarcode);
    if (!validation.isValid) {
      return { product: null, validation, source: "none", latencyMs: performance.now() - tStart };
    }

    const barcode = validation.normalizedBarcode;

    // 2. Cache Inspection
    if (BARCODE_CACHE.has(barcode)) {
      const latencyMs = performance.now() - tStart;
      console.log(`[BARCODE_ENGINE] Memory Cache HIT for ${barcode} | Latency: ${latencyMs.toFixed(3)} ms`);
      return { product: BARCODE_CACHE.get(barcode)!, validation, source: "memory_cache", latencyMs };
    }

    // 3. Delegate ONLY to ProviderRegistry (BarcodeEngine knows ZERO provider implementation details!)
    const { product, providerId } = await ProviderRegistry.lookup(barcode);

    const totalLatencyMs = performance.now() - tStart;

    if (product) {
      BARCODE_CACHE.set(barcode, product);
      console.log(`[BARCODE_ENGINE] Found barcode ${barcode} via ProviderRegistry (${providerId}) | Latency: ${totalLatencyMs.toFixed(3)} ms`);
      return { product, validation, source: providerId || "provider_registry", latencyMs: totalLatencyMs };
    }

    console.log(`[BARCODE_ENGINE] Barcode ${barcode} UNKNOWN across all ProviderRegistry providers | Latency: ${totalLatencyMs.toFixed(3)} ms`);
    return { product: null, validation, source: "none", latencyMs: totalLatencyMs };
  }

  public static clearCache(): void {
    BARCODE_CACHE.clear();
  }
}
