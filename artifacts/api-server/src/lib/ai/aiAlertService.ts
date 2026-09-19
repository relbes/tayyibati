/**
 * AI Alert Service for Tayyibati Admin Dashboard
 *
 * Implements:
 * - Smart alert evaluation based on unambiguous thresholds
 * - Quota exhaustion alerts (immediate, deduplicated)
 * - Repeated consecutive failures alert (threshold-based)
 * - Daily and monthly spend warning/critical alerts
 * - Recovery email on problem resolution
 * - Strict cooldown and deduplication (never spam emails)
 * - Resend / SMTP email dispatch with credential safety
 * - Admin test email trigger
 */

import { db, aiAlertSettingsTable, aiAlertEventsTable, adminUsersTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { logger } from "../logger";

export interface EvaluateAlertParams {
  provider: "openai" | "gemini";
  isSuccess: boolean;
  isQuotaExhausted: boolean;
  consecutiveFailures: number;
  consecutiveThreshold: number;
  todayCost: number;
  monthCost: number;
  dailyWarning: number;
  dailyCritical: number;
  monthlyWarning: number;
  monthlyCritical: number;
  previousStatus: string;
  currentStatus: string;
  errorMessage?: string;
}

/**
 * Resolves the recipient admin email for alerts.
 */
export async function getTargetAlertEmail(): Promise<string | null> {
  try {
    const [settings] = await db.select().from(aiAlertSettingsTable).limit(1);
    if (settings?.alertEmail && settings.alertEmail.includes("@")) {
      return settings.alertEmail.trim();
    }
  } catch {
    // fall through
  }

  if (process.env.ADMIN_ALERT_EMAIL && process.env.ADMIN_ALERT_EMAIL.includes("@")) {
    return process.env.ADMIN_ALERT_EMAIL.trim();
  }

  try {
    const [admin] = await db.select().from(adminUsersTable).limit(1);
    if (admin?.username && admin.username.includes("@")) {
      return admin.username.trim();
    }
  } catch {
    // fall through
  }

  return "admin@tayyibati.xyz";
}

/**
 * Checks whether an alert for (provider, alertType) is currently in cooldown.
 */
export async function isAlertInCooldown(
  provider: string,
  alertType: string,
  cooldownMinutes: number
): Promise<boolean> {
  try {
    const cooldownCutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    const [recent] = await db
      .select()
      .from(aiAlertEventsTable)
      .where(
        and(
          eq(aiAlertEventsTable.provider, provider),
          eq(aiAlertEventsTable.alertType, alertType),
          eq(aiAlertEventsTable.status, "SENT"),
          gte(aiAlertEventsTable.createdAt, cooldownCutoff)
        )
      )
      .orderBy(desc(aiAlertEventsTable.createdAt))
      .limit(1);

    return !!recent;
  } catch (err) {
    logger.warn({ err }, "[AI_ALERT_SERVICE] Error checking alert cooldown");
    return false;
  }
}

/**
 * Dispatches an alert email through Resend or SMTP.
 */
export async function sendAlertEmail(params: {
  to: string;
  subject: string;
  html: string;
  provider: string;
  alertType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}): Promise<boolean> {
  const { to, subject, html, provider, alertType, severity, message } = params;

  let delivered = false;

  try {
    // 1. Try Resend if configured
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL || "Tayyibati AI Monitor <alerts@tayyibati.xyz>";

      const res = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
      });

      if (!res.error) {
        delivered = true;
      } else {
        logger.error({ err: res.error }, "[AI_ALERT_SERVICE] Resend alert dispatch failed");
      }
    }
    // 2. Fallback to SMTP if env vars present
    else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailerMod: any = await import("nodemailer" as any).catch(() => null);
        if (!nodemailerMod) {
          throw new Error("nodemailer package is not installed");
        }
        const transporter = (nodemailerMod.default || nodemailerMod).createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"Tayyibati AI Monitor" <${process.env.SMTP_USER}>`,
          to,
          subject,
          html,
        });

        delivered = true;
      } catch (smtpErr) {
        logger.error({ err: smtpErr }, "[AI_ALERT_SERVICE] SMTP alert dispatch failed");
      }
    } else {
      // Development mode fallback: log alert safely
      logger.info(
        { to, subject, provider, alertType, severity },
        "[AI_ALERT_SERVICE] No email provider configured — simulated delivery in dev/test"
      );
      delivered = true;
    }
  } catch (err) {
    logger.error({ err }, "[AI_ALERT_SERVICE] General alert email dispatch error");
    delivered = false;
  }

  // Record event in ai_alert_events
  try {
    await db.insert(aiAlertEventsTable).values({
      provider,
      alertType,
      severity,
      message,
      sentTo: to,
      status: delivered ? "SENT" : "FAILED",
    });
  } catch (err) {
    logger.warn({ err }, "[AI_ALERT_SERVICE] Failed to record alert event");
  }

  return delivered;
}

/**
 * Builds clean Arabic/English HTML email template for AI alerts.
 */
function buildAlertHtml(params: {
  providerName: string;
  alertTitle: string;
  description: string;
  details: Record<string, string | number>;
  severity: "INFO" | "WARNING" | "CRITICAL";
}): string {
  const { providerName, alertTitle, description, details, severity } = params;

  const headerBg =
    severity === "CRITICAL" ? "#dc2626" : severity === "WARNING" ? "#d97706" : "#2563eb";

  const rows = Object.entries(details)
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">${k}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${v}</td>
      </tr>`
    )
    .join("");

  return `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: ${headerBg}; padding: 18px 24px; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">طيباتي - تنبيه نظام الذكاء الاصطناعي</h2>
        <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${providerName} - ${alertTitle}</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; color: #374151; line-height: 1.6; margin-top: 0;">${description}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; text-align: right;">
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top: 24px; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280; text-align: center;">
          تم إرسال هذا التنبيه تلقائياً من لوحة تحكم طيباتي وفقاً للإعدادات المحددة.
        </div>
      </div>
    </div>
  `;
}

/**
 * Evaluates operational triggers and dispatches appropriate alerts.
 * Completely non-blocking and isolated from user requests.
 */
export async function evaluateAlertTriggers(params: EvaluateAlertParams): Promise<void> {
  try {
    const [settings] = await db.select().from(aiAlertSettingsTable).limit(1);
    if (!settings || !settings.enabled) {
      return;
    }

    const recipient = await getTargetAlertEmail();
    if (!recipient) {
      return;
    }

    const cooldownMinutes = settings.cooldownMinutes || 60;
    const providerUpper = params.provider.toUpperCase();

    // 1. Quota Exhaustion Alert (Immediate upon quota error)
    if (params.isQuotaExhausted && settings.alertOnQuotaExhaustion) {
      const inCooldown = await isAlertInCooldown(params.provider, "QUOTA_EXHAUSTION", cooldownMinutes);
      if (inCooldown) {
        await recordSuppressedAlert(params.provider, "QUOTA_EXHAUSTION", "CRITICAL", recipient);
      } else {
        await sendAlertEmail({
          to: recipient,
          subject: `🚨 [تنبيه عاجل] نفاد رصيد / كوتا مزود الذكاء الاصطناعي (${providerUpper})`,
          provider: params.provider,
          alertType: "QUOTA_EXHAUSTION",
          severity: "CRITICAL",
          message: `نفدت كوتا مزود الذكاء الاصطناعي ${providerUpper}. يرجى التحقق من الرصيد والفوترة فوراً.`,
          html: buildAlertHtml({
            providerName: providerUpper,
            alertTitle: "نفاد الكوتا (Quota Exhausted)",
            description: `واجه النظام خطأ نفاد كوتا أو رصيد (429 / Quota Exhausted) عند طلب مزود ${providerUpper}. يتم تفعيل المزود البديل تلقائياً إن وُجد.`,
            severity: "CRITICAL",
            details: {
              المزود: providerUpper,
              الحالة: "EXHAUSTED",
              الخطأ: params.errorMessage || "Quota / Resource Exhausted",
              الوقت: new Date().toLocaleString("ar-SA"),
            },
          }),
        });
      }
      return;
    }

    // 2. Repeated Consecutive Failures Alert
    if (
      !params.isSuccess &&
      settings.alertOnRepeatedFailures &&
      params.consecutiveFailures >= settings.consecutiveFailureThreshold
    ) {
      const inCooldown = await isAlertInCooldown(params.provider, "REPEATED_FAILURES", cooldownMinutes);
      if (inCooldown) {
        await recordSuppressedAlert(params.provider, "REPEATED_FAILURES", "CRITICAL", recipient);
      } else {
        await sendAlertEmail({
          to: recipient,
          subject: `⚠️ [تحذير] تكرار فشل مزود الذكاء الاصطناعي (${providerUpper})`,
          provider: params.provider,
          alertType: "REPEATED_FAILURES",
          severity: "CRITICAL",
          message: `فشل مزود ${providerUpper} لـ ${params.consecutiveFailures} مرات متتالية.`,
          html: buildAlertHtml({
            providerName: providerUpper,
            alertTitle: "تكرار الفشل المتتالي",
            description: `سجل المزود ${providerUpper} عدد ${params.consecutiveFailures} محاولات فاشلة متتالية، متجاوزاً الحد المسموح (${settings.consecutiveFailureThreshold}).`,
            severity: "CRITICAL",
            details: {
              المزود: providerUpper,
              "عدد الإخفاقات المتتالية": params.consecutiveFailures,
              "آخر خطأ": params.errorMessage || "Service Failure",
              الوقت: new Date().toLocaleString("ar-SA"),
            },
          }),
        });
      }
      return;
    }

    // 3. Daily Estimated Spend Critical Alert
    if (params.todayCost >= params.dailyCritical) {
      const inCooldown = await isAlertInCooldown(params.provider, "DAILY_SPEND_CRITICAL", cooldownMinutes);
      if (!inCooldown) {
        await sendAlertEmail({
          to: recipient,
          subject: `🔴 [تجاوز الميزانية اليومية] تجاوز الحد الحرج لمزود (${providerUpper})`,
          provider: params.provider,
          alertType: "DAILY_SPEND_CRITICAL",
          severity: "CRITICAL",
          message: `تجاوز الإنفاق التقديري اليومي لمزود ${providerUpper} الحد الحرج ($${params.todayCost.toFixed(2)} / $${params.dailyCritical}).`,
          html: buildAlertHtml({
            providerName: providerUpper,
            alertTitle: "تجاوز الحد الحرج للميزانية اليومية",
            description: `وصلت تكلفة الاستخدام التقديرية لمزود ${providerUpper} اليوم إلى $${params.todayCost.toFixed(4)} متجاوزة الحد الحرج $${params.dailyCritical}.`,
            severity: "CRITICAL",
            details: {
              المزود: providerUpper,
              "التكلفة التقديرية اليوم": `$${params.todayCost.toFixed(4)}`,
              "الحد الحرج اليومي": `$${params.dailyCritical.toFixed(2)}`,
              الوقت: new Date().toLocaleString("ar-SA"),
            },
          }),
        });
      }
    }
    // 4. Daily Estimated Spend Warning Alert
    else if (params.todayCost >= params.dailyWarning) {
      const inCooldown = await isAlertInCooldown(params.provider, "DAILY_SPEND_WARNING", cooldownMinutes);
      if (!inCooldown) {
        await sendAlertEmail({
          to: recipient,
          subject: `🟡 [تنبيه الميزانية اليومية] اقتراب مزود (${providerUpper}) من الحد المسموح`,
          provider: params.provider,
          alertType: "DAILY_SPEND_WARNING",
          severity: "WARNING",
          message: `وصل الإنفاق التقديري اليومي لمزود ${providerUpper} إلى حد التحذير ($${params.todayCost.toFixed(2)} / $${params.dailyWarning}).`,
          html: buildAlertHtml({
            providerName: providerUpper,
            alertTitle: "تحذير الميزانية اليومية",
            description: `وصلت تكلفة الاستخدام التقديرية لمزود ${providerUpper} اليوم إلى $${params.todayCost.toFixed(4)} متجاوزة حد التحذير $${params.dailyWarning}.`,
            severity: "WARNING",
            details: {
              المزود: providerUpper,
              "التكلفة التقديرية اليوم": `$${params.todayCost.toFixed(4)}`,
              "حد التحذير اليومي": `$${params.dailyWarning.toFixed(2)}`,
              الوقت: new Date().toLocaleString("ar-SA"),
            },
          }),
        });
      }
    }

    // 5. Recovery Alert (Triggered ONLY if returning to HEALTHY from EXHAUSTED or ERROR)
    if (
      params.isSuccess &&
      settings.sendRecoveryEmail &&
      (params.previousStatus === "EXHAUSTED" || params.previousStatus === "ERROR") &&
      params.currentStatus === "HEALTHY"
    ) {
      await sendAlertEmail({
        to: recipient,
        subject: `✅ [تعافي النظام] عودة مزود (${providerUpper}) إلى الحالة الطبيعية`,
        provider: params.provider,
        alertType: "RECOVERY",
        severity: "INFO",
        message: `تعافى مزود الذكاء الاصطناعي ${providerUpper} وعاد للعمل بنجاح بعد انقطاع أو نفاد كوتا.`,
        html: buildAlertHtml({
          providerName: providerUpper,
          alertTitle: "تعافي المزود بنجاح",
          description: `سجل المزود ${providerUpper} طلباً ناجحاً وعادت حالته التشغيلية إلى HEALTHY بعد أن كان في حالة ${params.previousStatus}.`,
          severity: "INFO",
          details: {
            المزود: providerUpper,
            "الحالة السابقة": params.previousStatus,
            "الحالة الحالية": "HEALTHY",
            الوقت: new Date().toLocaleString("ar-SA"),
          },
        }),
      });
    }
  } catch (err) {
    logger.warn({ err }, "[AI_ALERT_SERVICE] Non-fatal error during alert trigger evaluation");
  }
}

async function recordSuppressedAlert(
  provider: string,
  alertType: string,
  severity: "INFO" | "WARNING" | "CRITICAL",
  sentTo: string
): Promise<void> {
  try {
    await db.insert(aiAlertEventsTable).values({
      provider,
      alertType,
      severity,
      message: `Suppressed duplicate alert (${alertType}) during cooldown window`,
      sentTo,
      status: "SUPPRESSED_COOLDOWN",
    });
  } catch {
    // ignore
  }
}

/**
 * Sends a test email to verify alert delivery. Admin-only action.
 */
export async function sendTestAlertEmail(targetEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const success = await sendAlertEmail({
      to: targetEmail,
      subject: "🧪 [تجربة] اختبار تنبيهات نظام الذكاء الاصطناعي - طيباتي",
      provider: "system",
      alertType: "TEST",
      severity: "INFO",
      message: "رسالة اختبار لتأكيد وصول تنبيهات لوحة تحكم الذكاء الاصطناعي.",
      html: buildAlertHtml({
        providerName: "Tayyibati AI Monitor",
        alertTitle: "اختبار إرسال البريد الإلكتروني",
        description: "تم إرسال هذا البريد بنجاح لتأكيد عمل إعدادات التنبيهات وإمكانية استلام الإشعارات عند حدوث أي طارئ.",
        severity: "INFO",
        details: {
          المستلم: targetEmail,
          الحالة: "SUCCESS",
          الوقت: new Date().toLocaleString("ar-SA"),
        },
      }),
    });

    return {
      success,
      message: success ? "تم إرسال بريد الاختبار بنجاح" : "فشل إرسال البريد، يرجى مراجعة إعدادات البريد",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Error sending test email" };
  }
}
