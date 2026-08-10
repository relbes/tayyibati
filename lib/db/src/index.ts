import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

if (!process.env.DATABASE_URL) {
  try {
    const cwd = process.cwd();
    const candidatePaths = [
      path.resolve(cwd, ".env"),
      path.resolve(cwd, "../../.env"),
      path.resolve(cwd, "../.env"),
      path.resolve(cwd, "../../../.env"),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        content.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              if (!process.env[k]) process.env[k] = v;
            }
          }
        });
        if (process.env.DATABASE_URL) break;
      }
    }
  } catch {
    // ignore env load errors
  }
}

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema/index";
