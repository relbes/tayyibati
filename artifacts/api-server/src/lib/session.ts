import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_SECRET_LENGTH = 32;

/**
 * Resolve the signing secret.
 *
 * Production: SESSION_SECRET must be set and at least 32 characters.
 *             Missing or weak secret → throw immediately so the process dies
 *             at startup before any token can be issued.
 *
 * Development: SESSION_SECRET is used when provided. When absent a fresh
 *              cryptographically-random 32-byte secret is generated once per
 *              process so tokens cannot be forged using a known string — but
 *              note that existing tokens are invalidated on each restart, which
 *              is acceptable in dev.
 */
function resolveSecret(): string {
  const env = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (env) {
    if (env.length < MIN_SECRET_LENGTH) {
      const msg = `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${env.length}). ` +
        "Set a strong secret and restart.";
      if (isProd) throw new Error(msg);
      console.warn(`[session] WARNING: ${msg}`);
    }
    return env;
  }

  if (isProd) {
    throw new Error(
      "SESSION_SECRET environment variable is required in production. " +
      `Set it to a random string of at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }

  // Dev fallback: random secret per process — not guessable, tokens invalidate on restart.
  const generated = randomBytes(32).toString("hex");
  console.warn(
    "[session] SESSION_SECRET not set. Using a random per-process secret for development. " +
    "All sessions will be invalidated on server restart.",
  );
  return generated;
}

// Resolve once at module load. In production this will throw (and crash the
// process) if the secret is absent or weak — intentional fail-fast behaviour.
const SECRET: string = resolveSecret();

/**
 * Issue a stateless HMAC-signed session token for the given userId.
 * Format (base64url-encoded): `<userId>.<iat>.<hmac-sha256-hex>`
 * userId is guaranteed to be alphanumeric + underscores, so "." is a safe separator.
 */
export function issueToken(userId: string): string {
  const iat = Date.now();
  const payload = `${userId}.${iat}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/**
 * Verify a session token and return the userId it was issued for, or null if
 * the token is missing, malformed, expired, or has an invalid signature.
 */
export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");

    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;
    const sig = decoded.slice(lastDot + 1);
    const payload = decoded.slice(0, lastDot);

    const secondLastDot = payload.lastIndexOf(".");
    if (secondLastDot === -1) return null;
    const userId = payload.slice(0, secondLastDot);
    const iat = parseInt(payload.slice(secondLastDot + 1), 10);

    const now = Date.now();
    // Reject expired tokens and tokens issued in the future (> 5 min clock skew).
    if (!userId || isNaN(iat) || now - iat > TOKEN_TTL_MS || iat - now > 5 * 60 * 1000) return null;

    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length === 0 || sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    return userId;
  } catch {
    return null;
  }
}
