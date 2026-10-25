export interface AppVersionInfo {
  latestVersion: string;
  minVersion?: string;
  installedVersion: string;
  isUpdateAvailable: boolean;
  releaseNotes?: string;
  android?: {
    packageId: string;
    storeUrl: string;
    marketUrl: string;
  };
  ios?: {
    bundleId: string;
    storeUrl: string;
    appId?: string | null;
  };
}

/**
 * Normalizes and extracts semantic version parts (e.g. "1.0.5" -> [1, 0, 5]).
 */
export function parseVersionParts(versionStr: string): number[] {
  if (!versionStr || typeof versionStr !== "string") return [0];
  const cleaned = versionStr.replace(/^v/i, "").trim().split(/[-+]/)[0];
  return cleaned.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compares two semantic version strings (e.g. "1.0.6" vs "1.0.5").
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v1 is older)
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = parseVersionParts(v1);
  const parts2 = parseVersionParts(v2);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks whether an update is available:
 * Returns true strictly if published version > installed version.
 * If installed >= published, returns false (Requirement 8).
 */
export function isNewerVersion(latestVersion: string, installedVersion: string): boolean {
  return compareVersions(latestVersion, installedVersion) > 0;
}

// 24 hours cooldown for reminding about the same dismissed version
export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Pure policy check: decides whether the update prompt should be displayed.
 * - Always shows if no previous dismissal exists.
 * - Always shows if latestVersion differs from the previously dismissed version (newer release).
 * - Shows if 24 hours have elapsed since dismissal of this version.
 * - Suppresses if within 24 hours of dismissal of the same version.
 */
export function shouldShowUpdatePromptPure(
  storedVersion: string | null | undefined,
  storedTimeStr: string | null | undefined,
  latestVersion: string,
  now: number = Date.now()
): boolean {
  if (!latestVersion) return false;
  if (!storedVersion || !storedTimeStr) return true;
  if (storedVersion !== latestVersion) return true; // A newer version has been released!

  const dismissedTime = parseInt(storedTimeStr, 10);
  if (isNaN(dismissedTime)) return true;

  return now - dismissedTime >= REMINDER_COOLDOWN_MS;
}

/**
 * Pure URL resolver for store listings across platforms.
 */
export function resolveStoreUrls(
  versionInfo?: AppVersionInfo | null,
  platform: "android" | "ios" | "web" | "windows" | "macos" = "android"
) {
  if (platform === "android") {
    const packageId = versionInfo?.android?.packageId || "com.tayyibati.app";
    const marketUrl = versionInfo?.android?.marketUrl || `market://details?id=${packageId}`;
    const storeUrl =
      versionInfo?.android?.storeUrl ||
      `https://play.google.com/store/apps/details?id=${packageId}`;
    return {
      packageId,
      marketUrl,
      storeUrl,
      primaryUrl: marketUrl,
    };
  } else if (platform === "ios") {
    const bundleId = versionInfo?.ios?.bundleId || "com.tayyibati.app";
    const storeUrl =
      versionInfo?.ios?.storeUrl ||
      "https://apps.apple.com/search?term=tayyibati";
    return {
      packageId: bundleId,
      marketUrl: null,
      storeUrl,
      primaryUrl: storeUrl,
    };
  } else {
    const storeUrl =
      versionInfo?.android?.storeUrl ||
      "https://play.google.com/store/apps/details?id=com.tayyibati.app";
    return {
      packageId: "com.tayyibati.app",
      marketUrl: null,
      storeUrl,
      primaryUrl: storeUrl,
    };
  }
}

