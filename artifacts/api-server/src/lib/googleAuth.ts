/**
 * Google ID Token Verification Module
 *
 * Verifies Google ID Tokens against Google OAuth2 tokeninfo endpoint.
 * Validates:
 * - iss: accounts.google.com or https://accounts.google.com
 * - aud: matches one of the configured Google Client IDs
 * - exp: token has not expired
 * - email_verified: true
 * - sub: subject (Google user ID) is present
 * - email: non-empty string
 */

export interface GoogleTokenPayload {
  iss: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  exp: number;
}

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

// Known client IDs across configurations
const KNOWN_CLIENT_IDS = [
  "133601957570-tl1echnbnngfo7pnk25tfri72eun63r1.apps.googleusercontent.com",
  "133601957570-rff83ikpf57cf4lbge8p8phbdlqte6mc.apps.googleusercontent.com",
  "133601957570-gsrlsponvrbk5b2fus71scqr167kcqrb.apps.googleusercontent.com",
  "133601957570-5bupf3ckg90a5s97tpsjggq0s03k5724.apps.googleusercontent.com",
];

function getAllowedClientIds(): Set<string> {
  const allowed = new Set<string>(KNOWN_CLIENT_IDS);

  const envVars = [
    process.env.GOOGLE_CLIENT_ID_WEB,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  ];

  for (const envVal of envVars) {
    if (envVal && envVal.trim()) {
      allowed.add(envVal.trim());
    }
  }

  return allowed;
}

// Test hook for unit testing without live network calls
type TokenVerifier = (idToken: string) => Promise<GoogleTokenPayload>;
let customVerifier: TokenVerifier | null = null;

export function setCustomVerifierForTesting(verifier: TokenVerifier | null): void {
  customVerifier = verifier;
}

/**
 * Fetch and verify Google ID Token.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser> {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    throw new Error("Missing ID Token");
  }

  const cleanToken = idToken.trim();

  let payload: GoogleTokenPayload;

  if (customVerifier) {
    payload = await customVerifier(cleanToken);
  } else {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err: any) {
      throw new Error(`Failed to reach Google token verification service: ${err.message || String(err)}`);
    }

    if (!res.ok) {
      let errorMsg = `Google verification returned HTTP ${res.status}`;
      try {
        const errorData = (await res.json()) as Record<string, any>;
        if (errorData?.error_description) {
          errorMsg = errorData.error_description;
        } else if (errorData?.error) {
          errorMsg = errorData.error;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(`Invalid Google ID Token: ${errorMsg}`);
    }

    const rawData = (await res.json()) as Record<string, any>;
    payload = {
      iss: String(rawData.iss || ""),
      sub: String(rawData.sub || ""),
      email: String(rawData.email || ""),
      email_verified: rawData.email_verified === "true" || rawData.email_verified === true,
      name: rawData.name ? String(rawData.name) : undefined,
      picture: rawData.picture ? String(rawData.picture) : undefined,
      aud: String(rawData.aud || ""),
      exp: Number(rawData.exp || 0),
    };
  }

  // 1. Verify Issuer
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!validIssuers.includes(payload.iss)) {
    throw new Error(`Invalid token issuer: "${payload.iss}"`);
  }

  // 2. Verify Expiration
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error("Google ID Token has expired");
  }

  // 3. Verify Email Verification
  if (!payload.email_verified) {
    throw new Error("Google account email is not verified");
  }

  // 4. Verify Email
  if (!payload.email || typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new Error("Google token does not contain a valid email");
  }

  // 5. Verify Subject (User ID)
  if (!payload.sub || typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new Error("Google token missing subject identifier");
  }

  // 6. Verify Audience
  const allowedClients = getAllowedClientIds();
  if (!allowedClients.has(payload.aud)) {
    throw new Error(`Google token audience mismatch: "${payload.aud}" is not an authorized client ID`);
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const name = payload.name?.trim() || normalizedEmail.split("@")[0];

  return {
    googleId: payload.sub.trim(),
    email: normalizedEmail,
    name,
    avatar: payload.picture?.trim() || null,
  };
}
