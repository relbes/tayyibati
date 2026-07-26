import { OAuth2Client } from "google-auth-library";

// Initialize client (Web Client ID serves as the primary audience for the ID token validation)
const client = new OAuth2Client();

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const allowedAudience = [
    process.env.GOOGLE_CLIENT_ID_WEB,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  ].filter(Boolean) as string[];

  if (allowedAudience.length === 0) {
    throw new Error("Google Client IDs are not configured on the server");
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: allowedAudience,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Invalid Google token signature or payload");
  }

  // Ensure email is verified by Google
  if (payload.email_verified !== true) {
    throw new Error("Google email address is not verified");
  }

  return {
    sub: payload.sub,
    email: payload.email!,
    name: payload.name,
    picture: payload.picture,
  };
}
