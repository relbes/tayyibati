import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { access, rename, rm, stat, cp } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Windows-resilient directory rename with copy fallback.
 * On Windows, antivirus or search indexers may hold temporary handles on newly created files,
 * causing EPERM or EBUSY errors on immediate rename. Retrying with short backoff and falling
 * back to recursive copy resolves this reliably.
 */
async function retryRename(src, dest, maxRetries = 10, delayMs = 150) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rename(src, dest);
      return;
    } catch (err) {
      if ((err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES") && attempt < maxRetries) {
        await sleep(delayMs);
        continue;
      }
      if (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES") {
        console.warn(`[build.mjs] Rename of '${src}' -> '${dest}' failed with ${err.code}. Falling back to recursive copy...`);
        await cp(src, dest, { recursive: true, force: true });
        try {
          await rm(src, { recursive: true, force: true });
        } catch {
          // ignore cleanup error if handle held on source
        }
        return;
      }
      throw err;
    }
  }
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies that critical build artifacts were produced and are non-empty.
 */
async function verifyBuildOutput(dir) {
  const indexFile = path.resolve(dir, "index.mjs");
  const mapFile = path.resolve(dir, "index.mjs.map");

  const [indexStat, mapStat] = await Promise.all([
    stat(indexFile),
    stat(mapFile),
  ]);

  if (indexStat.size === 0) {
    throw new Error(`Build verification failed: ${indexFile} is empty (0 bytes).`);
  }
  if (mapStat.size === 0) {
    throw new Error(`Build verification failed: ${mapFile} is empty (0 bytes).`);
  }
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  const buildId = `${process.pid}-${Date.now()}`;
  const tempDir = path.resolve(artifactDir, `.dist-build-${buildId}`);
  const backupDir = path.resolve(artifactDir, `.dist-backup-${buildId}`);

  await rm(tempDir, { recursive: true, force: true });

  let distMovedToBackup = false;

  try {
    console.log(`Building API server into staging directory: ${tempDir}`);
    await esbuild({
      entryPoints: [
        path.resolve(artifactDir, "src/index.ts"),
        path.resolve(artifactDir, "src/scratch_test.ts"),
        path.resolve(artifactDir, "src/test_phase8_step2_2_verify.ts"),
        path.resolve(artifactDir, "src/inspect_db.ts"),
        path.resolve(artifactDir, "src/api_verify.ts"),
        path.resolve(artifactDir, "src/inspect_openai.ts"),
        path.resolve(artifactDir, "src/runPlansMigration.ts"),
        path.resolve(artifactDir, "src/inspect_search.ts"),
        path.resolve(artifactDir, "src/check_shawarma_dishes.ts"),
        path.resolve(artifactDir, "src/test_dish_equivalence_verification.ts"),
        path.resolve(artifactDir, "src/test_search_separation.ts"),
        path.resolve(artifactDir, "src/test_food_selection_flow.ts"),
        path.resolve(artifactDir, "src/trace_runtime_search_flow.ts"),
        path.resolve(artifactDir, "src/inspect_rice_family_members.ts"),
        path.resolve(artifactDir, "src/inspect_bread_resolution.ts"),
        path.resolve(artifactDir, "src/test_display_title_preservation.ts"),
        path.resolve(artifactDir, "src/verify_e2e_titles.ts"),
        path.resolve(artifactDir, "src/test_invalid_query_guard.ts"),
        path.resolve(artifactDir, "src/test_food_family_ui_mode.ts"),
        path.resolve(artifactDir, "src/scratch_inspect_dates.ts"),
        path.resolve(artifactDir, "src/test_catalog_api_sync.ts"),
        path.resolve(artifactDir, "src/scratch_inspect_noise.ts"),
        path.resolve(artifactDir, "src/scratch_inspect_db_categories.ts"),
        path.resolve(artifactDir, "src/test_noise_and_arabic_categories.ts"),
        path.resolve(artifactDir, "src/scratch_inspect_maqluba.ts"),
        path.resolve(artifactDir, "src/test_potato_family_fix.ts"),
        path.resolve(artifactDir, "src/test_api_endpoints.ts"),
        path.resolve(artifactDir, "src/test_ai_monitoring_suite.ts"),
        path.resolve(artifactDir, "src/test_user_activity_history.ts"),
        path.resolve(artifactDir, "src/test_dish_variant_regression.ts"),
        path.resolve(artifactDir, "src/qa/searchQaRunner.ts")
      ],
      platform: "node",
      bundle: true,
      format: "esm",
      outdir: tempDir,
      outExtension: { ".js": ".mjs" },
      logLevel: "info",
      // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
      // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
      // Examples of unbundleable packages:
      // - uses native modules and loads them dynamically (e.g. sharp)
      // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
      external: [
        "*.node",
        "sharp",
        "better-sqlite3",
        "sqlite3",
        "canvas",
        "bcrypt",
        "argon2",
        "fsevents",
        "re2",
        "farmhash",
        "xxhash-addon",
        "bufferutil",
        "utf-8-validate",
        "ssh2",
        "cpu-features",
        "dtrace-provider",
        "isolated-vm",
        "lightningcss",
        "pg-native",
        "oracledb",
        "mongodb-client-encryption",
        "nodemailer",
        "handlebars",
        "knex",
        "typeorm",
        "protobufjs",
        "onnxruntime-node",
        "@tensorflow/*",
        "@prisma/client",
        "@mikro-orm/*",
        "@grpc/*",
        "@swc/*",
        "@aws-sdk/*",
        "@azure/*",
        "@opentelemetry/*",
        "@google-cloud/*",
        "@google/*",
        "googleapis",
        "firebase-admin",
        "@parcel/watcher",
        "@sentry/profiling-node",
        "@tree-sitter/*",
        "aws-sdk",
        "classic-level",
        "dd-trace",
        "ffi-napi",
        "grpc",
        "hiredis",
        "kerberos",
        "leveldown",
        "miniflare",
        "mysql2",
        "newrelic",
        "odbc",
        "piscina",
        "realm",
        "ref-napi",
        "rocksdb",
        "sass-embedded",
        "sequelize",
        "serialport",
        "snappy",
        "tinypool",
        "usb",
        "workerd",
        "wrangler",
        "zeromq",
        "zeromq-prebuilt",
        "playwright",
        "puppeteer",
        "puppeteer-core",
        "electron",
      ],
      sourcemap: "linked",
      plugins: [
        // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
        esbuildPluginPino({ transports: ["pino-pretty"] })
      ],
      // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
      banner: {
        js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
      },
    });

    console.log("Verifying build output in staging directory...");
    await verifyBuildOutput(tempDir);
    console.log("Staging build verification passed.");

    const distExists = await pathExists(distDir);
    if (distExists) {
      console.log(`Preserving existing dist at: ${backupDir}`);
      await retryRename(distDir, backupDir);
      distMovedToBackup = true;
    }

    try {
      console.log(`Promoting staging directory to dist: ${distDir}`);
      await retryRename(tempDir, distDir);
      console.log("Build successfully promoted to dist.");
      if (distMovedToBackup) {
        console.log(`Previous dist successfully preserved in backup: ${backupDir}`);
      }
    } catch (promotionErr) {
      console.error(`Promotion failed: ${promotionErr.message}`);
      if (distMovedToBackup) {
        console.warn(`Attempting automatic rollback from ${backupDir} to ${distDir}...`);
        try {
          await retryRename(backupDir, distDir);
          console.warn("Rollback succeeded: previous dist restored.");
        } catch (rollbackErr) {
          console.error("=".repeat(80));
          console.error("CRITICAL BUILD DISASTER RECOVERY ALERT:");
          console.error("1. Promotion of new build output to dist failed.");
          console.error("2. Automatic rollback to restore original dist also failed.");
          console.error("");
          console.error("THE PREVIOUS WORKING BUILD WAS PRESERVED AND NOT DELETED.");
          console.error(`Backup location: ${backupDir}`);
          console.error(`Target dist location: ${distDir}`);
          console.error("");
          console.error(`Manual recovery action: Move or copy the backup folder to '${distDir}'.`);
          console.error(`Promotion error: ${promotionErr.message}`);
          console.error(`Rollback error: ${rollbackErr.message}`);
          console.error("=".repeat(80));

          const criticalFailure = new Error(
            `CRITICAL BUILD FAILURE: Promotion failed (${promotionErr.message}) and automatic rollback failed (${rollbackErr.message}). ` +
            `The previous stable build was NOT deleted and is preserved at: ${backupDir}`
          );
          criticalFailure.cause = { promotionErr, rollbackErr, backupDir, distDir };
          throw criticalFailure;
        }
      }
      throw promotionErr;
    }
  } finally {
    try {
      if (await pathExists(tempDir)) {
        await rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn(`Warning: failed to clean up temp build directory ${tempDir}: ${cleanupErr.message}`);
    }
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
