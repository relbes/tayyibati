/**
 * Tayyibati Permanent Product Database Manager (Phase 7.4)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/PRODUCT_DATABASE.md
 * - See docs/PRODUCT_INTELLIGENCE.md
 * - See docs/ARCHITECTURE_RULES.md (Rule 2: Products store NO compatibility rulings)
 * - See docs/ENGINEERING_PRINCIPLES.md (Dynamic Decomposition, Deduplication, Search Indexing)
 *
 * MANDATE:
 * - PRIMARY source of truth for all commercial products.
 * - LocalProductProvider MUST read exclusively from this database.
 * - Deduplication: Products unique by `barcode` (or `brand` + `normalizedName` if barcode is missing).
 * - Versioning: Every product tracks `knowledgeVersion` ("2.1"), `sourceProvider`, and `lastVerified`.
 */

import { products, productAliases, productImages, productSources } from "@workspace/db";
import type { Product } from "./productAnalysisEngine";

export interface ProductDbRecord extends Product {
  id: number;
  nameAr?: string;
  nameEn?: string;
  ingredientTextNormalized: string;
  category?: string | null;
  status: "active" | "draft" | "archived";
  sourceProvider: string;
  lastVerified: string;
  createdAt: string;
  updatedAt: string;
  aliases?: string[];
}

export interface ProductSearchFilter {
  barcode?: string;
  brand?: string;
  nameAr?: string;
  nameEn?: string;
  alias?: string;
  normalizedIngredientText?: string;
}

// In-Memory Database Store Foundation for Sub-millisecond Execution
const PRODUCT_STORE = new Map<number, ProductDbRecord>();
const BARCODE_INDEX = new Map<string, ProductDbRecord>();
const BRAND_NAME_INDEX = new Map<string, ProductDbRecord>();
const ALIAS_INDEX = new Map<string, ProductDbRecord>();

// Pre-load default initial commercial products
const INITIAL_PRODUCTS: Partial<ProductDbRecord>[] = [
  {
    id: 1,
    barcode: "629100123456",
    brand: "Ferrero",
    productName: "Nutella Hazelnut Spread",
    nameAr: "نوتيلا كريمة البندق",
    nameEn: "Nutella Hazelnut Spread",
    manufacturer: "Ferrero SpA",
    country: "Italy",
    category: "Sweets",
    ingredientText: "سكر، زيت النخيل، بندق، حليب فرز مجفف، كاكاو قليل الدسم، ليسيثين الصويا، فانيلين",
    ingredientTextNormalized: "سكر زيت النخيل بندق حليب فرز مجفف كاكاو قليل الدسم ليسيثين الصويا فانيلين",
    language: "ar",
    status: "active",
    knowledgeVersion: "2.1",
    sourceProvider: "local_db",
    lastVerified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: ["نوتيلا", "Nutella", "nutella", "كريمة البندق نوتيلا"],
  },
  {
    id: 2,
    barcode: "012000000133",
    brand: "PepsiCo",
    productName: "Pepsi Can",
    nameAr: "ببسي علبة",
    nameEn: "Pepsi Can",
    manufacturer: "PepsiCo, Inc.",
    country: "USA",
    category: "Beverages",
    ingredientText: "مياه غازية، سكر، لون الكراميل، حمض الفوسفوريك، كافيين، نكهات طبيعية",
    ingredientTextNormalized: "مياه غازية سكر لون الكراميل حمض الفوسفوريك كافيين نكهات طبيعية",
    language: "ar",
    status: "active",
    knowledgeVersion: "2.1",
    sourceProvider: "local_db",
    lastVerified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: ["بيبتسي", "بيبسي كولا", "pepsi", "Pepsi"],
  },
  {
    id: 3,
    barcode: "5449000000996",
    brand: "Coca-Cola",
    productName: "Coca-Cola Original Taste",
    nameAr: "كوكاكولا الطعم الأصلي",
    nameEn: "Coca-Cola Original Taste",
    manufacturer: "The Coca-Cola Company",
    country: "USA",
    category: "Beverages",
    ingredientText: "مياه غازية، سكر، لون الكراميل، حمض الفوسفوريك، كافيين، نكهات طبيعية",
    ingredientTextNormalized: "مياه غازية سكر لون الكراميل حمض الفوسفوريك كافيين نكهات طبيعية",
    language: "ar",
    status: "active",
    knowledgeVersion: "2.1",
    sourceProvider: "local_db",
    lastVerified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: ["كوكاكولا", "كوكا كولا", "Coca-Cola", "cocacola", "coca cola"],
  },
  {
    id: 4,
    barcode: "9002490200007",
    brand: "Red Bull",
    productName: "Red Bull Energy Drink",
    nameAr: "مشروب الطاقة ريد بول",
    nameEn: "Red Bull Energy Drink",
    manufacturer: "Red Bull GmbH",
    country: "Austria",
    category: "Beverages",
    ingredientText: "مياه غازية، سكروز، جلوكوز، حمض الستريك، تورين، كافيين، فيتامينات ب",
    ingredientTextNormalized: "مياه غازية سكروز جلوكوز حمض الستريك تورين كافيين فيتامينات ب",
    language: "ar",
    status: "active",
    knowledgeVersion: "2.1",
    sourceProvider: "local_db",
    lastVerified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: ["ريد بول", "ريدبول", "Red Bull", "red bull", "RedBull"],
  },
];

export class ProductDatabase {
  private static isInitialized = false;

  private static normalizeText(str: string | null | undefined): string {
    if (!str) return "";
    return str
      .trim()
      .toLowerCase()
      .replace(/[^\w\u0621-\u064A]/g, "");
  }

  public static initialize(): void {
    if (this.isInitialized) return;
    INITIAL_PRODUCTS.forEach((p) => {
      this.upsertProductMemory(p as ProductDbRecord);
    });
    this.isInitialized = true;
    console.log(`[PRODUCT_DATABASE] Initialized with ${PRODUCT_STORE.size} commercial products.`);
  }

  private static upsertProductMemory(rec: ProductDbRecord): void {
    PRODUCT_STORE.set(rec.id, rec);
    if (rec.barcode) {
      BARCODE_INDEX.set(rec.barcode, rec);
    }
    const brandNameKey = `${this.normalizeText(rec.brand)}_${this.normalizeText(rec.nameAr || rec.productName)}`;
    BRAND_NAME_INDEX.set(brandNameKey, rec);

    if (rec.aliases) {
      rec.aliases.forEach((a) => {
        ALIAS_INDEX.set(this.normalizeText(a), rec);
      });
    }
  }

  /**
   * Deduplicated Product Insertion
   */
  public static insertProduct(input: Partial<ProductDbRecord>): ProductDbRecord {
    this.initialize();
    const barcode = input.barcode?.trim() || null;
    const nameAr = input.nameAr || input.productName || "منتج جديد";
    const brand = input.brand || null;
    const brandNameKey = `${this.normalizeText(brand)}_${this.normalizeText(nameAr)}`;

    // Deduplication Check by Barcode or Brand+Name
    let existing: ProductDbRecord | undefined;
    if (barcode && BARCODE_INDEX.has(barcode)) {
      existing = BARCODE_INDEX.get(barcode);
    } else if (BRAND_NAME_INDEX.has(brandNameKey)) {
      existing = BRAND_NAME_INDEX.get(brandNameKey);
    }

    const now = new Date().toISOString();

    if (existing) {
      // Update existing record
      const updated: ProductDbRecord = {
        ...existing,
        ...input,
        id: existing.id,
        updatedAt: now,
        lastVerified: now,
        knowledgeVersion: input.knowledgeVersion || existing.knowledgeVersion || "2.1",
      };
      this.upsertProductMemory(updated);
      console.log(`[PRODUCT_DATABASE] Updated existing product ID: ${existing.id} | Barcode: ${barcode || "N/A"}`);
      return updated;
    }

    const newId = PRODUCT_STORE.size + 1;
    const newRecord: ProductDbRecord = {
      id: newId,
      productId: input.productId || `PROD_${newId}`,
      barcode,
      brand,
      productName: nameAr,
      nameAr,
      nameEn: input.nameEn || nameAr,
      manufacturer: input.manufacturer || null,
      country: input.country || null,
      category: input.category || null,
      ingredientText: input.ingredientText || "",
      ingredientTextNormalized: this.normalizeText(input.ingredientText),
      nutritionFacts: input.nutritionFacts || null,
      imageUrl: input.imageUrl || null,
      language: input.language || "ar",
      status: input.status || "active",
      knowledgeVersion: input.knowledgeVersion || "2.1",
      sourceProvider: input.sourceProvider || "local_db",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
      aliases: input.aliases || [],
    };

    this.upsertProductMemory(newRecord);
    console.log(`[PRODUCT_DATABASE] Inserted new product ID: ${newId} | Barcode: ${barcode || "N/A"}`);
    return newRecord;
  }

  /**
   * Search Product Database by Barcode, Brand, Name, or Aliases
   */
  public static searchProduct(filter: ProductSearchFilter): ProductDbRecord | null {
    this.initialize();

    if (filter.barcode) {
      const bClean = filter.barcode.trim();
      if (BARCODE_INDEX.has(bClean)) return BARCODE_INDEX.get(bClean)!;
    }

    if (filter.brand && (filter.nameAr || filter.nameEn)) {
      const key = `${this.normalizeText(filter.brand)}_${this.normalizeText(filter.nameAr || filter.nameEn)}`;
      if (BRAND_NAME_INDEX.has(key)) return BRAND_NAME_INDEX.get(key)!;
    }

    if (filter.alias) {
      const normAlias = this.normalizeText(filter.alias);
      if (ALIAS_INDEX.has(normAlias)) return ALIAS_INDEX.get(normAlias)!;
    }

    if (filter.nameAr) {
      const normName = this.normalizeText(filter.nameAr);
      const match = Array.from(PRODUCT_STORE.values()).find(
        (p) => this.normalizeText(p.nameAr) === normName || (p.nameEn && this.normalizeText(p.nameEn) === normName)
      );
      if (match) return match;
    }

    return null;
  }

  /**
   * Import Batch Products (CSV / JSON simulation)
   */
  public static importBatch(batch: Partial<ProductDbRecord>[]): number {
    this.initialize();
    let imported = 0;
    batch.forEach((p) => {
      this.insertProduct(p);
      imported++;
    });
    return imported;
  }

  public static getStoreSize(): number {
    this.initialize();
    return PRODUCT_STORE.size;
  }

  public static getAllProducts(): ProductDbRecord[] {
    this.initialize();
    return Array.from(PRODUCT_STORE.values());
  }

  public static getProductById(id: number | string): ProductDbRecord | null {
    this.initialize();
    if (typeof id === "number" && PRODUCT_STORE.has(id)) return PRODUCT_STORE.get(id)!;
    const cleanId = String(id).trim();
    if (BARCODE_INDEX.has(cleanId)) return BARCODE_INDEX.get(cleanId)!;
    const numId = parseInt(cleanId.replace(/[^\d]/g, ""), 10);
    if (!isNaN(numId) && PRODUCT_STORE.has(numId)) return PRODUCT_STORE.get(numId)!;
    return null;
  }

  public static clear(): void {
    PRODUCT_STORE.clear();
    BARCODE_INDEX.clear();
    BRAND_NAME_INDEX.clear();
    ALIAS_INDEX.clear();
    this.isInitialized = false;
  }
}

ProductDatabase.initialize();
