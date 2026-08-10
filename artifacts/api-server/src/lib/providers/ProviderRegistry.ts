/**
 * Tayyibati Provider Registry (Phase 7.2)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/PRODUCT_PROVIDER_FRAMEWORK.md
 * - Manages registration, unregistration, enabling/disabling, priority sorting,
 *   lookup delegation, metrics tracking, and health check aggregation.
 */

import type { ProductProvider, ProviderHealth } from "./ProductProvider";
import type { Product } from "../productAnalysisEngine";
import { LocalProductProvider } from "./LocalProductProvider";
import { MockProductProvider } from "./MockProductProvider";

export interface ProviderMetrics {
  providerCalls: number;
  providerLatency: number;
  providerSuccessRate: number;
  providerFailures: number;
  cacheHits: number;
  cacheMisses: number;
}

export class ProviderRegistry {
  private static providers: Map<string, ProductProvider> = new Map();
  private static metrics: ProviderMetrics = {
    providerCalls: 0,
    providerLatency: 0,
    providerSuccessRate: 100,
    providerFailures: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  /**
   * Register a new ProductProvider instance.
   */
  public static register(provider: ProductProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a provider by ID.
   */
  public static unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Enable a provider by ID.
   */
  public static enable(providerId: string): boolean {
    const p = this.providers.get(providerId);
    if (p) {
      p.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a provider by ID.
   */
  public static disable(providerId: string): boolean {
    const p = this.providers.get(providerId);
    if (p) {
      p.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Returns active enabled providers sorted by priority (lowest number first).
   */
  public static getSortedProviders(): ProductProvider[] {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Executes lookup across registered providers in priority order.
   */
  public static async lookup(barcode: string): Promise<{ product: Product | null; providerId: string | null }> {
    const sorted = this.getSortedProviders();

    for (const provider of sorted) {
      this.metrics.providerCalls++;
      const pStart = performance.now();

      try {
        const product = await provider.lookupBarcode(barcode);
        const latency = performance.now() - pStart;
        this.metrics.providerLatency += latency;

        if (product) {
          this.recalculateSuccessRate();
          return { product, providerId: provider.id };
        }
      } catch (err) {
        this.metrics.providerFailures++;
        this.recalculateSuccessRate();
        console.error(`[PROVIDER_REGISTRY] Error in provider ${provider.id}:`, err);
      }
    }

    return { product: null, providerId: null };
  }

  /**
   * Aggregates health checks across all registered providers.
   */
  public static async health(): Promise<Record<string, ProviderHealth>> {
    const healthMap: Record<string, ProviderHealth> = {};
    for (const [id, provider] of this.providers.entries()) {
      try {
        healthMap[id] = await provider.health();
      } catch (err: any) {
        healthMap[id] = {
          status: "DOWN",
          latencyMs: 0,
          lastChecked: new Date().toISOString(),
          error: err.message || "Health check failed",
        };
      }
    }
    return healthMap;
  }

  public static getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  public static resetMetrics(): void {
    this.metrics = {
      providerCalls: 0,
      providerLatency: 0,
      providerSuccessRate: 100,
      providerFailures: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  public static resetDefaults(): void {
    this.providers.clear();
    this.register(new LocalProductProvider());
    this.register(new MockProductProvider());
    this.resetMetrics();
  }

  private static recalculateSuccessRate(): void {
    const total = this.metrics.providerCalls;
    if (total === 0) {
      this.metrics.providerSuccessRate = 100;
      return;
    }
    const successful = total - this.metrics.providerFailures;
    this.metrics.providerSuccessRate = Math.round((successful / total) * 100);
  }
}

// Initialize default providers
ProviderRegistry.resetDefaults();
