import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import { BASE_URL } from "./api";

import {
  AppVersionInfo,
  parseVersionParts,
  compareVersions,
  isNewerVersion,
  resolveStoreUrls,
} from "./versionUtils";

export {
  AppVersionInfo,
  parseVersionParts,
  compareVersions,
  isNewerVersion,
  resolveStoreUrls,
};

/**
 * Returns the currently installed app version from Expo constants.
 */
export function getInstalledVersion(): string {
  return (
    Constants.expoConfig?.version ||
    (Constants as any).nativeAppVersion ||
    "1.0.5"
  );
}

/**
 * Fetches version metadata from the configurable update endpoint with timeout and error handling.
 * Returns null if network is unavailable, offline, or request fails. Never throws.
 */
export async function fetchLatestVersionInfo(options?: {
  timeoutMs?: number;
  simulatedVersion?: string;
}): Promise<AppVersionInfo | null> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const queryParam = options?.simulatedVersion
      ? `?simulatedVersion=${encodeURIComponent(options.simulatedVersion)}`
      : "";
    const endpoint = `${BASE_URL}/api/app-version${queryParam}`;

    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data || typeof data.latestVersion !== "string") {
      return null;
    }

    const installedVersion = getInstalledVersion();
    // Rule 8: If installed version is newer than or equal to published version, no update available
    const isUpdateAvailable = compareVersions(data.latestVersion, installedVersion) > 0;

    return {
      latestVersion: data.latestVersion,
      minVersion: data.minVersion,
      installedVersion,
      isUpdateAvailable,
      releaseNotes: data.releaseNotes,
      android: data.android,
      ios: data.ios,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Opens the appropriate platform store listing for Tayyibati.
 * Gracefully handles failures without throwing errors.
 */
export async function openStoreListing(versionInfo?: AppVersionInfo | null): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      const packageId = versionInfo?.android?.packageId || "com.tayyibati.app";
      const marketUrl = versionInfo?.android?.marketUrl || `market://details?id=${packageId}`;
      const webUrl =
        versionInfo?.android?.storeUrl ||
        `https://play.google.com/store/apps/details?id=${packageId}`;

      const canOpenMarket = await Linking.canOpenURL(marketUrl).catch(() => false);
      if (canOpenMarket) {
        await Linking.openURL(marketUrl);
        return true;
      }
      await Linking.openURL(webUrl);
      return true;
    } else if (Platform.OS === "ios") {
      const iosUrl =
        versionInfo?.ios?.storeUrl ||
        "https://apps.apple.com/search?term=tayyibati";
      await Linking.openURL(iosUrl);
      return true;
    } else {
      // Web or fallback
      const webUrl =
        versionInfo?.android?.storeUrl ||
        "https://play.google.com/store/apps/details?id=com.tayyibati.app";
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (err) {
    console.warn("[AppUpdateService] Failed to open store link:", err);
    return false;
  }
}
