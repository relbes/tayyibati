import AsyncStorage from "@react-native-async-storage/async-storage";

import { REMINDER_COOLDOWN_MS, shouldShowUpdatePromptPure } from "./versionUtils";
export { REMINDER_COOLDOWN_MS };

export const STORAGE_DISMISSED_VERSION_KEY = "@tayyibati_update_dismissed_version";
export const STORAGE_DISMISSED_TIME_KEY = "@tayyibati_update_dismissed_time";

export interface UpdateDismissalState {
  dismissedVersion: string | null;
  dismissedTime: number | null;
}

/**
 * Checks whether an update prompt should be presented to the user
 * according to the reminder and dismissal policy.
 */
export async function shouldShowUpdatePrompt(latestVersion: string): Promise<boolean> {
  if (!latestVersion) return false;

  try {
    const [storedVersion, storedTimeStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_DISMISSED_VERSION_KEY),
      AsyncStorage.getItem(STORAGE_DISMISSED_TIME_KEY),
    ]);

    return shouldShowUpdatePromptPure(storedVersion, storedTimeStr, latestVersion);
  } catch {
    // If storage read fails, default to showing the prompt safely
    return true;
  }
}

/**
 * Records that the user dismissed the update prompt for the specified version.
 */
export async function dismissUpdate(latestVersion: string): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_DISMISSED_VERSION_KEY, latestVersion),
      AsyncStorage.setItem(STORAGE_DISMISSED_TIME_KEY, Date.now().toString()),
    ]);
  } catch {
    // Non-blocking
  }
}

/**
 * Clears stored dismissal state (useful for manual update checks or tests).
 */
export async function resetUpdateDismissal(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_DISMISSED_VERSION_KEY),
      AsyncStorage.removeItem(STORAGE_DISMISSED_TIME_KEY),
    ]);
  } catch {
    // Non-blocking
  }
}
