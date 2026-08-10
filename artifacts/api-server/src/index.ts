import fs from "fs";
import path from "path";

// Auto-load root .env before any workspace dependencies initialize
if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
  try {
    const envPath = path.resolve(process.cwd(), "../../.env");
    const altEnvPath = path.resolve(process.cwd(), ".env");
    const targetFile = fs.existsSync(envPath) ? envPath : fs.existsSync(altEnvPath) ? altEnvPath : null;
    if (targetFile) {
      const content = fs.readFileSync(targetFile, "utf8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch {
    // Ignore env load failure
  }
}

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

export { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
export { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
export { warmDishEngineCache, resolveSingleIngredient } from "./lib/dishCompatibilityEngine";
