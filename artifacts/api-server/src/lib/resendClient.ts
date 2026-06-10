// Resend email client backed by the Replit Resend connector.
// Uses @replit/connectors-sdk, which handles identity, token refresh, and auth
// headers automatically. See the Resend integration blueprint.
import { ReplitConnectors } from "@replit/connectors-sdk";

interface SendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

interface ResendClient {
  emails: {
    send: (payload: SendPayload) => Promise<{ error: unknown }>;
  };
}

export async function getUncachableResendClient(): Promise<ResendClient> {
  const connectors = new ReplitConnectors();
  return {
    emails: {
      send: async (payload: SendPayload) => {
        const res = await connectors.proxy("resend", "/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          let detail: unknown;
          try {
            detail = await res.json();
          } catch {
            detail = await res.text().catch(() => res.statusText);
          }
          return { error: detail ?? `Resend returned ${res.status}` };
        }
        return { error: null };
      },
    },
  };
}
