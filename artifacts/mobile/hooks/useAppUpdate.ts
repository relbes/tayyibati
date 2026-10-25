export { useAppUpdate, type AppUpdateContextValue } from "@/context/AppUpdateContext";
export {
  fetchLatestVersionInfo,
  openStoreListing,
  compareVersions,
  getInstalledVersion,
  type AppVersionInfo,
} from "@/lib/appUpdateService";
export {
  shouldShowUpdatePrompt,
  dismissUpdate,
  resetUpdateDismissal,
  REMINDER_COOLDOWN_MS,
} from "@/lib/appUpdatePolicy";
