import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  registerUser,
  loginUser,
  getUser,
  getCurrentUser,
  getUserUsage,
  setSessionToken,
} from "@/lib/api";
import { loginRevenueCat } from "@/lib/revenuecat";

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  provider?: "email" | "google";
  avatar?: string;
  planId?: number | null;
}

export interface UserUsageInfo {
  monthlyTextCount: number;
  monthlyImageCount: number;
  textLimit: number;
  imageLimit: number;
  textRemaining: number;
  imageRemaining: number;
  isPremium: boolean;
}

interface AuthContextType {
  user: User | null;
  usage: UserUsageInfo | null;
  isLoading: boolean;

  signIn: (
    email: string,
    name: string,
    opts?: {
      provider?: "email" | "google";
      avatar?: string;
      id?: string;
    }
  ) => Promise<void>;

  registerWithPassword: (
    email: string,
    name: string,
    password: string
  ) => Promise<void>;

  loginWithPassword: (
    email: string,
    password: string
  ) => Promise<void>;

  signOut: () => Promise<void>;

  updatePremium: (isPremium: boolean) => void;

  refreshUser: () => Promise<void>;
  refreshUsage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = "tayyibati_user_v2";
const TOKEN_KEY = "tayyibati_session_token";

/**
 * How often the mobile app checks the server for changes
 * to the user's plan/premium status.
 *
 * 60 seconds means:
 *
 * Admin changes Free -> Premium
 *        ↓
 * Mobile detects it within max ~60 seconds
 *        ↓
 * User becomes Premium without logout/login
 */
const PREMIUM_SYNC_INTERVAL = 60 * 1000;

interface ApiUser {
  id: string;
  email: string;
  name: string;
  isPremium: string;
  provider?: "email" | "google";
  avatar?: string | null;
  planId?: number | null;
  token?: string;
}

function toUser(api: ApiUser): User {
  return {
    id: api.id,
    email: api.email,
    name: api.name,
    isPremium: api.isPremium === "true",
    provider: api.provider ?? "email",
    ...(api.avatar ? { avatar: api.avatar } : {}),
    planId: api.planId ?? null,
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<UserUsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshingRef = useRef(false);

  /**
   * Refresh usage information from the API.
   *
   * The server determines:
   * - monthly usage
   * - text limits
   * - image limits
   * - premium status
   */
  const refreshUsage = useCallback(async () => {
    try {
      const currentUsage = await getUserUsage();

      setUsage(currentUsage);
    } catch {
      // Keep the existing usage state if the request fails.
    }
  }, []);

  /**
   * Refresh the authenticated user's information from the API.
   *
   * SERVER IS THE SOURCE OF TRUTH.
   *
   * This updates:
   * - isPremium
   * - planId
   * - name
   * - email
   * - provider
   * - avatar
   *
   * Then usage/limits are refreshed as well.
   */
const refreshUser = useCallback(async () => {
  if (isRefreshingRef.current) {
    return;
  }
  isRefreshingRef.current = true;

  try {
    const storedUser = await AsyncStorage.getItem(USER_KEY);
    if (!storedUser) {
      return;
    }

    const currentUser: User = JSON.parse(storedUser);
    if (!currentUser?.id) {
      return;
    }

    const apiUser: ApiUser = await getCurrentUser();
    const updatedUser = toUser(apiUser);

    const hasChanged =
      currentUser.isPremium !== updatedUser.isPremium ||
      currentUser.planId !== updatedUser.planId ||
      currentUser.name !== updatedUser.name ||
      currentUser.email !== updatedUser.email ||
      currentUser.avatar !== updatedUser.avatar;

    if (hasChanged) {
      setUser(updatedUser);
      await AsyncStorage.setItem(
        USER_KEY,
        JSON.stringify(updatedUser)
      );

      await refreshUsage();
    }
  } catch (error) {
    console.error("[Auth] User sync failed:", error);
  } finally {
    isRefreshingRef.current = false;
  }
}, [refreshUsage]);
  /**
   * Restore the local session when the app starts.
   */
  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(TOKEN_KEY),
    ])
      .then(async ([userData, token]) => {
        if (!mounted) return;

        if (token) {
          setSessionToken(token);
        }

        if (userData) {
          try {
            const storedUser: User = JSON.parse(userData);

            if (mounted) {
              setUser(storedUser);
            }

            /**
             * Immediately verify the cached user
             * against the server.
             *
             * This handles changes made while
             * the application was closed.
             */
            await refreshUser();
          } catch {
            await AsyncStorage.removeItem(USER_KEY);
          }
        }
      })
      .catch(() => {
        // Ignore session restoration errors.
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  /**
   * Refresh usage whenever the authenticated user changes.
   */
  useEffect(() => {
    if (!user) {
      setUsage(null);
      return;
    }

    refreshUsage();
  }, [user, refreshUsage]);

  /**
   * FOREGROUND SYNCHRONIZATION
   *
   * Whenever the app comes back to the foreground,
   * immediately check the server.
   *
   * Example:
   *
   * Admin:
   *     Free -> Premium
   *
   * User:
   *     leaves Tayyibati / opens another app
   *
   * User:
   *     returns to Tayyibati
   *
   * Result:
   *     Premium status is refreshed immediately.
   */
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const handleAppStateChange = (
      nextState: AppStateStatus
    ) => {
      if (nextState === "active") {
        console.log("[Auth] App became ACTIVE -> refreshing user");
        refreshUser();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [user?.id, refreshUser]);

  /**
   * PERIODIC SYNCHRONIZATION
   *
   * This handles the important case where:
   *
   * - Tayyibati remains open
   * - User remains on the screen
   * - Admin changes the user's plan
   *
   * The app will detect the change automatically.
   */
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const interval = setInterval(() => {
      refreshUser();
    }, PREMIUM_SYNC_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id, refreshUser]);

  /**
   * Persist a user and optionally its authentication token.
   */
  const persist = useCallback(
    async (u: User, token?: string) => {
      await AsyncStorage.setItem(
        USER_KEY,
        JSON.stringify(u)
      );

      if (token) {
        await AsyncStorage.setItem(
          TOKEN_KEY,
          token
        );

        setSessionToken(token);
      }

      setUser(u);
    },
    []
  );

  /**
   * Social / normal registration.
   */
  const signIn = useCallback(
    async (
      email: string,
      name: string,
      opts?: {
        provider?: "email" | "google";
        avatar?: string;
        id?: string;
      }
    ) => {
      const api: ApiUser = await registerUser({
        email,
        name,
        provider: opts?.provider ?? "email",
        avatar: opts?.avatar,
        id: opts?.id,
      });

      await persist(toUser(api), api.token);

      loginRevenueCat(api.id);

      /**
       * Load latest server state.
       */
      await refreshUser();
    },
    [persist, refreshUser]
  );

  /**
   * Register with email/password.
   */
  const registerWithPassword = useCallback(
    async (
      email: string,
      name: string,
      password: string
    ) => {
      const api: ApiUser = await registerUser({
        email,
        name,
        password,
      });

      await persist(toUser(api), api.token);

      loginRevenueCat(api.id);

      await refreshUser();
    },
    [persist, refreshUser]
  );

  /**
   * Login with email/password.
   */
  const loginWithPassword = useCallback(
    async (
      email: string,
      password: string
    ) => {
      const api: ApiUser = await loginUser({
        email,
        password,
      });

      await persist(toUser(api), api.token);

      loginRevenueCat(api.id);

      await refreshUser();
    },
    [persist, refreshUser]
  );

  /**
   * Sign out.
   */
  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([
      USER_KEY,
      TOKEN_KEY,
    ]);

    setSessionToken(null);
    setUser(null);
    setUsage(null);
  }, []);

  /**
   * Local premium update.
   *
   * Kept for compatibility with existing code.
   *
   * IMPORTANT:
   * The server remains the source of truth.
   */
  const updatePremium = useCallback(
    (isPremium: boolean) => {
      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const updatedUser = {
          ...currentUser,
          isPremium,
        };

        AsyncStorage.setItem(
          USER_KEY,
          JSON.stringify(updatedUser)
        ).catch(() => {});

        return updatedUser;
      });

      setUsage((currentUsage) => {
        if (!currentUsage) {
          return currentUsage;
        }

        return {
          ...currentUsage,
          isPremium,
        };
      });
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        usage,
        isLoading,
        signIn,
        registerWithPassword,
        loginWithPassword,
        signOut,
        updatePremium,
        refreshUser,
        refreshUsage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
}