# External Product Provider Framework Specification

**Document Version:** 1.0.0 (Phase 7.2)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Provider Subsystem  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATES**:
> 1. **Provider Abstraction**: `BarcodeEngine` MUST NEVER know implementation details of product providers. It communicates exclusively via `ProviderRegistry.lookup(barcode)`.
> 2. **Priority Chain**: Lookups execute across enabled providers in order of priority (lowest number first).
> 3. **Decoupled Business Rules**: Product providers ONLY retrieve product data; they NEVER evaluate compatibility.
> 4. **Standardized Return**: All providers MUST return a standardized `Product` interface.

---

## 1. Provider Architecture & Lifecycle

```
                               BarcodeEngine
                                     │
                                     ▼
                          ProviderRegistry.lookup()
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                       ▼
    LocalProductProvider    TayyibatiProvider       MockProductProvider
        (Priority 1)            (Priority 2)           (Priority 999)
             │                       │                       │
             └───────────────────────┼───────────────────────┘
                                     │
                                     ▼
                            Standardized Product
```

---

## 2. Interface Contracts

### `ProductProvider` Interface
```typescript
export interface ProviderHealth {
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  lastChecked: string;
  error?: string;
}

export interface ProductProvider {
  id: string;
  name: string;
  priority: number; // Lowest number = highest priority
  enabled: boolean;
  lookupBarcode(barcode: string): Promise<Product | null>;
  health(): Promise<ProviderHealth>;
}
```

---

## 3. Registered Providers & Priorities

| Provider ID | Implementation | Priority | Enabled | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `local_db` | `LocalProductProvider` | **1** | `true` | Local PostgreSQL product table / cache |
| `tayyibati` | `TayyibatiProductProvider` | **2** | `true` | Tayyibati production API |
| `mock_provider` | `MockProductProvider` | **999** | `true` | Testing & development fallback |

---

## 4. Future Provider Placeholders

The architecture is prepared for the following future external integrations without modifying `BarcodeEngine` or `ProductAnalysisEngine`:
- **`OpenFoodFactsProvider`** (Global open product database)
- **`GS1Provider`** (Official GS1 barcode registry API)
- **`AdminUploadProvider`** (User-submitted packaging queue)
- **`EnterpriseCommercialProvider`** (Paid product catalog APIs)

---

## 5. Metrics & Health Monitoring

`ProviderRegistry` tracks performance metrics and health status:
- **Metrics:** `providerCalls`, `providerLatency`, `providerSuccessRate`, `providerFailures`, `cacheHits`, `cacheMisses`.
- **Health Aggregation:** `ProviderRegistry.health()` returns health status for all registered providers.
