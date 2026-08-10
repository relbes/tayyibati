# Barcode Intelligence Engine Specification

**Document Version:** 1.0.0 (Phase 7.1)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Barcode Subsystem  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATE**:  
> A barcode **NEVER determines compatibility**.  
> A barcode **ONLY identifies a product**.  
> The identified `Product` object is then passed into the universal `ProductAnalysisEngine` pipeline.  
> The Barcode Engine MUST remain completely presentation-independent and rule-independent.

---

## 1. Pipeline Position & Flow Diagram

```
                              Raw Barcode Input
                                      │
                                      ▼
                   BarcodeEngine.validateBarcode()
                    (EAN-8, EAN-13, UPC-A, UPC-E, GTIN)
                                      │
                                      ▼
                        Memory Cache Inspection
                     (Target latency < 1.0 ms)
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
          Cache HIT                                     Cache MISS
               │                                             │
               │                                             ▼
               │                                   ProviderRegistry Loop
               │                               (Priority Fallback Chain)
               │                                 1. LocalProductProvider
               │                                 2. OpenFoodFactsProvider
               │                                 3. Mock / Commercial APIs
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                             Standardized Product
                                      │
                                      ▼
                            ProductAnalysisEngine
                                      │
                                      ▼
                         Universal Pipeline Execution
                    (Extraction -> Resolution -> Decision)
```

---

## 2. Provider Interface & Registry Architecture

```typescript
export interface ProviderHealth {
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  lastChecked: string;
}

export interface ProductProvider {
  id: string;
  name: string;
  priority: number; // 1 (highest) to N
  lookupBarcode(barcode: string): Promise<Product | null>;
  health(): Promise<ProviderHealth>;
}
```

---

## 3. Configurable Provider Priority Fallback Chain

Lookups traverse registered providers in order of ascending priority number:
1. `LocalProductProvider` (Priority `1` - Local DB / Cache)
2. `TayyibatiProductProvider` (Priority `2` - Production product API)
3. `OpenFoodFactsProvider` (Priority `3` - Global OpenFoodFacts API)
4. `MockProductProvider` (Priority `4` - Development / Test fallback)

---

## 4. Barcode Validation Matrix

| Format | Length | Digits Only | Status |
| :--- | :---: | :---: | :---: |
| **EAN-8** | 8 | Yes | `VALID` |
| **UPC-A** | 12 | Yes | `VALID` |
| **EAN-13** | 13 | Yes | `VALID` |
| **GTIN-14** | 14 | Yes | `VALID` |
| **UPC-E** | 6 | Yes | `VALID` |
| Non-digit / Invalid length | Variable | No | `INVALID` |

---

## 5. Unknown Barcode Handling

If a barcode is not found across any registered provider:
- Returns `product: null`
- `isUnknownProduct: true`
- `needsAdminReview: true`
- Metrics increments `unknownBarcodes`
- **Zero failure or crash**

---

## 6. Verification Examples

| Input Barcode | Format | Cache Status | Provider Source | Resulting Product | Latency |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `629100123456` | `EAN-13` | **HIT** | `memory_cache` | Nutella Hazelnut Spread | **0.110 ms** |
| `012000000133` | `UPC-A` | **MISS** | `local_db` | Pepsi Can | **0.450 ms** |
| `737628064502` | `UPC-A` | **MISS** | `openfoodfacts` | Rice Noodles | **0.820 ms** |
| `629100000000` | `EAN-13` | **MISS** | `none` | `null` (Unknown Barcode) | **0.250 ms** |
| `INVALID_123` | `UNKNOWN`| **N/A** | `none` | `null` (Format Error) | **0.050 ms** |
