import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getKnowledgeCache } from "../lib/knowledgeCache";
import { warmDishEngineCache } from "../lib/dishCompatibilityEngine";
import { ProductDatabase } from "../lib/productDatabase";
import { CanonicalSearchEngine } from "../lib/canonicalSearchEngine";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "tayyibati-api",
    timestamp: new Date().toISOString(),
  });
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/search/health", async (_req, res) => {
  try {
    const tStart = performance.now();
    const cache = await getKnowledgeCache();
    const dishCache = await warmDishEngineCache();
    const elapsedMs = Math.round((performance.now() - tStart) * 100) / 100;

    const now = Date.now();
    const cacheAgeSeconds = Math.round((now - cache.lastLoaded) / 1000);
    const lastWarmupIso = new Date(cache.lastLoaded).toISOString();
    const uptimeSeconds = Math.round(process.uptime());

    const liveMetrics = CanonicalSearchEngine.getOperationalMetrics();

    res.json({
      status: "ok",
      cacheLoaded: true,
      searchReady: true,
      knowledgeVersion: "v2.5",
      foodsVersion: "v2.5",
      dishesVersion: "v2.5",
      aliasesVersion: "v2.5",
      productsVersion: "v2.5",
      synonymsVersion: "v2.5",
      cacheAgeSeconds,
      lastWarmup: lastWarmupIso,
      lastReload: lastWarmupIso,
      uptimeSeconds,
      metrics: liveMetrics,
      foodIndex: cache.foods.length,
      foodAliasIndex: cache.aliases.length,
      dishIndex: dishCache.dishes.length,
      dishAliasIndex: dishCache.dishAliasesByNormAr.size,
      productIndex: ProductDatabase.getStoreSize(),
      buildTimeMs: elapsedMs,
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch (err: any) {
    res.status(500).json({ status: "degraded", searchReady: false, error: err?.message || String(err) });
  }
});

export default router;
