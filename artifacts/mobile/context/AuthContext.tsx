import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerUser, loginUser, getUser, setSessionToken } from "@/lib/api";
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, name: string, opts?: { provider?: "email" | "google"; avatar?: string; id?: string }) => Promise<void>;
  registerWithPassword: (email: string, name: string, password: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePremium: (isPremium: boolean) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = "tayyibati_user_v2";
const TOKEN_KEY = "tayyibati_session_token";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(TOKEN_KEY),
    ])
      .then(([userData, token]) => {
        if (token) setSessionToken(token);
        if (userData) {
          try {
            setUser(JSON.parse(userData));
          } catch {
            AsyncStorage.removeItem(USER_KEY);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (u: User, token?: string) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setSessionToken(token);
    }
    setUser(u);
  }, []);

  const signIn = useCallback(async (
    email: string,
    name: string,
    opts?: { provider?: "email" | "google"; avatar?: string; id?: string }
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
  }, [persist]);

  const registerWithPassword = useCallback(async (email: string, name: string, password: string) => {
    const api: ApiUser = await registerUser({ email, name, password });
    await persist(toUser(api), api.token);
    loginRevenueCat(api.id);
  }, [persist]);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const api: ApiUser = await loginUser({ email, password });
    await persist(toUser(api), api.token);
    loginRevenueCat(api.id);
  }, [persist]);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
    setSessionToken(null);
    setUser(null);
  }, []);

  const updatePremium = useCallback((isPremium: boolean) => {
    if (!user) return;
    const updated = { ...user, isPremium };
    setUser(updated);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const api = await getUser(user.id);
      await persist(toUser(api));
    } catch {
      // keep current state on failure
    }
  }, [user, persist]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, registerWithPassword, loginWithPassword, signOut, updatePremium, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
