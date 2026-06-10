import { logger } from "./logger";

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "Tayyibati <onboarding@resend.dev>";

export interface SendResult {
  delivered: boolean;
}

/**
 * Sends a password-reset verification code to the user's email via Resend.
 *
 * Until the Resend integration is connected, this falls back to logging the
 * code (development only) so the flow remains testable. In production an
 * unconfigured provider throws so failures are explicit rather than silent.
 */
export async function sendPasswordResetEmail(to: string, code: string): Promise<SendResult> {
  const client = await getResendClient();

  if (!client) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email provider is not configured");
    }
    logger.warn({ to, code }, "Resend not configured — logging reset code (dev only)");
    return { delivered: false };
  }

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: [to],
    subject: "رمز إعادة تعيين كلمة المرور - طيباتي",
    html: buildResetEmailHtml(code),
  });

  if (error) {
    logger.error({ err: error, to }, "Failed to send password reset email");
    throw new Error("Failed to send email");
  }

  return { delivered: true };
}

function buildResetEmailHtml(code: string): string {
  return `
  <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; text-align: right;">
    <h2 style="color: #1f6f54; margin-bottom: 8px;">طيباتي</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.8;">
      لقد طلبت إعادة تعيين كلمة المرور لحسابك. استخدم الرمز التالي لإكمال العملية:
    </p>
    <div style="background: #f1f7f4; border: 1px solid #cfe5db; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f6f54;">${code}</span>
    </div>
    <p style="color: #777; font-size: 13px; line-height: 1.7;">
      هذا الرمز صالح لمدة 15 دقيقة. إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.
    </p>
  </div>`;
}

/**
 * Returns a Resend client, or null if the integration isn't available yet.
 * Replaced with the official Replit Resend connector client once connected.
 */
async function getResendClient(): Promise<ResendLike | null> {
  try {
    const mod = await import("./resendClient");
    return await mod.getUncachableResendClient();
  } catch {
    return null;
  }
}

interface ResendLike {
  emails: {
    send: (payload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    }) => Promise<{ error: unknown }>;
  };
}
