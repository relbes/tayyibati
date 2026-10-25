import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  AppVersionInfo,
  fetchLatestVersionInfo,
  openStoreListing,
} from "@/lib/appUpdateService";
import {
  shouldShowUpdatePrompt,
  dismissUpdate,
} from "@/lib/appUpdatePolicy";
import { AppUpdateDialog } from "@/components/AppUpdateDialog";

export interface AppUpdateContextValue {
  versionInfo: AppVersionInfo | null;
  isChecking: boolean;
  isDialogVisible: boolean;
  checkForUpdates: (options?: { forcePrompt?: boolean; simulatedVersion?: string }) => Promise<AppVersionInfo | null>;
  promptUpdate: () => void;
  dismissPrompt: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextValue | undefined>(undefined);

// Throttle foreground checks to once every 15 minutes
const FOREGROUND_CHECK_THROTTLE_MS = 15 * 60 * 1000;

export function AppUpdateProvider({ children }: { children: React.ReactNode }) {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  // Concurrency lock to prevent duplicate simultaneous requests
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkForUpdates = useCallback(
    async (options?: { forcePrompt?: boolean; simulatedVersion?: string }): Promise<AppVersionInfo | null> => {
      // Prevent duplicate concurrent requests
      if (isCheckingRef.current) {
        return versionInfo;
      }

      isCheckingRef.current = true;
      setIsChecking(true);
      lastCheckTimeRef.current = Date.now();

      try {
        const info = await fetchLatestVersionInfo({
          simulatedVersion: options?.simulatedVersion,
        });

        if (info) {
          setVersionInfo(info);

          if (info.isUpdateAvailable) {
            // Check reminder & dismissal policy
            const shouldShow = options?.forcePrompt || (await shouldShowUpdatePrompt(info.latestVersion));
            if (shouldShow) {
              setIsDialogVisible(true);
            }
          } else {
            setIsDialogVisible(false);
          }
        }
        return info;
      } catch {
        return null;
      } finally {
        isCheckingRef.current = false;
        setIsChecking(false);
      }
    },
    [versionInfo]
  );

  // Check on initial app mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  // Check on app returning to foreground from background/inactive
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      const isReturningToForeground =
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active";

      if (isReturningToForeground) {
        const now = Date.now();
        const elapsed = now - lastCheckTimeRef.current;
        if (elapsed >= FOREGROUND_CHECK_THROTTLE_MS) {
          checkForUpdates();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkForUpdates]);

  const handleUpdate = useCallback(async () => {
    if (versionInfo) {
      await openStoreListing(versionInfo);
    }
  }, [versionInfo]);

  const handleDismiss = useCallback(async () => {
    setIsDialogVisible(false);
    if (versionInfo?.latestVersion) {
      await dismissUpdate(versionInfo.latestVersion);
    }
  }, [versionInfo]);

  const promptUpdate = useCallback(() => {
    if (versionInfo?.isUpdateAvailable) {
      setIsDialogVisible(true);
    }
  }, [versionInfo]);

  const dismissPrompt = useCallback(() => {
    handleDismiss();
  }, [handleDismiss]);

  return (
    <AppUpdateContext.Provider
      value={{
        versionInfo,
        isChecking,
        isDialogVisible,
        checkForUpdates,
        promptUpdate,
        dismissPrompt,
      }}
    >
      {children}

      {/* Global Native Update Dialog */}
      {versionInfo && (
        <AppUpdateDialog
          visible={isDialogVisible}
          latestVersion={versionInfo.latestVersion}
          installedVersion={versionInfo.installedVersion}
          releaseNotes={versionInfo.releaseNotes}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />
      )}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate(): AppUpdateContextValue {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error("useAppUpdate must be used within an AppUpdateProvider");
  }
  return context;
}
