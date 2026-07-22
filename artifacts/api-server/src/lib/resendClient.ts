// Resend email client backed by the official Resend SDK.
import { Resend } from "resend";

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const resend = new Resend(apiKey);
  return {
    emails: {
      send: async (payload: SendPayload) => {
        try {
          const { error } = await resend.emails.send(payload);
          return { error };
        } catch (err) {
          return { error: err };
        }
      },
    },
  };
}
