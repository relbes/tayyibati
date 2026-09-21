/**
 * Arabic date formatting utilities for Tayyibati subscriptions.
 * Formats dates in the user's local timezone with clean Arabic month names
 * and accurate singular/dual/plural rules.
 */

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/**
 * Format an ISO string or Date into standard Arabic date (e.g. "20 أكتوبر 2026").
 */
export function formatArabicDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  const day = d.getDate();
  const month = ARABIC_MONTHS[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Calculate remaining days until expiration and format with accurate Arabic rules:
 * - 0 days: "اليوم"
 * - 1 day: "متبقي يوم واحد"
 * - 2 days: "متبقي يومان"
 * - 3 to 10 days: "متبقي X أيام"
 * - 11+ days: "متبقي X يوماً"
 */
export function formatRemainingDays(expirationDate: string | Date | null | undefined): string {
  if (!expirationDate) return "";
  const exp = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;
  if (isNaN(exp.getTime())) return "";

  const now = new Date();
  const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = expDay.getTime() - nowDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "اليوم";
  if (diffDays === 1) return "متبقي يوم واحد";
  if (diffDays === 2) return "متبقي يومان";
  if (diffDays >= 3 && diffDays <= 10) return `متبقي ${diffDays} أيام`;
  return `متبقي ${diffDays} يوماً`;
}

/**
 * Returns raw number of remaining days (negative if expired).
 */
export function getRemainingDaysCount(expirationDate: string | Date | null | undefined): number | null {
  if (!expirationDate) return null;
  const exp = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;
  if (isNaN(exp.getTime())) return null;

  const now = new Date();
  const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((expDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));
}
