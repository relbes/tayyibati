// Placeholder Resend client. Replaced by the official Replit Resend connector
// snippet once the integration is connected. Until then it returns null so the
// email module falls back to dev-logging the reset code.
//
// After connecting Resend, swap this file's body for the connector snippet that
// exports `getUncachableResendClient()` returning an authenticated Resend client.

export async function getUncachableResendClient(): Promise<null> {
  return null;
}
